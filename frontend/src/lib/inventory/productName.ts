/**
 * The shop's naming format for accessories:
 *
 *   Samsung A03s Silicone Back Cover - Black
 *   brand   model subcategory+category   variant
 *
 * A name has to make sense on its own, because invoices and the website show
 * it without the Brand and Category columns beside it. The name stays the only
 * thing stored: the variant is read back from the part after " - ", so this
 * needs no new database column.
 */

export interface ProductNameParts {
  brand: string;
  model: string;
  category: string;
  subcategory: string;
  variant?: string;
}

const VARIANT_SEPARATOR = " - ";

// Words that describe the absence of a brand or subcategory, not a real one.
const NO_BRAND = /^(no ?brand|non ?brand|generic|unbranded|other|others|none|n\/?a|-)$/i;
const NO_SUBCATEGORY = /^(other|others|general|misc|none|n\/?a|-)$/i;

// Plural on purpose, or ending in s without being plural.
const KEEP_FINAL_S = /(ss|us|is|lens|earphones|headphones|earbuds|airpods|handsfree)$/i;

function singular(word: string): string {
  if (word.length < 4 || KEEP_FINAL_S.test(word)) return word;
  if (/[^aeiou]ies$/i.test(word)) return `${word.slice(0, -3)}y`;
  return word.endsWith("s") || word.endsWith("S") ? word.slice(0, -1) : word;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** "Back Covers" -> "Back Cover". Only the last word carries the plural. */
function singularPhrase(phrase: string): string {
  const w = words(phrase);
  if (w.length) w[w.length - 1] = singular(w[w.length - 1]);
  return w.join(" ");
}

/**
 * For comparing words. A word with a digit in it keeps its s, because the A03
 * and the A03s are different phones.
 */
function wordKey(word: string): string {
  const bare = word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  return /\d/.test(bare) ? bare : singular(bare);
}

/** SAMSUNG -> Samsung, but short ones like JBL could be initials, so they stay. */
function tidyCaps(word: string): string {
  if (/^iphone$/i.test(word)) return "iPhone";
  return /^[A-Z]{5,}$/.test(word) ? word[0] + word.slice(1).toLowerCase() : word;
}

const tidyPhrase = (phrase: string) => words(phrase).map(tidyCaps).join(" ");

/** Samsung writes the A03s with a small s; A03S reads like another model. */
function tidyModel(model: string, brand: string): string {
  const samsung = /samsung/i.test(`${brand} ${model}`);
  return words(model)
    .map(w => (samsung && /^[a-z]\d{2}s$/i.test(w) ? `${w[0].toUpperCase()}${w.slice(1, 3)}s` : tidyCaps(w)))
    .join(" ");
}

function productType(category: string, subcategory: string): string {
  const type = singularPhrase(tidyPhrase(category));
  const sub = NO_SUBCATEGORY.test(subcategory.trim()) ? "" : tidyPhrase(subcategory);
  if (!sub) return type;
  const typeKeys = words(type).map(wordKey);
  const subKeys = words(sub).map(wordKey);
  // Subcategory "Type-C Charger" under Chargers already says it all.
  if (typeKeys.every(k => subKeys.includes(k))) return singularPhrase(sub);
  if (subKeys.every(k => typeKeys.includes(k))) return type;
  return `${sub} ${type}`;
}

/** Puts the parts together. Empty parts are left out. */
export function buildProductName({ brand, model, category, subcategory, variant }: ProductNameParts): string {
  const cleanBrand = NO_BRAND.test(brand.trim()) ? "" : tidyPhrase(brand);
  const cleanModel = tidyModel(model, brand);
  // Brand "Samsung", model "Samsung A03s": say Samsung once.
  const modelHasBrand = !!cleanBrand && cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase());
  const base = [modelHasBrand ? "" : cleanBrand, cleanModel, productType(category, subcategory)].filter(Boolean).join(" ");
  const tail = (variant ?? "").trim();
  return tail ? `${base}${VARIANT_SEPARATOR}${tail}` : base;
}

/** The part after the last " - ", which is where the format keeps the variant. */
export function variantOf(name: string): string {
  const at = name.lastIndexOf(VARIANT_SEPARATOR);
  return at < 0 ? "" : name.slice(at + VARIANT_SEPARATOR.length).trim();
}

