"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  RepairJob,
  RepairDealer,
  DeviceConditionMap,
  EstimateApproval,
  HandoverRecord,
} from "@/cashier/contexts/RepairContext";

/**
 * Data access for the repair side.
 *
 * The database speaks snake_case and stores dates as timestamptz; the UI speaks
 * camelCase and, in several places, compares dates as plain "YYYY-MM-DD"
 * strings (see isToday / jobLabel). Everything crossing that boundary goes
 * through the mappers here so no component has to know the row shape.
 */

const INTAKE_BUCKET = "repair-intake";

/** What the technician column holds until somebody takes the job on. */
export const UNASSIGNED_TECHNICIAN = "Unassigned";

// ─── Row shapes ──────────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  customer_name: string;
  phone: string;
  brand: string;
  model: string;
  model_number: string | null;
  imei: string | null;
  issue: string;
  technician: string;
  status: RepairJob["status"];
  priority: RepairJob["priority"];
  estimated_cost: number | string;
  advance_paid: number | string;
  original_estimate: number | string | null;
  revised_estimate: number | string | null;
  dealer: string | null;
  dealer_id: number | null;
  created_at: string;
  estimated_completion: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  pause_reason: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  parts_used: string[] | null;
  tech_remarks: string | null;
  future_faults: string | null;
  received_items: string[] | null;
  intake_photos: string[] | null;
  cosmetic_condition: DeviceConditionMap | null;
  passcode_type: RepairJob["passcodeType"];
  device_passcode: string | null;
  customer_consent_signature: string | null;
  terms_version_accepted: string | null;
  approval: EstimateApproval | null;
  handover: HandoverRecord | null;
  warranty_id: string | null;
  completion_type: RepairJob["completionType"] | null;
}

interface DealerRow {
  id: number;
  name: string;
  address: string;
  contact: string;
  joined_at: string;
  remarks: string | null;
  in_house: boolean;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

/** numeric columns arrive as strings from PostgREST when they exceed JS-safe precision. */
const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));
const optNum = (v: number | string | null | undefined) => (v == null ? undefined : Number(v));
const opt = <T,>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

/** The UI slices dates with .slice(0, 10), so keep whole-day fields date-only. */
const dateOnly = (v: string | null | undefined) => (v ? v.slice(0, 10) : undefined);

export function rowToJob(row: JobRow): RepairJob {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone ?? "",
    brand: row.brand ?? "",
    model: row.model ?? "",
    modelNumber: opt(row.model_number),
    imei: opt(row.imei),
    issue: row.issue ?? "",
    technician: row.technician ?? "Unassigned",
    status: row.status,
    priority: row.priority,
    estimatedCost: num(row.estimated_cost),
    advancePaid: num(row.advance_paid),
    originalEstimate: optNum(row.original_estimate),
    revisedEstimate: optNum(row.revised_estimate),
    dealer: opt(row.dealer),
    dealerId: opt(row.dealer_id),
    createdAt: row.created_at.slice(0, 10),
    estimatedCompletion: dateOnly(row.estimated_completion) ?? "",
    startedAt: dateOnly(row.started_at),
    pausedAt: dateOnly(row.paused_at),
    completedAt: dateOnly(row.completed_at),
    cancelledAt: dateOnly(row.cancelled_at),
    pauseReason: opt(row.pause_reason),
    cancelReason: opt(row.cancel_reason),
    cancelledBy: opt(row.cancelled_by),
    partsUsed: row.parts_used?.length ? row.parts_used : undefined,
    techRemarks: opt(row.tech_remarks),
    futureFaults: opt(row.future_faults),
    receivedItems: row.received_items?.length ? row.received_items : undefined,
    intakePhotos: row.intake_photos?.length ? row.intake_photos : undefined,
    cosmeticCondition: opt(row.cosmetic_condition),
    passcodeType: row.passcode_type,
    devicePasscode: opt(row.device_passcode),
    customerConsentSignature: opt(row.customer_consent_signature),
    termsVersionAccepted: opt(row.terms_version_accepted),
    approval: opt(row.approval),
    handover: opt(row.handover),
    warrantyId: opt(row.warranty_id),
    completionType: opt(row.completion_type),
  };
}

