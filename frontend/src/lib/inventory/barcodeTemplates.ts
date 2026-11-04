"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { BarcodeSettings } from "@/cashier/contexts/InventoryContext";
import { parseElements, type LabelElement } from "@/lib/inventory/labelElements";

/**
 * Saved label designs (Admin -> Barcode).
 *
 * A template is a BarcodeSettings plus a name and a `layout` naming which
 * renderer draws it — see BarcodeLabelModal's `variant`. Splitting layout from
 * settings is what lets a new label design be added later as one more row
 * plus one more branch, instead of another global settings object.
 */

export type BarcodeLayout = "simple" | "repair" | "part" | "device" | "accessory";

export interface BarcodeTemplate extends BarcodeSettings {
  id: string;
  name: string;
  layout: BarcodeLayout;
  isDefault: boolean;
  /** A canvas design. Empty means "use the built-in layout named above", so a
   *  template never opened in the designer keeps printing exactly as it did. */
  elements: LabelElement[];
  /** Repair tags only: which side it prints for (migration 20261103000089).
   *  Absent on a database without that migration. */
  repairAudience?: RepairAudience | null;
}

export type RepairAudience = "internal" | "external";
export type RepairTagSlot = "internal" | "internal_passcode" | "external" | "external_passcode";

export const LAYOUT_LABELS: Record<BarcodeLayout, { label: string; blurb: string }> = {
  simple:    { label: "Product Label",       blurb: "Barcode with the code underneath — inventory and accessories." },
  repair:    { label: "Repair Job Tag",       blurb: "Job number, customer, barcode and the shop footer." },
  part:      { label: "Part Label",           blurb: "Spare-part name, SKU and barcode for the parts bin." },
  device:    { label: "Mobile Device Label",  blurb: "IMEI barcode with brand, model, storage and color — phones." },
  accessory: { label: "Accessory Label",      blurb: "Product code barcode with name and price — retail accessories." },
};

interface TemplateRow {
  id: number;
  name: string;
  layout: BarcodeLayout;
  format: BarcodeSettings["format"];
  bar_width: number | string;
  bar_height: number;
  font_size: number;
  show_text: boolean;
  code_prefix: string;
  label_width_mm: number | string;
  label_height_mm: number | string;
  label_margin_mm: number | string;
  is_default: boolean;
  elements: unknown;
  repair_audience?: string | null;
}

// numeric columns arrive as strings over PostgREST.
const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

function toTemplate(row: TemplateRow): BarcodeTemplate {
  return {
    id: String(row.id),
    name: row.name,
    layout: row.layout,
    isDefault: row.is_default,
    elements: parseElements(row.elements),
    format: row.format,
    width: num(row.bar_width),
    height: row.bar_height,
    fontSize: row.font_size,
    showText: row.show_text,
    prefix: row.code_prefix,
    labelWidthMm: num(row.label_width_mm),
    labelHeightMm: num(row.label_height_mm),
    labelMarginMm: num(row.label_margin_mm),
    repairAudience: (row.repair_audience as RepairAudience | null | undefined) ?? null,
  };
}

function toRow(t: Omit<BarcodeTemplate, "id" | "isDefault">) {
  return {
    name: t.name.trim(),
    layout: t.layout,
    format: t.format,
    bar_width: t.width,
    bar_height: t.height,
    font_size: t.fontSize,
    show_text: t.showText,
    code_prefix: t.prefix,
    label_width_mm: t.labelWidthMm,
    label_height_mm: t.labelHeightMm,
    label_margin_mm: t.labelMarginMm,
    elements: t.elements,
    // Only sent when set, so a database without the column still saves.
    ...(t.repairAudience ? { repair_audience: t.repairAudience } : {}),
  };
}

// "*" rather than a list: repair_audience exists only after migration
// 20261103000089, and naming it would fail every read before then.
const COLUMNS = "*";

export async function fetchTemplates(): Promise<BarcodeTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("barcode_templates")
    .select(COLUMNS)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as TemplateRow[] | null)?.map(toTemplate) ?? [];
}

/** The design the app prints with unless a call site picks another. */
export async function fetchDefaultTemplate(): Promise<BarcodeTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient()
    .from("barcode_templates")
    .select(COLUMNS)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toTemplate(data as TemplateRow) : null;
}

export async function createTemplate(t: Omit<BarcodeTemplate, "id" | "isDefault">): Promise<BarcodeTemplate> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("barcode_templates")
    .insert(toRow(t))
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error(`A template called "${t.name.trim()}" already exists.`);
    throw new Error(error.message);
  }
  return toTemplate(data as TemplateRow);
}

export async function updateTemplate(id: string, t: Omit<BarcodeTemplate, "id" | "isDefault">): Promise<BarcodeTemplate> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("barcode_templates")
    .update(toRow(t))
    .eq("id", Number(id))
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error(`A template called "${t.name.trim()}" already exists.`);
    throw new Error(error.message);
  }
  return toTemplate(data as TemplateRow);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("barcode_templates")
    .delete()
    .eq("id", Number(id));
  if (error) throw new Error(error.message);
}

