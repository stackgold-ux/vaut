export type Metal = 'Gold' | 'Silver' | 'Platinum' | 'Copper';

export interface Holding {
  id: string;
  metal: Metal;
  quantity: number;
  unit: string;
  /** The timestamp when this holding record was added to the vault (ISO 8601) */
  addedDate: string;
  note?: string;
  /** The date the metal was purchased (ISO date string, e.g. "2025-06-01") */
  purchaseDate?: string;
  /** Purchase price in the user's preferred currency */
  purchasePrice?: number;
  /** Optional descriptive note about the holding */
  description?: string;
  /** Optional URL to a photo of the holding (e.g. a certificate or bar photo) */
  photoUrl?: string;
}

export interface VaultState {
  holdings: Holding[];
  isLocked: boolean;
}

/** A single line item from a purchase order / inventory import */
export interface POItem {
  sygId: string;
  orderNum: string;
  orderDate: string;
  description: string;
  sku: string;
  vendor: string;
  metalType: string;
  unitCost: number;
  qtyOrdered: number;
  qtyShipped: number;
  lineSubtotal: number;
  notes: string;
  photoUrl: string;
  /** The source sheet from the XLSX (e.g. "Gold", "Silver", "Amazon") */
  sheet: string;
}
