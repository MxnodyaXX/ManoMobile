"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useParts, type PartRequest, type PartRequestStatus } from "@/cashier/contexts/PartsContext";
import { rulesForTechnician } from "@/lib/settings/staffRules";

// Part-request types/state now live in PartsContext — it's the cross-role
// shared store (Admin needs to see and approve these from a different route
// tree). Re-exported here so existing imports from this file keep working.
export type { PartRequestStatus, PartRequest } from "@/cashier/contexts/PartsContext";

// ─── Job Meta (timer) ─────────────────────────────────────────────────────────

export interface JobMeta {
  jobId: string;
  startedAt?: Date;
  lastPausedAt?: Date;
  pauseReason?: string;
  completionNotes?: string;
  completedAt?: Date;
  accumulatedMinutes?: number;
}

// ─── Diagnostic Report ────────────────────────────────────────────────────────

export type ScreenCondition = "Good" | "Cracked" | "Shattered" | "Dead";

export interface DiagnosticReport {
  jobId: string;
  completedAt: Date;
  screenCondition: ScreenCondition;
  powerOn: boolean;
  touchWorking: boolean | null;
  chargingWorking: boolean | null;
  speakerWorking: boolean | null;
  cameraWorking: boolean | null;
  buttonsWorking: boolean | null;
  waterDamage: boolean;
  imeiVerified: boolean;
  imeiNumber?: string;
  additionalNotes?: string;
  photos: string[]; // base64 data URLs
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export type ActivityType =
  | "status_change" | "part_requested" | "part_installed"
  | "note_added" | "diagnostic_done" | "test_completed"
  | "escalated" | "escalation_resolved" | "message_sent" | "warranty_issued";

export interface ActivityEntry {
  id: string;
  jobId: string;
  timestamp: Date;
  type: ActivityType;
  description: string;
  metadata?: Record<string, string | number | boolean>;
}

// ─── Internal Notes ───────────────────────────────────────────────────────────

export interface InternalNote {
  id: string;
  jobId: string;
  createdAt: Date;
  text: string;
  photos: string[];
}

// ─── Functional Test ──────────────────────────────────────────────────────────

export interface FunctionalTest {
  jobId: string;
  completedAt: Date;
  results: Record<string, boolean | null>;
  overallPass: boolean;
  notes?: string;
}

// ─── Warranty ─────────────────────────────────────────────────────────────────

export interface WarrantyRecord {
  jobId: string;
  issuedAt: Date;
  durationDays: number;
  terms?: string;
  expiresAt: Date;
}

// ─── Escalation ───────────────────────────────────────────────────────────────

export type EscalationPriority = "Low" | "Medium" | "High";

export interface EscalationFlag {
  id: string;
  jobId: string;
  raisedAt: Date;
  reason: string;
  priority: EscalationPriority;
  resolved: boolean;
  resolvedAt?: Date;
}

// ─── Shift ────────────────────────────────────────────────────────────────────

export interface BreakEntry { start: Date; end?: Date; }

export interface ShiftRecord {
  date: string; // "2026-05-22"
  clockIn: Date;
  clockOut?: Date;
  breaks: BreakEntry[];
}

// ─── Context Value ────────────────────────────────────────────────────────────

interface TechContextValue {
  technicianName: string;

  // Part requests. Approving/rejecting a Pending one is an Admin action —
  // see useParts().resolveRequest — not exposed here.
  partRequests: PartRequest[];
  /** Returns the resulting status so the caller can tell the technician
   *  whether it needs Admin approval or was granted immediately. */
  requestPart: (req: Omit<PartRequest, "id" | "requestedAt" | "status" | "installedAt" | "technicianName">) => Promise<PartRequestStatus>;
  markPartInstalled: (id: string) => Promise<void>;

  // Job meta / timer
  jobMeta: Record<string, JobMeta>;
  setJobMeta: (jobId: string, meta: Partial<Omit<JobMeta, "jobId">>) => void;
  getElapsedMinutes: (jobId: string) => number;

