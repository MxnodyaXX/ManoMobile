"use client";

import { createContext, useContext, useEffect, ReactNode, type Dispatch, type SetStateAction } from "react";
import { usePersistentState } from "@/cashier/hooks/usePersistentState";

// Bump this whenever the seed gains new fields so already-stored jobs get
// backfilled (instead of users having to clear localStorage).
const SEED_VERSION = "3";

// Same idea for the dealer registry — bump when the seed gains a new dealer.
const DEALER_SEED_VERSION = "1";

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

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const INITIAL_JOBS: RepairJob[] = [
  { id: "RM-001", customerName: "Kasun Perera",       phone: "+94 77 123 4567", brand: "Apple",   model: "iPhone 14 Pro",  issue: "Screen Damage",  technician: "Kamal",  status: "Non-Issued", priority: "High",   estimatedCost: 25000, advancePaid: 5000,  createdAt: "2025-04-20", estimatedCompletion: "2025-04-22", imei: "351988100241349", dealer: "MANO MOBILE CENTRE", dealerId: 5, receivedItems: ["SIM Card", "Charger"] },
  { id: "RM-002", customerName: "Nimali Silva",        phone: "+94 71 234 5678", brand: "Samsung", model: "Galaxy S23",      issue: "Battery",        technician: "Nimal",  status: "Issued",     priority: "Normal", estimatedCost: 8000,  advancePaid: 2000,  createdAt: "2025-04-21", estimatedCompletion: "2025-04-23", startedAt: "2025-04-21", imei: "354668771114184", dealer: "MANO MOBILE CENTRE", dealerId: 5, receivedItems: ["Back Cover"] },
  { id: "RM-003", customerName: "Roshan Fernando",     phone: "+94 76 345 6789", brand: "Xiaomi",  model: "Redmi Note 12",  issue: "Charging Port",  technician: "Suresh", status: "Pending",    priority: "Urgent", estimatedCost: 4500,  advancePaid: 1000,  createdAt: "2025-04-19", estimatedCompletion: "2025-04-21", startedAt: "2025-04-19", imei: "354682282577565", dealer: "MANO MOBILE CENTRE", dealerId: 5, pauseReason: "Waiting for charging-port module to arrive", pausedAt: "2025-04-20" },
  { id: "RM-004", customerName: "Dilini Rajapaksa",    phone: "+94 70 456 7890", brand: "Apple",   model: "iPhone 13",      issue: "Camera",         technician: "Kamal",  status: "Completed",  priority: "Normal", estimatedCost: 15000, advancePaid: 15000, createdAt: "2025-04-18", estimatedCompletion: "2025-04-20", startedAt: "2025-04-19", completedAt: "2025-04-20", imei: "356822002345678", jobWarranty: "3 MONTHS WARRANTY [NORMAL]", dealer: "MANO MOBILE CENTRE", dealerId: 5, partsUsed: ["iPhone 13 Rear Camera Module"], techRemarks: "Replaced rear camera module, recalibrated, tested all lenses OK.", futureFaults: "Battery health at 82% — may need replacement within 6 months." },
  { id: "RM-005", customerName: "Pradeep Jayawardena", phone: "+94 75 567 8901", brand: "Oppo",    model: "Reno 8",         issue: "Speaker / Mic",  technician: "Nimal",  status: "Non-Issued", priority: "Low",    estimatedCost: 3000,  advancePaid: 0,     createdAt: "2025-04-22", estimatedCompletion: "2025-04-25", dealer: "MANO MOBILE CENTRE", dealerId: 5 },
  { id: "RM-006", customerName: "Samantha Bandara",    phone: "+94 78 678 9012", brand: "Samsung", model: "Galaxy A54",     issue: "Water Damage",   technician: "Suresh", status: "Issued",     priority: "High",   estimatedCost: 12000, advancePaid: 3000,  createdAt: "2025-04-21", estimatedCompletion: "2025-04-24", startedAt: "2025-04-22", imei: "864562049583598", dealer: "MANO MOBILE CENTRE", dealerId: 5 },
  { id: "RM-007", customerName: "Chamara Wijesinghe",  phone: "+94 72 789 0123", brand: "Huawei",  model: "P30 Pro",        issue: "Software",       technician: "Kamal",  status: "Pending",    priority: "Normal", estimatedCost: 5000,  advancePaid: 2000,  createdAt: "2025-04-20", estimatedCompletion: "2025-04-22", startedAt: "2025-04-20", pauseReason: "Awaiting customer approval for extra cost", pausedAt: "2025-04-21", dealer: "MANO MOBILE CENTRE", dealerId: 5 },
  { id: "RM-008", customerName: "Isuru Madushanka",    phone: "+94 74 890 1234", brand: "OnePlus", model: "Nord 3",         issue: "Back Glass",     technician: "Nimal",  status: "Delivered",  priority: "Low",    estimatedCost: 6000,  advancePaid: 6000,  createdAt: "2025-04-17", estimatedCompletion: "2025-04-19", startedAt: "2025-04-17", completedAt: "2025-04-19", imei: "860123456789012", jobWarranty: "1 MONTH WARRANTY [NORMAL]", dealer: "MANO MOBILE CENTRE", dealerId: 5, partsUsed: ["Back Glass Panel"], techRemarks: "Replaced back glass, cleaned frame, pressure-tested.", handover: { collectedBy: "Isuru Madushanka", relationship: "Owner", idVerified: true, balanceSettled: 0, paymentMethod: "Cash", handoverSignature: "", warrantyCardIssued: true, handedOverBy: "Cashier", handedOverAt: "2025-04-20" } },
  { id: "RM-009", customerName: "Malini Dissanayake",  phone: "+94 76 901 2345", brand: "Apple",   model: "iPhone 12",      issue: "Battery Drain",  technician: "Suresh", status: "Cancelled",  priority: "Normal", estimatedCost: 9500,  advancePaid: 0,     createdAt: "2025-04-16", estimatedCompletion: "2025-04-18", dealer: "MANO MOBILE CENTRE", dealerId: 5, cancelReason: "Customer cancelled — no budget", cancelledAt: "2025-04-17", cancelledBy: "Customer (Malini Dissanayake)" },
];

