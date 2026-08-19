"use client";

import { createContext, useCallback, useContext, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { usePersistentState } from "@/cashier/hooks/usePersistentState";

/**
 * The repair spare-parts catalog (screens, batteries, charging ports, etc. —
 * components technicians consume during a repair) and the request/approval
 * workflow around it. Separate from InventoryContext's Accessories, which is
 * retail stock sold to customers.
 *
 * localStorage-backed (see usePersistentState), not plain Context state:
 * Admin (inside the Cashier route) adds parts and approves requests, and the
 * Technician route reads/creates them — two separate page loads with two
 * separate provider trees, which a normal Context can't cross but
 * localStorage can.
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

const INITIAL_PARTS: SparePart[] = [];
const INITIAL_REQUESTS: PartRequest[] = [];

interface PartsContextType {
  parts: SparePart[];
  setParts: Dispatch<SetStateAction<SparePart[]>>;

  partRequests: PartRequest[];
  /**
   * Create a request. `autoApprove: true` (a technician with the "use parts
   * without approval" permission) skips straight to Approved and deducts
   * stock immediately; otherwise it lands as Pending for Admin to resolve.
   */
  requestPart: (
    req: Omit<PartRequest, "id" | "requestedAt" | "status" | "installedAt">,
    opts?: { autoApprove?: boolean },
  ) => void;
  /** Admin's Approve/Reject action on a Pending request. Approving deducts
   *  the requested quantity from that part's stock (by SKU). */
  resolveRequest: (id: string, status: "Approved" | "Rejected") => void;
  markPartInstalled: (id: string) => void;
}

const PartsContext = createContext<PartsContextType | null>(null);

export function PartsProvider({ children }: { children: ReactNode }) {
  const [parts, setParts] = usePersistentState<SparePart[]>("mano_repair_parts", INITIAL_PARTS);
  const [partRequests, setPartRequests] = usePersistentState<PartRequest[]>("mano_part_requests", INITIAL_REQUESTS);

  const deductStock = useCallback((sku: string, quantity: number) => {
    setParts(prev => prev.map(p => p.sku === sku ? { ...p, stock: Math.max(0, p.stock - quantity) } : p));
  }, [setParts]);

  const requestPart = useCallback((
    req: Omit<PartRequest, "id" | "requestedAt" | "status" | "installedAt">,
    opts?: { autoApprove?: boolean },
  ) => {
    const id = `PR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const autoApprove = opts?.autoApprove ?? false;
    const entry: PartRequest = {
      ...req,
      id,
      requestedAt: new Date(),
      status: autoApprove ? "Approved" : "Pending",
      ...(autoApprove ? { resolvedAt: new Date() } : {}),
    };
    setPartRequests(prev => [...prev, entry]);
    if (autoApprove) deductStock(req.partSku, req.quantity);
  }, [setPartRequests, deductStock]);

  const resolveRequest = useCallback((id: string, status: "Approved" | "Rejected") => {
    const target = partRequests.find(r => r.id === id);
    if (!target || target.status !== "Pending") return;
    setPartRequests(prev => prev.map(r => r.id === id ? { ...r, status, resolvedAt: new Date() } : r));
    if (status === "Approved") deductStock(target.partSku, target.quantity);
  }, [partRequests, setPartRequests, deductStock]);

  const markPartInstalled = useCallback((id: string) => {
    setPartRequests(prev => prev.map(r => r.id === id ? { ...r, installedAt: new Date() } : r));
  }, [setPartRequests]);

  return (
    <PartsContext.Provider value={{ parts, setParts, partRequests, requestPart, resolveRequest, markPartInstalled }}>
      {children}
    </PartsContext.Provider>
  );
}

export function useParts() {
  const ctx = useContext(PartsContext);
  if (!ctx) throw new Error("useParts must be inside <PartsProvider>");
  return ctx;
}
