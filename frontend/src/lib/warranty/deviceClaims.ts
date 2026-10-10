"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Warranty claims on phones the shop sold — migration 20261006000069.
 *
 * Six ways a claim is settled (migration 20261010000074), each saying what
 * happens to the faulty phone as well as to the customer. Repair-warranty
 * claims are a separate thing (warranty_claims, WarrantyContext).
 */

export type DeviceClaimResolution =
  | "repair_shop" | "company_replace" | "company_refund" | "repair_company" | "replace" | "refund";
export type DeviceClaimStatus = "Open" | "In repair" | "At company" | "Ready" | "Completed" | "Rejected";

/** Where each kind of claim sends the faulty phone. */
export type ClaimGroup = "shop" | "company" | "stock";

export const RESOLUTIONS: { id: DeviceClaimResolution; label: string; blurb: string; group: ClaimGroup }[] = [
  { id: "repair_shop",     label: "Repair at the shop",            blurb: "A free warranty repair job for our bench.",                      group: "shop" },
  { id: "company_replace", label: "Return to company · new phone", blurb: "Faulty phone goes to the company; customer gets a unit from stock now.", group: "company" },
  { id: "company_refund",  label: "Return to company · refund",    blurb: "Faulty phone goes to the company; the price is refunded.",       group: "company" },
  { id: "repair_company",  label: "Return to company · wait",      blurb: "The company repairs it; the customer waits for it to come back.", group: "company" },
  { id: "replace",         label: "Replace · back in the rack",    blurb: "Customer gets another unit; the returned phone goes back into stock.", group: "stock" },
  { id: "refund",          label: "Full cash refund",              blurb: "The price is paid back in cash; the phone goes back into stock.", group: "stock" },
];

/** Replacement claims, and where the returned phone goes for each. */
export const REPLACE_TO: Partial<Record<DeviceClaimResolution, "resell" | "return_to_company">> = {
  company_replace: "return_to_company", replace: "resell",
};
/** Refund claims, and where the returned phone goes for each. */
export const REFUND_TO: Partial<Record<DeviceClaimResolution, "resell" | "return_to_company">> = {
  company_refund: "return_to_company", refund: "resell",
};

export const RESOLUTION_LABEL: Record<DeviceClaimResolution, string> = Object.fromEntries(
  RESOLUTIONS.map(r => [r.id, r.label]),
) as Record<DeviceClaimResolution, string>;

export interface DeviceClaim {
  id: string;
  invoiceNo: string;
  deviceId: number | null;
  imei: string;
  deviceName: string;
  customer: string | null;
  customerPhone: string | null;
  soldOn: string | null;
  warrantyUntil: string | null;
  reportedIssue: string;
  resolution: DeviceClaimResolution;
  status: DeviceClaimStatus;
  jobId: string | null;
  companyName: string | null;
  sentAt: string | null;
  expectedBack: string | null;
  backAt: string | null;
  replacementDeviceId: number | null;
  replacementImei: string | null;
  refundAmount: number | null;
  /** Part of the refund taken off the credit balance instead of handed back. */
  refundCreditAmount: number | null;
  refundMethod: RefundMethod | null;
  notes: string;
  handledBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));

const toClaim = (r: Row): DeviceClaim => ({
  id: String(r.id), invoiceNo: String(r.invoice_no), deviceId: r.device_id == null ? null : Number(r.device_id),
  imei: String(r.imei), deviceName: String(r.device_name), customer: str(r.customer), customerPhone: str(r.customer_phone),
  soldOn: str(r.sold_on), warrantyUntil: str(r.warranty_until), reportedIssue: String(r.reported_issue),
  resolution: r.resolution as DeviceClaimResolution, status: r.status as DeviceClaimStatus,
  jobId: str(r.job_id), companyName: str(r.company_name), sentAt: str(r.sent_at), expectedBack: str(r.expected_back),
  backAt: str(r.back_at), replacementDeviceId: r.replacement_device_id == null ? null : Number(r.replacement_device_id),
  replacementImei: str(r.replacement_imei), refundAmount: r.refund_amount == null ? null : Number(r.refund_amount),
  refundCreditAmount: r.refund_credit_amount == null ? null : Number(r.refund_credit_amount),
  refundMethod: (r.refund_method as RefundMethod | null) ?? null,
  notes: String(r.notes ?? ""), handledBy: str(r.handled_by), createdAt: String(r.created_at), resolvedAt: str(r.resolved_at),
});

const explain = (msg: string, code?: string) =>
  /device_warranty_claims|refund_mobile_device|PGRST20[25]|Could not find/.test(msg)
    ? "Phone warranty claims are not set up yet — run migration 20261006000069_device_warranty_claims.sql."
    : code === "42501" ? "You do not have permission to handle warranty claims." : msg;

