"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  fetchParts, savePart as savePartRow, deletePart as deletePartRow,
  fetchPartRequests, createPartRequest, resolvePartRequest, markRequestInstalled,
  importLegacyParts,
} from "@/lib/repair/parts";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The repair spare-parts catalog (screens, batteries, charging ports, etc. —
 * components technicians consume during a repair) and the request/approval
 * workflow around it. Separate from InventoryContext's Accessories, which is
 * retail stock sold to customers.
 *
 * Supabase-backed (repair_parts / repair_part_requests). This used to be
 * localStorage, which worked only because Admin and Technician run in the same
 * browser — but that also meant a technician on their own device saw an empty
 * catalogue and two machines kept two different stock counts. An approval
 * workflow needs one shared copy, so both now live in the database.
 *
 * Stock changes go through Postgres functions, never a read-modify-write from
 * here: two admins approving the same request must not both deduct.
 */

export type PartCategory =
  | "Screen" | "Battery" | "Charging Port" | "Speaker / Mic"
  | "Camera" | "Back Glass" | "Board / IC" | "Other";

export interface SparePart {
  id: string;
  sku: string;
  name: string;
  category: PartCategory;
  compatibleWith: string[];
  stock: number;
  reorderLevel: number;
  costPrice: number;
  location: string;
}

export const PART_CATEGORIES: PartCategory[] = [
  "Screen", "Battery", "Charging Port", "Speaker / Mic", "Camera", "Back Glass", "Board / IC", "Other",
];

// ─── Part Requests ──────────────────────────────────────────────────────────

export type PartRequestStatus = "Pending" | "Approved" | "Issued" | "Rejected";

export interface PartRequest {
  id: string;
  jobId: string;
  jobDevice: string;
  technicianName: string;
  partName: string;
  partSku: string;
  quantity: number;
  requestedAt: Date;
  status: PartRequestStatus;
  note?: string;
  resolvedAt?: Date;
  installedAt?: Date;
}

interface PartsContextType {
  parts: SparePart[];
  /** Insert or update one part. A blank `id` inserts. Throws on failure so the
   *  caller can keep the form open rather than reporting a false success. */
  savePart: (part: SparePart) => Promise<SparePart>;
  deletePart: (id: string) => Promise<void>;

  partRequests: PartRequest[];
  /**
   * Create a request. `autoApprove: true` (a technician with the "use parts
   * without approval" permission) skips straight to Approved and deducts
   * stock in the same transaction; otherwise it lands as Pending for Admin.
   * Throws if stock ran out, so nobody is told "approved" for a part that is
   * no longer there.
   */
  requestPart: (
    req: Omit<PartRequest, "id" | "requestedAt" | "status" | "installedAt">,
    opts?: { autoApprove?: boolean },
  ) => Promise<PartRequest>;
  /** Admin's Approve/Reject on a Pending request. Approving deducts stock. */
  resolveRequest: (id: string, status: "Approved" | "Rejected") => Promise<void>;
  markPartInstalled: (id: string) => Promise<void>;

  loading: boolean;
  error: string | null;
  /** False when Supabase env vars are missing — the UI shows a notice rather
   *  than pretending an empty catalogue is the real one. */
  configured: boolean;
  reload: () => Promise<void>;
}

const PartsContext = createContext<PartsContextType | null>(null);

export function PartsProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [parts, setPartsState] = useState<SparePart[]>([]);
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      const [p, r] = await Promise.all([fetchParts(), fetchPartRequests()]);
      setPartsState(p);
      setPartRequests(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    let active = true;
    // Carry any pre-database catalogue up first, so the shop doesn't open the
    // Parts tab to an empty list and retype what it already entered.
    importLegacyParts()
      .catch(() => { /* reported on the next load; the fetch below still runs */ })
      .then(() => { if (active) return reload(); });
    return () => { active = false; };
  }, [configured, reload]);

  const savePart = useCallback(async (part: SparePart) => {
    const saved = await savePartRow(part);
    setPartsState(prev =>
      prev.some(p => p.id === saved.id)
        ? prev.map(p => (p.id === saved.id ? saved : p))
        : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return saved;
  }, []);

  const deletePart = useCallback(async (id: string) => {
    await deletePartRow(id);
    setPartsState(prev => prev.filter(p => p.id !== id));
  }, []);

  const requestPart = useCallback(async (
    req: Omit<PartRequest, "id" | "requestedAt" | "status" | "installedAt">,
    opts?: { autoApprove?: boolean },
  ) => {
    const created = await createPartRequest(req, opts?.autoApprove ?? false);
    setPartRequests(prev => [created, ...prev]);
    // Auto-approval deducted stock server-side; refetch so the number on
    // screen is the database's, not an arithmetic guess made here.
    if (created.status === "Approved") {
      fetchParts().then(setPartsState).catch(() => { /* next reload corrects it */ });
    }
    return created;
  }, []);

  const resolveRequest = useCallback(async (id: string, status: "Approved" | "Rejected") => {
    const updated = await resolvePartRequest(id, status);
    setPartRequests(prev => prev.map(r => (r.id === id ? updated : r)));
    if (status === "Approved") {
      fetchParts().then(setPartsState).catch(() => { /* next reload corrects it */ });
    }
  }, []);

  const markPartInstalled = useCallback(async (id: string) => {
    await markRequestInstalled(id);
    const at = new Date();
    setPartRequests(prev => prev.map(r => (r.id === id ? { ...r, installedAt: at } : r)));
  }, []);

  return (
    <PartsContext.Provider value={{
      parts, savePart, deletePart,
      partRequests, requestPart, resolveRequest, markPartInstalled,
      loading, error, configured, reload,
    }}>
      {children}
    </PartsContext.Provider>
  );
}

export function useParts() {
  const ctx = useContext(PartsContext);
  if (!ctx) throw new Error("useParts must be inside <PartsProvider>");
  return ctx;
}
