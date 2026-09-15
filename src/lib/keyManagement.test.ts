/**
 * keyManagement.test.ts — unit tests for the envelope-encryption primitives.
 *
 * Covers key generation, KEK derivation, key wrap/unwrap, payload encryption, and a
 * full end-to-end simulation of the Option B recovery flow (without the network).
 */

import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  bytesToB64,
  b64ToBytes,
  generateVaultMasterKey,
  generateRecoveryKey,
  generateEphemeralWrapKey,
  generateSalt,
  deriveKek,
  encryptBytes,
  decryptBytes,
  wrapKey,
  unwrapKey,
  encryptVaultPayload,
  decryptVaultPayload,
  type EncryptedBlob,
} from './keyManagement';
import type { Holding } from '../types';

if (!globalThis.crypto) {
  // @ts-ignore — ensure WebCrypto is present in the Node test environment
  globalThis.crypto = webcrypto;
}

const sampleHoldings: Holding[] = [
  {
    id: 'h1',
    metal: 'Gold',
    quantity: 2,
    unit: 'oz',
    addedDate: '2025-06-01T00:00:00.000Z',
    purchaseDate: '2025-05-15',
    purchasePrice: 4200,
    description: 'Two gold coins',
    photoUrl: 'https://example.com/gold.jpg',
  },
  {
    id: 'h2',
    metal: 'Silver',
    quantity: 50,
    unit: 'oz',
    addedDate: '2025-06-02T00:00:00.000Z',
  },
];

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(b64ToBytes(bytesToB64(bytes))).toEqual(bytes);
  });

  it('round-trips empty bytes', () => {
    expect(b64ToBytes(bytesToB64(new Uint8Array(0)))).toEqual(new Uint8Array(0));
  });
});

describe('key generation / derivation', () => {
  it('generates an extractable AES-GCM-256 VMK', async () => {
    const vmk = await generateVaultMasterKey();
    expect(vmk.type).toBe('secret');
    expect(vmk.extractable).toBe(true);
    expect((vmk.algorithm as AesKeyAlgorithm).name).toBe('AES-GCM');
    expect((vmk.algorithm as AesKeyAlgorithm).length).toBe(256);
  });

  it('generates a 16-byte salt', () => {
    expect(generateSalt()).toHaveLength(16);
  });

  it('deriveKek produces a non-extractable key', async () => {
    const kek = await deriveKek('password', generateSalt());
    expect(kek.extractable).toBe(false);
  });

  it('deriveKek is deterministic for the same password + salt', async () => {
    const salt = generateSalt();
    const kek1 = await deriveKek('hunter2', salt);
    const kek2 = await deriveKek('hunter2', salt);
    // Both keys must encrypt/decrypt interchangeably.
    const blob = await encryptBytes(new TextEncoder().encode('x'), kek1);
    const decrypted = await decryptBytes(blob, kek2);
    expect(new TextDecoder().decode(decrypted)).toBe('x');
  });
});

describe('wrap / unwrap key', () => {
  it('wraps and unwraps a VMK under a KEK', async () => {
    const vmk = await generateVaultMasterKey();
    const kek = await deriveKek('pw', generateSalt());
    const wrapped = await wrapKey(vmk, kek);
    const unwrapped = await unwrapKey(wrapped, kek);
    expect(unwrapped.extractable).toBe(true);

    // The unwrapped key must decrypt data the original VMK encrypted.
    const blob = await encryptBytes(new TextEncoder().encode('secret'), vmk);
    expect(new TextDecoder().decode(await decryptBytes(blob, unwrapped))).toBe('secret');
  });

  it('fails to unwrap with the wrong wrapping key', async () => {
    const vmk = await generateVaultMasterKey();
    const goodKek = await deriveKek('right', generateSalt());
    const badKek = await deriveKek('wrong', generateSalt());
    const wrapped = await wrapKey(vmk, goodKek);
    await expect(unwrapKey(wrapped, badKek)).rejects.toThrow();
  });
});

describe('encrypt / decrypt vault payload', () => {
  it('round-trips a holdings list', async () => {
    const vmk = await generateVaultMasterKey();
    const blob = await encryptVaultPayload(sampleHoldings, vmk);
    const decrypted = await decryptVaultPayload<Holding[]>(blob, vmk);
    expect(decrypted).toEqual(sampleHoldings);
  });

  it('produces unique IVs across encryptions', async () => {
    const vmk = await generateVaultMasterKey();
    const a = await encryptVaultPayload([], vmk);
    const b = await encryptVaultPayload([], vmk);
    expect(a.iv).not.toBe(b.iv);
  });
});

describe('Option B recovery flow (end-to-end, no network)', () => {
  it('recovers the VMK after a password change via the recovery key', async () => {
    // --- Signup ---
    const oldPassword = 'old-password';
    const salt = generateSalt();
    const vmk = await generateVaultMasterKey();
    const recoveryKey = await generateRecoveryKey();
    const oldKek = await deriveKek(oldPassword, salt);

    const passwordWrapped = await wrapKey(vmk, oldKek);
    const recoveryWrapped = await wrapKey(vmk, recoveryKey);

    // Encrypt some data under the VMK.
    const vaultBlob = await encryptVaultPayload(sampleHoldings, vmk);

    // --- Server-side: encrypt the recovery key with the server key (HKDF of secret) ---
    const serverSecret = 'top-secret-service-role-key';
    const serverBase = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(serverSecret),
      'HKDF',
      false,
      ['deriveKey']
    );
    const serverKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('user-123'),
        info: new TextEncoder().encode('stack-your-vault-recovery-v1'),
      },
      serverBase,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const recoveryKeyEncrypted = await encryptBytes(
      new Uint8Array(await crypto.subtle.exportKey('raw', recoveryKey)),
      serverKey
    );

    // --- Password reset + recovery ---
    const newPassword = 'brand-new-password';
    const newKek = await deriveKek(newPassword, salt);

    // Server: decrypt recovery key, unwrap VMK, re-wrap under ephemeral wrap key.
    const ewk = await generateEphemeralWrapKey();
    const recoveryKeyRecovered = await crypto.subtle.importKey(
      'raw',
      await decryptBytes(recoveryKeyEncrypted, serverKey) as BufferSource,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const vmkRecovered = await crypto.subtle.importKey(
      'raw',
      await decryptBytes(recoveryWrapped, recoveryKeyRecovered) as BufferSource,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const ewkWrappedVmk = await encryptBytes(
      new Uint8Array(await crypto.subtle.exportKey('raw', vmkRecovered)),
      ewk
    );

    // Client: unwrap VMK with EWK, then re-wrap under the new password.
    const recoveredVmk = await unwrapKey(ewkWrappedVmk, ewk);
    const newPasswordWrapped = await wrapKey(recoveredVmk, newKek);

    // --- Assertions ---
    // New password must now unlock the vault data.
    const unlockedVmk = await unwrapKey(newPasswordWrapped, newKek);
    const holdings = await decryptVaultPayload<Holding[]>(vaultBlob, unlockedVmk);
    expect(holdings).toEqual(sampleHoldings);

    // The old password-wrapped key must NOT unwrap under the new KEK.
    await expect(unwrapKey(passwordWrapped, newKek)).rejects.toThrow();
  });
});
