/** One lot of an item's stock, as its expanded row shows it. */
export interface StockBatch {
  id: number;
  /** The product's or part's id. */
  itemId: string;
  batchNo: string;
  source: "purchase" | "opening" | "adjustment" | "return";
  manual: boolean;
  dateUnknown: boolean;
  supplierName: string;
  invoiceNo?: string;
  receivedOn: string;
  qtyReceived: number;
  qtyAvailable: number;
  unitCost: number;
  supplierWarrantyDays: number | null;
  note: string;
}

export type BatchKind = "part" | "accessory";

const rs = (v: number) => `Rs. ${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
export const batchDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The order they'll be used in, soonest first. The same order the database takes
 * them: a part's opening stock goes first of all, then oldest date, then oldest entry.
 */
export function orderBatches(batches: StockBatch[], kind: BatchKind): StockBatch[] {
  return [...batches].sort((a, b) =>
    (kind === "part" ? Number(b.source === "opening") - Number(a.source === "opening") : 0)
    || a.receivedOn.localeCompare(b.receivedOn)
    || a.id - b.id);
}

export const batchLabel = (b: StockBatch) =>
  b.source === "opening" ? (b.manual ? "Old stock" : "Stock from before batches")
  : b.source === "adjustment" ? "Stock adjustment"
  : b.source === "return" ? "Returned from a sale"
  : b.supplierName || "Supplier invoice";

/**
 * What sets this batch apart from the item's others. Only what actually differs:
 * listing every detail of every batch would hide the one that matters. Prices are
 * compared with the newest batch, the one a new price would have come from.
 */
export function batchDifferences(
  batch: StockBatch,
  ordered: StockBatch[],
  warranty: (days: number) => string = days => `${days} days`,
): string[] {
  const out: string[] = [];
  const distinct = <T,>(get: (b: StockBatch) => T) => new Set(ordered.map(get)).size > 1;
  const newest = ordered[ordered.length - 1];

  if (distinct(b => b.unitCost)) {
    const gap = batch.unitCost - newest.unitCost;
    if (batch === newest) out.push("Latest price");
    else if (gap !== 0) out.push(`${rs(Math.abs(gap))} ${gap < 0 ? "less" : "more"} than the latest`);
    else out.push("Same price as the latest");
  }
  if (batch.source === "purchase" && distinct(b => b.supplierName)) out.push(`From ${batch.supplierName || "another supplier"}`);
  if (batch.source !== "purchase") out.push(batchLabel(batch));
  if (distinct(b => b.supplierWarrantyDays)) {
    out.push(batch.supplierWarrantyDays == null ? "No supplier warranty" : `Supplier warranty: ${warranty(batch.supplierWarrantyDays)}`);
  }
  if (batch.note) out.push(batch.note);
  if (out.length === 0) out.push("Same details, separate delivery");
  return out;
}
