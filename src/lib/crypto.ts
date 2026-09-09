const PBKDF2_ITERATIONS = 100000;
const AES_GCM_TAG_LENGTH = 128;

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(data: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any as BufferSource, tagLength: AES_GCM_TAG_LENGTH },
    key,
    data as any as BufferSource
  );
}

export async function decrypt(encryptedData: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any as BufferSource, tagLength: AES_GCM_TAG_LENGTH },
    key,
    encryptedData as any as BufferSource
  );
}
