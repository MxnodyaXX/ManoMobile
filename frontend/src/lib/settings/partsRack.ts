"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The shape of the shop's spare-parts rack.
 *
 * A grid with holes in it, because that is what a real rack is: two units side
 * by side with a gap between them, one column three drawers tall and the next
 * four, a bay in the middle where a drawer went missing years ago. A list of
 * per-column heights cannot say any of that.
 *
 * Bay codes come from the position, not from the contents — A-3 is the third
 * bay of the top row whatever is hidden around it. So hiding a bay never
 * renames its neighbour and never moves a part that is already filed there.
 *
 * Admin edits it, everyone reads it, and null means "the default" — a shop
 * that never opens the editor sees what it always saw.
 */

export interface RackLayout {
  rows: number;
  cols: number;
  /** Bays that do not exist. Codes like "A-1". */
  hidden: string[];
}

export const DEFAULT_RACK: RackLayout = { rows: 5, cols: 8, hidden: [] };

/** Kept small enough to stay a picture rather than a spreadsheet, and large
 *  enough for a wall of drawers. Rows are letters, so 26 is the ceiling. */
export const RACK_MAX_ROWS = 26;
export const RACK_MAX_COLS = 16;

/** Row 0 is A. */
export const rowLetter = (i: number) => String.fromCharCode(65 + i);

export const bayCode = (rowIndex: number, col: number) => `${rowLetter(rowIndex)}-${col}`;

/** Every bay the rack has, hidden ones included, reading order. */
export function allBays(layout: RackLayout): string[] {
  const out: string[] = [];
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 1; c <= layout.cols; c++) out.push(bayCode(r, c));
  }
  return out;
}

export const isHidden = (layout: RackLayout, code: string) => layout.hidden.includes(code);

/**
 * The bay a stored location refers to, or nothing.
 *
 * Storage Location is free text and stays free text — a part can live in a
 * drawer, a supplier's box or the back of the van, and none of those is on the
 * rack. This only reads the ones that are, and it is forgiving about how they
 * were written: "Shelf A-3", "A3" and "a - 3" are the same bay, because three
 * people typed them and all three meant it.
 *
 * A bay outside the current layout still parses. A part filed in E-8 before
 * the rack was shrunk is still in E-8; pretending the code is unreadable would
 * lose the only clue to where the thing physically is.
 */
export function shelfCode(text: string | undefined | null): string | null {
  const m = (text ?? "").trim().match(/([A-Za-z])\s*[-–—]?\s*([0-9]{1,2})$/);
  if (!m) return null;
  const row = m[1].toUpperCase();
  const col = Number(m[2]);
  if (row < "A" || row > "Z") return null;
  if (col < 1 || col > RACK_MAX_COLS) return null;
  return `${row}-${col}`;
}

/** Is this code a bay the rack still has, and has not had hidden? */
export function bayExists(layout: RackLayout, code: string | null): boolean {
  if (!code) return false;
  const [row, col] = code.split("-");
  const r = row.charCodeAt(0) - 65;
  const c = Number(col);
  return r >= 0 && r < layout.rows && c >= 1 && c <= layout.cols && !isHidden(layout, code);
}

/** Anything that is not a usable layout reads as the default rather than as an
 *  error — a malformed settings row must never stop somebody filing a part. */
function coerce(value: unknown): RackLayout {
  if (!value || typeof value !== "object") return DEFAULT_RACK;
  const v = value as Partial<RackLayout>;
  const rows = Math.min(RACK_MAX_ROWS, Math.max(1, Math.round(Number(v.rows) || 0)));
  const cols = Math.min(RACK_MAX_COLS, Math.max(1, Math.round(Number(v.cols) || 0)));
  if (!rows || !cols) return DEFAULT_RACK;
  const hidden = Array.isArray(v.hidden) ? v.hidden.filter(x => typeof x === "string") : [];
  return { rows, cols, hidden };
}

export async function fetchRackLayout(): Promise<RackLayout> {
  if (!isSupabaseConfigured()) return DEFAULT_RACK;
  const { data, error } = await getSupabaseBrowserClient()
    .from("app_settings")
    .select("parts_rack")
    .limit(1)
    .maybeSingle();

  // Including the case where the column has not been added yet: the rack is a
  // convenience, and a missing migration should cost the default layout, not
  // the screen.
  if (error || !data) return DEFAULT_RACK;
  const raw = (data as { parts_rack: unknown }).parts_rack;
  return raw == null ? DEFAULT_RACK : coerce(raw);
}

/**
 * Through set_parts_rack, not a direct write.
 *
 * app_settings is one row that also holds the work rules, and RLS is per row —
 * so writing this column directly means holding Admin, which would put the
 * rack out of reach of the very people who file parts into it. The function
 * writes this column and nothing else, under the permission the parts
 * catalogue already runs on. See migration 20260908000041.
 */
export async function saveRackLayout(layout: RackLayout): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .rpc("set_parts_rack", { p_layout: layout });

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "You are not allowed to change the rack layout — it needs an Admin, or an Admin Cashier with catalogue access."
        // undefined_function: the migration that adds the door has not run.
        : error.code === "42883" || /set_parts_rack/.test(error.message)
          ? "The rack layout cannot be saved yet — run migrations 20260908000040 and 20260908000041."
          : `Could not save the rack layout: ${error.message}`,
    );
  }
}

/**
 * The layout, for anything that draws the rack.
 *
 * The fetch settles into state from its own callback rather than being called
 * straight out of the effect body — the same shape every other loader in this
 * codebase uses, and what keeps React 19 from counting it as a synchronous
 * setState inside an effect.
 */
export function useRackLayout() {
  const [layout, setLayout] = useState<RackLayout>(DEFAULT_RACK);
  const [loading, setLoading] = useState(true);
  // Bumped to re-run the fetch after the layout is edited, since nothing the
  // effect depends on has otherwise changed.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    fetchRackLayout()
      .then(l => { if (active) { setLayout(l); setLoading(false); } })
      // The default is the safe failure: a rack drawn at its shipped size is
      // wrong in the details, an unusable picker is wrong outright.
      .catch(() => { if (active) { setLayout(DEFAULT_RACK); setLoading(false); } });
    return () => { active = false; };
  }, [nonce]);

  return { layout, loading, reload: useCallback(() => setNonce(n => n + 1), []) };
}
