import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultStorage } from './storage';
import type { Holding } from '../types';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = webcrypto;
}

describe('VaultStorage', () => {
  let storage: VaultStorage;

  beforeEach(async () => {
    storage = new VaultStorage();
    await storage.init();
    // Clear the object store between tests
    // @ts-ignore — access private db for cleanup
    const db = storage.db as IDBDatabase;
    const transaction = db.transaction('vault', 'readwrite');
    transaction.objectStore('vault').clear();
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should create and load holdings', async () => {
    await storage.createVault('pass123');
    const holdings: Holding[] = [
      { id: '1', metal: 'Gold', quantity: 1, unit: 'oz', addedDate: new Date().toISOString(), note: 'First coin' }
    ];
    await storage.saveHoldings(holdings);
    expect(await storage.loadHoldings()).toEqual(holdings);
  });

  it('should fail with wrong password', async () => {
    await storage.createVault('pass123');
    await storage.lockVault();
    const unlocked = await storage.unlockVault('wrong');
    expect(unlocked).toBe(false);
  });

  it('should persist after re-init', async () => {
    await storage.createVault('pass123');
    const holdings: Holding[] = [{ id: '2', metal: 'Silver', quantity: 10, unit: 'oz', addedDate: new Date().toISOString() }];
    await storage.saveHoldings(holdings);
    await storage.close();

    const newStorage = new VaultStorage();
    await newStorage.init();
    await newStorage.unlockVault('pass123');
    expect(await newStorage.loadHoldings()).toEqual(holdings);
    await newStorage.close();
  });

  it('HOLD-03: saves and loads holdings with all new fields (purchaseDate, purchasePrice, description, photoUrl)', async () => {
    await storage.createVault('test-pass');
    const holdings: Holding[] = [
      {
        id: 'hold-1',
        metal: 'Gold',
        quantity: 5,
        unit: 'oz',
        addedDate: '2025-06-01T00:00:00.000Z',
        note: 'Bullion bar',
        purchaseDate: '2025-05-15',
        purchasePrice: 12500.50,
        description: 'PAMP Suisse 5 oz gold bar',
        photoUrl: 'https://example.com/gold-bar.jpg',
      },
    ];
    await storage.saveHoldings(holdings);
    const loaded = await storage.loadHoldings();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].addedDate).toBe('2025-06-01T00:00:00.000Z');
    expect(loaded[0].purchaseDate).toBe('2025-05-15');
    expect(loaded[0].purchasePrice).toBe(12500.50);
    expect(loaded[0].description).toBe('PAMP Suisse 5 oz gold bar');
    expect(loaded[0].photoUrl).toBe('https://example.com/gold-bar.jpg');
  });

  it('HOLD-04: saves and loads holdings with no optional fields', async () => {
    await storage.createVault('test-pass');
    const holdings: Holding[] = [
      {
        id: 'hold-2',
        metal: 'Silver',
        quantity: 100,
        unit: 'oz',
        addedDate: '2025-06-01T00:00:00.000Z',
      },
    ];
    await storage.saveHoldings(holdings);
    const loaded = await storage.loadHoldings();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].addedDate).toBe('2025-06-01T00:00:00.000Z');
    expect(loaded[0].purchaseDate).toBeUndefined();
    expect(loaded[0].purchasePrice).toBeUndefined();
    expect(loaded[0].description).toBeUndefined();
    expect(loaded[0].photoUrl).toBeUndefined();
  });

  it('HOLD-05: handles mixed holdings with and without optional fields', async () => {
    await storage.createVault('test-pass');
    const holdings: Holding[] = [
      {
        id: 'hold-a',
        metal: 'Gold',
        quantity: 1,
        unit: 'oz',
        addedDate: '2025-01-01T00:00:00.000Z',
        purchaseDate: '2024-12-15',
        purchasePrice: 2000,
        description: 'American Eagle',
        photoUrl: 'https://example.com/eagle.jpg',
      },
      {
        id: 'hold-b',
        metal: 'Platinum',
        quantity: 2,
        unit: 'oz',
        addedDate: '2025-01-02T00:00:00.000Z',
        purchaseDate: '2024-12-20',
        purchasePrice: 1800,
        description: 'Platinum bar',
      },
      {
        id: 'hold-c',
        metal: 'Copper',
        quantity: 50,
        unit: 'oz',
        addedDate: '2025-01-03T00:00:00.000Z',
      },
    ];
    await storage.saveHoldings(holdings);
    const loaded = await storage.loadHoldings();
    expect(loaded).toHaveLength(3);

    expect(loaded[0].id).toBe('hold-a');
    expect(loaded[0].addedDate).toBe('2025-01-01T00:00:00.000Z');
    expect(loaded[0].purchaseDate).toBe('2024-12-15');
    expect(loaded[0].purchasePrice).toBe(2000);
    expect(loaded[0].description).toBe('American Eagle');
    expect(loaded[0].photoUrl).toBe('https://example.com/eagle.jpg');

    expect(loaded[1].id).toBe('hold-b');
    expect(loaded[1].addedDate).toBe('2025-01-02T00:00:00.000Z');
    expect(loaded[1].purchaseDate).toBe('2024-12-20');
    expect(loaded[1].purchasePrice).toBe(1800);
    expect(loaded[1].description).toBe('Platinum bar');
    expect(loaded[1].photoUrl).toBeUndefined();

    expect(loaded[2].id).toBe('hold-c');
    expect(loaded[2].addedDate).toBe('2025-01-03T00:00:00.000Z');
    expect(loaded[2].purchaseDate).toBeUndefined();
    expect(loaded[2].purchasePrice).toBeUndefined();
    expect(loaded[2].description).toBeUndefined();
    expect(loaded[2].photoUrl).toBeUndefined();
  });

  it('HOLD-06: backward compat — old holdings with `date` field migrate to `addedDate`', async () => {
    await storage.createVault('test-pass');
    // Simulate old-format data: serialize with `date` instead of `addedDate`
    const oldData = [
      { id: 'old-1', metal: 'Gold', quantity: 5, unit: 'oz', date: '2024-01-15T00:00:00.000Z', note: 'Legacy entry' },
    ];
    // Inject directly into the encrypted store to simulate old vault data
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(oldData));
    const { encrypt } = await import('./crypto');
    // We need the encryption key — access storage internals
    // Re-create vault to get a key, then close and inject
    await storage.close();

    // Create vault normally, grab the key by directly accessing private field
    const tmpStorage = new VaultStorage();
    await tmpStorage.init();
    await tmpStorage.createVault('test-pass');
    // @ts-ignore — access private key for test injection
    const key = tmpStorage['encryptionKey'] as CryptoKey;
    const encrypted = await encrypt(encoded, key, iv);
    // Overwrite the holdings entry with old-format data
    // @ts-ignore — access private db
    const db = tmpStorage['db'] as IDBDatabase;
    const transaction = db.transaction('vault', 'readwrite');
    const store = transaction.objectStore('vault');
    store.put({ iv, data: encrypted }, 'holdings');
    await new Promise<void>((resolve) => { transaction.oncomplete = () => resolve(); });

    // Now load from a fresh storage instance with the migration
    const freshStorage = new VaultStorage();
    await freshStorage.init();
    await freshStorage.unlockVault('test-pass');
    const loaded = await freshStorage.loadHoldings();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('old-1');
    expect(loaded[0].metal).toBe('Gold');
    expect(loaded[0].quantity).toBe(5);
    expect(loaded[0].addedDate).toBe('2024-01-15T00:00:00.000Z');
    // The old `date` key should be gone
    expect((loaded[0] as any).date).toBeUndefined();
    await freshStorage.close();
    await tmpStorage.close();
  });
});
