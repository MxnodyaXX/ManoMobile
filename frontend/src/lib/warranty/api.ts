"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Warranty, WarrantyClaim } from "@/cashier/contexts/WarrantyContext";

/**
 * Data access for warranties, mirroring src/lib/repair/api.ts's conventions:
 * the database speaks snake_case, the UI speaks camelCase, and everything
 * crossing that boundary goes through the mappers here.
 */

const opt = <T,>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

// ─── Row shapes ──────────────────────────────────────────────────────────────

interface WarrantyRow {
  id: string;
  job_id: string;
  invoice_no: string | null;
  customer_name: string;
  customer_phone: string;
  device_model: string;
  imei: string | null;
  parts_covered: string[] | null;
  scope: Warranty["scope"];
  duration_days: number;
  issued_at: string;
  starts_at: string | null;
  expires_at: string | null;
  status: Warranty["status"];
  void_reason: string | null;
  exclusions: string[] | null;
}

interface ClaimRow {
  id: string;
  warranty_id: string;
  job_id: string;
  reported_issue: string;
  reported_at: string;
  inspection_notes: string | null;
  within_coverage: boolean | null;
  resolution: WarrantyClaim["resolution"] | null;
  new_job_id: string | null;
  handled_by: string;
  status: WarrantyClaim["status"];
  resolved_at: string | null;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function rowToWarranty(row: WarrantyRow): Warranty {
  return {
    id: row.id,
    jobId: row.job_id,
    invoiceNo: opt(row.invoice_no),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deviceModel: row.device_model,
    imei: opt(row.imei),
    partsCovered: row.parts_covered ?? [],
    scope: row.scope,
    durationDays: row.duration_days,
    issuedAt: row.issued_at,
    startsAt: opt(row.starts_at),
    expiresAt: opt(row.expires_at),
    status: row.status,
    voidReason: opt(row.void_reason),
    exclusions: row.exclusions ?? [],
  };
}

function warrantyToRow(w: Partial<Warranty>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (col: string, value: unknown) => { if (value !== undefined) row[col] = value; };

  set("job_id", w.jobId);
  set("invoice_no", w.invoiceNo);
  set("customer_name", w.customerName);
  set("customer_phone", w.customerPhone);
  set("device_model", w.deviceModel);
  set("imei", w.imei);
  set("parts_covered", w.partsCovered);
  set("scope", w.scope);
  set("duration_days", w.durationDays);
  set("issued_at", w.issuedAt);
  set("starts_at", w.startsAt);
  set("expires_at", w.expiresAt);
  set("status", w.status);
  set("void_reason", w.voidReason);
  set("exclusions", w.exclusions);

  return row;
}

function rowToClaim(row: ClaimRow): WarrantyClaim {
  return {
    id: row.id,
    warrantyId: row.warranty_id,
    jobId: row.job_id,
    reportedIssue: row.reported_issue,
    reportedAt: row.reported_at,
    inspectionNotes: opt(row.inspection_notes),
    withinCoverage: opt(row.within_coverage),
    resolution: opt(row.resolution),
    newJobId: opt(row.new_job_id),
    handledBy: row.handled_by,
    status: row.status,
    resolvedAt: opt(row.resolved_at),
  };
}

function claimToRow(c: Partial<WarrantyClaim>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (col: string, value: unknown) => { if (value !== undefined) row[col] = value; };

  set("warranty_id", c.warrantyId);
  set("job_id", c.jobId);
  set("reported_issue", c.reportedIssue);
  set("reported_at", c.reportedAt);
  set("inspection_notes", c.inspectionNotes);
  set("within_coverage", c.withinCoverage);
  set("resolution", c.resolution);
  set("new_job_id", c.newJobId);
  set("handled_by", c.handledBy);
  set("status", c.status);
  set("resolved_at", c.resolvedAt);

  return row;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchWarranties(): Promise<Warranty[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("warranties")
    .select("*")
    .order("issued_at", { ascending: false });

  if (error) throw new Error(`Could not load warranties: ${error.message}`);
  return (data as WarrantyRow[]).map(rowToWarranty);
}

export async function fetchWarrantyClaims(): Promise<WarrantyClaim[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("warranty_claims")
    .select("*")
    .order("reported_at", { ascending: false });

  if (error) throw new Error(`Could not load warranty claims: ${error.message}`);
  return (data as ClaimRow[]).map(rowToClaim);
}

/**
 * Issue a warranty for a job. Won't double-issue: if one already exists for
 * this job id (the unique index on warranties.job_id is the backstop against
 * a genuine race), the existing row is returned instead.
 */
export async function insertWarranty(
  input: Omit<Warranty, "id" | "status" | "issuedAt" | "startsAt" | "expiresAt" | "exclusions"> & { issuedAt?: string; exclusions?: string[] },
): Promise<Warranty> {
  const client = getSupabaseBrowserClient();

  const { data: existing } = await client
    .from("warranties")
    .select("*")
    .eq("job_id", input.jobId)
    .maybeSingle();
  if (existing) return rowToWarranty(existing as WarrantyRow);

  const row = warrantyToRow({
    ...input,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    status: "Pending Activation",
  });

  const { data, error } = await client
    .from("warranties")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    // Lost the race to another insert for the same job between the check
    // above and this insert — fetch and return what won instead of erroring.
    if (error.code === "23505") {
      const { data: winner } = await client.from("warranties").select("*").eq("job_id", input.jobId).maybeSingle();
      if (winner) return rowToWarranty(winner as WarrantyRow);
    }
    throw new Error(`Could not issue the warranty: ${error.message}`);
  }
  return rowToWarranty(data as WarrantyRow);
}

export async function patchWarranty(id: string, changes: Partial<Warranty>): Promise<Warranty> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("warranties")
    .update(warrantyToRow(changes))
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Could not update warranty ${id}: ${error.message}`);
  return rowToWarranty(data as WarrantyRow);
}

export async function insertWarrantyClaim(
  input: Omit<WarrantyClaim, "id" | "status" | "reportedAt">,
): Promise<WarrantyClaim> {
  const row = claimToRow({ ...input, status: "Open", reportedAt: new Date().toISOString() });
  const { data, error } = await getSupabaseBrowserClient()
    .from("warranty_claims")
    .insert(row)
    .select("*")
    .single();

  if (error) throw new Error(`Could not open the claim: ${error.message}`);
  return rowToClaim(data as ClaimRow);
}

export async function patchWarrantyClaim(id: string, changes: Partial<WarrantyClaim>): Promise<WarrantyClaim> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("warranty_claims")
    .update(claimToRow(changes))
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Could not update claim ${id}: ${error.message}`);
  return rowToClaim(data as ClaimRow);
}

