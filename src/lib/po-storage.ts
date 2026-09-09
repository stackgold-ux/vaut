/**
 * po-storage.ts — PO Inventory database module using IndexedDB
 *
 * Stores purchase order line items (catalog data) in IndexedDB.
 * Unlike the vault storage, this data is NOT encrypted — it's catalog
 * inventory data that needs offline access but not personal secrecy.
 *
 * Supports importing from the po-full.json / parsed-po.json format,
 * querying by metal type, vendor, SKU, and updating photo URLs.
 */

import type { POItem } from '../types';

const DB_NAME = 'StackYourSafePO';
const STORE_NAME = 'po_items';
const DB_VERSION = 1;

/**
 * Map of header names from the XLSX to POItem field names.
 * Used to normalise row data during import.
 */
const HEADER_MAP: Record<string, keyof POItem> = {
  'SYG #': 'sygId',
  'Order #': 'orderNum',
  'Order Date': 'orderDate',
  'Item Description': 'description',
  'SKU': 'sku',
  'Vendor': 'vendor',
  'Metal Type': 'metalType',
  'Unit Cost': 'unitCost',
  'Qty Ordered': 'qtyOrdered',
  'Qty Shipped': 'qtyShipped',
  'Line Subtotal': 'lineSubtotal',
  'Notes': 'notes',
  'Photo': 'photoUrl',
};

/** Fields that should be parsed as numbers */
const NUMERIC_FIELDS = new Set<keyof POItem>(['unitCost', 'qtyOrdered', 'qtyShipped', 'lineSubtotal']);

export class POStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'sygId' });
          // Create indexes for common queries
          store.createIndex('metalType', 'metalType', { unique: false });
          store.createIndex('vendor', 'vendor', { unique: false });
          store.createIndex('sku', 'sku', { unique: false });
          store.createIndex('sheet', 'sheet', { unique: false });
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

  /**
   * Check if PO data has already been imported (by counting items).
   */
  async isImported(): Promise<boolean> {
    const count = await this.getCount();
    return count > 0;
  }

  /**
   * Get the total number of PO items in the store.
   */
  async getCount(): Promise<number> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Import data from the po-full.json format.
   *
   * Expected format: { "Gold": { headers: string[], rows: string[][] }, ... }
   * Each sheet has headers and rows arrays.
   *
   * Returns the number of items imported.
   */
  async importFromJson(data: Record<string, { headers: string[]; rows: (string | number)[][] }>): Promise<number> {
    if (!this.db) throw new Error('DB not initialized');

    const items: POItem[] = [];

    for (const [sheet, sheetData] of Object.entries(data)) {
      const { headers, rows } = sheetData;
      for (const row of rows) {
        const item = this.rowToItem(headers, row, sheet);
        if (item) {
          items.push(item);
        }
      }
    }

    if (items.length === 0) return 0;

    // Batch insert into the store
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let inserted = 0;
      for (const item of items) {
        const request = store.put(item);
        request.onsuccess = () => { inserted++; };
        request.onerror = () => { /* skip duplicates silently */ };
      }

      transaction.oncomplete = () => resolve(inserted);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Convert a row array + headers into a POItem object.
   */
  private rowToItem(
    headers: string[],
    row: (string | number)[],
    sheet: string
  ): POItem | null {
    const raw: Record<string, string | number> = { sheet };

    for (let i = 0; i < headers.length; i++) {
      const field = HEADER_MAP[headers[i]];
      if (field) {
        let value: string | number = row[i] ?? '';
        // Convert empty strings / blank values to empty string
        if (typeof value === 'string') {
          value = value.trim();
        }
        // Parse numeric fields
        if (NUMERIC_FIELDS.has(field) && typeof value === 'string') {
          value = value === '' ? 0 : parseFloat(value) || 0;
        }
        raw[field] = value;
      }
    }

    // sygId is required
    if (!raw.sygId) return null;

    return {
      sygId: String(raw.sygId),
      orderNum: String(raw.orderNum || ''),
      orderDate: String(raw.orderDate || ''),
      description: String(raw.description || ''),
      sku: String(raw.sku || ''),
      vendor: String(raw.vendor || ''),
      metalType: String(raw.metalType || ''),
      unitCost: Number(raw.unitCost) || 0,
      qtyOrdered: Number(raw.qtyOrdered) || 0,
      qtyShipped: Number(raw.qtyShipped) || 0,
      lineSubtotal: Number(raw.lineSubtotal) || 0,
      notes: String(raw.notes || ''),
      photoUrl: String(raw.photoUrl || ''),
      sheet,
    };
  }

  /**
   * Get all PO items.
   */
  async getAll(): Promise<POItem[]> {
    return this.getAllFromIndex(null);
  }

  /**
   * Get PO items by metal type (e.g. "Gold", "Silver").
   */
  async getByMetalType(metalType: string): Promise<POItem[]> {
    return this.getAllFromIndex('metalType', metalType);
  }

  /**
   * Get PO items by vendor name.
   */
  async getByVendor(vendor: string): Promise<POItem[]> {
    return this.getAllFromIndex('vendor', vendor);
  }

  /**
   * Get a single PO item by SKU. Returns null if not found.
   */
  async getBySku(sku: string): Promise<POItem | null> {
    return this.getOneFromIndex('sku', sku);
  }

  /**
   * Get a single PO item by its SYG ID.
   */
  async getById(sygId: string): Promise<POItem | null> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sygId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update the photoUrl for a specific PO item by sygId.
   * Returns true if the item was found and updated.
   */
  async updatePhotoUrl(sygId: string, photoUrl: string): Promise<boolean> {
    if (!this.db) throw new Error('DB not initialized');
    const item = await this.getById(sygId);
    if (!item) return false;

    item.photoUrl = photoUrl;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Search items by keyword in description, SKU, or vendor.
   */
  async search(query: string): Promise<POItem[]> {
    if (!this.db) throw new Error('DB not initialized');
    const all = await this.getAll();
    const q = query.toLowerCase();
    return all.filter(
      (item) =>
        item.description.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.vendor.toLowerCase().includes(q) ||
        item.sygId.toLowerCase().includes(q)
    );
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async getAllFromIndex(
    indexName: string | null,
    value?: string
  ): Promise<POItem[]> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      let source: IDBIndex | IDBObjectStore;
      if (indexName && value !== undefined) {
        source = store.index(indexName);
      } else {
        source = store;
      }

      const request = indexName && value !== undefined
        ? (source as IDBIndex).getAll(value)
        : (source as IDBObjectStore).getAll();

      request.onsuccess = () => resolve(request.result as POItem[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async getOneFromIndex(
    indexName: string,
    value: string
  ): Promise<POItem | null> {
    if (!this.db) throw new Error('DB not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index(indexName);
      const request = index.get(value);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }
}