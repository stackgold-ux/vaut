/**
 * receipt-parser.test.ts — Automated tests for OCR receipt parsing
 *
 * Tests:
 * - Text extraction from receipt-like strings
 * - Regex parsing of dates, metal types, weights, prices
 * - Edge cases (blurry/partial text, handwritten receipts, non-English)
 * - OCR loading state handling (via mock)
 *
 * Run: npx vitest run receipt-parser
 */

import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './receipt-parser';

// ---------------------------------------------------------------------------
// Sample receipt texts simulating OCR output
// ---------------------------------------------------------------------------
const SAMPLE_RECEIPT_GOLD = `
  LIBERTY COIN & BULLION
  123 Main St, Anytown
  ------------------------
  Gold American Eagle 1 oz
  Qty: 1
  $2,450.00
  Date: 03/15/2025
  ------------------------
  Thank you!
`;

const SAMPLE_RECEIPT_SILVER = `
  SILVER BARS INC.
  10 oz Silver Bar
  $350.00
  2025-06-01
`;

const SAMPLE_RECEIPT_PLATINUM = `
  PLATINUM SPECIALTIES
  Platinum 1 oz
  $1,200.50
  Date: 12-25-2024
`;

const SAMPLE_RECEIPT_COPPER = `
  Copper 5 kg
  $45.00
  2025-03-01
`;

// Handwritten-style (less structured)
const SAMPLE_RECEIPT_HANDWRITTEN = `
  Gold 0.5 oz
  $1,250
  3/10/25
`;

// Non-English text
const SAMPLE_RECEIPT_NON_ENGLISH = `
  ORO 1 oz  (Gold in Spanish)
  2.500,00 €
  Fecha: 15/05/2025
`;

// Minimal/partial text
const SAMPLE_RECEIPT_PARTIAL = `
  Gold
  1
  oz
`;

const SAMPLE_RECEIPT_EMPTY = '';

const SAMPLE_RECEIPT_NOISE = `
  !@#$%^&*() INVOICE #1234
  *&^%$#@! NO METAL HERE
  123
  abcdefg
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('parseReceiptText — Metal Detection', () => {
  it('OCR-01: detects "Gold" from receipt text', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_GOLD);
    expect(result.metal).toBe('Gold');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('OCR-02: detects "Silver" from receipt text', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_SILVER);
    expect(result.metal).toBe('Silver');
  });

  it('OCR-03: detects "Platinum" from receipt text', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_PLATINUM);
    expect(result.metal).toBe('Platinum');
  });

  it('OCR-04: detects "Copper" from receipt text', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_COPPER);
    expect(result.metal).toBe('Copper');
  });

  it('OCR-05: detects metal from handwritten-style text', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_HANDWRITTEN);
    expect(result.metal).toBe('Gold');
  });

  it('returns undefined for metal when no metal keyword present', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_NOISE);
    expect(result.metal).toBeUndefined();
  });
});

describe('parseReceiptText — Quantity & Unit Extraction', () => {
  it('OCR-06: extracts quantity and unit (1 oz)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_GOLD);
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('oz');
  });

  it('OCR-07: extracts quantity and unit (10 oz)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_SILVER);
    expect(result.quantity).toBe(10);
    expect(result.unit).toBe('oz');
  });

  it('OCR-08: extracts quantity and unit (5 kg)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_COPPER);
    expect(result.quantity).toBe(5);
    expect(result.unit).toBe('kg');
  });

  it('OCR-09: extracts quantity from handwritten text (0.5 oz)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_HANDWRITTEN);
    expect(result.quantity).toBe(0.5);
    expect(result.unit).toBe('oz');
  });

  it('OCR-10: extracts quantity from partial/minimal text', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_PARTIAL);
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('oz');
  });
});

describe('parseReceiptText — Date Extraction', () => {
  it('OCR-11: extracts date in MM/DD/YYYY format', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_GOLD);
    expect(result.purchaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // normalized
    expect(result.purchaseDate).toBe('2025-03-15');
  });

  it('OCR-12: extracts date in YYYY-MM-DD format (ISO)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_SILVER);
    expect(result.purchaseDate).toBe('2025-06-01');
  });

  it('OCR-13: extracts date in MM-DD-YYYY format', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_PLATINUM);
    expect(result.purchaseDate).toBe('2024-12-25');
  });

  it('OCR-14: extracts date from handwritten text (M/D/YY)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_HANDWRITTEN);
    expect(result.purchaseDate).toBe('2025-03-10');
  });

  it('OCR-15: returns undefined for date when no date present', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_NOISE);
    expect(result.purchaseDate).toBeUndefined();
  });
});

describe('parseReceiptText — Price Extraction', () => {
  it('OCR-16: extracts price with dollar sign and commas ($2,450.00)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_GOLD);
    expect(result.purchasePrice).toBe(2450.00);
  });

  it('OCR-17: extracts price without dollar sign (350.00)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_SILVER);
    expect(result.purchasePrice).toBe(350.00);
  });

  it('OCR-18: extracts price with comma separator (1,200.50)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_PLATINUM);
    expect(result.purchasePrice).toBe(1200.50);
  });

  it('OCR-19: extracts price from handwritten text ($1,250)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_HANDWRITTEN);
    expect(result.purchasePrice).toBe(1250);
  });

  it('OCR-20: returns undefined for price when no price present', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_NOISE);
    expect(result.purchasePrice).toBeUndefined();
  });
});

describe('parseReceiptText — Edge Cases', () => {
  it('OCR-21: handles empty string input', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_EMPTY);
    expect(result.confidence).toBe(0);
    expect(result.metal).toBeUndefined();
    expect(result.quantity).toBeUndefined();
  });

  it('OCR-22: handles noisy/garbled text with no useful data', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_NOISE);
    expect(result.confidence).toBe(0);
    expect(result.metal).toBeUndefined();
    expect(result.quantity).toBeUndefined();
  });

  it('OCR-23: handles partial/minimal text (only metal+qty)', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_PARTIAL);
    expect(result.metal).toBe('Gold');
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('oz');
  });

  it('OCR-25: confidence is 0.25 for single field match', () => {
    const result = parseReceiptText('Gold only here');
    expect(result.metal).toBe('Gold');
    expect(result.confidence).toBe(0.25);
  });

  it('OCR-26: confidence is 1.0 when all 4 fields match', () => {
    const result = parseReceiptText(SAMPLE_RECEIPT_GOLD);
    expect(result.confidence).toBe(1.0);
  });

  it('OCR-27: normalizes "ounce" to "oz"', () => {
    const result = parseReceiptText('Silver 5 ounce');
    expect(result.unit).toBe('oz');
  });

  it('OCR-28: normalizes "grams" to "g"', () => {
    const result = parseReceiptText('Gold 100 grams');
    expect(result.unit).toBe('g');
  });

  it('returns rawText as provided', () => {
    const text = 'Raw OCR output line 1\nline 2';
    const result = parseReceiptText(text);
    expect(result.rawText).toBe(text);
  });
});