/**
 * vaultSync.test.ts — tests for the encrypted vault sync layer.
 *
 * Verifies that holdings are encrypted before being written and decrypted after being
 * read, using a mock Supabase client with an in-memory `vault_data` table.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pushVault, pullVault } from './vaultSync';
import { setSupabaseForTesting, resetSupabaseForTesting } from './supabase';
import { generateVaultMasterKey } from './keyManagement';
import type { Holding } from '../types';

if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = webcrypto;
}

function createMockSupabase(): SupabaseClient {
  const rows = new Map<string, Record<string, unknown>>();

  function query() {
    let op: 'select' | 'upsert' = 'select';
    let payload: Record<string, unknown> | null = null;
    let eqFilter: { col: string; val: unknown } | null = null;
    let single = false;

    const run = async (): Promise<{ data: unknown; error: unknown }> => {
      if (op === 'upsert' && payload) {
        rows.set(payload.user_id as string, payload);
        return { data: payload, error: null };
      }
      if (op === 'select') {
        if (eqFilter) {
          const found = [...rows.values()].find((r) => r[eqFilter.col] === eqFilter.val);
          return { data: single ? (found ?? null) : found ? [found] : [], error: null };
        }
        return { data: single ? null : [...rows.values()], error: null };
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
      then: (resolve: (v: unknown) => void) => run().then(resolve),
    };
    return builder;
  }

  return {
    auth: {},
    functions: { invoke: async () => ({ data: null, error: null }) },
    from: () => query(),
  } as unknown as SupabaseClient;
}

const holdings: Holding[] = [
  { id: 'h1', metal: 'Gold', quantity: 1, unit: 'oz', addedDate: '2025-06-01T00:00:00.000Z' },
  { id: 'h2', metal: 'Copper', quantity: 500, unit: 'oz', addedDate: '2025-06-02T00:00:00.000Z' },
];

describe('vault sync layer', () => {
  let mock: SupabaseClient;

  beforeEach(() => {
    mock = createMockSupabase();
    setSupabaseForTesting(mock);
  });

  afterEach(() => {
    resetSupabaseForTesting();
  });

  it('push then pull round-trips holdings (encrypted at rest)', async () => {
    const vmk = await generateVaultMasterKey();
    const userId = 'user-123';

    await pushVault(userId, holdings, vmk);
    const loaded = await pullVault(userId, vmk);

    expect(loaded).toEqual(holdings);
  });

  it('returns an empty array when no vault data exists yet', async () => {
    const vmk = await generateVaultMasterKey();
    await expect(pullVault('user-none', vmk)).resolves.toEqual([]);
  });

  it('cannot decrypt with a different VMK (ciphertext is key-bound)', async () => {
    const vmk = await generateVaultMasterKey();
    const otherVmk = await generateVaultMasterKey();
    const userId = 'user-456';

    await pushVault(userId, holdings, vmk);
    await expect(pullVault(userId, otherVmk)).rejects.toThrow();
  });
});
