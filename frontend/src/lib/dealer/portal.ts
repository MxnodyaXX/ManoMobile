"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { publicOrigin } from "@/lib/siteUrl";

/**
 * The dealer portal — see migration 20260928000061.
 *
 * A dealer invoice carries a QR to /dealer?t=<portal_token>&invoice=<no>. The
 * token is the dealer's secret key; without it the database answers nothing,
 * and an invoice is only ever shown to the dealer it was billed to.
 */

export interface PortalJob {
  id: string;
  dealerJobNo: string | null;
  customerName: string;
  brand: string;
  model: string;
  imei: string | null;
  issue: string;
  technician: string | null;
  status: "Non-Issued" | "Issued" | "Pending" | "Completed" | "Delivered" | "Cancelled";
  completionType: string | null;
  receivedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  estimatedCompletion: string | null;
  estimate: number;
  advancePaid: number;
  techRemarks: string | null;
  partsUsed: string[];
  unitPrice: number | null;
  discount: number | null;
  lineTotal: number | null;
}

export interface PortalInvoiceSummary {
  invoiceNo: string;
  date: string;
  createdAt: string;
  total: number;
  paid: number;
  discount: number;
  status: "Paid" | "Returned";
  jobCount: number;
  outstanding: number;
}

export interface PortalAccount {
  balance: number;
  totalCharged: number;
  totalPaid: number;
  totalWrittenOff: number;
  totalRefunded: number;
  creditLimit: number;
  termsDays: number;
  status: "Active" | "Overdue" | "Settled";
  firstChargeOn: string | null;
  lastPaymentOn: string | null;
}

export interface DealerPortalData {
  dealer: { name: string; contact: string; address: string; joinedAt: string };
  account: PortalAccount | null;
  invoices: PortalInvoiceSummary[];
  openJobs: PortalJob[];
}

export interface PortalInvoice {
  invoiceNo: string;
  date: string;
  createdAt: string;
  status: string;
  subtotal: number | null;
  discount: number;
  total: number;
  paid: number;
  paymentMethod: string | null;
  cashier: string | null;
  outstanding: number;
  jobs: PortalJob[];
  otherLines: { description: string; qty: number; unitPrice: number; discount: number; lineTotal: number }[];
}

// numeric columns come back as strings through jsonb in some drivers; normalise.
const n = (v: unknown) => (v == null ? 0 : Number(v));
const nOrNull = (v: unknown) => (v == null ? null : Number(v));

const normJob = (j: PortalJob): PortalJob => ({
  ...j,
  estimate: n(j.estimate),
  advancePaid: n(j.advancePaid),
  unitPrice: nOrNull(j.unitPrice),
  discount: nOrNull(j.discount),
  lineTotal: nOrNull(j.lineTotal),
  partsUsed: j.partsUsed ?? [],
});

const explain = (msg: string) =>
  /Could not find the function|PGRST202/.test(msg)
    ? "The dealer portal is not set up yet."
    : msg;

/** Everything on the dealer's portal. Null when the link is not valid. */
export async function fetchDealerPortal(token: string): Promise<DealerPortalData | null> {
  if (!isSupabaseConfigured()) throw new Error("The portal is not connected.");
  const { data, error } = await getSupabaseBrowserClient().rpc("dealer_portal", { p_token: token });
  if (error) throw new Error(explain(error.message));
  if (!data) return null;
  const d = data as DealerPortalData;
  return {
    ...d,
    account: d.account ? {
      ...d.account,
      balance: n(d.account.balance), totalCharged: n(d.account.totalCharged), totalPaid: n(d.account.totalPaid),
      totalWrittenOff: n(d.account.totalWrittenOff), totalRefunded: n(d.account.totalRefunded),
      creditLimit: n(d.account.creditLimit), termsDays: n(d.account.termsDays),
    } : null,
    invoices: (d.invoices ?? []).map(i => ({ ...i, total: n(i.total), paid: n(i.paid), discount: n(i.discount), outstanding: n(i.outstanding) })),
    openJobs: (d.openJobs ?? []).map(normJob),
  };
}

/** One invoice and its jobs. Null when it is not this dealer's. */
export async function fetchDealerPortalInvoice(token: string, invoiceNo: string): Promise<PortalInvoice | null> {
  if (!isSupabaseConfigured()) throw new Error("The portal is not connected.");
  const { data, error } = await getSupabaseBrowserClient().rpc("dealer_portal_invoice", {
    p_token: token, p_invoice_no: invoiceNo,
  });
  if (error) throw new Error(explain(error.message));
  if (!data) return null;
  const i = data as PortalInvoice;
  return {
    ...i,
    subtotal: nOrNull(i.subtotal), discount: n(i.discount), total: n(i.total), paid: n(i.paid), outstanding: n(i.outstanding),
    jobs: (i.jobs ?? []).map(normJob),
    otherLines: (i.otherLines ?? []).map(l => ({ ...l, unitPrice: n(l.unitPrice), discount: n(l.discount), lineTotal: n(l.lineTotal) })),
  };
}

/** The link printed as the QR on a dealer invoice. */
export function dealerPortalUrl(token: string, invoiceNo?: string): string {
  // The short /d/<token>?i=<no> form (see app/d/[token]/page.tsx): every
  // character saved makes the printed QR's squares bigger and easier to scan.
  const base = `${publicOrigin()}/d/${encodeURIComponent(token)}`;
  return invoiceNo ? `${base}?i=${encodeURIComponent(invoiceNo)}` : base;
}

/**
 * The dealer's portal token, for staff printing an invoice. Undefined while
 * still loading (so a print can wait for it); null when the dealer is unknown, or before the migration exists — the invoice then
 * falls back to its old QR (the bare invoice number) rather than failing.
 */
export function useDealerPortalToken(dealerId: number | string | null | undefined): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const id = dealerId == null || dealerId === "" ? null : Number(dealerId);
    const lookup = id == null || !Number.isFinite(id) || !isSupabaseConfigured()
      ? Promise.resolve<string | null>(null)
      : Promise.resolve(
          getSupabaseBrowserClient().from("repair_dealers").select("portal_token").eq("id", id).maybeSingle(),
        ).then(({ data, error }) => (error || !data ? null : ((data as { portal_token?: string }).portal_token ?? null)));
    lookup.then(t => { if (live) setToken(t); }).catch(() => { if (live) setToken(null); });
    return () => { live = false; };
  }, [dealerId]);
  return token;
}

/** Admin: issue a new token, which stops every earlier printed link working. */
export async function regenerateDealerPortalToken(dealerId: number): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().rpc("regenerate_dealer_portal_token", { p_dealer_id: dealerId });
  if (error) throw new Error(explain(error.message));
  return data as string;
}
