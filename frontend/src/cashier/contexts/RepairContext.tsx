"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode, type Dispatch, type SetStateAction } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { notifyJobEvent } from "@/lib/sms/notify";
import { rulesForTechnician } from "@/lib/settings/staffRules";
import { fetchJobs, fetchDealers, insertJob, patchJob, upsertDealer, deleteDealer, claimJob as claimJobRow, UNASSIGNED_TECHNICIAN } from "@/lib/repair/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "Non-Issued" | "Issued" | "Pending" | "Completed" | "Delivered" | "Cancelled";

export type ConditionGrade = "Pristine" | "Good" | "Worn" | "Damaged";

export interface DeviceConditionMap {
  front: ConditionGrade;
  back: ConditionGrade;
  frame: ConditionGrade;
  camera: ConditionGrade;
  ports: ConditionGrade;
  buttons: ConditionGrade;
  notes?: string;
}

export type ApprovalChannel = "In-store" | "SMS" | "WhatsApp" | "Phone" | "Online";

export interface EstimateApproval {
  amount: number;
  approvedBy: string;
  channel: ApprovalChannel;
  signature?: string;   // base64 if in-store
  reference?: string;   // message id / call note
  approvedAt: string;   // ISO
  recordedByStaff: string;
}

export interface HandoverRecord {
  collectedBy: string;
  relationship?: string;
  idVerified: boolean;
  balanceSettled: number;
  paymentMethod?: "Cash" | "Card" | "Bank Transfer" | "Online";
  releaseWithBalanceOverride?: { approvedByStaff: string; reason: string };
  handoverSignature: string;   // base64
  warrantyCardIssued: boolean;
  handedOverBy: string;
  handedOverAt: string;        // ISO — warranty clock starts here
}

export interface RepairJob {
  id: string;
  customerName: string;
  phone: string;
  brand: string;
  model: string;
  issue: string;
  technician: string;
  status: JobStatus;
  priority: "Low" | "Normal" | "High" | "Urgent";
  estimatedCost: number;
  advancePaid: number;
  createdAt: string;
  estimatedCompletion: string;
  imei?: string;
  modelNumber?: string;          // device model number (e.g. M2006C3LMG) — maps to model
  jobWarranty?: string;          // @deprecated — superseded by WarrantyContext (warrantyId)
  warrantyId?: string;           // FK into WarrantyContext
  /** How the current technician got the job — drives repair_assignments.assignment_type. */
  assignmentSource?: "Assigned" | "Self-Taken";
  dealer?: string;               // dealer name as recorded at intake (printed on slips)
  dealerId?: number;             // FK into the managed dealer registry
  cancelReason?: string;
  cancelledAt?: string;          // ISO date the job was cancelled
  cancelledBy?: string;          // who requested / actioned the cancellation
  receivedItems?: string[];

  // Work-state timestamps & technician hand-back (used on receipts)
  startedAt?: string;            // when the repair was started (Started)
  pauseReason?: string;          // why the job is paused (Pending)
  pausedAt?: string;             // ISO when paused
  completedAt?: string;          // ISO when the repair was finished (Non-Issued)
  partsUsed?: string[];          // parts consumed in the repair
  techRemarks?: string;          // technician's job remarks / work summary
  futureFaults?: string;         // future faults the technician identified

  // Intake evidence & consent
  cosmeticCondition?: DeviceConditionMap;
  intakePhotos?: string[];       // base64 captured at drop-off
  passcodeType?: "PIN" | "Pattern" | "Password" | "None" | "Provided Separately";
  devicePasscode?: string;       // demo only — would be encrypted at rest in production
  customerConsentSignature?: string;   // base64 PNG signed at intake
  termsVersionAccepted?: string;

  // Estimate & approval
  originalEstimate?: number;     // first quote at intake
  revisedEstimate?: number;      // technician's post-diagnosis quote
  approval?: EstimateApproval;

  // Handover
  handover?: HandoverRecord;
}

/**
 * A repair dealer — the shop / partner that hands a device in for repair.
 * Managed from Admin Control → Repair Dealers and selected at intake (step 1
 * of New Repair).
 */
export interface RepairDealer {
  id: number;
  name: string;
  address: string;
  contact: string;
  joinedAt: string;   // YYYY-MM-DD — the date the dealer joined
  remarks?: string;
  /** The shop itself (walk-in customers). Its jobs print as a job receipt,
   *  not as a sales invoice billed to a dealer. */
  inHouse?: boolean;
}