/** Goes through the Postgres function: clearing the old default and setting
 *  the new one must not be visible as two separate steps. */
export async function setDefaultTemplate(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .rpc("set_default_barcode_template", { p_id: Number(id) });
  if (error) throw new Error(error.message);
}

export function useBarcodeTemplates() {
  const configured = isSupabaseConfigured();
  const [templates, setTemplates] = useState<BarcodeTemplate[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      setTemplates(await fetchTemplates());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => { void reload(); }, [reload]);

  return { templates, loading, error, configured, reload };
}

/**
 * The template a given label kind prints with — used by BarcodeLabelModal to
 * find a canvas design for its variant. Prefers the default when more than one
 * template shares a layout, so "which one prints?" has one answer.
 */
export async function fetchTemplateForLayout(layout: BarcodeLayout): Promise<BarcodeTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient()
    .from("barcode_templates")
    .select(COLUMNS)
    .eq("layout", layout)
    .order("is_default", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const row = (data as TemplateRow[] | null)?.[0];
  return row ? toTemplate(row) : null;
}

/**
 * A specific template picked by name rather than by layout+default — for a
 * call site that needs a particular design regardless of what's marked
 * default (e.g. an outside-dealer repair tag using a different layout than
 * Mano Mobile's own jobs). Returns null on no match, same as
 * fetchTemplateForLayout, so callers can fall back to the normal default.
 */
export async function fetchTemplateByName(name: string): Promise<BarcodeTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient()
    .from("barcode_templates")
    .select(COLUMNS)
    .ilike("name", name)
    .limit(1);

  if (error) throw new Error(error.message);
  const row = (data as TemplateRow[] | null)?.[0];
  return row ? toTemplate(row) : null;
}

// ── Repair tags: which template prints for which kind of job ─────────────────

export const REPAIR_SLOT_LABEL: Record<RepairTagSlot, string> = {
  internal: "Normal job tag",
  internal_passcode: "Job tag with passcode",
  external: "Normal job tag",
  external_passcode: "Job tag with passcode",
};

/** slot → template id (null = nothing chosen). Empty before migration 20261103000089. */
export async function fetchRepairSlots(): Promise<Partial<Record<RepairTagSlot, string | null>>> {
  if (!isSupabaseConfigured()) return {};
  const { data, error } = await getSupabaseBrowserClient().from("repair_tag_slots").select("slot, template_id");
  if (error) return {};
  return Object.fromEntries(((data ?? []) as { slot: RepairTagSlot; template_id: number | null }[])
    .map(r => [r.slot, r.template_id == null ? null : String(r.template_id)]));
}

export async function setRepairSlot(slot: RepairTagSlot, templateId: string | null): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("repair_tag_slots")
    .upsert({ slot, template_id: templateId ? Number(templateId) : null, updated_at: new Date().toISOString() });
  if (error) {
    if (/repair_tag_slots|PGRST205|does not exist/.test(error.message)) {
      throw new Error("Run migration 20261103000089_repair_tag_slots.sql to choose repair tags.");
    }
    throw new Error(error.message);
  }
}

async function fetchTemplateById(id: string): Promise<BarcodeTemplate | null> {
  const { data, error } = await getSupabaseBrowserClient().from("barcode_templates").select(COLUMNS).eq("id", Number(id)).maybeSingle();
  if (error || !data) return null;
  return toTemplate(data as TemplateRow);
}

/**
 * The template a repair tag prints with, for one kind of job.
 *
 *   1. the chosen template for that exact case (e.g. external + passcode);
 *   2. for a passcode case left empty, that side's normal tag;
 *   3. nothing chosen at all (or before the migration): the old rule — the
 *      template named for the case, then the repair default.
 * A template from the other side is never used: an internal job never prints
 * an external tag, and vice versa.
 */
export async function fetchRepairTag(audience: RepairAudience, passcode: boolean): Promise<BarcodeTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const slots = await fetchRepairSlots();
  const order: RepairTagSlot[] = passcode ? [`${audience}_passcode`, audience] : [audience];
  const anyChosen = Object.keys(slots).length > 0;

  for (const slot of order) {
    const id = slots[slot];
    if (!id) continue;
    const t = await fetchTemplateById(id);
    if (t && (t.repairAudience == null || t.repairAudience === audience)) return t;
  }
  if (anyChosen) return null; // slots exist but none chosen for this side → built-in tag

  // Before the migration: the names the app always used.
  const names = [...(passcode ? ["Repair Job Tag With Pass"] : []), ...(audience === "external" ? ["RepairJobTagOutsideDealers"] : [])];
  for (const n of names) {
    const t = await fetchTemplateByName(n);
    if (t) return t;
  }
  return fetchTemplateForLayout("repair");
}
