/**
 * po-storage.test.ts — Unit tests for the PO Inventory database module
 *
 * Tests the POStorage class: import, querying, updating, and edge cases.
 *
 * Run: npx vitest run po-storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POStorage } from './po-storage';
import 'fake-indexeddb/auto';

import type { POItem } from '../types';

// ---------------------------------------------------------------------------
// Test data — small subset mimicking the po-full.json format
// ---------------------------------------------------------------------------

const MOCK_PO_DATA: Record<string, { headers: string[]; rows: (string | number)[][] }> = {
  Gold: {
    headers: ['SYG #', 'Order #', 'Order Date', 'Item Description', 'SKU', 'Vendor', 'Metal Type', 'Unit Cost', 'Qty Ordered', 'Qty Shipped', 'Line Subtotal', 'Line Tax', 'Profit Margin', 'Sales Price', 'Notes', 'Photo', 'Video'],
    rows: [
      ['SYG001', 'ORD-100', '2026-01-15', '1 oz Gold Bar', 'GBAR-1OZ', 'SD Bullion', 'Gold', 2100.00, '5', '5', 10500.00, 0, '', '', '', '', ''],
      ['SYG002', 'ORD-100', '2026-01-15', '1/10 oz Gold Coin', 'GCOIN-010', 'APMEX', 'Gold', 250.00, '10', '10', 2500.00, 0, '', '', '', '', ''],
      ['SYG003', 'ORD-101', '2026-02-01', '10 oz Silver Bar', 'SBAR-10OZ', 'JM Bullion', 'Silver', 280.00, '3', '3', 840.00, 0, '', '', '', '', ''],
    ],
  },
  Silver: {
    headers: ['SYG #', 'Order #', 'Order Date', 'Item Description', 'SKU', 'Vendor', 'Metal Type', 'Unit Cost', 'Qty Ordered', 'Qty Shipped', 'Line Subtotal', 'Notes', 'Photo'],
    rows: [
      ['SYG004', 'ORD-102', '2026-02-15', '1 oz Silver Round', 'SROUND-1OZ', 'APMEX', 'Silver', 32.50, '100', '100', 3250.00, '', '', ''],
      ['SYG005', 'ORD-103', '2026-03-01', '100 oz Silver Bar', 'SBAR-100OZ', 'SD Bullion', 'Silver', 3100.00, '1', '1', 3100.00, '', '', ''],
    ],
  },
  Platinum: {
    headers: ['SYG #', 'Order #', 'Order Date', 'Item Description', 'SKU', 'Vendor', 'Metal Type', 'Unit Cost', 'Qty Ordered', 'Qty Shipped', 'Line Subtotal', 'Notes', 'Photo'],
    rows: [
      ['SYG006', 'ORD-104', '2026-03-15', '1 oz Platinum Bar', 'PBAR-1OZ', 'SD Bullion', 'Platinum', 980.00, '2', '2', 1960.00, '', '', ''],
    ],
  },
  Supplies: {
    headers: ['SYG #', 'Order #', 'Order Date', 'Item Description', 'SKU', 'Vendor', 'Metal Type', 'Unit Cost', 'Qty Ordered', 'Qty Shipped', 'Line Subtotal', 'Notes', 'Photo'],
    rows: [
      ['SYG007', 'ORD-105', '2026-04-01', 'Coin Tubes (Pack of 10)', 'TUBE-10', 'Amazon', 'Supplies', 15.00, '20', '20', 300.00, '', '', ''],
    ],
  },
  Amazon: {
    headers: ['SYG #', 'Order #', 'Order Date', 'Item Description', 'SKU', 'Vendor', 'Metal Type', 'Unit Cost', 'Qty Ordered', 'Qty Shipped', 'Line Subtotal', 'Notes', 'Photo'],
    rows: [
      ['SYG008', 'ORD-106', '2026-04-15', 'Digital Scale 0.01g', 'SCALE-001', 'Amazon', 'Supplies', 45.00, '1', '1', 45.00, '', '', ''],
    ],
  },
  'SD Bullion': {
    headers: ['SYG #', 'Order #', 'Order Date', 'Item Description', 'SKU', 'Vendor', 'Metal Type', 'Unit Cost', 'Qty Ordered', 'Qty Shipped', 'Line Subtotal', 'Notes', 'Photo'],
    rows: [
      ['SYG009', 'ORD-107', '2026-05-01', '1 oz Gold Buffalo Coin', 'GBUFF-1OZ', 'SD Bullion', 'Gold', 2100.00, '2', '2', 4200.00, '', 'https://example.com/buffalo.jpg', ''],
    ],
  },
};

describe('POStorage', () => {
  let storage: POStorage;

  beforeEach(async () => {
    storage = new POStorage();
    await storage.init();
    // Clear the object store between tests to prevent cross-test pollution
    // @ts-ignore — access private db for cleanup
    const db = storage.db as IDBDatabase;
    if (db.objectStoreNames.contains('po_items')) {
      const transaction = db.transaction('po_items', 'readwrite');
      const store = transaction.objectStore('po_items');
      store.clear();
      await new Promise<void>((resolve) => {
        transaction.oncomplete = () => resolve();
      });
    }
  });

  afterEach(async () => {
    await storage.close();
  });

  // -----------------------------------------------------------------------
  // Import
  // -----------------------------------------------------------------------

  it('PO-01: imports data from po-full.json format', async () => {
    const count = await storage.importFromJson(MOCK_PO_DATA);
    expect(count).toBeGreaterThan(0);
    expect(await storage.getCount()).toBe(count);
  });

  it('PO-02: import reports correct total count', async () => {
    const count = await storage.importFromJson(MOCK_PO_DATA);
    // 9 total items across all sheets
    expect(count).toBe(9);
  });

  it('PO-03: isImported returns false before import, true after', async () => {
    expect(await storage.isImported()).toBe(false);
    await storage.importFromJson(MOCK_PO_DATA);
    expect(await storage.isImported()).toBe(true);
  });

  it('PO-04: importing same data twice is idempotent (upsert)', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const firstCount = await storage.getCount();
    await storage.importFromJson(MOCK_PO_DATA);
    const secondCount = await storage.getCount();
    // Same items should overwrite (same keys), so count stays the same
    expect(secondCount).toBe(firstCount);
  });

  // -----------------------------------------------------------------------
  // Querying
  // -----------------------------------------------------------------------

  it('PO-05: getAll returns all items', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const all = await storage.getAll();
    expect(all).toHaveLength(9);
  });

  it('PO-06: getByMetalType returns only items of that metal type', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const gold = await storage.getByMetalType('Gold');
    expect(gold).toHaveLength(3); // SYG001, SYG002, SYG009
    gold.forEach((item) => expect(item.metalType).toBe('Gold'));
  });

  it('PO-07: getByVendor returns only items from that vendor', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const sdBullion = await storage.getByVendor('SD Bullion');
    expect(sdBullion).toHaveLength(4); // SYG001, SYG005, SYG006, SYG009
    sdBullion.forEach((item) => expect(item.vendor).toBe('SD Bullion'));
  });

  it('PO-08: getBySku returns the correct item', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const item = await storage.getBySku('GBAR-1OZ');
    expect(item).not.toBeNull();
    expect(item!.sygId).toBe('SYG001');
    expect(item!.description).toBe('1 oz Gold Bar');
    expect(item!.unitCost).toBe(2100.00);
  });

  it('PO-09: getBySku returns null for non-existent SKU', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const item = await storage.getBySku('NONEXISTENT');
    expect(item).toBeNull();
  });

  it('PO-10: getById returns the correct item', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const item = await storage.getById('SYG003');
    expect(item).not.toBeNull();
    expect(item!.sku).toBe('SBAR-10OZ');
    expect(item!.sheet).toBe('Gold');
  });

  it('PO-11: getById returns null for non-existent ID', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const item = await storage.getById('FAKEID');
    expect(item).toBeNull();
  });

  it('PO-12: getByMetalType returns empty array for non-existent type', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const items = await storage.getByMetalType('Copper');
    expect(items).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Updating photoUrl
  // -----------------------------------------------------------------------

  it('PO-13: updatePhotoUrl updates the photoUrl field', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const result = await storage.updatePhotoUrl('SYG001', 'https://example.com/new-photo.jpg');
    expect(result).toBe(true);

    const updated = await storage.getById('SYG001');
    expect(updated!.photoUrl).toBe('https://example.com/new-photo.jpg');
  });

  it('PO-14: updatePhotoUrl returns false for non-existent ID', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const result = await storage.updatePhotoUrl('FAKEID', 'https://example.com/photo.jpg');
    expect(result).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  it('PO-15: search finds items by keyword in description', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const results = await storage.search('Gold');
    // Should match "Gold Bar", "Gold Coin", "Gold Buffalo" descriptions
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('PO-16: search finds items by SKU', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const results = await storage.search('GBAR-1OZ');
    expect(results).toHaveLength(1);
    expect(results[0].sygId).toBe('SYG001');
  });

  it('PO-17: search finds items by vendor', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const results = await storage.search('APMEX');
    expect(results).toHaveLength(2); // SYG002, SYG004
  });

  it('PO-18: search returns empty array for no matches', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const results = await storage.search('XYZZZ');
    expect(results).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('PO-19: handles empty data import', async () => {
    const count = await storage.importFromJson({});
    expect(count).toBe(0);
    expect(await storage.isImported()).toBe(false);
  });

  it('PO-20: handles sheet with no rows', async () => {
    const count = await storage.importFromJson({
      Empty: { headers: ['SYG #', 'Description', 'SKU', 'Vendor', 'Metal Type'], rows: [] },
    });
    expect(count).toBe(0);
  });

  it('PO-21: item has correct shape after import', async () => {
    await storage.importFromJson(MOCK_PO_DATA);
    const item = await storage.getById('SYG001');
    expect(item).toMatchObject({
      sygId: 'SYG001',
      orderNum: 'ORD-100',
      orderDate: '2026-01-15',
      description: '1 oz Gold Bar',
      sku: 'GBAR-1OZ',
      vendor: 'SD Bullion',
      metalType: 'Gold',
      unitCost: 2100.00,
      qtyOrdered: 5,
      qtyShipped: 5,
      lineSubtotal: 10500.00,
      notes: '',
      photoUrl: '',
      sheet: 'Gold',
    });
  });

  it('PO-22: getAll returns empty array when no data imported', async () => {
    const all = await storage.getAll();
    expect(all).toEqual([]);
  });

  it('PO-23: getCount returns 0 when no data imported', async () => {
    expect(await storage.getCount()).toBe(0);
  });
});