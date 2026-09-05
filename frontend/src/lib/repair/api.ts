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

/**
 * Is this job nobody's yet?
 *
 * There are two ways a job says so and both are in the data: intake writes the
 * literal "Unassigned", while jobs created elsewhere leave the column empty.
 * Checking only one of them is how the technician bench came to show an empty
 * claim list while the counter listed two unassigned repairs — so the question
 * is asked in exactly one place.
 */
export function isUnassigned(technician?: string | null): boolean {
  const t = (technician ?? "").trim();
  return t === "" || t.toLowerCase() === UNASSIGNED_TECHNICIAN.toLowerCase();
}

// ─── Row shapes ──────────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  customer_name: string;
  phone: string;
  customer_email: string | null;
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
  /** Set when the advance was given back. The amount and reason are in
   *  cash_returns; this is the flag the jobs list reads. */
  advance_refunded_on: string | null;
  cash_return_amount: number | string | null;
  rejob_of: string | null;
  written_off: number | string | null;
  original_estimate: number | string | null;
  revised_estimate: number | string | null;
  dealer: string | null;
  dealer_id: number | null;
  dealer_job_no: string | null;
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
  labour_cost: number | string | null;
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
    customerEmail: opt(row.customer_email),
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
    advanceRefundedOn: row.advance_refunded_on ?? null,
    cashReturnAmount: optNum(row.cash_return_amount),
    rejobOf: row.rejob_of ?? null,
    // Part of the bill forgiven at handover — see migration 20260901000017.
    writtenOff: num(row.written_off),
    originalEstimate: optNum(row.original_estimate),
    revisedEstimate: optNum(row.revised_estimate),
    dealer: opt(row.dealer),
    dealerId: opt(row.dealer_id),
    dealerJobNo: opt(row.dealer_job_no),
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
    labourCost: row.labour_cost == null ? undefined : Number(row.labour_cost),
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
  set("customer_email", job.customerEmail);
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
  set("cash_return_amount", job.cashReturnAmount);
  set("rejob_of", job.rejobOf);
  set("written_off", job.writtenOff);
  set("original_estimate", job.originalEstimate);
  set("revised_estimate", job.revisedEstimate);
  set("dealer", job.dealer);
  set("dealer_id", job.dealerId);
  set("dealer_job_no", job.dealerJobNo);
  set("estimated_completion", job.estimatedCompletion || undefined);
  set("started_at", job.startedAt);
  set("paused_at", job.pausedAt);
  set("completed_at", job.completedAt);
  set("cancelled_at", job.cancelledAt);
  set("pause_reason", job.pauseReason);
  set("cancel_reason", job.cancelReason);
  set("cancelled_by", job.cancelledBy);
  set("parts_used", job.partsUsed);
  set("labour_cost", job.labourCost);
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

/**
 * Every job this device has been through before, newest first.
 *
 * A phone that comes back is the single most useful thing the counter can know
 * at intake — it changes the quote, the warranty question and often the fault
 * itself — and until now nothing looked. The IMEI is the only identifier that
 * survives a customer changing their number, their name spelling, or the phone
 * changing hands.
 *
 * Matched on digits only. IMEIs get typed with spaces and dashes, and two
 * records of the same handset must not miss each other over punctuation.
 */
