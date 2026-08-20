"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { parseReceiptElements, type ReceiptElement } from "@/lib/repair/receiptElements";

/**
 * Saved job-receipt designs (Admin -> Barcode -> Job Receipt). Mirrors
 * barcodeTemplates.ts — see that file for why this is a flat CRUD module
 * rather than folded into a context.
 */

export interface ReceiptTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  pageWidthMm: number;
  pageHeightMm: number;
  /** Empty means "use the built-in JobReceiptSlip layout". */
  elements: ReceiptElement[];
}

interface TemplateRow {
  id: number;
  name: string;
  page_width_mm: number | string;
  page_height_mm: number | string;
  is_default: boolean;
  elements: unknown;
}

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

function toTemplate(row: TemplateRow): ReceiptTemplate {
  return {
    id: String(row.id),
    name: row.name,
    isDefault: row.is_default,
    pageWidthMm: num(row.page_width_mm),
    pageHeightMm: num(row.page_height_mm),
    elements: parseReceiptElements(row.elements),
  };
}

function toRow(t: Omit<ReceiptTemplate, "id" | "isDefault">) {
  return {
    name: t.name.trim(),
    page_width_mm: t.pageWidthMm,
    page_height_mm: t.pageHeightMm,
    elements: t.elements,
  };
}

const COLUMNS = "id, name, page_width_mm, page_height_mm, is_default, elements";

export async function fetchReceiptTemplates(): Promise<ReceiptTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("receipt_templates")
    .select(COLUMNS)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as TemplateRow[] | null)?.map(toTemplate) ?? [];
}

/** The design the app prints with unless a call site picks another. Returns
 *  null (not an error) when nothing's configured or nothing is saved yet —
 *  callers fall back to the built-in JobReceiptSlip layout either way. */
export async function fetchDefaultReceiptTemplate(): Promise<ReceiptTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient()
    .from("receipt_templates")
    .select(COLUMNS)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toTemplate(data as TemplateRow) : null;
}

export async function createReceiptTemplate(t: Omit<ReceiptTemplate, "id" | "isDefault">): Promise<ReceiptTemplate> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("receipt_templates")
    .insert(toRow(t))
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error(`A receipt template called "${t.name.trim()}" already exists.`);
    throw new Error(error.message);
  }
  return toTemplate(data as TemplateRow);
}

export async function updateReceiptTemplate(id: string, t: Omit<ReceiptTemplate, "id" | "isDefault">): Promise<ReceiptTemplate> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("receipt_templates")
    .update(toRow(t))
    .eq("id", Number(id))
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error(`A receipt template called "${t.name.trim()}" already exists.`);
    throw new Error(error.message);
  }
  return toTemplate(data as TemplateRow);
}

export async function deleteReceiptTemplate(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from("receipt_templates")
    .delete()
    .eq("id", Number(id));
  if (error) throw new Error(error.message);
}

export async function setDefaultReceiptTemplate(id: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .rpc("set_default_receipt_template", { p_id: Number(id) });
  if (error) throw new Error(error.message);
}

export function useReceiptTemplates() {
  const configured = isSupabaseConfigured();
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      setTemplates(await fetchReceiptTemplates());
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