/**
 * Works out the model and variant an old free-typed name was carrying.
 *
 * Words the other fields already cover are dropped and nothing else is, so
 * details only the old name knows ("Clear", "20W") survive. With no Compatible
 * Model saved, what is left is the model: that's how "A03S" gets kept.
 */
export function readExistingName(p: ProductNameParts & { name: string }): { model: string; variant: string } {
  const at = p.name.lastIndexOf(VARIANT_SEPARATOR);
  const base = at < 0 ? p.name : p.name.slice(0, at);
  const oldVariant = variantOf(p.name);
  const covered = new Set(words(`${p.brand} ${p.model} ${p.category} ${p.subcategory}`).map(wordKey));
  // A key is empty for a lone "-" or "/", which isn't a detail worth keeping.
  const leftover = words(base).filter(w => wordKey(w) && !covered.has(wordKey(w))).map(tidyCaps).join(" ");
  if (!p.model.trim()) return { model: leftover, variant: oldVariant };
  return { model: p.model, variant: [leftover, oldVariant].filter(Boolean).join(" ") };
}

// ─── Repair parts ────────────────────────────────────────────────────────────

/**
 * Words that already say what a part is, so "M02 Display" doesn't become
 * "M02 Display Screen". Parts are named more loosely than the fixed categories.
 */
const PART_TYPE_WORDS: Record<string, RegExp> = {
  "Screen": /^(screen|display|lcd|oled|amoled|touch|digitizer|combo|folder)$/,
  "Battery": /^(battery|batt)$/,
  "Charging Port": /^(charging|charger|port|flex|connector|dock|pin)$/,
  "Speaker / Mic": /^(speaker|mic|microphone|ringer|earpiece|buzzer)$/,
  "Camera": /^(camera|cam|lens)$/,
  "Back Glass": /^(back|glass|housing|cover|panel)$/,
  "Board / IC": /^(board|ic|motherboard|chip|pcb)$/,
};

/**
 * The model a part is known by. An old name that already says which device it
 * means wins ("M02 Display" fitting the M02s and M02 is the M02), otherwise it's
 * the first one listed.
 */
function mainDevice(devices: string[], nameKeys: Set<string>): string {
  let best = devices[0] ?? "";
  let bestScore = 0;
  for (const device of devices) {
    const keys = words(device).map(wordKey);
    const codes = keys.filter(k => /\d/.test(k));
    if (!(codes.length ? codes : keys).every(k => nameKeys.has(k))) continue;
    const score = keys.filter(k => nameKeys.has(k)).length;
    if (score > bestScore) { best = device; bestScore = score; }
  }
  return best;
}

export interface PartNameParts {
  name: string;
  category: string;
  compatibleWith: string[];
  brand?: string;
}

const isPartTypeWord = (word: string, category: string) => !!PART_TYPE_WORDS[category]?.test(wordKey(word));

/**
 * Parts name the one model they're known by, however many they fit, then the
 * brand if there is one, then what the part is:
 *
 *   Samsung M02s Crown Display
 *   Samsung M02s Display
 */
export function suggestPartName({ name, category, compatibleWith, brand = "" }: PartNameParts): string {
  const devices = compatibleWith.map(d => tidyModel(d, "")).filter(Boolean);
  const main = mainDevice(devices, new Set(words(name).map(wordKey)));
  const cleanBrand = tidyPhrase(brand);
  const covered = new Set(words(`${devices.join(" ")} ${brand}`).map(wordKey));
  const rest = words(name)
    // "/" stays for now, since a category can hold one ("Speaker / Mic").
    .filter(w => w === "/" || (wordKey(w) && !covered.has(wordKey(w))))
    .map(tidyCaps);
  // But one left between two device names means nothing.
  while (rest[0] === "/") rest.shift();
  while (rest[rest.length - 1] === "/") rest.pop();
  const namesType = rest.some(w => isPartTypeWord(w, category));
  const type = category === "Other" || namesType ? "" : category;
  if (main) return [main, cleanBrand, ...rest, type].filter(Boolean).join(" ");
  // No device saved, so the model is somewhere in the old words: the brand goes
  // in front of what the part is, not in front of the model.
  const at = rest.findIndex(w => isPartTypeWord(w, category));
  if (at >= 0) rest.splice(at, 0, cleanBrand);
  else rest.push(cleanBrand);
  return [...rest, type].filter(Boolean).join(" ");
}