// ─── No seed data ─────────────────────────────────────────────────────────────
// Jobs and dealers come from Supabase only. The demo records that used to live
// here were removed so nothing fictional can ever appear in the system; with no
// backend configured the lists are simply empty and the UI says so.

/** The shop's own name — used when a job carries no dealer at all. */
export const IN_HOUSE_DEALER = "MANO MOBILE CENTRE";

/**
 * Resolve the managed dealer record for anything that carries a dealer —
 * a job, an invoice row, a plain name. Matches on id first (survives renames),
 * then on name (case-insensitive), so jobs saved before the registry existed
 * still resolve.
 */
export function findDealer(
  dealers: RepairDealer[],
  ref: { dealerId?: number; dealer?: string } | string | undefined,
): RepairDealer | undefined {
  if (!ref) return undefined;
  const { dealerId, dealer } = typeof ref === "string" ? { dealerId: undefined, dealer: ref } : ref;
  if (dealerId !== undefined) {
    const byId = dealers.find(d => d.id === dealerId);
    if (byId) return byId;
  }
  const name = dealer?.trim().toLowerCase();
  if (!name) return undefined;
  return dealers.find(d => d.name.trim().toLowerCase() === name);
}

/**
 * A stable comparison key for "is this the same dealer?" — collapses the
 * registry record, a job's stored name, and legacy spellings ("MANO MOBILE"
 * vs "MANO MOBILE CENTRE") onto one value.
 */
export function dealerKey(
  dealers: RepairDealer[],
  ref: { dealerId?: number; dealer?: string } | string | undefined,
): string {
  if (isInHouseDealer(dealers, ref)) return "@in-house";
  const match = findDealer(dealers, ref);
  const name = match?.name ?? (typeof ref === "string" ? ref : ref?.dealer) ?? "";
  return name.trim().toLowerCase();
}

/**
 * Is this the shop's own work (rather than a partner dealer's)? Driven by the
 * registry's `inHouse` flag, with a name fallback for legacy job records that
 * stored "MANO MOBILE" before dealers were managed.
 */
export function isInHouseDealer(
  dealers: RepairDealer[],
  ref: { dealerId?: number; dealer?: string } | string | undefined,
): boolean {
  const match = findDealer(dealers, ref);
  if (match) return !!match.inHouse;
  const name = (typeof ref === "string" ? ref : ref?.dealer) ?? "";
  return name.trim() === "" || name.toUpperCase().includes("MANO MOBILE");
}

// ─── Context ──────────────────────────────────────────────────────────────────

// ─── Customer-facing lifecycle (display layer) ──────────────────────────────────
//
// The internal JobStatus enum keeps its original values, but the SHOP-FACING
// lifecycle is relabelled per the agreed model. Mapping (internal → shown):
//   "Non-Issued" (just logged / not started) → "New" (today) or "Not Started" (older)
//   "Issued"     (repair in progress)        → "Started"
//   "Pending"    (paused, with reason)       → "Pending"
//   "Completed"  (repaired, awaiting pickup)  → "Non-Issued"
//   "Delivered"  (collected by customer)      → "Issued"
//   "Cancelled"                               → "Cancelled"

export type RepairView =
  | "New" | "Not Started" | "Started" | "Pending"
  | "Non-Issued" | "Issued" | "Cancelled" | "All";

