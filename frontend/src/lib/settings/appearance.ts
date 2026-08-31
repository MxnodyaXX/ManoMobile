"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Shop-wide look and feel.
 *
 * Each palette overrides the same CSS custom properties globals.css already
 * defines, for both modes. Only the surfaces, borders and ink move — accent,
 * success, danger and warning stay put, because those carry meaning and a
 * palette that repainted "danger" would change what a red row means.
 *
 * Applied by writing the variables onto <html> at runtime rather than by
 * shipping more stylesheet: it is one source of truth, it survives a stale
 * CSS bundle, and it lets the Appearance page preview a palette without
 * saving it.
 */

export type PaletteVars = Record<string, string>;

export interface Palette {
  id: string;
  name: string;
  blurb: string;
  /** A three-swatch preview: page, card, ink. */
  swatch: [string, string, string];
  light: PaletteVars;
  dark: PaletteVars;
}

/**
 * The properties a palette may set. Anything outside this list is ignored when
 * applying, so a typo in a palette can never blank an unrelated variable.
 */
const ALLOWED = [
  "--bg-primary", "--bg-secondary", "--bg-card", "--bg-card-hover",
  "--border", "--border-active",
  "--text-primary", "--text-secondary", "--text-muted",
  "--shadow-card",
] as const;

