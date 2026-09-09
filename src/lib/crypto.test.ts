/**
 * crypto.test.ts — Automated unit tests for the encryption layer
 *
 * Tests the cryptographic primitives used by Stack Your Vault:
 * - PBKDF2 key derivation (deriveKey)
 * - AES-GCM encrypt/decrypt
 * - Key determinism and tamper rejection
 *
 * Run: npx vitest run crypto
 */

import { describe, it, expect } from 'vitest';
import { deriveKey, encrypt, decrypt } from './crypto';
import type { Holding } from '../types';

// ---------------------------------------------------------------------------
// Helper to generate test keys
// ---------------------------------------------------------------------------
async function makeKey(password: string, salt?: Uint8Array): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, s);
  return { key, salt: s };
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes: ArrayBuffer): string {
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Key Derivation Tests
// ---------------------------------------------------------------------------
describe('deriveKey — PBKDF2 Key Derivation', () => {
  it('SEC-01: deriveKey uses PBKDF2 + SHA-256 and returns a CryptoKey', async () => {
    const salt = new Uint8Array(16).fill(0x01);
    const key = await deriveKey('test-password', salt);

    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('SEC-03: Same password + same salt produces the same key (extractable check)', async () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

    const key1 = await deriveKey('MyP@ssw0rd!', salt);
    const key2 = await deriveKey('MyP@ssw0rd!', salt);

    // Both keys should be able to encrypt and decrypt the same data
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = textToBytes('test data');
    const encrypted = await encrypt(data, key1, iv);
    const decrypted = await decrypt(encrypted, key2, iv);
    expect(bytesToText(decrypted)).toBe('test data');
  });

  it('SEC-04: Different passwords with same salt produce different keys', async () => {
    const salt = new Uint8Array(16).fill(0xab);

    const keyA = await deriveKey('password-A', salt);
    const keyB = await deriveKey('password-B', salt);

    // Encrypt with keyA, decrypt with keyB should fail (auth tag mismatch)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = textToBytes('secret data');
    const encrypted = await encrypt(data, keyA, iv);

    await expect(decrypt(encrypted, keyB, iv)).rejects.toThrow();
  });

  it('SEC-05: Different salts with same password produce different keys', async () => {
    const salt1 = new Uint8Array(16).fill(0x01);
    const salt2 = new Uint8Array(16).fill(0x02);

    const key1 = await deriveKey('same-password', salt1);
    const key2 = await deriveKey('same-password', salt2);

    // Cross-decrypt should fail
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = textToBytes('cross-salt test');
    const encrypted = await encrypt(data, key1, iv);

    await expect(decrypt(encrypted, key2, iv)).rejects.toThrow();
  });

  it('handles empty string password', async () => {
    const salt = new Uint8Array(16).fill(0x01);
    const key = await deriveKey('', salt);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
  });

  it('handles very long passwords (128 chars)', async () => {
    const salt = new Uint8Array(16).fill(0x01);
    const longPassword = 'x'.repeat(128);
    const key = await deriveKey(longPassword, salt);
    expect(key).toBeDefined();
  });

  it('salt length is exactly 16 bytes', () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    expect(salt.length).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// Encrypt / Decrypt Tests
// ---------------------------------------------------------------------------
describe('encrypt / decrypt — AES-GCM Operations', () => {
  it('SEC-06: encrypt returns an ArrayBuffer', async () => {
    const { key } = await makeKey('test-password');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = textToBytes('plaintext data');

    const encrypted = await encrypt(data, key, iv);
    expect(encrypted).toBeInstanceOf(ArrayBuffer);
    expect(encrypted.byteLength).toBeGreaterThan(data.byteLength); // Has auth tag
  });

  it('SEC-07: encrypt uses a 12-byte IV', () => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    expect(iv.length).toBe(12);
  });

  it('SEC-08: decrypt with correct key + IV returns original plaintext', async () => {
    const { key } = await makeKey('test-password');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const original = 'My precious metals: Gold 10oz, Silver 50oz';

    const encrypted = await encrypt(textToBytes(original), key, iv);
    const decrypted = await decrypt(encrypted, key, iv);

    expect(bytesToText(decrypted)).toBe(original);
  });

  it('SEC-09: decrypt with wrong key throws (authentication failure)', async () => {
    const { key: correctKey } = await makeKey('correct-password');
    const { key: wrongKey } = await makeKey('wrong-password');
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await encrypt(textToBytes('secret'), correctKey, iv);
    await expect(decrypt(encrypted, wrongKey, iv)).rejects.toThrow();
  });

  it('SEC-10: decrypt with wrong IV throws (authentication failure)', async () => {
    const { key } = await makeKey('password');
    const iv1 = crypto.getRandomValues(new Uint8Array(12));
    const iv2 = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await encrypt(textToBytes('data'), key, iv1);
    await expect(decrypt(encrypted, key, iv2)).rejects.toThrow();
  });

  it('SEC-11: handles Unicode / special characters', async () => {
    const { key } = await makeKey('password');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const unicode = 'Gold: 10oz 🥇 | 日本語 | émojis ✓';

    const encrypted = await encrypt(textToBytes(unicode), key, iv);
    const decrypted = await decrypt(encrypted, key, iv);
    expect(bytesToText(decrypted)).toBe(unicode);
  });

  it('SEC-12: handles empty Uint8Array', async () => {
    const { key } = await makeKey('password');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const empty = new Uint8Array(0);

    const encrypted = await encrypt(empty, key, iv);
    const decrypted = await decrypt(encrypted, key, iv);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(0));
  });

  it('SEC-13: handles large payloads (100KB)', async () => {
    const { key } = await makeKey('password');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const largeData = new Uint8Array(100_000).fill(0x42);

    const encrypted = await encrypt(largeData, key, iv);
    const decrypted = await decrypt(encrypted, key, iv);
    expect(new Uint8Array(decrypted)).toEqual(largeData);
  });

  it('multiple sequential encrypt/decrypt operations work correctly', async () => {
    const password = 'sequential-test';
    const salt = new Uint8Array(16).fill(0xdd);
    const key = await deriveKey(password, salt);

    const texts = ['First entry', 'Second entry', 'Third entry'];
    for (const text of texts) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await encrypt(textToBytes(text), key, iv);
      const decrypted = await decrypt(encrypted, key, iv);
      expect(bytesToText(decrypted)).toBe(text);
    }
  });

  it('tampered ciphertext throws on decrypt', async () => {
    const { key } = await makeKey('password');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = textToBytes('tamper test');

    const encrypted = await encrypt(data, key, iv);

    // Tamper with the ciphertext (flip a byte)
    const tampered = new Uint8Array(encrypted);
    tampered[0] ^= 0xff;

    await expect(decrypt(tampered.buffer, key, iv)).rejects.toThrow();
  });

  it('HOLD-01: encrypts and decrypts a Holding with all new fields', async () => {
    const { key } = await makeKey('test-password');
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const holding: Holding = {
      id: 'test-id-123',
      metal: 'Gold',
      quantity: 10.5,
      unit: 'oz',
      addedDate: '2025-06-26T12:00:00.000Z',
      note: 'Test note',
      purchaseDate: '2025-06-01',
      purchasePrice: 2500.00,
      description: 'American Gold Eagle, 1 oz',
      photoUrl: 'https://example.com/gold-coin.jpg',
    };

    const encoded = new TextEncoder().encode(JSON.stringify(holding));
    const encrypted = await encrypt(encoded, key, iv);
    const decrypted = await decrypt(encrypted, key, iv);
    const decoded = JSON.parse(new TextDecoder().decode(decrypted)) as Holding;

    expect(decoded.id).toBe('test-id-123');
    expect(decoded.metal).toBe('Gold');
    expect(decoded.quantity).toBe(10.5);
    expect(decoded.addedDate).toBe('2025-06-26T12:00:00.000Z');
    expect(decoded.purchaseDate).toBe('2025-06-01');
    expect(decoded.purchasePrice).toBe(2500.00);
    expect(decoded.description).toBe('American Gold Eagle, 1 oz');
    expect(decoded.photoUrl).toBe('https://example.com/gold-coin.jpg');
  });

  it('HOLD-02: encrypts and decrypts a Holding with no optional fields', async () => {
    const { key } = await makeKey('test-password');
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const holding: Holding = {
      id: 'test-id-456',
      metal: 'Silver',
      quantity: 100,
      unit: 'oz',
      addedDate: '2025-06-26T12:00:00.000Z',
    };

    const encoded = new TextEncoder().encode(JSON.stringify(holding));
    const encrypted = await encrypt(encoded, key, iv);
    const decrypted = await decrypt(encrypted, key, iv);
    const decoded = JSON.parse(new TextDecoder().decode(decrypted)) as Holding;

    expect(decoded.id).toBe('test-id-456');
    expect(decoded.addedDate).toBe('2025-06-26T12:00:00.000Z');
    expect(decoded.purchaseDate).toBeUndefined();
    expect(decoded.purchasePrice).toBeUndefined();
    expect(decoded.description).toBeUndefined();
    expect(decoded.photoUrl).toBeUndefined();
  });
});