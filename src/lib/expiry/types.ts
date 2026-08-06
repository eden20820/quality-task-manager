export interface ParsedExpiryItem {
  materialName: string;
  expiryDate: Date | null;
  quantity: number | null;
  location: string;
  invalidExpiryText: string | null;
  isRejected: boolean;
  rowNumber: number;
}

export interface ValidationError {
  row: number;
  message: string;
}

export interface SyncResult {
  newItems: ParsedExpiryItem[];
  updatedItems: ParsedExpiryItem[];
  unchangedItems: ParsedExpiryItem[];
  inactiveItems: string[];
  invalidItems: ValidationError[];
}