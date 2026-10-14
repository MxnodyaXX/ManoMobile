import type { AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";

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
