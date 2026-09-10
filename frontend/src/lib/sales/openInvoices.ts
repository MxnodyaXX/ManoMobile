"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Invoices that are still being filled in.
 *
 * Typing a shop's old job book in is not one repair at a time: a dealer's month
 * came back on one invoice covering nine phones, and the person entering it has
 * nine records to make and one invoice to put them on. This is the list of
 * invoices waiting for the rest of their work — see migration 20260910000046.
 */

export interface OpenInvoice {
  invoiceNo: string;
  soldOn: string;
  customer: string;
  total: number;
  paid: number;
  jobIds: string[];
  closedAt: string | null;
}

const toOpen = (r: Record<string, unknown>): OpenInvoice => ({
  invoiceNo: r.invoice_no as string,
  soldOn: r.sold_on as string,
  customer: (r.customer as string) ?? "",
  total: Number(r.total ?? 0),
  paid: Number(r.paid ?? 0),
  jobIds: (r.job_ids as string[]) ?? [],
  closedAt: (r.closed_at as string | null) ?? null,
});

/**
 * The open invoices for one dealer, newest first.
 *
 * Scoped to the dealer because that is the only way the list is useful: an
 * invoice is a bill to somebody, and offering last month's Phone House invoice
 * while entering a Thirasara Max repair is offering a mistake.
 */
export function useOpenInvoices(dealerId: number | null | undefined) {
  const configured = isSupabaseConfigured();
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * Bumped to ask for the list again.
   *
   * The fetch lives inside the effect rather than in a callback the effect
   * calls, because React 19 counts a setState reached from an effect as a
   * cascading render however many functions it travels through. A counter the
   * effect depends on is the same refresh without the indirection — and
   * reload() is only ever pressed from an event, never from render.
   */
  const [tick, setTick] = useState(0);
  const reload = useCallback(async () => { setTick(n => n + 1); }, []);

  useEffect(() => {
    if (!configured || dealerId == null) return;
    let active = true;

    (async () => {
      const { data, error: e } = await getSupabaseBrowserClient()
        .from("sales")
        .select("invoice_no, sold_on, customer, total, paid, job_ids, closed_at")
        .eq("dealer_id", dealerId)
        .is("closed_at", null)
        .neq("status", "Voided")
        .order("sold_on", { ascending: false })
        .limit(25);

      if (!active) return;
      if (e) {
        // 42703 is undefined_column: the migration has not been run.
        setError(e.code === "42703" ? "Open invoices need migration 20260910000046." : e.message);
        setInvoices([]);
        return;
      }
      setError(null);
      setInvoices((data ?? []).map(toOpen));
    })();

    return () => { active = false; };
  }, [configured, dealerId, tick]);

  // Derived rather than stored, so switching to a dealer with no open
  // invoices cannot leave the previous one's list on screen.
  return { invoices: dealerId == null ? [] : invoices, error, reload };
}

export async function appendJobToInvoice(
  invoiceNo: string,
  jobId: string,
  lineTotal: number,
  received: number,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseBrowserClient().rpc("append_job_to_sale", {
    p_invoice_no: invoiceNo,
    p_job_id: jobId,
    p_line_total: lineTotal,
    p_received: received,
  });
  if (error) {
    throw new Error(
      error.code === "42883"
        ? "Adding to an invoice needs migration 20260910000046 — run it and try again."
        : error.message,
    );
  }
}

export async function setInvoiceClosed(invoiceNo: string, closed: boolean): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseBrowserClient().rpc("set_sale_closed", {
    p_invoice_no: invoiceNo,
    p_closed: closed,
  });
  if (error) throw new Error(error.message);
}
