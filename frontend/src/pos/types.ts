/**
 * The POS screen's own vocabulary.
 *
 * Ported from iPark (github.com/MxnodyaXX/iPark), whose screen this is. The
 * shapes are kept so the components could be lifted almost as they were; what
 * changed is where the data comes from — see PosScreen.tsx for the mapping
 * from ManoMobile's accessory catalogue and credit accounts onto these.
 */

export interface Product {
  /** accessory_products.id */
  id: number;
  name: string;
  /** The product code, printed on the shelf label. */
  sku: string;
  price: number;
  category: string;
  stock: number;
}

export interface CartLine {
  id: string;
  product: Product;
  qty: number;
  addedAt: number;
}

export type PartyType = "customer" | "dealer";

export interface Party {
  /** The credit account id, or "dealer:<n>" for a repair dealer with no account yet. */
  id: string;
  type: PartyType;
  name: string;
  phone: string;
  address?: string;
  /** Amount already owed from previous sales, carried on their account. */
  outstandingBalance: number;
  /** Set once the party has a credit account to carry a balance. */
  accountId: string | null;
  /** The repair_dealers row, when this is one of the shop's dealers. */
  dealerId: number | null;
}

export type PaymentMethod = "cash" | "card" | "credit" | "check";

export interface SaleSnapshot {
  lines: CartLine[];
  party: Party | null;
  discountAmount: number;
  writeOffAmount: number;
  paidOverride: number | null;
}

export interface HeldSale extends SaleSnapshot {
  id: string;
  heldAt: number;
}