/** The name without its brand. The last match, since "Samsung M02s Samsung Display" keeps the model. */
export function partBaseName(name: string, brand = ""): string {
  const all = words(name);
  const drop = words(brand).map(w => w.toLowerCase());
  if (!drop.length) return all.join(" ");
  for (let i = all.length - drop.length; i >= 0; i--) {
    if (drop.every((w, j) => all[i + j].toLowerCase() === w)) {
      return [...all.slice(0, i), ...all.slice(i + drop.length)].join(" ");
    }
  }
  return all.join(" ");
}

/**
 * What groups the types of one part. It's the name without the brand, so
 * "Samsung M02s Crown Display" and "Samsung M02s HD+ Display" list as one part.
 */
export const partGroupKey = (p: { name: string; brand?: string }) => partBaseName(p.name, p.brand).toUpperCase();

/** Swaps the brand inside a name that's already there, as the Brand box changes. */
export function setPartBrand(name: string, oldBrand: string, newBrand: string, category: string): string {
  const all = words(partBaseName(name, oldBrand));
  const brand = tidyPhrase(newBrand);
  if (!brand) return all.join(" ");
  const at = all.findIndex(w => isPartTypeWord(w, category));
  all.splice(at >= 0 ? at : all.length, 0, brand);
  return all.join(" ");
}

const PART_SKU_CODES: Record<string, string> = {
  "Screen": "D",
  "Battery": "B",
  "Charging Port": "CP",
  "Speaker / Mic": "SM",
  "Camera": "CM",
  "Back Glass": "BG",
  "Board / IC": "IC",
  "Other": "OT",
};

const skuPiece = (s: string) => s.toUpperCase().replace(/[^A-Z0-9+]/g, "");

/** "Samsung M02s" -> M02S, "iPhone 13" -> IP13. Other makers stay, so an Oppo A15 and Samsung A15 differ. */
function skuModel(device: string): string {
  return skuPiece(words(device)
    .filter(w => !/^(samsung|apple)$/i.test(w))
    .map(w => (/^iphone$/i.test(w) ? "IP" : w))
    .join(""));
}

/**
 * A SKU in the shop's style: model, part, brand. M02S-D-CROWN, or M02S-D with no
 * brand. The model comes from the part's name, since compatible devices can list
 * anything it fits. Stays free of the rest of the catalogue by counting up:
 * M02S-D-CROWN-2.
 */
export function suggestPartSku(part: PartNameParts, taken: Iterable<string>): string {
  const base = words(partBaseName(part.name, part.brand));
  // What comes before the part itself: "Samsung M02s" out of "Samsung M02s Display".
  const typeAt = base.findIndex(w => isPartTypeWord(w, part.category));
  const before = typeAt >= 0 ? base.slice(0, typeAt) : base;
  const digitAt = before.findIndex(w => /\d/.test(w));
  const named = typeAt >= 0 ? before : digitAt >= 0 ? before.slice(0, digitAt + 1) : before.slice(0, 1);
  // A name with no model in it ("Display") falls back on the devices it fits.
  const devices = part.compatibleWith.filter(d => d.trim());
  const model = skuModel(named.join(" ")) || (devices.length ? skuModel(mainDevice(devices, new Set(base.map(wordKey)))) : skuPiece(base[0] ?? ""));
  if (!model) return "";
  const sku = [model, PART_SKU_CODES[part.category] ?? "OT", skuPiece(part.brand ?? "")].filter(Boolean).join("-");
  const used = new Set([...taken].map(s => s.trim().toUpperCase()));
  if (!used.has(sku)) return sku;
  let n = 2;
  while (used.has(`${sku}-${n}`)) n++;
  return `${sku}-${n}`;
}

/** The format applied to a product that already has a name. */
export function suggestProductName(p: ProductNameParts & { name: string }): string {
  const { model, variant } = readExistingName(p);
  return buildProductName({ ...p, model, variant });
}
