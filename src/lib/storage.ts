
import { deriveKey, encrypt, decrypt } from './crypto';
import type { Holding } from '../types';

const DB_NAME = 'StackYourSafeVault';
const STORE_NAME = 'vault';
const DB_VERSION = 1;

/**
 * Migrate holdings loaded from storage for backward compatibility.
 * Old data used `date` (string) — rename to `addedDate`.
 */
function migrateHolding(h: Record<string, unknown>): Holding {
  if (h.date && !h.addedDate) {
    h.addedDate = h.date;
  }
  delete h.date;
  return h as unknown as Holding;
}

export class VaultStorage {
  private db: IDBDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async get(key: string): Promise<any> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async set(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exists(): Promise<boolean> {
    const metadata = await this.get('metadata');
    return !!(metadata && metadata.salt);
  }
  async createVault(password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    this.encryptionKey = await deriveKey(password, salt);
    await this.set('metadata', { salt });
    await this.saveHoldings([]);
  }

  async unlockVault(password: string): Promise<boolean> {
    const metadata = await this.get('metadata');
    if (!metadata || !metadata.salt) throw new Error('Vault not created');

    const key = await deriveKey(password, metadata.salt);
    try {
      const encryptedData = await this.get('holdings');
      if (encryptedData) {
        await decrypt(encryptedData.data, key, encryptedData.iv);
      }
      this.encryptionKey = key;
      return true;
    } catch (e) {
      return false;
    }
  }

  async lockVault(): Promise<void> {
    this.encryptionKey = null;
  }

  async saveHoldings(holdings: Holding[]): Promise<void> {
    if (!this.encryptionKey) throw new Error('Vault locked');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(holdings));
    const encrypted = await encrypt(encoded, this.encryptionKey, iv);
    await this.set('holdings', { iv, data: encrypted });
  }

  async loadHoldings(): Promise<Holding[]> {
    if (!this.encryptionKey) throw new Error('Vault locked');
    const encryptedData = await this.get('holdings');
    if (!encryptedData) return [];
    const decrypted = await decrypt(encryptedData.data, this.encryptionKey, encryptedData.iv);
    const raw = JSON.parse(new TextDecoder().decode(decrypted)) as Record<string, unknown>[];
    return raw.map(migrateHolding);
  }
}