/** Domain → row. Only defined keys are emitted, so partial updates stay partial. */
export function jobToRow(job: Partial<RepairJob>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (col: string, value: unknown) => {
    if (value !== undefined) row[col] = value;
  };

  set("customer_name", job.customerName);
  set("phone", job.phone);
  set("brand", job.brand);
  set("model", job.model);
  set("model_number", job.modelNumber);
  set("imei", job.imei);
  set("issue", job.issue);
  set("technician", job.technician);
  set("assignment_source", job.assignmentSource);
  set("status", job.status);
  set("priority", job.priority);
  set("estimated_cost", job.estimatedCost);
  set("advance_paid", job.advancePaid);
  set("original_estimate", job.originalEstimate);
  set("revised_estimate", job.revisedEstimate);
  set("dealer", job.dealer);
  set("dealer_id", job.dealerId);
  set("estimated_completion", job.estimatedCompletion || undefined);
  set("started_at", job.startedAt);
  set("paused_at", job.pausedAt);
  set("completed_at", job.completedAt);
  set("cancelled_at", job.cancelledAt);
  set("pause_reason", job.pauseReason);
  set("cancel_reason", job.cancelReason);
  set("cancelled_by", job.cancelledBy);
  set("parts_used", job.partsUsed);
  set("tech_remarks", job.techRemarks);
  set("future_faults", job.futureFaults);
  set("received_items", job.receivedItems);
  set("intake_photos", job.intakePhotos);
  set("cosmetic_condition", job.cosmeticCondition);
  set("passcode_type", job.passcodeType);
  set("device_passcode", job.devicePasscode);
  set("customer_consent_signature", job.customerConsentSignature);
  set("terms_version_accepted", job.termsVersionAccepted);
  set("approval", job.approval);
  set("handover", job.handover);
  set("warranty_id", job.warrantyId);
  set("completion_type", job.completionType);

  return row;
}

