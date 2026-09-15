"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * The lines of an invoice — see migration 20260915000052.
 *
 * `sales` is the header; these are what was on it. A repair invoice carries
 * one repair_service line per job and, since the combined checkout, whatever
 * accessories the customer took away at the same time. The header's `items`
 * string stays as the one-line summary every list shows; this is the detail
 * for the invoice itself.
 */

export type SaleItemKind = "repair_service" | "repair_part" | "accessory" | "sim" | "reload" | "other";

export interface NewSaleItem {
  kind: SaleItemKind;
  /** RM-nnn for a repair line, the product id for an accessory, absent otherwise. */
  referenceId?: string | number | null;
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
  /** Stored as printed. Defaults to qty × unitPrice − discount. */
  lineTotal?: number;
}

export interface SaleItem extends Required<Omit<NewSaleItem, "referenceId">> {
  id: number;
  invoiceNo: string;
  referenceId: string | null;
  sortOrder: number;
}

interface Row {
  id: number; invoice_no: string; kind: SaleItemKind; reference_id: string | null;
  description: string; qty: number; unit_price: number | string; discount: number | string;
  line_total: number | string; sort_order: number;
}

const rowToItem = (r: Row): SaleItem => ({
  id: r.id,
  invoiceNo: r.invoice_no,
  kind: r.kind,
  referenceId: r.reference_id,
  description: r.description,
  qty: r.qty,
  unitPrice: Number(r.unit_price),
  discount: Number(r.discount),
  lineTotal: Number(r.line_total),
  sortOrder: r.sort_order,
});

export const lineTotalOf = (i: Pick<NewSaleItem, "qty" | "unitPrice" | "discount" | "lineTotal">) =>
  i.lineTotal ?? Math.max(0, i.qty * i.unitPrice - (i.discount ?? 0));

/**
 * Write the lines for a sale that has just been inserted.
 *
 * Called by insertSale with the header's id, in the same breath. Not a
 * transaction with the header — PostgREST cannot span two tables in one — so a
 * failure here leaves a header with no lines, which the readers treat as an
 * older sale and fall back to the `items` string. Worse would be the reverse:
 * lines with no header, which the foreign key forbids.
 */
export async function insertSaleItems(saleId: string, invoiceNo: string, items: NewSaleItem[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await getSupabaseBrowserClient()
    .from("sale_items")
    .insert(items.map((i, n) => ({
      sale_id: saleId,
      invoice_no: invoiceNo,
      kind: i.kind,
      reference_id: i.referenceId == null ? null : String(i.referenceId),
      description: i.description,
      qty: i.qty,
      unit_price: i.unitPrice,
      discount: i.discount ?? 0,
      line_total: lineTotalOf(i),
      sort_order: n,
    })));
  if (error) throw new Error(`The invoice was saved but its lines were not: ${error.message}`);
}

/** The lines of one invoice, in the order they were printed. Empty for older sales. */
export async function fetchSaleItems(invoiceNo: string): Promise<SaleItem[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("sale_items")
    .select("id, invoice_no, kind, reference_id, description, qty, unit_price, discount, line_total, sort_order")
    .eq("invoice_no", invoiceNo)
    .order("sort_order");
  if (error) throw new Error(`Could not load the lines of ${invoiceNo}: ${error.message}`);
  return (data as Row[]).map(rowToItem);
}
