"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { usePersistentState } from "@/cashier/hooks/usePersistentState";

// ─── Types ──────────────────────────────────────────────────────────────────
//
// This is the SINGLE canonical warranty model for the whole system. It replaces
// the two disconnected representations that existed before:
//   • the free-text `RepairJob.jobWarranty` string ("3 MONTHS WARRANTY [NORMAL]")
//   • the thin `WarrantyRecord` in TechContext
// All dates are ISO strings so they survive JSON / localStorage round-trips.

export type WarrantyStatus = "Pending Activation" | "Active" | "Expired" | "Void" | "Claimed";
export type WarrantyScope  = "Parts & Labour" | "Parts Only" | "Labour Only";

export type ClaimStatus     = "Open" | "Under Review" | "Approved" | "Rejected" | "Resolved";
export type ClaimResolution = "Re-repair (free)" | "Part replaced (free)" | "Partial charge" | "Rejected — out of scope";

export interface Warranty {
  id: string;                 // WR-0001
  jobId: string;
  invoiceNo?: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  imei?: string;
  partsCovered: string[];
  scope: WarrantyScope;
  durationDays: number;
  issuedAt: string;           // when the job was completed
  startsAt?: string;          // set at HANDOVER — the clock starts on collection
  expiresAt?: string;         // startsAt + durationDays
  status: WarrantyStatus;
  voidReason?: string;
  exclusions: string[];       // snapshot of terms at issue time
}

export interface WarrantyClaim {
  id: string;                 // CL-0001
  warrantyId: string;
  jobId: string;              // the original repair job
  reportedIssue: string;
  reportedAt: string;
  inspectionNotes?: string;
  withinCoverage?: boolean;
  resolution?: ClaimResolution;
  newJobId?: string;          // free re-repair job spawned for in-coverage claims
  handledBy: string;
  status: ClaimStatus;
  resolvedAt?: string;
}

export const DEFAULT_EXCLUSIONS = [
  "Physical damage after handover (drops, cracks, bends)",
  "Liquid / water damage after handover",
  "Tampering or repair by a third party",
  "Removed or altered warranty seal / IMEI",
  "Software issues caused by the user",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function addDaysISO(fromISO: string, days: number): string {
  return new Date(new Date(fromISO).getTime() + days * 86_400_000).toISOString();
}

/** Status as it should appear *now* (auto-expires Active warranties past expiry). */
export function effectiveStatus(w: Warranty): WarrantyStatus {
  if (w.status === "Active" && w.expiresAt && new Date(w.expiresAt).getTime() < Date.now()) {
    return "Expired";
  }
  return w.status;
}

export function daysRemaining(w: Warranty): number | null {
  if (!w.expiresAt) return null;
  return Math.ceil((new Date(w.expiresAt).getTime() - Date.now()) / 86_400_000);
}

// ─── Seed data ──────────────────────────────────────────────────────────────
// A handful of warranties so the register isn't empty on first load. These mirror
// the delivered seed jobs in RepairContext (RM-004, RM-008).

const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * 86_400_000).toISOString();

const SEED_WARRANTIES: Warranty[] = [
  {
    id: "WR-0001", jobId: "RM-004", invoiceNo: "INV-R-0044",
    customerName: "Dilini Rajapaksa", customerPhone: "+94 70 456 7890",
    deviceModel: "Apple iPhone 13", imei: "356822002345678",
    partsCovered: ["iPhone 13 Rear Camera Module"], scope: "Parts & Labour",
    durationDays: 90, issuedAt: iso(-25), startsAt: iso(-24), expiresAt: iso(66),
    status: "Active", exclusions: DEFAULT_EXCLUSIONS,
  },
  {
    id: "WR-0002", jobId: "RM-008", invoiceNo: "INV-R-0081",
    customerName: "Isuru Madushanka", customerPhone: "+94 74 890 1234",
    deviceModel: "OnePlus Nord 3", imei: "860123456789012",
    partsCovered: ["Back Glass Panel"], scope: "Parts Only",
    durationDays: 30, issuedAt: iso(-28), startsAt: iso(-27), expiresAt: iso(3),
    status: "Active", exclusions: DEFAULT_EXCLUSIONS,
  },
  {
    id: "WR-0003", jobId: "RM-101", invoiceNo: "INV-R-0101",
    customerName: "Chathura Bandara", customerPhone: "+94 77 555 1212",
    deviceModel: "Samsung Galaxy S22", imei: "353091104567821",
    partsCovered: ["Battery", "Charging Port"], scope: "Parts & Labour",
    durationDays: 90, issuedAt: iso(-120), startsAt: iso(-119), expiresAt: iso(-29),
    status: "Active", exclusions: DEFAULT_EXCLUSIONS, // will auto-show as Expired
  },
];

const SEED_CLAIMS: WarrantyClaim[] = [];

