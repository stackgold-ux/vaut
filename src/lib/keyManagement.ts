/**
 * keyManagement.ts — envelope encryption primitives for cross-device accounts.
 *
 * This implements the key hierarchy for the recoverable (Option B) account model:
 *
 *   VMK  (Vault Master Key)   — random 256-bit AES-GCM key that encrypts vault data.
 *   KEK  (Key Encryption Key) — PBKDF2(password, salt); wraps the VMK for normal login.
 *   RK   (Recovery Key)       — random 256-bit AES-GCM key; wraps the VMK for recovery.
 *   EWK  (Ephemeral Wrap Key) — single-use key used only during password reset.
 *
 * All binary values are encoded as base64 strings when persisted to Supabase, and
 * wrapped blobs use the shape `{ iv: string; data: string }` (both base64).
 */

import { deriveKey } from './crypto';

export const AES_GCM_KEY_LENGTH = 256;
export const IV_LENGTH = 12; // AES-GCM recommended IV length
const AES_GCM_TAG_LENGTH = 128;

/** An AES-GCM ciphertext with its random IV, both base64-encoded. */
export interface EncryptedBlob {
  /** base64 of the 12-byte IV */
  iv: string;
  /** base64 of the ciphertext (AES-GCM already includes its 16-byte auth tag) */
  data: string;
}

// ---------------------------------------------------------------------------
// Base64 helpers (portable across browser and Node — no Buffer dependency)
// ---------------------------------------------------------------------------

export function bytesToB64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Key generation / derivation
// ---------------------------------------------------------------------------

/** Generate a random, extractable 256-bit AES-GCM key (used as VMK / RK / EWK). */
export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: AES_GCM_KEY_LENGTH },
    true, // extractable so it can be wrapped / unwrapped
    ['encrypt', 'decrypt']
  );
}

/** Generate the Vault Master Key. */
export function generateVaultMasterKey(): Promise<CryptoKey> {
  return generateAesKey();
}

/** Generate a Recovery Key. */
export function generateRecoveryKey(): Promise<CryptoKey> {
  return generateAesKey();
}

/** Generate a single-use Ephemeral Wrap Key (used during password reset). */
export function generateEphemeralWrapKey(): Promise<CryptoKey> {
  return generateAesKey();
}

/** Generate 16 random bytes to use as the PBKDF2 salt. */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Derive the Key Encryption Key from the user's password + salt.
 * Reuses the existing PBKDF2 (SHA-256, 100k iterations) primitive — the KEK is
 * deliberately non-extractable; it is only ever used to wrap/unwrap the VMK.
 */
export function deriveKek(password: string, salt: Uint8Array): Promise<CryptoKey> {
  return deriveKey(password, salt);
}

// ---------------------------------------------------------------------------
// AES-GCM encrypt / decrypt of arbitrary bytes
// ---------------------------------------------------------------------------

/** Encrypt raw bytes with AES-GCM, returning the base64 IV + ciphertext. */
export async function encryptBytes(data: Uint8Array, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: AES_GCM_TAG_LENGTH },
    key,
    data as BufferSource
  );
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ciphertext)) };
}

/** Decrypt an {@link EncryptedBlob} with AES-GCM. */
export async function decryptBytes(blob: EncryptedBlob, key: CryptoKey): Promise<Uint8Array> {
  const iv = b64ToBytes(blob.iv);
  const data = b64ToBytes(blob.data);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: AES_GCM_TAG_LENGTH },
    key,
    data as BufferSource
  );
  return new Uint8Array(plaintext);
}

// ---------------------------------------------------------------------------
// Key wrapping (key encryption via AES-GCM)
// ---------------------------------------------------------------------------

/**
 * Wrap a key by exporting its raw bytes and encrypting them with `wrappingKey`.
 * Used for: wrapKey(vmk, kek) and wrapKey(vmk, recoveryKey).
 */
export async function wrapKey(key: CryptoKey, wrappingKey: CryptoKey): Promise<EncryptedBlob> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return encryptBytes(new Uint8Array(raw), wrappingKey);
}

/** Unwrap a key previously produced by {@link wrapKey}. */
export async function unwrapKey(blob: EncryptedBlob, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const raw = await decryptBytes(blob, wrappingKey);
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM', length: AES_GCM_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// ---------------------------------------------------------------------------
// Vault payload helpers
// ---------------------------------------------------------------------------

/** Serialize and encrypt the vault holdings under the VMK. */
export async function encryptVaultPayload(holdings: unknown, vmk: CryptoKey): Promise<EncryptedBlob> {
  const encoded = new TextEncoder().encode(JSON.stringify(holdings));
  return encryptBytes(encoded, vmk);
}

/** Decrypt and parse the vault holdings payload under the VMK. */
export async function decryptVaultPayload<T>(blob: EncryptedBlob, vmk: CryptoKey): Promise<T> {
  const bytes = await decryptBytes(blob, vmk);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