export const rowToDealer = (row: DealerRow): RepairDealer => ({
  id: row.id,
  name: row.name,
  address: row.address ?? "",
  contact: row.contact ?? "",
  joinedAt: row.joined_at,
  remarks: opt(row.remarks),
  inHouse: row.in_house || undefined,
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchJobs(): Promise<RepairJob[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load repair jobs: ${error.message}`);
  return (data as JobRow[]).map(rowToJob);
}

export async function fetchDealers(): Promise<RepairDealer[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_dealers")
    .select("*")
    .order("in_house", { ascending: false })
    .order("name");

  if (error) throw new Error(`Could not load dealers: ${error.message}`);
  return (data as DealerRow[]).map(rowToDealer);
}

/**
 * Insert a job. The job number (RM-0xx) is assigned by a Postgres sequence, not
 * by the client — two cashiers taking devices in at the same moment can no
 * longer be handed the same number.
 */
export async function insertJob(job: Omit<RepairJob, "id">): Promise<RepairJob> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_jobs")
    .insert(jobToRow(job))
    .select("*")
    .single();

  if (error) throw new Error(`Could not create the repair job: ${error.message}`);
  return rowToJob(data as JobRow);
}

export async function patchJob(id: string, changes: Partial<RepairJob>): Promise<RepairJob> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_jobs")
    .update(jobToRow(changes))
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Could not update ${id}: ${error.message}`);
  return rowToJob(data as JobRow);
}

/**
 * Claim an unassigned job for a technician.
 *
 * The `.eq("technician", UNASSIGNED)` guard is the whole point: it makes the
 * update conditional inside a single SQL statement, so when two technicians tap
 * Start on the same job at the same moment, Postgres lets exactly one through.
 * The loser gets zero rows back and is told the job is taken — no last-write-wins.
 *
 * Returns the claimed job, or null if somebody else got there first.
 */
export async function claimJob(id: string, technician: string): Promise<RepairJob | null> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_jobs")
    .update({
      technician,
      status: "Issued",
      started_at: new Date().toISOString(),
      // Recorded explicitly so repair_assignments.assignment_type says
      // "Self-Taken" rather than the trigger having to infer it.
      assignment_source: "Self-Taken",
    })
    .eq("id", id)
    .eq("technician", UNASSIGNED_TECHNICIAN)
    .eq("status", "Non-Issued")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Could not start ${id}: ${error.message}`);
  return data ? rowToJob(data as JobRow) : null;
}

export async function upsertDealer(dealer: Partial<RepairDealer> & { name: string }): Promise<RepairDealer> {
  const payload: Record<string, unknown> = {
    name: dealer.name,
    address: dealer.address ?? "",
    contact: dealer.contact ?? "",
    joined_at: dealer.joinedAt ?? new Date().toISOString().slice(0, 10),
    remarks: dealer.remarks ?? null,
    in_house: dealer.inHouse ?? false,
  };
  if (dealer.id) payload.id = dealer.id;

  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_dealers")
    .upsert(payload)
    .select("*")
    .single();

  if (error) throw new Error(`Could not save the dealer: ${error.message}`);
  return rowToDealer(data as DealerRow);
}

export async function deleteDealer(id: number): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from("repair_dealers").delete().eq("id", id);
  if (error) throw new Error(`Could not delete the dealer: ${error.message}`);
}

/** Status history for one job, newest first. Written by trigger, read-only here. */
export interface JobEvent {
  id: number;
  jobId: string;
  fromStatus: RepairJob["status"] | null;
  toStatus: RepairJob["status"];
  note: string | null;
  changedAt: string;
  changedByName: string | null;
}

export async function fetchJobEvents(jobId: string): Promise<JobEvent[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_job_events")
    .select("id, job_id, from_status, to_status, note, changed_at, profiles:changed_by (full_name)")
    .eq("job_id", jobId)
    .order("changed_at", { ascending: false });

  if (error) throw new Error(`Could not load history for ${jobId}: ${error.message}`);

  return (data ?? []).map((r: unknown) => {
    const row = r as {
      id: number; job_id: string;
      from_status: RepairJob["status"] | null; to_status: RepairJob["status"];
      note: string | null; changed_at: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
    };
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      jobId: row.job_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      note: row.note,
      changedAt: row.changed_at,
      changedByName: p?.full_name ?? null,
    };
  });
}

// ─── Intake photos (Storage) ─────────────────────────────────────────────────

/** "data:image/jpeg;base64,…" → Blob, so the signature-pad/camera output can be uploaded as a file. */
function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/jpeg";
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return { blob: new Blob([buf], { type: mime }), ext: mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg" };
}

/**
 * Upload intake photos and return their storage paths.
 *
 * Photos are megabytes each as base64 — keeping them in the row would bloat
 * every query that reads a job. Failures are reported but never block the job:
 * a saved repair with missing photos beats a lost intake.
 */
export async function uploadIntakePhotos(jobId: string, dataUrls: string[]): Promise<string[]> {
  if (!dataUrls.length) return [];
  const supabase = getSupabaseBrowserClient();
  const paths: string[] = [];

  for (const [i, dataUrl] of dataUrls.entries()) {
    if (!dataUrl.startsWith("data:")) {
      paths.push(dataUrl); // already a stored path
      continue;
    }
    const { blob, ext } = dataUrlToBlob(dataUrl);
    const path = `${jobId}/intake-${i + 1}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(INTAKE_BUCKET).upload(path, blob, {
      contentType: blob.type,
      upsert: true,
    });
    if (error) {
      console.error(`Intake photo ${i + 1} for ${jobId} failed to upload:`, error.message);
      continue;
    }
    paths.push(path);
  }
  return paths;
}

/** Signed URLs for display. The bucket is private, so paths are not directly viewable. */
export async function signedPhotoUrls(paths: string[], expiresInSeconds = 3600): Promise<string[]> {
  if (!paths.length) return [];
  const stored = paths.filter((p) => !p.startsWith("data:") && !p.startsWith("http"));
  if (!stored.length) return paths;

  const { data, error } = await getSupabaseBrowserClient()
    .storage.from(INTAKE_BUCKET)
    .createSignedUrls(stored, expiresInSeconds);

  if (error) {
    console.error("Could not sign intake photo URLs:", error.message);
    return [];
  }
  return (data ?? []).map((d: { signedUrl: string }) => d.signedUrl).filter(Boolean);
}