  // Diagnostics
  diagnostics: Record<string, DiagnosticReport>;
  saveDiagnostic: (report: DiagnosticReport) => void;

  // Activity log
  activityLog: Record<string, ActivityEntry[]>;
  addActivity: (entry: Omit<ActivityEntry, "id" | "timestamp">) => void;

  // Internal notes
  notes: Record<string, InternalNote[]>;
  addNote: (note: Omit<InternalNote, "id" | "createdAt">) => void;

  // Functional tests
  functionalTests: Record<string, FunctionalTest>;
  saveFunctionalTest: (test: FunctionalTest) => void;

  // Warranty
  warranties: Record<string, WarrantyRecord>;
  saveWarranty: (w: WarrantyRecord) => void;

  // Escalations
  escalations: EscalationFlag[];
  raiseEscalation: (esc: Omit<EscalationFlag, "id" | "raisedAt" | "resolved">) => void;
  resolveEscalation: (id: string) => void;

  // Shift
  currentShift: ShiftRecord | null;
  shiftHistory: ShiftRecord[];
  clockIn: () => void;
  clockOut: () => void;
  startBreak: () => void;
  endBreak: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TechContext = createContext<TechContextValue>({} as TechContextValue);

// ─── Seed Data ────────────────────────────────────────────────────────────────

let actSeq = 10;
let noteSeq = 1;
let escSeq = 1;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TechProvider({ children, technicianName }: { children: ReactNode; technicianName: string }) {
  const { partRequests, requestPart: rawRequestPart, markPartInstalled } = useParts();
  const [jobMetaMap, setJobMetaMap]       = useState<Record<string, JobMeta>>({});
  const [diagnostics, setDiagnostics]     = useState<Record<string, DiagnosticReport>>({});
  const [activityLog, setActivityLog]     = useState<Record<string, ActivityEntry[]>>({});
  const [notes, setNotes]                 = useState<Record<string, InternalNote[]>>({});
  const [functionalTests, setFunctTests]  = useState<Record<string, FunctionalTest>>({});
  const [warranties, setWarranties]       = useState<Record<string, WarrantyRecord>>({});
  const [escalations, setEscalations]     = useState<EscalationFlag[]>([]);
  const [currentShift, setCurrentShift]   = useState<ShiftRecord | null>(null);
  const [shiftHistory, setShiftHistory]   = useState<ShiftRecord[]>([]);

  // ── Part requests ──
  // Whether this technician can pull parts without Admin sign-off. Fetched
  // once per session and cached here (rulesForTechnician has its own 60s
  // cache too) — defaults to requiring approval until it resolves, since
  // skipping the gate before we're sure of the permission would be worse
  // than a technician waiting a beat for it to load.
  const [autoApprove, setAutoApprove] = useState(false);
  useEffect(() => {
    let active = true;
    rulesForTechnician(technicianName)
      .then(r => { if (active) setAutoApprove(r.canUsePartsWithoutApproval); })
      .catch(() => { /* stays false — approval required until this can be confirmed */ });
    return () => { active = false; };
  }, [technicianName]);

  // The status now comes back from the database rather than being predicted
  // from the permission: auto-approval deducts stock in the same transaction,
  // so it can legitimately fail when the last one just went.
  const requestPart = useCallback(async (
    req: Omit<PartRequest, "id" | "requestedAt" | "status" | "installedAt" | "technicianName">,
  ): Promise<PartRequestStatus> => {
    const created = await rawRequestPart({ ...req, technicianName }, { autoApprove });
    return created.status;
  }, [rawRequestPart, technicianName, autoApprove]);

  // ── Job meta / timer ──
  const setJobMeta = useCallback((jobId: string, meta: Partial<Omit<JobMeta, "jobId">>) => {
    setJobMetaMap(prev => ({ ...prev, [jobId]: { ...prev[jobId], jobId, ...meta } }));
  }, []);

  const getElapsedMinutes = useCallback((jobId: string): number => {
    const m = jobMetaMap[jobId];
    if (!m?.startedAt) return 0;
    const base = m.accumulatedMinutes ?? 0;
    if (m.lastPausedAt) return base;
    return base + Math.max(0, Math.floor((Date.now() - m.startedAt.getTime()) / 60_000));
  }, [jobMetaMap]);

  // ── Diagnostics ──
  const saveDiagnostic = useCallback((report: DiagnosticReport) => {
    setDiagnostics(prev => ({ ...prev, [report.jobId]: report }));
  }, []);

  // ── Activity log ──
  const addActivity = useCallback((entry: Omit<ActivityEntry, "id" | "timestamp">) => {
    const id = `ACT-${String(++actSeq).padStart(3, "0")}`;
    const full: ActivityEntry = { ...entry, id, timestamp: new Date() };
    setActivityLog(prev => ({ ...prev, [entry.jobId]: [...(prev[entry.jobId] ?? []), full] }));
  }, []);

  // ── Internal notes ──
  const addNote = useCallback((note: Omit<InternalNote, "id" | "createdAt">) => {
    const id = `NOTE-${String(++noteSeq).padStart(3, "0")}`;
    const full: InternalNote = { ...note, id, createdAt: new Date() };
    setNotes(prev => ({ ...prev, [note.jobId]: [...(prev[note.jobId] ?? []), full] }));
  }, []);

  // ── Functional tests ──
  const saveFunctionalTest = useCallback((test: FunctionalTest) => {
    setFunctTests(prev => ({ ...prev, [test.jobId]: test }));
  }, []);

  // ── Warranty ──
  const saveWarranty = useCallback((w: WarrantyRecord) => {
    setWarranties(prev => ({ ...prev, [w.jobId]: w }));
  }, []);

  // ── Escalations ──
  const raiseEscalation = useCallback((esc: Omit<EscalationFlag, "id" | "raisedAt" | "resolved">) => {
    const id = `ESC-${String(++escSeq).padStart(3, "0")}`;
    setEscalations(prev => [...prev, { ...esc, id, raisedAt: new Date(), resolved: false }]);
  }, []);

  const resolveEscalation = useCallback((id: string) => {
    setEscalations(prev => prev.map(e => e.id === id ? { ...e, resolved: true, resolvedAt: new Date() } : e));
  }, []);

  // ── Shift tracking ──
  const todayStr = new Date().toISOString().slice(0, 10);

  const clockIn = useCallback(() => {
    setCurrentShift({ date: todayStr, clockIn: new Date(), breaks: [] });
  }, [todayStr]);

  const clockOut = useCallback(() => {
    setCurrentShift(prev => {
      if (!prev) return null;
      const finished = { ...prev, clockOut: new Date() };
      setShiftHistory(h => [...h, finished]);
      return null;
    });
  }, []);

  const startBreak = useCallback(() => {
    setCurrentShift(prev => prev ? { ...prev, breaks: [...prev.breaks, { start: new Date() }] } : prev);
  }, []);

  const endBreak = useCallback(() => {
    setCurrentShift(prev => {
      if (!prev) return prev;
      const breaks = [...prev.breaks];
      const last = breaks[breaks.length - 1];
      if (last && !last.end) breaks[breaks.length - 1] = { ...last, end: new Date() };
      return { ...prev, breaks };
    });
  }, []);

  return (
    <TechContext.Provider value={{
      technicianName,
      partRequests, requestPart, markPartInstalled,
      jobMeta: jobMetaMap, setJobMeta, getElapsedMinutes,
      diagnostics, saveDiagnostic,
      activityLog, addActivity,
      notes, addNote,
      functionalTests, saveFunctionalTest,
      warranties, saveWarranty,
      escalations, raiseEscalation, resolveEscalation,
      currentShift, shiftHistory, clockIn, clockOut, startBreak, endBreak,
    }}>
      {children}
    </TechContext.Provider>
  );
}

export function useTech() { return useContext(TechContext); }
