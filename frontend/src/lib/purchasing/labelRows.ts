import type { AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import type { SparePart } from "@/cashier/contexts/PartsContext";

export type LabelRow =
  | { key: string; kind: "accessory"; name: string; code: string; qty: number; hasBoxBarcode: boolean; product: AccessoryProduct }
  | { key: string; kind: "part"; name: string; code: string; qty: number; hasBoxBarcode: false; part: SparePart };

interface LabelLine {
  productId: number | null;
  partId: number | null;
  qty: number;
  receivedQty: number;
}

/**
 * One row per product or part on an invoice, however many lines it's on. Counts
 * what came in, or what was billed for a line with nothing received yet, so a
 * short delivery doesn't print labels for stock that isn't there.
 */
export function buildLabelRows(lines: LabelLine[], products: AccessoryProduct[], parts: SparePart[]): LabelRow[] {
  const rows = new Map<string, LabelRow>();
  for (const line of lines) {
    const qty = line.receivedQty > 0 ? line.receivedQty : line.qty;
    if (line.partId) {
      const part = parts.find(p => Number(p.id) === line.partId);
      if (!part) continue;
      const key = `part-${line.partId}`;
      const seen = rows.get(key);
      if (seen) seen.qty += qty;
      else rows.set(key, { key, kind: "part", name: part.name, code: part.sku, qty, hasBoxBarcode: false, part });
    } else if (line.productId) {
      const product = products.find(p => p.id === line.productId);
      if (!product) continue;
      const key = `accessory-${line.productId}`;
      const seen = rows.get(key);
      if (seen) seen.qty += qty;
      else rows.set(key, { key, kind: "accessory", name: product.name, code: product.code, qty, hasBoxBarcode: product.barcodes.length > 0, product });
    }
  }
  return [...rows.values()];
}
