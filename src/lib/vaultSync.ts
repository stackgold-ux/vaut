/**
 * vaultSync.ts — push/pull encrypted vault holdings to/from Supabase.
 *
 * Holdings are encrypted client-side under the VMK and stored as a single AES-GCM
 * blob in `vault_data` (one row per user). The VMK never leaves the client; only
 * ciphertext is written to Supabase.
 */

import { getSupabase } from './supabase';
import { type EncryptedBlob, encryptVaultPayload, decryptVaultPayload } from './keyManagement';
import type { Holding } from '../types';

/** A `vault_data` row. */
export interface VaultDataRow {
  user_id: string;
  iv: string;
  ciphertext: string;
  updated_at?: string;
}

function rowToBlob(row: VaultDataRow): EncryptedBlob {
  return { iv: row.iv, data: row.ciphertext };
}

/** Encrypt and persist the full holdings list for the given user. */
export async function pushVault(userId: string, holdings: Holding[], vmk: CryptoKey): Promise<void> {
  const blob = await encryptVaultPayload(holdings, vmk);
  const { error } = await getSupabase().from('vault_data').upsert({
    user_id: userId,
    iv: blob.iv,
    ciphertext: blob.data,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Fetch and decrypt the holdings list for the given user (empty array if none yet). */
export async function pullVault(userId: string, vmk: CryptoKey): Promise<Holding[]> {
  const { data, error } = await getSupabase()
    .from('vault_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return [];
  const blob = rowToBlob(data as VaultDataRow);
  return decryptVaultPayload<Holding[]>(blob, vmk);
}