// ─── Public tracking lookup ───────────────────────────────────────────────────

export interface TrackedWarrantyClaim {
  id: string;
  status: WarrantyClaim["status"];
  reportedIssue: string;
  reportedAt: string;
  resolution?: WarrantyClaim["resolution"];
  resolvedAt?: string;
}

export interface TrackedWarranty {
  id: string;
  status: Warranty["status"];
  scope: Warranty["scope"];
  durationDays: number;
  partsCovered: string[];
  exclusions: string[];
  issuedAt: string;
  startsAt?: string;
  expiresAt?: string;
  claims: TrackedWarrantyClaim[];
}

interface TrackWarrantyRow {
  id: string;
  status: Warranty["status"];
  scope: Warranty["scope"];
  duration_days: number;
  parts_covered: string[] | null;
  exclusions: string[] | null;
  issued_at: string;
  starts_at: string | null;
  expires_at: string | null;
  claims: TrackedWarrantyClaim[] | null;
}

/** Warranty for one job, for the public /track page. Same trust boundary as
 *  trackJob(): you have to already hold that exact job id. Null means the
 *  job has no warranty (never issued, or not a repair that carries one). */
export async function trackWarranty(jobId: string): Promise<TrackedWarranty | null> {
  const { data, error } = await getSupabaseBrowserClient()
    .rpc("track_warranty", { p_job_id: jobId.trim() });
  if (error) throw new Error(`Could not look up the warranty: ${error.message}`);

  const row = (data as TrackWarrantyRow[] | null)?.[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    scope: row.scope,
    durationDays: row.duration_days,
    partsCovered: row.parts_covered ?? [],
    exclusions: row.exclusions ?? [],
    issuedAt: row.issued_at,
    startsAt: opt(row.starts_at),
    expiresAt: opt(row.expires_at),
    claims: row.claims ?? [],
  };
}
