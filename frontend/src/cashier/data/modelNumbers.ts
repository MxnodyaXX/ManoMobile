// Offline model-number → device lookup.
// Many budget phones are sold by an opaque marketing/model number printed on the
// box or under Settings (e.g. "M2006C3LMG"). This table resolves common ones to a
// human-readable brand + model so the intake form can auto-fill the Model field.
// Extend freely — unknown numbers can be typed and saved from the form.

export interface ModelInfo { brand: string; model: string; }

export const MODEL_NUMBER_DB: Record<string, ModelInfo> = {
  // Xiaomi / Redmi / Poco
  "M2006C3LMG": { brand: "Xiaomi",  model: "Redmi 9C" },
  "M2006C3MNG": { brand: "Xiaomi",  model: "Redmi 9C NFC" },
  "M2004J19C":  { brand: "Xiaomi",  model: "Redmi 9" },
  "M2010J19SG": { brand: "Xiaomi",  model: "Redmi 9T" },
  "M2101K6G":   { brand: "Xiaomi",  model: "Redmi Note 10 Pro" },
  "M2101K7BNY": { brand: "Xiaomi",  model: "Redmi Note 10S" },
  "21091116AG": { brand: "Xiaomi",  model: "Redmi Note 11" },
  "22111317G":  { brand: "Xiaomi",  model: "Redmi Note 12" },
  "23021RAA2Y": { brand: "Xiaomi",  model: "Redmi Note 12 Pro" },
  "2201116SG":  { brand: "Xiaomi",  model: "Redmi Note 11 Pro" },
  "M2102J20SG": { brand: "Xiaomi",  model: "Poco X3 Pro" },
  "22041216G":  { brand: "Xiaomi",  model: "Poco F4" },
  // Samsung
  "SM-A057F":   { brand: "Samsung", model: "Galaxy A05s" },
  "SM-A156B":   { brand: "Samsung", model: "Galaxy A15 5G" },
  "SM-A256B":   { brand: "Samsung", model: "Galaxy A25 5G" },
  "SM-A546B":   { brand: "Samsung", model: "Galaxy A54 5G" },
  "SM-A556B":   { brand: "Samsung", model: "Galaxy A55 5G" },
  "SM-S911B":   { brand: "Samsung", model: "Galaxy S23" },
  "SM-S918B":   { brand: "Samsung", model: "Galaxy S23 Ultra" },
  "SM-S921B":   { brand: "Samsung", model: "Galaxy S24" },
  // Apple
  "A2882":      { brand: "Apple",   model: "iPhone 14" },
  "A2890":      { brand: "Apple",   model: "iPhone 14 Pro Max" },
  "A3089":      { brand: "Apple",   model: "iPhone 15" },
  "A3108":      { brand: "Apple",   model: "iPhone 15 Pro Max" },
  "A2643":      { brand: "Apple",   model: "iPhone 13" },
  // Oppo / Realme / Vivo
  "CPH2387":    { brand: "OPPO",    model: "Oppo A57" },
  "CPH2565":    { brand: "OPPO",    model: "Oppo A60" },
  "RMX3627":    { brand: "Realme",  model: "Realme C55" },
  "V2247":      { brand: "Vivo",    model: "Vivo Y27" },
};

/** Normalise a model number for matching (uppercase, strip spaces/dashes). */
function normalise(s: string): string {
  return s.toUpperCase().replace(/[\s-]/g, "");
}

const NORMALISED: Record<string, ModelInfo> = Object.fromEntries(
  Object.entries(MODEL_NUMBER_DB).map(([k, v]) => [normalise(k), v]),
);

/** Look up a model number; returns brand+model if known, else null. */
export function lookupModelNumber(input: string): ModelInfo | null {
  const key = normalise(input);
  if (!key) return null;
  return NORMALISED[key] ?? null;
}