export const PALETTES: Palette[] = [
  {
    id: "default",
    name: "Default",
    blurb: "White cards on a light grey page. The original look.",
    swatch: ["#f4f4f4", "#ffffff", "#111111"],
    // Spelled out rather than left empty: the comfort dimmer works on values,
    // and an empty palette would be the one option it could not dim.
    light: {
      "--bg-primary": "#f4f4f4",
      "--bg-secondary": "#ffffff",
      "--bg-card": "#ffffff",
      "--bg-card-hover": "#efefef",
    },
    dark: {},
  },
  {
    id: "soft-grey",
    name: "Soft Grey",
    blurb: "A grey page and off-white cards. Less glare than pure white under shop lighting.",
    swatch: ["#e7e8ea", "#f7f8f9", "#1b1d21"],
    light: {
      "--bg-primary": "#e7e8ea",
      "--bg-secondary": "#f2f3f5",
      "--bg-card": "#f7f8f9",
      "--bg-card-hover": "#eceef1",
      "--border": "rgba(20,24,31,0.10)",
      "--border-active": "rgba(20,24,31,0.20)",
      "--text-primary": "#1b1d21",
      "--text-secondary": "#54585f",
      "--text-muted": "#868b93",
      "--shadow-card": "0 1px 3px rgba(20,24,31,0.05), 0 4px 14px rgba(20,24,31,0.04)",
    },
    dark: {
      "--bg-primary": "#111214",
      "--bg-secondary": "#17181b",
      "--bg-card": "#1c1e21",
      "--bg-card-hover": "#232529",
      "--border": "rgba(255,255,255,0.08)",
      "--border-active": "rgba(255,255,255,0.16)",
    },
  },
  {
    id: "warm-paper",
    name: "Warm Paper",
    blurb: "Warm, paper-like surfaces with less blue. Easiest on the eyes over a long shift.",
    swatch: ["#eee8dd", "#faf6ef", "#241f18"],
    light: {
      "--bg-primary": "#eee8dd",
      "--bg-secondary": "#f5f1e8",
      "--bg-card": "#faf6ef",
      "--bg-card-hover": "#f1ebe0",
      "--border": "rgba(60,48,32,0.12)",
      "--border-active": "rgba(60,48,32,0.22)",
      "--text-primary": "#241f18",
      "--text-secondary": "#5d5346",
      "--text-muted": "#8e8477",
      "--shadow-card": "0 1px 3px rgba(60,48,32,0.06), 0 4px 14px rgba(60,48,32,0.05)",
    },
    dark: {
      "--bg-primary": "#14120f",
      "--bg-secondary": "#1a1714",
      "--bg-card": "#201d18",
      "--bg-card-hover": "#282420",
      "--border": "rgba(255,246,232,0.09)",
      "--border-active": "rgba(255,246,232,0.18)",
      "--text-primary": "#f3ece0",
      "--text-secondary": "rgba(243,236,224,0.55)",
      "--text-muted": "rgba(243,236,224,0.34)",
    },
  },
  {
    id: "cool-slate",
    name: "Cool Slate",
    blurb: "Blue-grey surfaces. Calm and low-contrast without going dim.",
    swatch: ["#e3e8ee", "#f6f8fa", "#161c24"],
    light: {
      "--bg-primary": "#e3e8ee",
      "--bg-secondary": "#eef2f6",
      "--bg-card": "#f6f8fa",
      "--bg-card-hover": "#e9eef4",
      "--border": "rgba(16,28,42,0.10)",
      "--border-active": "rgba(16,28,42,0.20)",
      "--text-primary": "#161c24",
      "--text-secondary": "#4c5663",
      "--text-muted": "#7d8794",
      "--shadow-card": "0 1px 3px rgba(16,28,42,0.05), 0 4px 14px rgba(16,28,42,0.04)",
    },
    dark: {
      "--bg-primary": "#0e1319",
      "--bg-secondary": "#141a21",
      "--bg-card": "#182029",
      "--bg-card-hover": "#1f2833",
      "--border": "rgba(226,236,246,0.09)",
      "--border-active": "rgba(226,236,246,0.18)",
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    blurb: "Maximum separation between text and background, for bright shop lighting or tired eyes.",
    swatch: ["#ffffff", "#ffffff", "#000000"],
    light: {
      "--bg-primary": "#ffffff",
      "--bg-secondary": "#f2f2f2",
      "--bg-card": "#ffffff",
      "--bg-card-hover": "#ebebeb",
      "--border": "rgba(0,0,0,0.28)",
      "--border-active": "rgba(0,0,0,0.55)",
      "--text-primary": "#000000",
      "--text-secondary": "#2e2e2e",
      "--text-muted": "#565656",
      "--shadow-card": "0 1px 2px rgba(0,0,0,0.12)",
    },
    dark: {
      "--bg-primary": "#000000",
      "--bg-secondary": "#0a0a0a",
      "--bg-card": "#0f0f0f",
      "--bg-card-hover": "#191919",
      "--border": "rgba(255,255,255,0.32)",
      "--border-active": "rgba(255,255,255,0.6)",
      "--text-primary": "#ffffff",
      "--text-secondary": "rgba(255,255,255,0.78)",
      "--text-muted": "rgba(255,255,255,0.56)",
    },
  },
];

export const paletteById = (id: string) => PALETTES.find(p => p.id === id) ?? PALETTES[0];

export const DEFAULT_PALETTE_ID = "default";

// ─── Screen comfort ──────────────────────────────────────────────────────────

/**
 * How far to dim the surfaces.
 *
 * A 24" monitor showing a white card is a lamp pointed at the reader for ten
 * hours. This scales every surface down in linear light — the only measure that
 * matches how bright a screen actually looks — while leaving text alone, so
 * contrast rises as the surface darkens rather than falling.
 *
 * The measured figures are in the level table below; they were computed, not
 * chosen by eye, and the dimmest level still clears WCAG AAA for body text.
 */
export const COMFORT_LEVELS: { id: number; name: string; blurb: string; factor: number; cardLum: string; contrast: string }[] = [
  { id: 0, name: "Normal",  blurb: "Full brightness surfaces.",                    factor: 1,    cardLum: "94%", contrast: "15.9:1" },
  { id: 1, name: "Dim",     blurb: "Noticeably softer. A good default indoors.",   factor: 0.80, cardLum: "75%", contrast: "12.9:1" },
  { id: 2, name: "Dimmer",  blurb: "For long shifts or bright overhead lighting.", factor: 0.62, cardLum: "58%", contrast: "10.2:1" },
  { id: 3, name: "Dimmest", blurb: "Lowest glare. Still above AAA for text.",      factor: 0.46, cardLum: "43%", contrast: "7.8:1"  },
];

export const DEFAULT_COMFORT = 1;

export const comfortById = (id: number) => COMFORT_LEVELS.find(c => c.id === id) ?? COMFORT_LEVELS[DEFAULT_COMFORT];

/** Only these are dimmed. Text keeps its value so contrast improves, and the
 *  borders are rgba() — scaling those would fade them to nothing. */
const DIMMABLE = ["--bg-primary", "--bg-secondary", "--bg-card", "--bg-card-hover"];

const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const toSrgb   = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/**
 * Scale a hex colour's luminance, keeping its hue.
 *
 * Done in linear light, not on the sRGB bytes: halving the byte values does not
 * halve the perceived brightness, and would tint the result.
 */
function dimHex(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || factor >= 1) return hex;
  const n = parseInt(m[1], 16);
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(c => toSrgb(toLinear(c / 255) * factor))
    .map(c => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0"))
    .join("");
  return `#${out}`;
}

/**
 * Write a palette onto <html>.
 *
 * Cleared first, so switching from a palette that sets a variable to one that
 * does not falls back to the stylesheet rather than keeping the old value.
 */
export function applyPalette(id: string, isDark: boolean, comfort: number = DEFAULT_COMFORT): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  for (const v of ALLOWED) el.style.removeProperty(v);

  const vars = isDark ? paletteById(id).dark : paletteById(id).light;
  // Dark surfaces are already low-luminance; dimming them further would take
  // them below the point where card edges are visible at all.
  const factor = isDark ? 1 : comfortById(comfort).factor;

  for (const v of ALLOWED) {
    const value = vars[v];
    if (!value) continue;
    el.style.setProperty(v, DIMMABLE.includes(v) ? dimHex(value, factor) : value);
  }
}

// ─── Stored setting ──────────────────────────────────────────────────────────

export interface Appearance { palette: string; comfort: number }

export const DEFAULT_APPEARANCE: Appearance = { palette: DEFAULT_PALETTE_ID, comfort: DEFAULT_COMFORT };

export async function fetchAppearance(): Promise<Appearance> {
  if (!isSupabaseConfigured()) return DEFAULT_APPEARANCE;
  const { data, error } = await getSupabaseBrowserClient()
    .from("appearance_settings")
    .select("palette, comfort")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(`Could not load appearance settings: ${error.message}`);
  const row = data as { palette?: string; comfort?: number } | null;
  return {
    palette: row?.palette ?? DEFAULT_PALETTE_ID,
    comfort: row?.comfort ?? DEFAULT_COMFORT,
  };
}

export async function saveAppearance(palette: string, comfort: number): Promise<void> {
  const { data: { user } } = await getSupabaseBrowserClient().auth.getUser();
  const { error } = await getSupabaseBrowserClient()
    .from("appearance_settings")
    .update({ palette, comfort, updated_by: user?.id ?? null })
    .eq("id", true);

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Only an Admin can change how the system looks."
        : `Could not save the appearance: ${error.message}`,
    );
  }
}