export function isToday(isoDate: string): boolean {
  if (!isoDate) return false;
  return isoDate.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

/** The shop-facing label for a job (date-aware for the not-started split). */
export function jobLabel(job: Pick<RepairJob, "status" | "createdAt">): RepairView {
  switch (job.status) {
    case "Non-Issued": return isToday(job.createdAt) ? "New" : "Not Started";
    case "Issued":     return "Started";
    case "Pending":    return "Pending";
    case "Completed":  return "Non-Issued";
    case "Delivered":  return "Issued";
    case "Cancelled":  return "Cancelled";
    default:           return "All";
  }
}

/** Does a job belong in a given tab/view? */
export function jobMatchesView(job: RepairJob, view: RepairView): boolean {
  if (view === "All") return true;
  return jobLabel(job) === view;
}

/** Colour + icon-name config for each shop-facing view. */
export const VIEW_META: Record<Exclude<RepairView, "All">, { color: string; bg: string; border: string }> = {
  "New":         { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  "Not Started": { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  "Started":     { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
  "Pending":     { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)"  },
  "Non-Issued":  { color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  "Issued":      { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
  "Cancelled":   { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
};

export { UNASSIGNED_TECHNICIAN };

/**
 * A job nobody has taken on yet. These are offered to every technician until
 * one of them starts it — see claimJob.
 */
export function isUnassigned(job: RepairJob): boolean {
  const t = (job.technician ?? "").trim();
  return t === "" || t.toLowerCase() === UNASSIGNED_TECHNICIAN.toLowerCase();
}

/** A job any technician is allowed to pick up right now. */
export function isClaimable(job: RepairJob): boolean {
  return isUnassigned(job) && job.status === "Non-Issued";
}

/**
 * "busy"        - already at their limit of jobs in progress.
 * "not-allowed" - this technician may not take unassigned jobs at all.
 */
export type ClaimResult = "claimed" | "taken" | "busy" | "not-allowed" | "error";

interface RepairContextValue {
  jobs: RepairJob[];
  /** Resolves with the saved job — the job number is assigned by the database. */
  addJob: (partial: Omit<RepairJob, "id">) => Promise<RepairJob>;
  updateJob: (id: string, changes: Partial<RepairJob>) => void;
  /** Take an unassigned job. "taken" means another technician got it first. */
  claimJob: (id: string, technician: string) => Promise<ClaimResult>;
  dealers: RepairDealer[];
  setDealers: Dispatch<SetStateAction<RepairDealer[]>>;
  /** True while the first load is in flight. */
  loading: boolean;
  /** Last backend error, for surfacing in the UI. */
  error: string | null;
  /** Re-read jobs and dealers from the backend. */
  refresh: () => Promise<void>;
  /** "supabase" once configured; "local" means seeded demo data, nothing is saved. */
  backend: "supabase" | "local";
}

const RepairContext = createContext<RepairContextValue>({
  jobs: [],
  addJob: async () => ({} as RepairJob),
  updateJob: () => {},
  claimJob: async () => "error",
  dealers: [],
  setDealers: () => {},
  loading: false,
  error: null,
  refresh: async () => {},
  backend: "local",
});

/** Local-only fallback numbering, used when Supabase isn't configured. */
function nextJobId(jobs: RepairJob[]): string {
  const nums = jobs
    .map(j => parseInt(j.id.replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `RM-${String(max + 1).padStart(3, "0")}`;
}

/**
 * Repair jobs and dealers, backed by Supabase.
 *
 * The public shape is deliberately the same as the old localStorage version so
 * the repair UI did not have to change — except `addJob`, which is now async
 * because the database assigns the job number (two cashiers can no longer be
 * handed the same RM-0xx).
 *
 * With Supabase unconfigured the provider serves the seed data in memory and
 * reports `backend: "local"`, so the app still demos rather than showing empty
 * tables. Nothing is persisted in that mode.
 */
export function RepairProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();

  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [dealers, setDealersState] = useState<RepairDealer[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  // setDealers keeps its Dispatch signature (Admin Control calls it with an
  // updater), so the persist step needs the current list without adding a
  // render dependency — hence a ref rather than reading state in the callback.
  const dealersRef = useRef(dealers);
  useEffect(() => { dealersRef.current = dealers; }, [dealers]);

  const load = useCallback(async () => {
    if (!configured) return;
    try {
      const [nextJobs, nextDealers] = await Promise.all([fetchJobs(), fetchDealers()]);
      setJobs(nextJobs);
      setDealersState(nextDealers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    (async () => {
      await load();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [configured, load]);

  const addJob = useCallback(async (partial: Omit<RepairJob, "id">): Promise<RepairJob> => {
    if (!configured) {
      const created: RepairJob = { id: nextJobId(jobs), ...partial };
      setJobs(prev => [{ ...created, id: nextJobId(prev) }, ...prev]);
      return created;
    }
    const created = await insertJob(partial);
    setJobs(prev => [created, ...prev]);
    // "We have your device, here is the job number."
    notifyJobEvent("created", created);
    return created;
  }, [configured, jobs]);

  /**
   * Optimistic: the row updates on screen immediately, then reconciles with what
   * the database actually stored. A failure reverts by reloading, so the UI can
   * never quietly show a change that was rejected by RLS.
   */
  const updateJob = useCallback((id: string, changes: Partial<RepairJob>) => {
    // Notify from the transition, not from the caller: every screen that moves a
    // job goes through here, so the customer hears about it however it happened.
    // Comparing against the previous status also stops a repeated save from
    // texting twice.
    const before = jobs.find(j => j.id === id);
    if (before && changes.status && changes.status !== before.status) {
      const after: RepairJob = { ...before, ...changes };
      if (changes.status === "Issued" && before.status === "Non-Issued") notifyJobEvent("started", after);
      else if (changes.status === "Pending") notifyJobEvent("paused", after);
      else if (changes.status === "Completed") notifyJobEvent("finished", after);
    }

    setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...changes } : j)));
    if (!configured) return;

    patchJob(id, changes)
      .then(fresh => setJobs(prev => prev.map(j => (j.id === id ? fresh : j))))
      .catch(e => {
        setError(e instanceof Error ? e.message : String(e));
        void load();
      });
  }, [configured, load, jobs]);

  /**
   * Take an unassigned job. The database decides the winner (the update is
   * conditional on the job still being unassigned), so a race between two
   * technicians has exactly one winner rather than the later click silently
   * overwriting the earlier one.
   */
  const claimJob = useCallback(async (id: string, technician: string): Promise<ClaimResult> => {
    // This technician's own rules, falling back to the shop rule.
    const rules = await rulesForTechnician(technician);
    if (!rules.canClaimUnassigned) return "not-allowed";

    const mine = jobs.filter(j => j.technician === technician && j.status === "Issued").length;
    if (!rules.allowMultipleActiveJobs && mine >= 1) return "busy";
    if (rules.allowMultipleActiveJobs && rules.maxActiveJobs != null && mine >= rules.maxActiveJobs) return "busy";

    if (!configured) {
      // Same rule locally: only claim if it is still free.
      const current = jobs.find(j => j.id === id);
      if (!current || !isClaimable(current)) return "taken";
      setJobs(prev => prev.map(j => (
        j.id === id && isClaimable(j)
          ? { ...j, technician, status: "Issued" as JobStatus, startedAt: new Date().toISOString().slice(0, 10) }
          : j
      )));
      return "claimed";
    }

    try {
      const claimed = await claimJobRow(id, technician);
      if (!claimed) {
        // Somebody beat us to it — refresh so the row shows its real owner.
        await load();
        return "taken";
      }
      setJobs(prev => prev.map(j => (j.id === id ? claimed : j)));
      // Claiming *is* starting the repair, and it bypasses updateJob — so the
      // customer would otherwise never hear that work began.
      notifyJobEvent("started", claimed);
      return "claimed";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return "error";
    }
  }, [configured, jobs, load]);

  /**
   * Accepts a value or an updater, like useState, and works out what changed so
   * Admin Control's add / edit / delete keep working untouched.
   */
  const setDealers = useCallback<Dispatch<SetStateAction<RepairDealer[]>>>((action) => {
    const previous = dealersRef.current;
    const next = typeof action === "function"
      ? (action as (p: RepairDealer[]) => RepairDealer[])(previous)
      : action;

    dealersRef.current = next;
    setDealersState(next);
    if (!configured) return;

    const removed = previous.filter(p => !next.some(n => n.id === p.id));
    const changed = next.filter(n => {
      const before = previous.find(p => p.id === n.id);
      return !before || JSON.stringify(before) !== JSON.stringify(n);
    });

    (async () => {
      try {
        for (const dealer of changed) await upsertDealer(dealer);
        for (const dealer of removed) await deleteDealer(dealer.id);
        // Re-read so server-assigned ids and defaults replace local guesses.
        setDealersState(await fetchDealers());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setDealersState(previous);
        dealersRef.current = previous;
      }
    })();
  }, [configured]);

  const value = useMemo<RepairContextValue>(() => ({
    jobs, addJob, updateJob, claimJob, dealers, setDealers,
    loading, error, refresh: load,
    backend: configured ? "supabase" : "local",
  }), [jobs, addJob, updateJob, claimJob, dealers, setDealers, loading, error, load, configured]);

  return <RepairContext.Provider value={value}>{children}</RepairContext.Provider>;
}

export function useRepair() {
  return useContext(RepairContext);
}
