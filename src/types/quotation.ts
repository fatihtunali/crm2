/**
 * Quotation-related types
 * @module types/quotation
 */

import type { Money } from '@/types/api';

/**
 * Quotation item representing a supplier service or expense
 */
export interface QuotationItem {
  /** Type of supplier providing the service */
  supplier_type: 'hotel' | 'guide' | 'vehicle' | 'restaurant' | 'entrance_fee' | 'extra_expense' | 'transfer' | 'tour_package';
  /** ID of the supplier */
  supplier_id: number;
  /** Date of service (optional) */
  date?: string;
  /** Quantity of the service/item */
  qty: number;
  /** Unit price with currency */
  unit_price: Money;
  /** Additional notes (optional) */
  notes?: string;
}
