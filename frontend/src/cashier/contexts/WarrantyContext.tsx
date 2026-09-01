"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchWarranties, fetchWarrantyClaims,
  insertWarranty, patchWarranty,
  insertWarrantyClaim, patchWarrantyClaim,
} from "@/lib/warranty/api";

// ─── Types ──────────────────────────────────────────────────────────────────
//
// This is the SINGLE canonical warranty model for the whole system. It replaces
// the two disconnected representations that existed before:
//   • the free-text `RepairJob.jobWarranty` string ("3 MONTHS WARRANTY [NORMAL]")
//   • the thin `WarrantyRecord` in TechContext
// All dates are ISO strings.
//
// Backed by Supabase (see supabase/migrations/20260902000002_warranties.sql) —
// warranties used to live only in this browser's localStorage, which meant no
// other staff member's browser, and certainly not a customer's own browser on
// the public /track page, could ever see one. Same "local" fallback as
// RepairContext: with Supabase unconfigured, this serves in-memory only and
// nothing is persisted.

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

// ─── Context ────────────────────────────────────────────────────────────────

interface WarrantyContextValue {
  warranties: Warranty[];
  claims: WarrantyClaim[];
  loading: boolean;
  error: string | null;

  getWarrantyForJob: (jobId: string) => Warranty | undefined;
  lookupActiveWarranty: (imeiOrPhone: string) => Warranty | undefined;

  /** Issued at job completion. Status = Pending Activation (clock starts at handover). */
  issueWarranty: (input: Omit<Warranty, "id" | "status" | "issuedAt" | "startsAt" | "expiresAt" | "exclusions"> & { issuedAt?: string; exclusions?: string[] }) => Promise<string>;
  /** Called at handover — starts the warranty clock. */
  activateWarranty: (warrantyId: string, startISO?: string) => Promise<void>;
  voidWarranty: (warrantyId: string, reason: string) => Promise<void>;

  openClaim: (input: Omit<WarrantyClaim, "id" | "status" | "reportedAt">) => Promise<string>;
  updateClaim: (claimId: string, patch: Partial<WarrantyClaim>) => Promise<void>;
}

const WarrantyContext = createContext<WarrantyContextValue>({
  warranties: [], claims: [], loading: false, error: null,
  getWarrantyForJob: () => undefined,
  lookupActiveWarranty: () => undefined,
  issueWarranty: async () => "",
  activateWarranty: async () => {},
  voidWarranty: async () => {},
  openClaim: async () => "",
  updateClaim: async () => {},
});

function nextId(prefix: string, items: { id: string }[]): string {
  const max = items.reduce((m, it) => {
    const n = parseInt(it.id.replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function WarrantyProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();

  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [claims, setClaims]         = useState<WarrantyClaim[]>([]);
  const [loading, setLoading]       = useState(configured);
  const [error, setError]           = useState<string | null>(null);

  // Reads inside callbacks need the current list without becoming a render
  // dependency — same ref trick RepairContext uses for dealers.
  const warrantiesRef = useRef(warranties);
  useEffect(() => { warrantiesRef.current = warranties; }, [warranties]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    (async () => {
      try {
        const [w, c] = await Promise.all([fetchWarranties(), fetchWarrantyClaims()]);
        if (!active) return;
        setWarranties(w);
        setClaims(c);
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [configured]);

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

  const issueWarranty: WarrantyContextValue["issueWarranty"] = useCallback(async (input) => {
    // Don't double-issue for the same job.
    const existingLocal = warrantiesRef.current.find(w => w.jobId === input.jobId);
    if (existingLocal) return existingLocal.id;

    if (!configured) {
      const id = nextId("WR", warrantiesRef.current);
      const w: Warranty = {
        ...input, id,
        issuedAt: input.issuedAt ?? new Date().toISOString(),
        exclusions: input.exclusions ?? DEFAULT_EXCLUSIONS,
        status: "Pending Activation",
      };
      setWarranties(prev => [w, ...prev]);
      return id;
    }

    const created = await insertWarranty({ ...input, exclusions: input.exclusions ?? DEFAULT_EXCLUSIONS });
    setWarranties(prev => prev.some(w => w.id === created.id) ? prev : [created, ...prev]);
    return created.id;
  }, [configured]);

  const activateWarranty = useCallback(async (warrantyId: string, startISO?: string) => {
    const start = startISO ?? new Date().toISOString();
    const current = warrantiesRef.current.find(w => w.id === warrantyId);
    const expiresAt = current ? addDaysISO(start, current.durationDays) : undefined;

    if (configured) {
      await patchWarranty(warrantyId, { startsAt: start, expiresAt, status: "Active" });
    }
    setWarranties(prev => prev.map(w =>
      w.id === warrantyId
        ? { ...w, startsAt: start, expiresAt: addDaysISO(start, w.durationDays), status: "Active" }
        : w,
    ));
  }, [configured]);

  const voidWarranty = useCallback(async (warrantyId: string, reason: string) => {
    if (configured) {
      await patchWarranty(warrantyId, { status: "Void", voidReason: reason });
    }
    setWarranties(prev => prev.map(w =>
      w.id === warrantyId ? { ...w, status: "Void", voidReason: reason } : w,
    ));
  }, [configured]);

  const openClaim: WarrantyContextValue["openClaim"] = useCallback(async (input) => {
    if (!configured) {
      const id = nextId("CL", claims);
      setClaims(prev => [{ ...input, id, status: "Open", reportedAt: new Date().toISOString() }, ...prev]);
      return id;
    }
    const created = await insertWarrantyClaim(input);
    setClaims(prev => [created, ...prev]);
    return created.id;
  }, [configured, claims]);

  const updateClaim = useCallback(async (claimId: string, patch: Partial<WarrantyClaim>) => {
    if (configured) {
      await patchWarrantyClaim(claimId, patch);
    }
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, ...patch } : c));
    // If a claim is marked resolved against coverage, flag the warranty as Claimed.
    if (patch.status === "Resolved" && patch.withinCoverage) {
      const claim = claims.find(c => c.id === claimId);
      const warrantyId = claim?.warrantyId;
      if (warrantyId) {
        const target = warrantiesRef.current.find(w => w.id === warrantyId);
        if (target?.status === "Active") {
          if (configured) await patchWarranty(warrantyId, { status: "Claimed" });
          setWarranties(prev => prev.map(w =>
            w.id === warrantyId && w.status === "Active" ? { ...w, status: "Claimed" } : w,
          ));
        }
      }
    }
  }, [configured, claims]);

  return (
    <WarrantyContext.Provider value={{
      warranties, claims, loading, error,
      getWarrantyForJob, lookupActiveWarranty,
      issueWarranty, activateWarranty, voidWarranty,
      openClaim, updateClaim,
    }}>
      {children}
    </WarrantyContext.Provider>
  );
}

export function useWarranty() { return useContext(WarrantyContext); }
