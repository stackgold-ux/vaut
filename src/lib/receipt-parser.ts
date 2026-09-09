/**
 * receipt-parser.ts — OCR receipt text parsing for Stack Your Vault
 *
 * Extracts metal type, quantity, unit, date, and price from OCR'd receipt text.
 * Uses regex patterns to find common receipt layouts.
 *
 * Designed to work alongside Tesseract.js OCR output.
 */

import type { Metal } from '../types';

export interface ParsedReceipt {
  /** Confidence score (0-1) for the overall extraction */
  confidence: number;
  metal?: Metal;
  quantity?: number;
  unit?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  /** Human-readable description of what was matched */
  rawText: string;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const METAL_KEYWORDS: Record<string, any> = {
  'gold': 'Gold',
  'au': 'Gold',
  'silver': 'Silver',
  'ag': 'Silver',
  'platinum': 'Platinum',
  'pt': 'Platinum',
  'palladium': 'Platinum', // Map to Platinum or cast
  'pd': 'Platinum',
  'copper': 'Copper',
  'cu': 'Copper',
};

/** Matches "Gold", "SILVER", "1 oz Platinum", "Pt" etc. */
const METAL_PATTERN = /\b(Gold|Silver|Platinum|Palladium|Copper|AU|AG|PT|PD|CU)\b/i;

/** Matches quantities like "10", "0.5", "1.25 oz" */
const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s*(oz|g|kg|ounce|gram|grams|ozt)\b/i;
const QUANTITY_ALONE_PATTERN = /^(\d+(?:\.\d+))\s*$/m;

/** Matches dates in various formats */
const DATE_PATTERN = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}-\d{2}-\d{2})/;

/** Matches prices like "$1,250.50", "1250.50", "$350.00", "€45.00" */
const PRICE_PATTERN = /(?:[\$\€\£]\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+\.\d{2})|(\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:USD|EUR|GBP)?/i;

/** Matches unit abbreviations */
const UNIT_PATTERN = /\b(oz|g|kg|ounce|gram|ozt)\b/i;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseReceiptText(text: string): ParsedReceipt {
  if (!text || text.trim().length === 0) {
    return { confidence: 0, rawText: text };
  }

  let fieldsMatched = 0;
  const result: ParsedReceipt = { rawText: text, confidence: 0 };

  // 1. Extract metal type
  const metalMatch = text.match(METAL_PATTERN);
  if (metalMatch) {
    const key = metalMatch[1].toLowerCase();
    result.metal = METAL_KEYWORDS[key] ?? metalMatch[1] as Metal;
    fieldsMatched++;
  }

  // 2. Extract quantity and unit
  const qtyMatch = text.match(QUANTITY_PATTERN);
  if (qtyMatch) {
    result.quantity = parseFloat(qtyMatch[1]);
    result.unit = normalizeUnit(qtyMatch[2]);
    fieldsMatched++;
  } else {
    // Try bare number on its own line
    const bareQty = text.match(QUANTITY_ALONE_PATTERN);
    if (bareQty) {
      result.quantity = parseFloat(bareQty[1]);
      fieldsMatched++;
    }
    // Try to extract just the unit
    const unitMatch = text.match(UNIT_PATTERN);
    if (unitMatch) {
      result.unit = normalizeUnit(unitMatch[1]);
    }
  }

  // 3. Extract date
  const dateMatch = text.match(DATE_PATTERN);
  if (dateMatch) {
    result.purchaseDate = normalizeDate(dateMatch[0]);
    fieldsMatched++;
  }

  // 4. Extract price
  const priceMatch = text.match(PRICE_PATTERN);
  if (priceMatch) {
    const raw = (priceMatch[1] || priceMatch[2] || '').replace(/,/g, '');
    if (raw) {
      result.purchasePrice = parseFloat(raw);
      fieldsMatched++;
    }
  }

  // Calculate confidence based on how many fields were matched (out of 4)
  result.confidence = Math.min(fieldsMatched / 4, 1.0);

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase();
  if (u === 'ounce' || u === 'ounces' || u === 'ozt') return 'oz';
  if (u === 'gram' || u === 'grams') return 'g';
  if (u === 'kg' || u === 'kilo' || u === 'kilos') return 'kg';
  return u;
}

function normalizeDate(dateStr: string): string {
  // If already ISO format (YYYY-MM-DD), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Parse common formats: MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY
  const parts = dateStr.split(/[/-]/);
  if (parts.length === 3) {
    let year = parts[2];
    let month = parts[0];
    let day = parts[1];

    // Handle 2-digit years
    if (year.length === 2) {
      year = `20${year}`;
    }

    // Pad single-digit months/days
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  return dateStr;
}