export async function fetchDeviceClaims(): Promise<DeviceClaim[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_warranty_claims").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(explain(error.message, error.code));
  return ((data ?? []) as Row[]).map(toClaim);
}

/** A claim still being dealt with — anything not Completed or Rejected. */
export const isOpenClaim = (c: Pick<DeviceClaim, "status">) => c.status !== "Completed" && c.status !== "Rejected";

/**
 * Every claim ever made on these phones, newest first — for the lookup to say
 * "already claimed" instead of offering a second claim on the same phone.
 */
export async function fetchClaimsForImeis(imeis: string[]): Promise<DeviceClaim[]> {
  const list = [...new Set(imeis.map(i => i.trim()).filter(Boolean))];
  if (!isSupabaseConfigured() || list.length === 0) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("device_warranty_claims").select("*").in("imei", list).order("created_at", { ascending: false });
  if (error) throw new Error(explain(error.message, error.code));
  return ((data ?? []) as Row[]).map(toClaim);
}

export async function createDeviceClaim(c: {
  invoiceNo: string; deviceId: number; imei: string; deviceName: string;
  customer: string | null; customerPhone: string | null; soldOn: string | null; warrantyUntil: string | null;
  reportedIssue: string; resolution: DeviceClaimResolution; status: DeviceClaimStatus;
  jobId?: string | null; companyName?: string | null; expectedBack?: string | null; notes?: string; handledBy?: string;
}): Promise<DeviceClaim> {
  const sb = getSupabaseBrowserClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb.from("device_warranty_claims").insert({
    invoice_no: c.invoiceNo, device_id: c.deviceId, imei: c.imei, device_name: c.deviceName,
    customer: c.customer, customer_phone: c.customerPhone, sold_on: c.soldOn, warranty_until: c.warrantyUntil,
    reported_issue: c.reportedIssue.trim(), resolution: c.resolution, status: c.status,
    job_id: c.jobId ?? null, company_name: c.companyName?.trim() || null,
    sent_at: c.resolution === "repair_company" ? new Date().toISOString() : null,
    expected_back: c.expectedBack || null, notes: c.notes?.trim() ?? "", handled_by: c.handledBy ?? null,
    created_by: user?.id ?? null,
  }).select("*").single();
  if (error) throw new Error(explain(error.message, error.code));
  return toClaim(data as Row);
}

export async function updateDeviceClaim(id: string, patch: Partial<{
  status: DeviceClaimStatus; jobId: string | null; backAt: string | null; notes: string;
  replacementDeviceId: number | null; replacementImei: string | null; resolvedAt: string | null;
}>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.jobId !== undefined) row.job_id = patch.jobId;
  if (patch.backAt !== undefined) row.back_at = patch.backAt;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.replacementDeviceId !== undefined) row.replacement_device_id = patch.replacementDeviceId;
  if (patch.replacementImei !== undefined) row.replacement_imei = patch.replacementImei;
  if (patch.resolvedAt !== undefined) row.resolved_at = patch.resolvedAt;
  const { error } = await getSupabaseBrowserClient().from("device_warranty_claims").update(row).eq("id", id);
  if (error) throw new Error(explain(error.message, error.code));
}

export type RefundMethod = "Cash" | "Card" | "Bank Transfer";

/** How a refund splits: what comes off the customer's credit balance, and
 *  what is actually handed back to them. */
export interface RefundSplit { credit: number; payout: number }

const splitOf = (data: unknown, amount: number): RefundSplit => {
  const r = (data ?? {}) as Record<string, unknown>;
  return { credit: Number(r.credit ?? 0), payout: Number(r.payout ?? amount) };
};

/**
 * Full refund on a claim — migration 20261006000070. Whatever is still owed
 * on the invoice's credit is cancelled first; only the rest is handed back,
 * by `method`. The phone comes off the sale and the claim closes. The caller
 * pays the cash part out of the till.
 */
export async function refundDeviceClaim(
  claimId: string, disposition: "resell" | "return_to_company", amount: number, method: RefundMethod,
): Promise<RefundSplit> {
  const { data, error } = await getSupabaseBrowserClient().rpc("refund_mobile_device", {
    p_claim_id: claimId, p_disposition: disposition, p_amount: amount, p_method: method,
  });
  if (error) throw new Error(explain(error.message, error.code));
  return splitOf(data, amount);
}

/** The same split, before anything is committed. Null when it can't be read
 *  (the migration has not run) — the window then just shows the full amount. */
export async function previewInvoiceRefund(invoiceNo: string, amount: number): Promise<RefundSplit | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseBrowserClient().rpc("invoice_refund_preview", {
    p_invoice_no: invoiceNo, p_amount: amount,
  });
  if (error) return null;
  return splitOf(data, amount);
}
