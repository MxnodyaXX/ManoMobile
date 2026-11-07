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

/** The barcodes a label for this part can print. The shop's own comes first. */
export const partBarcodeOptions = (p: Pick<SparePart, "sku" | "barcodes">) =>
  withSupplierCodes({ value: p.sku, label: "Our SKU" }, p.barcodes ?? []);

/** Starts on what was scanned, if it's one of these. Otherwise the shop's own. */
export function pickBarcode(options: BarcodeOption[], scanned = ""): string {
  const key = normalizeScanCode(scanned);
  return options.find(o => key && normalizeScanCode(o.value) === key)?.value ?? options[0].value;
}
