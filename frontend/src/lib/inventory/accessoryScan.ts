import type { AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import type { SparePart } from "@/cashier/contexts/PartsContext";

/**
 * Comparable form of a scanned or stored code.
 *
 * Case and surrounding whitespace never matter. Leading zeros on an all-digit
 * code don't either: the same UPC-A box reads as "012345678905" on one scanner
 * and as the EAN-13 "0012345678905" on another, depending on its settings.
 */
export function normalizeScanCode(code: string): string {
  const s = code.trim().toUpperCase();
  return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, "") : s;
}

/**
 * Every product a scanned value could mean — the shop's numeric label barcode,
 * its item code (older labels encode that), or any manufacturer barcode linked
 * to it. More than one result is normal for cheap
 * accessories that share one barcode across colours/models; the caller asks
 * which one.
 */
export function matchScannedAccessory<T extends AccessoryProduct>(products: T[], scanned: string): T[] {
  const key = normalizeScanCode(scanned);
  if (!key) return [];
  return products.filter(p =>
    normalizeScanCode(p.code) === key ||
    (!!p.labelBarcode && normalizeScanCode(p.labelBarcode) === key) ||
    p.barcodes.some(b => normalizeScanCode(b) === key),
  );
}

/** Every repair part a scanned value could mean: its SKU, its number, or a supplier's barcode. */
export function matchScannedPart<T extends SparePart>(parts: T[], scanned: string): T[] {
  const key = normalizeScanCode(scanned);
  if (!key) return [];
  return parts.filter(p =>
    normalizeScanCode(p.sku) === key ||
    (!!p.partNo && normalizeScanCode(p.partNo) === key) ||
    (p.barcodes ?? []).some(b => normalizeScanCode(b) === key),
  );
}

export interface BarcodeOption { value: string; label: string }

function withSupplierCodes(own: BarcodeOption, supplierCodes: string[]): BarcodeOption[] {
  const seen = new Set([normalizeScanCode(own.value)]);
  const options = [own];
  for (const code of supplierCodes) {
    const key = normalizeScanCode(code);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value: code, label: supplierCodes.length > 1 ? `Supplier's (${options.length})` : "Supplier's" });
  }
  return options;
}

/** The barcodes a label for this product can print. The shop's own comes first. */
export const accessoryBarcodeOptions = (p: Pick<AccessoryProduct, "labelBarcode" | "code" | "barcodes">) =>
  withSupplierCodes({ value: p.labelBarcode || p.code, label: "Our label" }, p.barcodes);

/**
 * What a part's own barcode encodes: its number, as five digits. An SKU can be too
 * long for a 38mm label to hold bars a scanner can read. The number is short,
 * unique and never changes, and leading zeros don't matter to a scan, so 01012
 * finds part 1012. Past 99999 it simply grows. A part with no number yet uses its SKU.
 */
export const partScanCode = (p: Pick<SparePart, "sku" | "partNo">) =>
  p.partNo ? p.partNo.padStart(5, "0") : p.sku;

/** The barcodes a label for this part can print. The short number comes first. */
export function partBarcodeOptions(p: Pick<SparePart, "sku" | "partNo" | "barcodes">): BarcodeOption[] {
  const own = partScanCode(p);
  const skuToo = own === p.sku ? [] : [{ value: p.sku, label: "SKU" }];
  const [first, ...suppliers] = withSupplierCodes({ value: own, label: own === p.sku ? "SKU" : "Part number" }, p.barcodes ?? []);
  return [first, ...skuToo, ...suppliers];
}

/** Whether a part's own codes or its barcodes match what's in a search box. */
export const partCodeMatches = (p: SparePart, search: string) =>
  matchScannedPart([p], search).length > 0;

/** Starts on what was scanned, if it's one of these. Otherwise the shop's own. */
export function pickBarcode(options: BarcodeOption[], scanned = ""): string {
  const key = normalizeScanCode(scanned);
  return options.find(o => key && normalizeScanCode(o.value) === key)?.value ?? options[0].value;
}
