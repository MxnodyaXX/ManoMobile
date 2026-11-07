/**
 * The part of a barcode's box that's clear of the label's text and images.
 *
 * A box can be drawn running under the text beside it, and the bars fill their
 * box, so without this they'd print over the words. Whatever sits above the
 * barcode's middle pushes its top down, and whatever sits below pulls its bottom
 * up. If that would leave too little to scan, the box stays as drawn.
 */
export function barcodeClearArea<T extends { x: number; y: number; w: number; h: number; id: string; type: string }>(
  barcode: T,
  elements: T[],
  minHeightMm = 4,
): { y: number; h: number } {
  const middle = barcode.y + barcode.h / 2;
  let top = barcode.y;
  let bottom = barcode.y + barcode.h;
  for (const other of elements) {
    if (other.id === barcode.id || (other.type !== "text" && other.type !== "image")) continue;
    const sideBySide = other.x + other.w <= barcode.x || other.x >= barcode.x + barcode.w;
    const apart = other.y + other.h <= barcode.y || other.y >= barcode.y + barcode.h;
    if (sideBySide || apart) continue;
    if (other.y + other.h / 2 < middle) top = Math.max(top, other.y + other.h);
    else bottom = Math.min(bottom, other.y);
  }
  return bottom - top >= minHeightMm ? { y: top, h: bottom - top } : { y: barcode.y, h: barcode.h };
}