export async function fetchJobsByImei(imei: string, excludeId?: string): Promise<RepairJob[]> {
  const digits = (imei ?? "").replace(/\D/g, "");
  if (digits.length < 14) return [];

  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_jobs")
    .select("*")
    .not("imei", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not check the IMEI: ${error.message}`);

  return (data as JobRow[])
    .filter(r => (r.imei ?? "").replace(/\D/g, "") === digits)
    .filter(r => r.id !== excludeId)
    .map(rowToJob);
}

/**
 * Take an unassigned job, atomically.
 *
 * Goes through claim_repair_job() rather than a plain update, because a claim
 * from the browser is a read-modify-write: two technicians with the pool open
 * both read "unassigned" and both write, and the second silently overwrites the
 * first. The function makes the check part of the UPDATE, so the database picks
 * the winner and the loser is told.
 *
 * Throws with a message worth showing — "already started by another technician"
 * is the answer, not an error to swallow.
 */
export async function claimRepairJob(jobId: string): Promise<RepairJob> {
  const { data, error } = await getSupabaseBrowserClient()
    .rpc("claim_repair_job", { p_job_id: jobId });

  if (error) {
    if (/already been started/i.test(error.message)) {
      throw new Error("This repair has already been started by another technician.");
    }
    if (/not permitted/i.test(error.message)) {
      throw new Error("You are not permitted to claim unassigned repairs.");
    }
    if (/claim_repair_job/.test(error.message) || error.code === "42883") {
      throw new Error("Claiming is not set up yet — run migration 20260902000019_technician_workflow.sql.");
    }
    throw new Error(error.message);
  }
  return rowToJob(data as JobRow);
}

/**
 * Hand a job to somebody else, or put it back in the pool with a null target.
 * Admin only, enforced in the function.
 */
export async function reassignRepairJob(jobId: string, to: string | null): Promise<RepairJob> {
  const { data, error } = await getSupabaseBrowserClient()
    .rpc("reassign_repair_job", { p_job_id: jobId, p_to: to });

  if (error) {
    throw new Error(
      /Only an Admin/i.test(error.message)
        ? "Only an Admin can reassign or release a repair."
        : error.message,
    );
  }
  return rowToJob(data as JobRow);
}

/** The narrow shape track_job() returns — see migrations
 *  20260819000015 / 20260819000016_public_job_tracking for why this isn't
 *  the full RepairJob (no phone, address, IMEI, passcode, signature, or
 *  internal staff notes reach a public, unauthenticated endpoint). */
export interface TrackedJob {
  id: string; customerName: string; brand: string; model: string; issue: string;
  status: RepairJob["status"]; estimatedCompletion: string;
  estimatedCost: number; advancePaid: number;
  originalEstimate?: number; revisedEstimate?: number; labourCost?: number;
  approval?: EstimateApproval; warrantyId?: string;
  technician?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  receivedItems?: string[];
  /** Masked server-side (track_job() never returns the raw value) — safe to
   *  print as-is, there's nothing further to hide. */
  customerPhone?: string;
  imei?: string;
  partsUsed?: string[];
  cosmeticCondition?: DeviceConditionMap;
  intakePhotos?: string[];
  pauseReason?: string;
  cancelReason?: string;
  cancelledAt?: string;
  handedOverAt?: string;
}

interface TrackJobRow {
  id: string; customer_name: string; brand: string; model: string; issue: string;
  status: RepairJob["status"]; estimated_completion: string | null;
  estimated_cost: number | string; advance_paid: number | string;
  original_estimate: number | string | null; revised_estimate: number | string | null;
  labour_cost: number | string | null;
  approval: EstimateApproval | null; warranty_id: string | null;
  technician: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  received_items: string[] | null;
  customer_phone: string | null;
  imei: string | null;
  parts_used: string[] | null;
  cosmetic_condition: DeviceConditionMap | null;
  intake_photos: string[] | null;
  pause_reason: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  handed_over_at: string | null;
}

/**
 * Public job lookup for the /track page — the only thing an unauthenticated
 * customer's browser can read. Goes through track_job() rather than the
 * table directly: repair_jobs' own RLS is staff-only, on purpose, so a
 * scanned QR code must not be able to list or read arbitrary columns. Phone
 * and IMEI arrive already masked — track_job() masks them in SQL, so the raw
 * values never leave the database.
 */
export async function trackJob(jobId: string): Promise<TrackedJob | null> {
  const { data, error } = await getSupabaseBrowserClient()
    .rpc("track_job", { p_job_id: jobId.trim() });

  if (error) throw new Error(`Could not look up that job: ${error.message}`);
  const row = (data as TrackJobRow[] | null)?.[0];
  if (!row) return null;

  return {
    id: row.id,
    customerName: row.customer_name,
    brand: row.brand,
    model: row.model,
    issue: row.issue,
    status: row.status,
    estimatedCompletion: dateOnly(row.estimated_completion) ?? "",
    estimatedCost: num(row.estimated_cost),
    advancePaid: num(row.advance_paid),
    originalEstimate: optNum(row.original_estimate),
    revisedEstimate: optNum(row.revised_estimate),
    labourCost: optNum(row.labour_cost),
    approval: opt(row.approval),
    warrantyId: opt(row.warranty_id),
    technician: opt(row.technician),
    createdAt: dateOnly(row.created_at),
    startedAt: dateOnly(row.started_at),
    completedAt: dateOnly(row.completed_at),
    receivedItems: row.received_items?.length ? row.received_items : undefined,
    customerPhone: opt(row.customer_phone),
    imei: opt(row.imei),
    partsUsed: row.parts_used?.length ? row.parts_used : undefined,
    cosmeticCondition: opt(row.cosmetic_condition),
    intakePhotos: row.intake_photos?.length ? row.intake_photos : undefined,
    pauseReason: opt(row.pause_reason),
    cancelReason: opt(row.cancel_reason),
    cancelledAt: dateOnly(row.cancelled_at),
    handedOverAt: dateOnly(row.handed_over_at),
  };
}

export interface TrackedJobHistoryEntry {
  id: string; brand: string; model: string; issue: string;
  status: RepairJob["status"]; estimatedCost: number;
  completedAt?: string; createdAt?: string;
  /** "imei": certainly the same handset. "device": same customer, same make
   *  and model — likely, not certain. Drives what the page claims. */
  matchedOn: "imei" | "device";
}

interface TrackJobHistoryRow {
  id: string; brand: string; model: string; issue: string;
  status: RepairJob["status"]; estimated_cost: number | string;
  completed_at: string | null; created_at: string | null;
  matched_on: "imei" | "device" | null;
}

/**
 * Earlier repairs on the same handset as `jobId`.
 *
 * Matched on IMEI where the job carries one. This used to match on the
 * customer's phone number, which on a dealer job is the dealer's switchboard —
 * so one device's tracking link listed the dealer's whole book as "previous
 * repairs on this device".
 *
 * Same trust boundary as trackJob(): you have to already hold one exact job id
 * to see anything at all.
 */
export async function trackJobHistory(jobId: string): Promise<TrackedJobHistoryEntry[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .rpc("track_job_history", { p_job_id: jobId.trim() });
  if (error) throw new Error(`Could not look up previous repairs: ${error.message}`);

  return ((data as TrackJobHistoryRow[] | null) ?? []).map(row => ({
    id: row.id,
    brand: row.brand,
    model: row.model,
    issue: row.issue,
    status: row.status,
    estimatedCost: num(row.estimated_cost),
    completedAt: dateOnly(row.completed_at),
    createdAt: dateOnly(row.created_at),
    // Older deployments of the function do not return it; the weaker claim is
    // the safe assumption when we cannot tell.
    matchedOn: row.matched_on ?? "device",
  }));
}

/** The customer approving a revised estimate from the tracking page. See
 *  approve_job_estimate() — writes only the job's `approval` column. */
export async function approveJobEstimate(jobId: string, approvedBy: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .rpc("approve_job_estimate", { p_job_id: jobId.trim(), p_approved_by: approvedBy });
  if (error) throw new Error(`Could not record your approval: ${error.message}`);
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
/**
 * `id` is optional and honoured only here, never on update.
 *
 * Jobs taken in for another shop already have that shop's own job number on
 * the docket, and staff need to find the device by the number the dealer will
 * quote at them. Omit it and the column default (next_job_no) assigns the
 * usual RM-nnn, which is also the only collision-proof option since the
 * sequence, not the browser, picks the number.
 *
 * jobToRow deliberately does not emit `id` — letting an update change the
 * primary key would orphan the job's events, parts and assignment rows.
 */
export async function insertJob(job: Omit<RepairJob, "id"> & { id?: string }): Promise<RepairJob> {
  const row = jobToRow(job);
  const explicitId = job.id?.trim();
  if (explicitId) row.id = explicitId;

  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_jobs")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    // 23505 is unique_violation, which for an insert here is always the job
    // number. "duplicate key value violates..." means nothing at a counter.
    if (error.code === "23505") {
      // Two different unique constraints can land here, and the fix differs.
      if (error.message.includes("dealer_job_no")) {
        throw new Error(`That dealer already has a job numbered "${job.dealerJobNo?.trim()}".`);
      }
      if (explicitId) {
        throw new Error(`Job number "${explicitId}" is already used by another repair.`);
      }
    }
    // 42501 is a row-level security refusal. Postgres phrases it as "new row
    // violates row-level security policy", which tells a shop nothing about
    // what to do — and the answer here is almost always "you are signed in as
    // the wrong person", not "something is broken".
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      throw new Error(
        "Only a Cashier or an Admin can book in a repair. You are signed in under a different role — sign out and back in as the counter account.",
      );
    }
    throw new Error(`Could not create the repair job: ${error.message}`);
  }
  return rowToJob(data as JobRow);
}

/**
 * What the next auto-generated number will most likely be, for showing in the
 * intake form before the job is saved.
 *
 * A preview, not a reservation: the sequence is only advanced by an actual
 * insert, so two cashiers looking at the form at once see the same number.
 * That is why the auto-generate tick lets the database assign rather than
 * sending this value back — only the sequence can guarantee uniqueness.
 */
export async function previewNextJobNo(): Promise<string | null> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_jobs")
    .select("id")
    .like("id", "RM-%")
    .order("id", { ascending: false })
    .limit(1);

  if (error) return null;
  const last = (data as { id: string }[] | null)?.[0]?.id;
  const n = last ? Number(last.replace(/^RM-/, "")) : 0;
  if (!Number.isFinite(n)) return null;
  return `RM-${String(n + 1).padStart(3, "0")}`;
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

// ─── Dealer job-number clashes ───────────────────────────────────────────────

export interface DealerJobNoCheck {
  /** The job already filed under this dealer + number, if any. */
  existing: { id: string; dealerJobNo: string; customerName: string; device: string; createdAt: string; status: string } | null;
  /** A free variant of the same number for a device coming back — 1 -> 1A. */
  suggestion: string | null;
}

/**
 * Whether this dealer has already used this number, checked while the cashier
 * types rather than on save.
 *
 * The unique constraint would catch it either way, but only after five steps of
 * intake have been filled in. Catching it at the box is the difference between
 * correcting a digit and redoing the form.
 *
 * A returning device is a real case, not a mistake: the same phone comes back
 * under the dealer's same docket number, and the shop needs both jobs on
 * record. So the clash also carries the next free suffix — 1 becomes 1A, then
 * 1B — which keeps the two visibly related instead of inventing a number.
 */
export async function checkDealerJobNo(dealerId: number, raw: string): Promise<DealerJobNoCheck> {
  const value = raw.trim();
  if (!value) return { existing: null, suggestion: null };

  // PostgREST's `like` uses * as the wildcard; strip any the user typed so a
  // number containing one cannot widen the search.
  const base = value.replace(/[*%_]/g, "");

  const { data, error } = await getSupabaseBrowserClient()
    .from("repair_jobs")
    .select("id, dealer_job_no, customer_name, brand, model, created_at, status")
    .eq("dealer_id", dealerId)
    .like("dealer_job_no", `${base}*`);

  if (error) return { existing: null, suggestion: null };

  const rows = (data ?? []) as {
    id: string; dealer_job_no: string | null; customer_name: string;
    brand: string | null; model: string | null; created_at: string; status: string;
  }[];

  const hit = rows.find(r => (r.dealer_job_no ?? "").trim().toLowerCase() === value.toLowerCase());
  if (!hit) return { existing: null, suggestion: null };

  // Letters already taken on this number, so a third visit becomes 1B not 1A.
  const taken = new Set(
    rows
      .map(r => (r.dealer_job_no ?? "").trim().toUpperCase())
      .map(n => (n.startsWith(base.toUpperCase()) ? n.slice(base.length) : ""))
      .filter(sfx => /^[A-Z]$/.test(sfx)),
  );
  const free = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(c => !taken.has(c)) ?? null;

  return {
    existing: {
      id: hit.id,
      dealerJobNo: hit.dealer_job_no ?? value,
      customerName: hit.customer_name,
      device: [hit.brand, hit.model].filter(Boolean).join(" ") || "—",
      createdAt: hit.created_at,
      status: hit.status,
    },
    suggestion: free ? `${base}${free}` : null,
  };
}
