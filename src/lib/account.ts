/**
 * account.ts — auth + key-management service layer (Option B, recoverable accounts).
 *
 * Public API consumed by the frontend:
 *   signUp(email, password)   — create account + keys + profile
 *   signIn(email, password)   — authenticate and unwrap the VMK
 *   signOut()                 — end the Supabase session
 *   resetPassword(email)      — trigger the recovery email
 *   recoverKey(newPassword)   — after a reset, recover the VMK via the edge function
 *   getCurrentUserId()        — resolve the logged-in user id (null if none)
 *
 * The VMK lives only in memory (a `CryptoKey`) once unlocked; it is never persisted
 * raw. It is wrapped under the password-derived KEK and under a server-recoverable
 * recovery key (see `supabase/functions/vault-key/index.ts`).
 */

import { getSupabase } from './supabase';
import {
  type EncryptedBlob,
  bytesToB64,
  b64ToBytes,
  generateVaultMasterKey,
  generateRecoveryKey,
  generateEphemeralWrapKey,
  generateSalt,
  deriveKek,
  wrapKey,
  unwrapKey,
} from './keyManagement';

/** Result of a successful sign-in / sign-up / recovery: the user id + in-memory VMK. */
export interface AccountSession {
  userId: string;
  vmk: CryptoKey;
}

/** A `profiles` row as stored in Supabase (all blobs are base64 / JSON strings). */
export interface ProfileRow {
  id: string;
  kdf_salt: string;
  password_wrapped_vmk: string;
  recovery_wrapped_vmk: string;
  recovery_key_encrypted: string;
  needs_rekey: boolean;
  created_at?: string;
  updated_at?: string;
}

/** JSON-serialized form of an {@link EncryptedBlob} as stored in a text column. */
function blobToJson(blob: EncryptedBlob): string {
  return JSON.stringify(blob);
}

function jsonToBlob(json: string): EncryptedBlob {
  return JSON.parse(json) as EncryptedBlob;
}

async function exportRawB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bytesToB64(new Uint8Array(raw));
}

/** Current Supabase auth user id, or null if no session. */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser();
  return data.user?.id ?? null;
}

export async function signUp(email: string, password: string): Promise<AccountSession> {
  const sb = getSupabase();

  const { data: authData, error: authError } = await sb.auth.signUp({ email, password });
  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error('Sign up did not return a user.');

  // Generate the key hierarchy.
  const vmk = await generateVaultMasterKey();
  const recoveryKey = await generateRecoveryKey();
  const salt = generateSalt();
  const kek = await deriveKek(password, salt);

  const passwordWrapped = await wrapKey(vmk, kek);
  const recoveryWrapped = await wrapKey(vmk, recoveryKey);

  // Ask the edge function to encrypt the recovery key with the server-held key.
  const recoveryKeyB64 = await exportRawB64(recoveryKey);
  const { data: fnData, error: fnError } = await sb.functions.invoke('vault-key', {
    body: { action: 'setup', recoveryKeyB64 },
  });
  if (fnError) throw new Error(`Recovery setup failed: ${fnError.message}`);
  const recoveryKeyEncrypted = fnData.recoveryKeyEncrypted as EncryptedBlob;
  if (!recoveryKeyEncrypted) throw new Error('Recovery setup returned no encrypted key.');

  // Persist the profile row (RLS allows the authenticated user to write their own row).
  const { error: profileError } = await sb.from('profiles').upsert({
    id: user.id,
    kdf_salt: bytesToB64(salt),
    password_wrapped_vmk: blobToJson(passwordWrapped),
    recovery_wrapped_vmk: blobToJson(recoveryWrapped),
    recovery_key_encrypted: blobToJson(recoveryKeyEncrypted),
    needs_rekey: false,
  });
  if (profileError) throw profileError;

  return { userId: user.id, vmk };
}

export async function signIn(email: string, password: string): Promise<AccountSession> {
  const sb = getSupabase();

  const { data: authData, error: authError } = await sb.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error('Sign in did not return a user.');

  const profile = await loadProfile(user.id);
  const salt = b64ToBytes(profile.kdf_salt);
  const kek = await deriveKek(password, salt);
  const passwordWrapped = jsonToBlob(profile.password_wrapped_vmk);
  // Throws on auth-tag mismatch (i.e. wrong password / tampered key).
  const vmk = await unwrapKey(passwordWrapped, kek);

  return { userId: user.id, vmk };
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string): Promise<void> {
  const redirectTo =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined;
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

/**
 * After a password reset, the old KEK is gone. This recovers the VMK through the
 * server-held recovery key (edge function), then re-wraps it under the new password.
 */
export async function recoverKey(newPassword: string): Promise<AccountSession> {
  const sb = getSupabase();

  const { data: authData, error: authError } = await sb.auth.getUser();
  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error('Not authenticated — sign in with the new password first.');

  const profile = await loadProfile(user.id);

  // Generate a single-use ephemeral wrap key so the edge function never returns the
  // raw VMK over the wire.
  const ewk = await generateEphemeralWrapKey();
  const ewkB64 = await exportRawB64(ewk);

  const { data: fnData, error: fnError } = await sb.functions.invoke('vault-key', {
    body: { action: 'recover', ephemeralWrapKeyB64: ewkB64 },
  });
  if (fnError) throw new Error(`Recovery failed: ${fnError.message}`);
  const ewkWrappedVmk = fnData.ewkWrappedVmk as EncryptedBlob;
  if (!ewkWrappedVmk) throw new Error('Recovery returned no wrapped key.');

  const vmk = await unwrapKey(ewkWrappedVmk, ewk);

  // Re-wrap under the new password.
  const salt = b64ToBytes(profile.kdf_salt);
  const kek = await deriveKek(newPassword, salt);
  const newPasswordWrapped = await wrapKey(vmk, kek);

  const { error: updateError } = await sb
    .from('profiles')
    .update({ password_wrapped_vmk: blobToJson(newPasswordWrapped), needs_rekey: false })
    .eq('id', user.id);
  if (updateError) throw updateError;

  return { userId: user.id, vmk };
}

async function loadProfile(userId: string): Promise<ProfileRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No vault profile found for this account.');
  return data as ProfileRow;
}
