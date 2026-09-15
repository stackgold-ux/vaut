// vault-key — Supabase Edge Function (Deno)
//
// Serves two actions for the recoverable (Option B) key hierarchy:
//
//   action: "setup"
//     Input:  { action: "setup", recoveryKeyB64: string }
//     Output: { recoveryKeyEncrypted: { iv: string, data: string } }
//     Encrypts the client-generated recovery key under a per-user server key derived
//     from SUPABASE_SECRET_KEY + the authenticated user's id (HKDF-SHA256).
//
//   action: "recover"
//     Input:  { action: "recover", ephemeralWrapKeyB64: string }
//     Output: { ewkWrappedVmk: { iv: string, data: string } }
//     Unwraps the VMK with the recovery key, then re-wraps it under the client's
//     single-use ephemeral wrap key so the raw VMK never crosses the wire.
//
// Both actions require a valid Supabase auth JWT (Authorization: Bearer ...).
// The function runs with the service-role key, so it can read `profiles` regardless
// of RLS.

// @ts-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2';

interface EncryptedBlob {
  iv: string;
  data: string;
}

const AES_GCM_TAG_LENGTH = 128;
const IV_LENGTH = 12;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptBytes(data: Uint8Array, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: AES_GCM_TAG_LENGTH },
    key,
    data as BufferSource
  );
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ciphertext)) };
}

async function decryptBytes(blob: EncryptedBlob, key: CryptoKey): Promise<Uint8Array> {
  const iv = b64ToBytes(blob.iv);
  const data = b64ToBytes(blob.data);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: AES_GCM_TAG_LENGTH },
    key,
    data as BufferSource
  );
  return new Uint8Array(plaintext);
}

/** Per-user server recovery key derived from the service-role secret + user id. */
async function deriveServerKey(userId: string): Promise<CryptoKey> {
  const secret = Deno.env.get('SUPABASE_SECRET_KEY');
  if (!secret) throw new Error('SUPABASE_SECRET_KEY is not set');
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey']
  );
  const salt = new TextEncoder().encode(userId);
  const info = new TextEncoder().encode('stack-your-vault-recovery-v1');
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function importRawAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json({}, 204);
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY');
    if (!url || !serviceKey) throw new Error('Supabase env vars are not set');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, '');

    const sb = createClient(url, serviceKey);
    const { data: userData, error: userError } = await sb.auth.getUser(jwt);
    if (userError || !userData.user) {
      return json({ error: 'Invalid or expired token' }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json();
    const action = body.action;
    const serverKey = await deriveServerKey(userId);

    if (action === 'setup') {
      const recoveryKeyB64 = body.recoveryKeyB64 as string;
      if (!recoveryKeyB64) return json({ error: 'recoveryKeyB64 is required' }, 400);
      const recoveryKey = await importRawAesKey(b64ToBytes(recoveryKeyB64));
      const recoveryKeyEncrypted = await encryptBytes(
        new Uint8Array(await crypto.subtle.exportKey('raw', recoveryKey)),
        serverKey
      );
      return json({ recoveryKeyEncrypted });
    }

    if (action === 'recover') {
      const ephemeralWrapKeyB64 = body.ephemeralWrapKeyB64 as string;
      if (!ephemeralWrapKeyB64) return json({ error: 'ephemeralWrapKeyB64 is required' }, 400);

      const { data: profile, error: profileError } = await sb
        .from('profiles')
        .select('recovery_key_encrypted, recovery_wrapped_vmk, needs_rekey')
        .eq('id', userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return json({ error: 'No profile found' }, 404);

      // Decrypt the recovery key with the server key, then unwrap the VMK.
      const recoveryKeyEncrypted = JSON.parse(profile.recovery_key_encrypted) as EncryptedBlob;
      const recoveryRaw = await decryptBytes(recoveryKeyEncrypted, serverKey);
      const recoveryKey = await importRawAesKey(recoveryRaw);

      const recoveryWrapped = JSON.parse(profile.recovery_wrapped_vmk) as EncryptedBlob;
      const vmkRaw = await decryptBytes(recoveryWrapped, recoveryKey);
      const vmk = await importRawAesKey(vmkRaw);

      // Re-wrap the VMK under the client's ephemeral wrap key.
      const ewk = await importRawAesKey(b64ToBytes(ephemeralWrapKeyB64));
      const ewkWrappedVmk = await encryptBytes(
        new Uint8Array(await crypto.subtle.exportKey('raw', vmk)),
        ewk
      );

      return json({ ewkWrappedVmk });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
