"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PartRequestStatus = "Pending" | "Approved" | "Issued" | "Rejected";

export interface PartRequest {
  id: string;
  jobId: string;
  jobDevice: string;
  partName: string;
  partSku: string;
  quantity: number;
  requestedAt: Date;
  status: PartRequestStatus;
  note?: string;
  resolvedAt?: Date;
}

export interface JobMeta {
  jobId: string;
  startedAt?: Date;
  lastPausedAt?: Date;
  pauseReason?: string;
  completionNotes?: string;
  completedAt?: Date;
  accumulatedMinutes?: number; // minutes worked before last pause
}

interface TechContextValue {
  technicianName: string;
  partRequests: PartRequest[];
  jobMeta: Record<string, JobMeta>;
  requestPart: (req: Omit<PartRequest, "id" | "requestedAt" | "status">) => void;
  updateRequestStatus: (id: string, status: PartRequestStatus) => void;
  setJobMeta: (jobId: string, meta: Partial<Omit<JobMeta, "jobId">>) => void;
  getElapsedMinutes: (jobId: string) => number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TechContext = createContext<TechContextValue>({
  technicianName: "",
  partRequests: [],
  jobMeta: {},
  requestPart: () => {},
  updateRequestStatus: () => {},
  setJobMeta: () => {},
  getElapsedMinutes: () => 0,
});

// ─── Seed Requests ─────────────────────────────────────────────────────────────

let reqSeq = 2;

const makeSeedRequests = (): PartRequest[] => [
  {
    id: "PR-001", jobId: "RM-001", jobDevice: "iPhone 14 Pro",
    partName: "iPhone 14 Pro OLED Screen Assembly", partSku: "SCR-IP14P-BLK",
    quantity: 1, requestedAt: new Date(Date.now() - 3600_000), status: "Approved",
    resolvedAt: new Date(Date.now() - 1800_000),
  },
  {
    id: "PR-002", jobId: "RM-003", jobDevice: "Redmi Note 12",
    partName: "USB-C Charging Port Module", partSku: "CHG-USB-RN12",
    quantity: 1, requestedAt: new Date(Date.now() - 7200_000), status: "Pending",
  },
];

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TechProvider({ children, technicianName }: { children: ReactNode; technicianName: string }) {
  const [partRequests, setPartRequests] = useState<PartRequest[]>(makeSeedRequests);
  const [jobMeta, setJobMetaMap] = useState<Record<string, JobMeta>>({});

  const requestPart = useCallback((req: Omit<PartRequest, "id" | "requestedAt" | "status">) => {
    const id = `PR-${String(++reqSeq).padStart(3, "0")}`;
    setPartRequests(prev => [...prev, { ...req, id, requestedAt: new Date(), status: "Pending" }]);
  }, []);

  const updateRequestStatus = useCallback((id: string, status: PartRequestStatus) => {
    setPartRequests(prev =>
      prev.map(r => r.id === id ? { ...r, status, resolvedAt: new Date() } : r)
    );
  }, []);

  const setJobMeta = useCallback((jobId: string, meta: Partial<Omit<JobMeta, "jobId">>) => {
    setJobMetaMap(prev => ({ ...prev, [jobId]: { ...prev[jobId], jobId, ...meta } }));
  }, []);

  // Elapsed minutes since job was started (excluding paused time)
  const getElapsedMinutes = useCallback((jobId: string): number => {
    const m = jobMeta[jobId];
    if (!m?.startedAt) return 0;
    const base = m.accumulatedMinutes ?? 0;
    // If currently paused, don't count time since last pause
    if (m.lastPausedAt) return base;
    return base + Math.max(0, Math.floor((Date.now() - m.startedAt.getTime()) / 60_000));
  }, [jobMeta]);

  return (
    <TechContext.Provider value={{
      technicianName, partRequests, jobMeta,
      requestPart, updateRequestStatus, setJobMeta, getElapsedMinutes,
    }}>
      {children}
    </TechContext.Provider>
  );
}

export function useTech() { return useContext(TechContext); }