export const INITIAL_DEALERS: RepairDealer[] = [
  { id: 5, name: "MANO MOBILE CENTRE", address: "", contact: "", joinedAt: "2018-01-01", remarks: "In-house — walk-in customers", inHouse: true },
  { id: 1, name: "Tech Hub Colombo",    address: "123 Galle Road, Colombo 03", contact: "+94 11 234 5678", joinedAt: "2019-03-12", remarks: "Primary dealer — 15% discount" },
  { id: 2, name: "Mobile World Kandy",  address: "45 Peradeniya Rd, Kandy",    contact: "+94 81 223 4567", joinedAt: "2021-07-05", remarks: "Wholesale partner" },
  { id: 3, name: "Digital Zone Negombo", address: "78 Sea Street, Negombo",    contact: "+94 31 222 3344", joinedAt: "2024-11-18", remarks: "New dealer — verify identity" },
  { id: 4, name: "Smart Phones Galle",  address: "12 Hospital Rd, Galle",      contact: "+94 91 224 5566", joinedAt: "2019-08-30", remarks: "Trusted dealer since 2019" },
];

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

interface RepairContextValue {
  jobs: RepairJob[];
  addJob: (partial: Omit<RepairJob, "id">) => RepairJob;
  updateJob: (id: string, changes: Partial<RepairJob>) => void;
  dealers: RepairDealer[];
  setDealers: Dispatch<SetStateAction<RepairDealer[]>>;
}

const RepairContext = createContext<RepairContextValue>({
  jobs: INITIAL_JOBS,
  addJob: () => ({} as RepairJob),
  updateJob: () => {},
  dealers: INITIAL_DEALERS,
  setDealers: () => {},
});

function nextJobId(jobs: RepairJob[]): string {
  const nums = jobs
    .map(j => parseInt(j.id.replace("RM-", ""), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `RM-${String(max + 1).padStart(3, "0")}`;
}

export function RepairProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = usePersistentState<RepairJob[]>("mano_repair_jobs", INITIAL_JOBS);
  const [dealers, setDealers] = usePersistentState<RepairDealer[]>("mano_repair_dealers", INITIAL_DEALERS);

  // One-time migration: merge any new seed fields (e.g. the date timeline) into
  // jobs already stored from an older seed, without losing user-created jobs.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("mano_seed_version") === SEED_VERSION) return;
      const raw = window.localStorage.getItem("mano_repair_jobs");
      const stored: RepairJob[] = raw ? JSON.parse(raw) : INITIAL_JOBS;
      const seedById = new Map(INITIAL_JOBS.map(j => [j.id, j]));
      // For matching seed jobs, fill in fields the stored copy is missing; keep stored values otherwise.
      const merged = stored.map(j => {
        const seed = seedById.get(j.id);
        return seed ? { ...seed, ...j } : j;
      });
      window.localStorage.setItem("mano_repair_jobs", JSON.stringify(merged));
      window.localStorage.setItem("mano_seed_version", SEED_VERSION);
      setJobs(merged);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time top-up: add seed dealers a stored list predates (e.g. the in-house
  // entry) without resurrecting dealers the admin has deliberately deleted.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("mano_dealer_seed_version") === DEALER_SEED_VERSION) return;
      const raw = window.localStorage.getItem("mano_repair_dealers");
      if (raw) {
        const stored: RepairDealer[] = JSON.parse(raw);
        const missing = INITIAL_DEALERS.filter(seed => !stored.some(d => d.id === seed.id));
        if (missing.length) {
          const merged = [...missing, ...stored];
          window.localStorage.setItem("mano_repair_dealers", JSON.stringify(merged));
          setDealers(merged);
        }
      }
      window.localStorage.setItem("mano_dealer_seed_version", DEALER_SEED_VERSION);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addJob = (partial: Omit<RepairJob, "id">): RepairJob => {
    const created: RepairJob = { id: nextJobId(jobs), ...partial };
    setJobs(prev => {
      // Recompute id against the freshest list to avoid collisions.
      const id = nextJobId(prev);
      created.id = id;
      return [created, ...prev];
    });
    return created;
  };

  const updateJob = (id: string, changes: Partial<RepairJob>) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...changes } : j)));
  };

  return (
    <RepairContext.Provider value={{ jobs, addJob, updateJob, dealers, setDealers }}>
      {children}
    </RepairContext.Provider>
  );
}

export function useRepair() {
  return useContext(RepairContext);
}
