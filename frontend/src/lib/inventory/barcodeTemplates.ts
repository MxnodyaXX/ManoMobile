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

export type BarcodeLayout = "simple" | "repair" | "part";

export interface BarcodeTemplate extends BarcodeSettings {
  id: string;
  name: string;
  layout: BarcodeLayout;
  isDefault: boolean;
  /** A canvas design. Empty means "use the built-in layout named above", so a
   *  template never opened in the designer keeps printing exactly as it did. */
  elements: LabelElement[];
}

export const LAYOUT_LABELS: Record<BarcodeLayout, { label: string; blurb: string }> = {
  simple: { label: "Product Label", blurb: "Barcode with the code underneath — inventory and accessories." },
  repair: { label: "Repair Job Tag", blurb: "Job number, customer, barcode and the shop footer." },
  part:   { label: "Part Label",     blurb: "Spare-part name, SKU and barcode for the parts bin." },
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
  };
}

const COLUMNS =
  "id, name, layout, format, bar_width, bar_height, font_size, show_text, " +
  "code_prefix, label_width_mm, label_height_mm, label_margin_mm, is_default, elements";

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
