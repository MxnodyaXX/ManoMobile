"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { publicOrigin } from "@/lib/siteUrl";

/**
 * The public product & warranty check — what the QR on an accessory invoice
 * opens. Backed by verify_invoice() (migration 20261104000091), the only way
 * an anonymous browser can read a sale: exact invoice number, customer-safe
 * fields only.
 */

export interface VerifiedItem {
  description: string;
  kind: string;
  /** Item code for an accessory, the last four of the IMEI for a phone. */
  code: string | null;
  category: string | null;
  qty: number;
  lineTotal: number;
  warrantyDays: number;
  warrantyLabel: string | null;
  terms: string;
  startsOn: string;
  expiresOn: string | null;
}

export interface VerifiedInvoice {
  invoiceNo: string;
  soldOn: string;
  category: string;
  status: "Paid" | "Voided" | "Returned";
  total: number;
  /** First name and initial — the page is public. */
  customer: string;
  items: VerifiedItem[];
}

type Row = Record<string, unknown>;

/** Null when there is no such invoice. */
export async function verifyInvoice(invoiceNo: string): Promise<VerifiedInvoice | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient().rpc("verify_invoice", { p_invoice_no: invoiceNo.trim() });
  if (error) {
    throw new Error(error.code === "PGRST202"
      ? "Invoice checking isn't switched on yet — the shop needs to run migration 20261104000091."
      : error.message);
  }
  if (!data) return null;
  const r = data as Row;
  return {
    invoiceNo: String(r.invoice_no),
    soldOn: String(r.sold_on),
    category: String(r.category ?? ""),
    status: (r.status as VerifiedInvoice["status"]) ?? "Paid",
    total: Number(r.total ?? 0),
    customer: String(r.customer ?? "Walk-in"),
    items: ((r.items as Row[] | null) ?? []).map(i => ({
      description: String(i.description ?? "Item"),
      kind: String(i.kind ?? ""),
      code: (i.code as string | null) ?? null,
      category: (i.category as string | null) ?? null,
      qty: Number(i.qty ?? 1),
      lineTotal: Number(i.line_total ?? 0),
      warrantyDays: Number(i.warranty_days ?? 0),
      warrantyLabel: (i.warranty_label as string | null) ?? null,
      terms: String(i.terms ?? ""),
      startsOn: String(i.starts_on),
      expiresOn: (i.expires_on as string | null) ?? null,
    })),
  };
}

/** What the QR on a product invoice encodes. */
export function verifyUrl(invoiceNo: string): string {
  return `${publicOrigin()}/verify?inv=${encodeURIComponent(invoiceNo)}`;
}
