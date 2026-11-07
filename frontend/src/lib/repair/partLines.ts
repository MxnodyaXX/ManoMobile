/**
 * The Parts Used list while a job is being finished: one line per part, "Name" or
 * "Name ×2".
 *
 * Two types of a part can share a name, so a line picked from the catalogue also
 * carries its SKU, in a marker that never leaves this screen. That's what decides
 * whose stock and cost it uses. What gets saved on the job and printed on the
 * receipt is the plain text, as it always was.
 */

const MARKER = /\s*\[\[(.+?)\]\]/;

export interface PartLine {
  /** The line without its count: what identifies it in the list. */
  key: string;
  name: string;
  sku: string | null;
  qty: number;
}

export function parsePartLine(line: string): PartLine {
  const counted = /^(.*?)(?:\s*×\s*(\d+))?$/.exec(line.trim());
  const key = (counted?.[1] ?? line).trim();
  const sku = MARKER.exec(key)?.[1]?.trim() ?? null;
  return { key, name: key.replace(MARKER, "").trim(), sku, qty: Math.max(1, Number(counted?.[2] ?? 1)) };
}

const linesOf = (text: string) => text.split("\n").map(l => l.trim()).filter(Boolean);

/** Adds a picked part. The same part again counts up; another type of the same name gets its own line. */
export function addPartLine(text: string, part: { name: string; sku: string }): string {
  const key = `${part.name} [[${part.sku}]]`;
  const lines = linesOf(text);
  const at = lines.findIndex(l => parsePartLine(l).key === key);
  if (at < 0) return [...lines, key].join("\n");
  lines[at] = `${key} ×${parsePartLine(lines[at]).qty + 1}`;
  return lines.join("\n");
}

/** Sets a line's count. Zero takes it off. */
export function setPartLineQty(text: string, key: string, qty: number): string {
  return linesOf(text).flatMap(l => {
    if (parsePartLine(l).key.toLowerCase() !== key.toLowerCase()) return [l];
    return qty <= 0 ? [] : [qty === 1 ? parsePartLine(l).key : `${parsePartLine(l).key} ×${qty}`];
  }).join("\n");
}

/** The list as it's saved on the job and printed: names and counts only. */
export const savedPartLines = (text: string) => linesOf(text).map(l => {
  const { name, qty } = parsePartLine(l);
  return qty > 1 ? `${name} ×${qty}` : name;
});
