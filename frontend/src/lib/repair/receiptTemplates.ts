"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { parseReceiptElements, type ReceiptElement, type TemplateKind } from "@/lib/repair/receiptElements";

/**
 * Saved receipt/invoice designs (Admin -> Barcode -> Job Receipt / Job Issue
 * Invoice). Mirrors barcodeTemplates.ts — see that file for why this is a
 * flat CRUD module rather than folded into a context. One table holds both
 * document kinds (see receiptElements.ts's TemplateKind doc comment); every
 * function here takes/threads a `kind` so a receipt design and an invoice
 * design never collide — each kind has its own list and its own default.
 */

export interface ReceiptTemplate {
  id: string;
  name: string;
  kind: TemplateKind;
  isDefault: boolean;
  pageWidthMm: number;
  pageHeightMm: number;
  /** Empty means "use the built-in layout for this kind". */
  elements: ReceiptElement[];
}

interface TemplateRow {
  id: number;
  name: string;
  kind: string;
  page_width_mm: number | string;
  page_height_mm: number | string;
  is_default: boolean;
  elements: unknown;
}

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));
const toKind = (v: string): TemplateKind => (v === "issue" ? "issue" : "receipt");

function toTemplate(row: TemplateRow): ReceiptTemplate {
  return {
    id: String(row.id),
    name: row.name,
    kind: toKind(row.kind),
    isDefault: row.is_default,
    pageWidthMm: num(row.page_width_mm),
    pageHeightMm: num(row.page_height_mm),
    elements: parseReceiptElements(row.elements),
  };
}

function toRow(t: Omit<ReceiptTemplate, "id" | "isDefault">) {
  return {
    name: t.name.trim(),
    kind: t.kind,
    page_width_mm: t.pageWidthMm,
    page_height_mm: t.pageHeightMm,
    elements: t.elements,
  };
}

const COLUMNS = "id, name, kind, page_width_mm, page_height_mm, is_default, elements";

export async function fetchReceiptTemplates(kind: TemplateKind): Promise<ReceiptTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("receipt_templates")
    .select(COLUMNS)
    .eq("kind", kind)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as TemplateRow[] | null)?.map(toTemplate) ?? [];
}

/** Every saved design, receipt and invoice alike — used to build the "Copy
 *  Design From" list in the canvas editor, where reusing a receipt's logo/
 *  header arrangement on the invoice (or back) is exactly the point. The
 *  main list views stay kind-scoped via fetchReceiptTemplates; only the
 *  copy-source picker needs to see across the split. */
export async function fetchAllReceiptTemplates(): Promise<ReceiptTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("receipt_templates")
    .select(COLUMNS)
    .order("kind", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as TemplateRow[] | null)?.map(toTemplate) ?? [];
}

/** The design the app prints with for this kind unless a call site picks
 *  another. Returns null (not an error) when nothing's configured or nothing
 *  is saved yet — callers fall back to the built-in layout either way. */
export async function fetchDefaultReceiptTemplate(kind: TemplateKind): Promise<ReceiptTemplate | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient()
    .from("receipt_templates")
    .select(COLUMNS)
    .eq("kind", kind)
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
    if (error.code === "23505") throw new Error(`A template called "${t.name.trim()}" already exists.`);
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
    if (error.code === "23505") throw new Error(`A template called "${t.name.trim()}" already exists.`);
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

export function useReceiptTemplates(kind: TemplateKind) {
  const configured = isSupabaseConfigured();
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      setTemplates(await fetchReceiptTemplates(kind));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured, kind]);

  useEffect(() => { void reload(); }, [reload]);

  return { templates, loading, error, configured, reload };
}
