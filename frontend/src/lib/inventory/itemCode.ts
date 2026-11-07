/** "Data Cable" -> "DC". */
export function categoryAbbr(category: string): string {
  return category.split(/[\s/\-–]+/).filter(Boolean).map(w => w[0].toUpperCase()).join("");
}

/**
 * The next code for a category: one above the highest in use, so DC-010 gives
 * DC-011 even with gaps below it. Reads every code passed in, whatever its
 * capitals or padding. Every screen that adds a product takes its code from here.
 */
export function nextItemCode(category: string, takenCodes: string[]): string {
  const abbr = categoryAbbr(category);
  if (!abbr) return "";
  const pattern = new RegExp(`^${abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`, "i");
  const highest = takenCodes.reduce((max, code) => {
    const match = code.trim().match(pattern);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `${abbr}-${String(highest + 1).padStart(3, "0")}`;
}