// ─── Context ────────────────────────────────────────────────────────────────

interface WarrantyContextValue {
  warranties: Warranty[];
  claims: WarrantyClaim[];

  getWarrantyForJob: (jobId: string) => Warranty | undefined;
  lookupActiveWarranty: (imeiOrPhone: string) => Warranty | undefined;

  /** Issued at job completion. Status = Pending Activation (clock starts at handover). */
  issueWarranty: (input: Omit<Warranty, "id" | "status" | "issuedAt" | "startsAt" | "expiresAt" | "exclusions"> & { issuedAt?: string; exclusions?: string[] }) => string;
  /** Called at handover — starts the warranty clock. */
  activateWarranty: (warrantyId: string, startISO?: string) => void;
  voidWarranty: (warrantyId: string, reason: string) => void;

  openClaim: (input: Omit<WarrantyClaim, "id" | "status" | "reportedAt">) => string;
  updateClaim: (claimId: string, patch: Partial<WarrantyClaim>) => void;
}

const WarrantyContext = createContext<WarrantyContextValue>({} as WarrantyContextValue);

function nextId(prefix: string, items: { id: string }[]): string {
  const max = items.reduce((m, it) => {
    const n = parseInt(it.id.replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function WarrantyProvider({ children }: { children: ReactNode }) {
  const [warranties, setWarranties] = usePersistentState<Warranty[]>("mano_warranties", SEED_WARRANTIES);
  const [claims, setClaims]         = usePersistentState<WarrantyClaim[]>("mano_claims", SEED_CLAIMS);

  const getWarrantyForJob = useCallback(
    (jobId: string) => warranties.find(w => w.jobId === jobId),
    [warranties],
  );

  const lookupActiveWarranty = useCallback((imeiOrPhone: string) => {
    const q = imeiOrPhone.replace(/\s/g, "").toLowerCase();
    if (!q) return undefined;
    return warranties.find(w => {
      if (effectiveStatus(w) !== "Active") return false;
      return (
        (w.imei && w.imei.replace(/\s/g, "").toLowerCase().includes(q)) ||
        w.customerPhone.replace(/\s/g, "").toLowerCase().includes(q)
      );
    });
  }, [warranties]);

  const issueWarranty: WarrantyContextValue["issueWarranty"] = useCallback((input) => {
    let id = "";
    setWarranties(prev => {
      // Don't double-issue for the same job.
      const existing = prev.find(w => w.jobId === input.jobId);
      if (existing) { id = existing.id; return prev; }
      id = nextId("WR", prev);
      const w: Warranty = {
        ...input,
        id,
        issuedAt: input.issuedAt ?? new Date().toISOString(),
        exclusions: input.exclusions ?? DEFAULT_EXCLUSIONS,
        status: "Pending Activation",
      };
      return [w, ...prev];
    });
    return id;
  }, [setWarranties]);

  const activateWarranty = useCallback((warrantyId: string, startISO?: string) => {
    const start = startISO ?? new Date().toISOString();
    setWarranties(prev => prev.map(w =>
      w.id === warrantyId
        ? { ...w, startsAt: start, expiresAt: addDaysISO(start, w.durationDays), status: "Active" }
        : w,
    ));
  }, [setWarranties]);

  const voidWarranty = useCallback((warrantyId: string, reason: string) => {
    setWarranties(prev => prev.map(w =>
      w.id === warrantyId ? { ...w, status: "Void", voidReason: reason } : w,
    ));
  }, [setWarranties]);

  const openClaim: WarrantyContextValue["openClaim"] = useCallback((input) => {
    let id = "";
    setClaims(prev => {
      id = nextId("CL", prev);
      return [{ ...input, id, status: "Open", reportedAt: new Date().toISOString() }, ...prev];
    });
    return id;
  }, [setClaims]);

  const updateClaim = useCallback((claimId: string, patch: Partial<WarrantyClaim>) => {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, ...patch } : c));
    // If a claim is marked resolved against coverage, flag the warranty as Claimed.
    if (patch.status === "Resolved" && patch.withinCoverage) {
      setClaims(prevClaims => {
        const claim = prevClaims.find(c => c.id === claimId);
        if (claim) {
          setWarranties(prevW => prevW.map(w =>
            w.id === claim.warrantyId && w.status === "Active" ? { ...w, status: "Claimed" } : w,
          ));
        }
        return prevClaims;
      });
    }
  }, [setClaims, setWarranties]);

  return (
    <WarrantyContext.Provider value={{
      warranties, claims,
      getWarrantyForJob, lookupActiveWarranty,
      issueWarranty, activateWarranty, voidWarranty,
      openClaim, updateClaim,
    }}>
      {children}
    </WarrantyContext.Provider>
  );
}

export function useWarranty() { return useContext(WarrantyContext); }
