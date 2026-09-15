/**
 * account.test.ts — integration tests for the account service layer.
 *
 * Uses a mock Supabase client with an in-memory store, plus a faithful re-implementation
 * of the vault-key edge function, so the full signUp → signIn → recoverKey lifecycle is
 * exercised with real WebCrypto (no network).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signUp, signIn, recoverKey, getCurrentUserId } from './account';
import { setSupabaseForTesting, resetSupabaseForTesting } from './supabase';
import {
  bytesToB64,
  b64ToBytes,
  generateAesKey,
  deriveKek,
  encryptBytes,
  decryptBytes,
  wrapKey,
  unwrapKey,
  type EncryptedBlob,
} from './keyManagement';
import type { Holding } from '../types';

if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = webcrypto;
}

// ---------------------------------------------------------------------------
// Mock Supabase client (mirrors supabase-js surface used by the service layer)
// ---------------------------------------------------------------------------

const SERVER_SECRET = 'test-service-role-secret';

async function importRawAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function deriveServerKey(userId: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SERVER_SECRET),
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(userId),
      info: new TextEncoder().encode('stack-your-vault-recovery-v1'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

interface StoredUser {
  id: string;
  email: string;
  password: string;
}

function createMockSupabase(): SupabaseClient {
  const profiles = new Map<string, Record<string, unknown>>();
  const vaultData = new Map<string, Record<string, unknown>>();
  const usersByEmail = new Map<string, StoredUser>();
  let currentUserId: string | null = null;

  // Faithful re-implementation of supabase/functions/vault-key/index.ts
  async function vaultKey(body: { action: string; recoveryKeyB64?: string; ephemeralWrapKeyB64?: string }) {
    if (!currentUserId) throw new Error('No authenticated session');
    const serverKey = await deriveServerKey(currentUserId);

    if (body.action === 'setup') {
      const recoveryKey = await importRawAesKey(b64ToBytes(body.recoveryKeyB64!));
      const raw = new Uint8Array(await crypto.subtle.exportKey('raw', recoveryKey));
      return { recoveryKeyEncrypted: await encryptBytes(raw, serverKey) };
    }

    if (body.action === 'recover') {
      const profile = profiles.get(currentUserId)!;
      const recoveryKeyEncrypted = JSON.parse(profile.recovery_key_encrypted as string) as EncryptedBlob;
      const recoveryRaw = await decryptBytes(recoveryKeyEncrypted, serverKey);
      const recoveryKey = await importRawAesKey(recoveryRaw);

      const recoveryWrapped = JSON.parse(profile.recovery_wrapped_vmk as string) as EncryptedBlob;
      const vmkRaw = await decryptBytes(recoveryWrapped, recoveryKey);
      const vmk = await importRawAesKey(vmkRaw);

      const ewk = await importRawAesKey(b64ToBytes(body.ephemeralWrapKeyB64!));
      const ewkWrappedVmk = await encryptBytes(
        new Uint8Array(await crypto.subtle.exportKey('raw', vmk)),
        ewk
      );
      return { ewkWrappedVmk };
    }

    throw new Error('Unknown action');
  }

  function query(table: 'profiles' | 'vault_data') {
    let op: 'select' | 'upsert' | 'update' = 'select';
    let payload: Record<string, unknown> | null = null;
    let eqFilter: { col: string; val: unknown } | null = null;
    let single = false;

    const store = () => (table === 'profiles' ? profiles : vaultData);

    const run = async (): Promise<{ data: unknown; error: unknown }> => {
      if (op === 'upsert' && payload) {
        const key = (payload.id ?? payload.user_id) as string;
        store().set(key, payload);
        return { data: payload, error: null };
      }
      if (op === 'update') {
        if (eqFilter) {
          for (const [key, row] of store()) {
            if (row[eqFilter.col] === eqFilter.val) {
              store().set(key, { ...row, ...payload });
            }
          }
        }
        return { data: null, error: null };
      }
      if (op === 'select') {
        if (eqFilter) {
          const found = [...store().values()].find((r) => r[eqFilter.col] === eqFilter.val);
          return { data: single ? (found ?? null) : found ? [found] : [], error: null };
        }
        return { data: single ? null : [...store().values()], error: null };
      }
      return { data: null, error: null };
    };

    const builder: any = {
      select: () => {
        op = 'select';
        return builder;
      },
      eq: (col: string, val: unknown) => {
        eqFilter = { col, val };
        return builder;
      },
      maybeSingle: () => {
        single = true;
        return run();
      },
      upsert: (row: Record<string, unknown>) => {
        op = 'upsert';
        payload = row;
        return run();
      },
      update: (patch: Record<string, unknown>) => {
        op = 'update';
        payload = patch;
        return builder;
      },
      then: (resolve: (v: unknown) => void) => run().then(resolve),
    };
    return builder;
  }

  const mock = {
    auth: {
      async signUp({ email, password }: { email: string; password: string }) {
        const id = crypto.randomUUID();
        usersByEmail.set(email, { id, email, password });
        currentUserId = id;
        return { data: { user: { id, email }, session: null }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const user = usersByEmail.get(email);
        if (!user || user.password !== password) {
          return { data: { user: null }, error: { message: 'Invalid login credentials' } };
        }
        currentUserId = user.id;
        return { data: { user: { id: user.id, email } }, error: null };
      },
      async signOut() {
        currentUserId = null;
        return { error: null };
      },
      async resetPasswordForEmail(_email: string, _opts: unknown) {
        return { error: null };
      },
      async getUser() {
        return { data: { user: currentUserId ? { id: currentUserId } : null } };
      },
      // Test-only helper: simulate the completion of a Supabase password reset,
      // which updates the stored auth password for subsequent sign-ins.
      async _updatePassword(email: string, newPassword: string) {
        const user = usersByEmail.get(email);
        if (user) user.password = newPassword;
      },
    },
    functions: {
      async invoke(_name: string, { body }: { body: Record<string, unknown> }) {
        return { data: await vaultKey(body as never), error: null };
      },
    },
    from: (table: 'profiles' | 'vault_data') => query(table),
  };

  return mock as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const sampleHoldings: Holding[] = [
  { id: 'h1', metal: 'Gold', quantity: 3, unit: 'oz', addedDate: '2025-06-01T00:00:00.000Z' },
  { id: 'h2', metal: 'Silver', quantity: 100, unit: 'oz', addedDate: '2025-06-02T00:00:00.000Z' },
];

describe('account service layer', () => {
  let mock: SupabaseClient;

  beforeEach(() => {
    mock = createMockSupabase();
    setSupabaseForTesting(mock);
  });

  afterEach(() => {
    resetSupabaseForTesting();
  });

  it('signUp returns a working VMK and signIn with the same password unwraps it', async () => {
    const session = await signUp('user@example.com', 'correct-horse');
    expect(session.userId).toBeTruthy();

    // Encrypt data with the signup VMK.
    const vaultBlob = await encryptBytes(
      new TextEncoder().encode(JSON.stringify(sampleHoldings)),
      session.vmk
    );

    const signInSession = await signIn('user@example.com', 'correct-horse');
    expect(signInSession.userId).toBe(session.userId);

    // The sign-in VMK must decrypt data encrypted with the signup VMK.
    const decrypted = await decryptBytes(vaultBlob, signInSession.vmk);
    expect(JSON.parse(new TextDecoder().decode(decrypted))).toEqual(sampleHoldings);
  });

  it('signIn with the wrong password rejects', async () => {
    await signUp('user2@example.com', 'right-password');
    await expect(signIn('user2@example.com', 'wrong-password')).rejects.toThrow();
  });

  it('getCurrentUserId reflects the authenticated user', async () => {
    await signUp('user3@example.com', 'pw');
    await expect(getCurrentUserId()).resolves.toBeTruthy();
  });

  it('recovers the VMK after a password reset (Option B end-to-end)', async () => {
    const signup = await signUp('reset@example.com', 'old-password');

    // Encrypt some vault data under the original VMK.
    const vaultBlob = await encryptBytes(
      new TextEncoder().encode(JSON.stringify(sampleHoldings)),
      signup.vmk
    );

    // Simulate a completed password reset: the user is authenticated with a new
    // password, but the profile still holds the old password-wrapped VMK.
    await (mock as unknown as { auth: { _updatePassword: (e: string, p: string) => Promise<void> } })
      .auth._updatePassword('reset@example.com', 'new-password');
    const recovered = await recoverKey('new-password');
    expect(recovered.userId).toBe(signup.userId);

    // The recovered VMK must be identical to the original (decrypts the same data).
    const decrypted = await decryptBytes(vaultBlob, recovered.vmk);
    expect(JSON.parse(new TextDecoder().decode(decrypted))).toEqual(sampleHoldings);

    // Now a fresh sign-in with the NEW password must also yield the same VMK.
    const relogin = await signIn('reset@example.com', 'new-password');
    const decryptedAgain = await decryptBytes(vaultBlob, relogin.vmk);
    expect(JSON.parse(new TextDecoder().decode(decryptedAgain))).toEqual(sampleHoldings);
  });
});
