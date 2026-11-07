/** A typed, comma-separated device list as its entries. */
export const splitDevices = (text: string) => text.split(",").map(s => s.trim()).filter(Boolean);

/** Each name once, whatever its capitals, most used first. */
export function buildDeviceList(names: string[]): string[] {
  const seen = new Map<string, { name: string; count: number }>();
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase();
    const hit = seen.get(key);
    if (hit) hit.count += 1;
    else seen.set(key, { name, count: 1 });
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map(d => d.name);
}

/** What fits the entry being typed after the last comma, leaving out anything already listed. */
export function suggestDevices(known: string[], text: string, limit = 8): string[] {
  const parts = text.split(",");
  const typing = parts[parts.length - 1].trim().toLowerCase();
  if (!typing) return [];
  const listed = new Set(parts.slice(0, -1).map(s => s.trim().toLowerCase()));
  const words = typing.split(/\s+/);
  return known
    .filter(d => {
      const name = d.toLowerCase();
      return name !== typing && !listed.has(name) && words.every(w => name.includes(w));
    })
    .slice(0, limit);
}

/** Puts a picked device in place of what was being typed, ready for the next one. */
export function applyDeviceSuggestion(text: string, device: string): string {
  const parts = text.split(",").slice(0, -1).map(s => s.trim()).filter(Boolean);
  return [...parts, device].join(", ") + ", ";
}
