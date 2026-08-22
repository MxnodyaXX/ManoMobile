// Offline model-number → device lookup.
// Many budget phones are sold by an opaque marketing/model number printed on the
// box or under Settings (e.g. "M2006C3LMG"). This table resolves common ones to a
// human-readable brand + model so the intake form can auto-fill the Model field.
// Extend freely — unknown numbers can be typed and saved from the form.

export interface ModelInfo { brand: string; model: string; }

export const MODEL_NUMBER_DB: Record<string, ModelInfo> = {};

/** Normalise a model number for matching (uppercase, strip spaces/dashes). */
export function normaliseModelNumber(s: string): string {
  return s.toUpperCase().replace(/[\s-]/g, "");
}

const NORMALISED: Record<string, ModelInfo> = Object.fromEntries(
  Object.entries(MODEL_NUMBER_DB).map(([k, v]) => [normaliseModelNumber(k), v]),
);

/** Look up a model number; returns brand+model if known, else null. */
export function lookupModelNumber(input: string): ModelInfo | null {
  const key = normaliseModelNumber(input);
  if (!key) return null;
  return NORMALISED[key] ?? null;
}
