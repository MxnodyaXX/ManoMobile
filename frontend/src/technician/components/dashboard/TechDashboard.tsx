"use client";

import { useEffect, useState, useRef } from "react";
import {
  Wrench, Clock, CheckCircle, AlertCircle, PackageCheck,
  Play, Pause, Timer, Layers, TrendingUp, Calendar, Package,
} from "lucide-react";
import { useRepair, type JobStatus } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import StatusUpdateModal from "@/technician/components/jobs/StatusUpdateModal";
import PartRequestModal from "@/technician/components/parts/PartRequestModal";
import { useParts } from "@/cashier/contexts/PartsContext";
import InsightModal, { type InsightColumn, type InsightRow, type InsightSummary } from "@/cashier/components/dashboard/InsightModal";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

function fmtMinutes(min: number) {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function fmtElapsed(startedAt: Date): string {
  const secs = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PRIORITY_CFG = {
  Low:    { color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
  Normal: { color: "#60a5fa", bg: "rgba(96,165,250,0.08)"  },
  High:   { color: "#fbbf24", bg: "rgba(251,191,36,0.08)"  },
  Urgent: { color: "#f87171", bg: "rgba(248,113,113,0.08)" },
};

export default function TechDashboard() {
  const { jobs } = useRepair();
  const { technicianName, partRequests, jobMeta, getElapsedMinutes } = useTech();
  const { parts } = useParts();
  const [, tick] = useState(0);
  // Which job the status modal is for, and which transition it opens on.
  const [statusModalJob, setStatusModalJob] = useState<{ id: string; next?: JobStatus } | null>(null);
  // Which job the Request Parts sheet is for. Was a bare boolean, which
  // silently attached every request to the first active job once a technician
  // could have several.
  const [partReqJob, setPartReqJob] = useState<string | null>(null);
  const [partsViewJob, setPartsViewJob] = useState<string | null>(null);
  const [openStat, setOpenStat] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myJobs = jobs.filter(j => j.technician === technicianName);
  /**
   * Every job this technician has in progress, oldest first.
   *
   * This used to take only the first: fine when the shop allowed one job at a
   * time, wrong the moment "work on several jobs at once" is granted — the
   * other live jobs simply vanished off the dashboard, timer and all.
   */
  const activeJobs = myJobs
    .filter(j => j.status === "Issued")
    .sort((a, b) => new Date(a.startedAt ?? a.createdAt).getTime() - new Date(b.startedAt ?? b.createdAt).getTime());
  // Kept for the Request Parts / parts-view modals, which act on one job.
  const activeJob = activeJobs[0];

  // Tick every second for live timer
  useEffect(() => {
    if (activeJobs.length > 0) {
      timerRef.current = setInterval(() => tick(n => n + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeJobs.length]);

  /**
   * Each tile knows the rows behind its number, so a count is never a dead end.
   * Built from the same filtered lists the tile counts rather than re-deriving
   * them, or the breakdown could disagree with the headline it opened from.
   */
  const money = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString("en-LK")}`;
  const dev = (j: typeof myJobs[number]) => [j.brand, j.model].filter(Boolean).join(" ") || "—";
  const day = (v?: string) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");

  const JOB_COLS: InsightColumn[] = [
    { key: "job", label: "Job" },
    { key: "customer", label: "Customer" },
    { key: "device", label: "Device" },
    { key: "issue", label: "Fault" },
    { key: "priority", label: "Priority" },
    { key: "created", label: "Taken in" },
    { key: "cost", label: "Estimate", numeric: true },
  ];

  const jobRows = (list: typeof myJobs): InsightRow[] => list.map(j => ({
    id: j.id,
    cells: {
      job: j.id, customer: j.customerName || "—", device: dev(j),
      issue: j.issue || "—", priority: j.priority,
      created: day(j.createdAt), cost: money(j.estimatedCost),
    },
  }));

  const jobSummary = (list: typeof myJobs): InsightSummary[] => [
    { label: "Jobs", value: String(list.length), strong: true },
    { label: "Estimated value", value: money(list.reduce((t, j) => t + j.estimatedCost, 0)) },
  ];

  const inProgress = myJobs.filter(j => j.status === "Issued");
  const pausedJobs = myJobs.filter(j => j.status === "Pending");
  const readyJobs  = myJobs.filter(j => j.status === "Completed");
  const pendingReq = partRequests.filter(r => r.status === "Pending");

  const stats: {
    label: string; value: number; color: string; icon: typeof Wrench;
    insight: () => React.ComponentProps<typeof InsightModal>;
  }[] = [
    {
      label: "Assigned", value: myJobs.length, color: TA, icon: Wrench,
      insight: () => ({
        title: "My Jobs", subtitle: "Everything currently on your bench",
        columns: JOB_COLS, rows: jobRows(myJobs), summary: jobSummary(myJobs),
        emptyText: "Nothing is assigned to you. Unclaimed jobs appear under Job Pool.",
        onClose: () => {},
      }),
    },
    {
      label: "In Progress", value: inProgress.length, color: "#34d399", icon: Play,
      insight: () => ({
        title: "In Progress", subtitle: "Started and being worked on",
        columns: JOB_COLS, rows: jobRows(inProgress), summary: jobSummary(inProgress),
        emptyText: "Nothing started yet. Open a job and press Start.",
        onClose: () => {},
      }),
    },
    {
      label: "Paused", value: pausedJobs.length, color: "#fbbf24", icon: Timer,
      insight: () => ({
        title: "Paused Jobs", subtitle: "On hold — each with the reason it stopped",
        // The reason is the whole point of this list, so it replaces the
        // columns a paused job tells you nothing new about.
        columns: [
          { key: "job", label: "Job" }, { key: "device", label: "Device" },
          { key: "reason", label: "Why it is on hold" }, { key: "paused", label: "Paused" },
        ],
        rows: pausedJobs.map(j => ({
          id: j.id,
          cells: {
            job: j.id, device: dev(j),
            reason: j.pauseReason || "No reason recorded",
            paused: day(j.pausedAt),
          },
        })),
        summary: jobSummary(pausedJobs),
        emptyText: "Nothing is on hold.",
        onClose: () => {},
      }),
    },
    {
      label: "Ready Pickup", value: readyJobs.length, color: "#60a5fa", icon: PackageCheck,
      insight: () => ({
        title: "Ready For Pickup", subtitle: "Finished, waiting for the customer to collect",
        columns: [
          { key: "job", label: "Job" }, { key: "customer", label: "Customer" },
          { key: "device", label: "Device" }, { key: "completed", label: "Finished" },
          { key: "cost", label: "Final bill", numeric: true },
          { key: "balance", label: "Balance", numeric: true },
        ],
        rows: readyJobs.map(j => ({
          id: j.id,
          cells: {
            job: j.id, customer: j.customerName || "—", device: dev(j),
            completed: day(j.completedAt), cost: money(j.estimatedCost),
            balance: money(Math.max(0, j.estimatedCost - j.advancePaid)),
          },
        })),
        summary: [
          { label: "Waiting", value: String(readyJobs.length), strong: true },
          { label: "To collect", value: money(readyJobs.reduce((t, j) => t + Math.max(0, j.estimatedCost - j.advancePaid), 0)) },
        ],
        note: "Handover is done at the counter — the cashier issues these.",
        emptyText: "Nothing waiting to be collected.",
        onClose: () => {},
      }),
    },
    {
      label: "Parts Pending", value: pendingReq.length, color: "#a78bfa", icon: Layers,
      insight: () => ({
        title: "Parts Awaiting Approval", subtitle: "Requested, not yet approved by Admin",
        columns: [
          { key: "job", label: "Job" }, { key: "part", label: "Part" },
          { key: "qty", label: "Qty", numeric: true },
          { key: "stock", label: "In stock", numeric: true },
          { key: "asked", label: "Requested" },
        ],
        rows: pendingReq.map(r => {
          const inStock = parts.find(p => p.sku === r.partSku)?.stock;
          return {
            id: r.id,
            // Dimmed when the shelf cannot cover it — approval will fail, and
            // that is worth seeing before waiting on it.
            dim: inStock !== undefined && inStock < r.quantity,
            cells: {
              job: r.jobId, part: r.partName, qty: String(r.quantity),
              stock: inStock === undefined ? "—" : String(inStock),
              asked: day(r.requestedAt instanceof Date ? r.requestedAt.toISOString() : String(r.requestedAt)),
            },
          };
        }),
        summary: [{ label: "Awaiting approval", value: String(pendingReq.length), strong: true }],
        note: "Admin approves these under Admin Control → Part Requests.",
        emptyText: "No part requests are waiting.",
        onClose: () => {},
      }),
    },
  ];

  const pendingJobs  = myJobs.filter(j => j.status === "Pending");
  const notStarted   = myJobs.filter(j => j.status === "Non-Issued").slice(0, 3);

  const REQ_CFG: Record<string, { color: string; bg: string; border: string }> = {
    Pending:  { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
    Approved: { color: TA,        bg: `${TA}10`,                border: `${TA}28`               },
    Issued:   { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
    Rejected: { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  };

  const activeJobModal = statusModalJob ? myJobs.find(j => j.id === statusModalJob.id) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff }}>

      {/* Greeting */}
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {technicianName} 👋
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* ── ACTIVE JOB BANNERS — one per job in progress ── */}
      {activeJobs.length > 0 ? activeJobs.map((activeJob, idx) => (() => {
        const meta = jobMeta[activeJob.id];
        const elapsed = meta?.startedAt ? fmtElapsed(meta.startedAt) : "00:00";
        const pc = PRIORITY_CFG[activeJob.priority];
        const jobParts = partRequests.filter(r => r.jobId === activeJob.id);
        const REQ_CFG: Record<string, { color: string; bg: string; border: string }> = {
          Pending:  { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)"  },
          Approved: { color: TA,        bg: `${TA}18`,                border: `${TA}35`               },
          Issued:   { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)"  },
          Rejected: { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
        };
        return (
          <div key={activeJob.id} className="fade-up" style={{
            background: `linear-gradient(135deg, ${TA}12 0%, ${TA}06 100%)`,
            border: `1px solid ${TA}35`,
            borderRadius: 16, padding: "20px 22px",
            display: "flex", flexDirection: "column", gap: 0,
          }}>
            {/* Main row */}
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `${TA}18`, border: `1px solid ${TA}35`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Wrench size={22} color={TA} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: TA, animation: "pulse-tech 2s infinite", display: "inline-block" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: TA, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: ff }}>
                    {activeJobs.length > 1 ? `ACTIVE JOB ${idx + 1} OF ${activeJobs.length}` : "ACTIVE JOB"}
                  </span>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3, fontFamily: ff }}>
                  {activeJob.brand} {activeJob.model} — {activeJob.issue}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>
                    <strong style={{ color: "var(--text-secondary)" }}>{activeJob.id}</strong> · {activeJob.customerName}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                    background: pc.bg, color: pc.color, fontFamily: ff,
                  }}>
                    {activeJob.priority}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "0 10px", borderLeft: `1px solid ${TA}22` }}>
                <p style={{ fontSize: 28, fontWeight: 800, color: TA, fontFamily: ff, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{elapsed}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff }}>Time on job</p>
              </div>
              {jobParts.length > 0 && (
                <button
                  onClick={() => setPartsViewJob(activeJob.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                    background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa",
                    cursor: "pointer", fontFamily: ff, flexShrink: 0,
                  }}
                >
                  <Package size={14} />
                  {jobParts.length} Part{jobParts.length > 1 ? "s" : ""}
                  <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(167,139,250,0.2)", borderRadius: 20, padding: "1px 6px" }}>
                    Rs. {jobParts.reduce((sum, r) => sum + (parts.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0).toLocaleString()}
                  </span>
                </button>
              )}
              <button
                onClick={() => setPartReqJob(activeJob.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                  background: `${TA}14`, border: `1px solid ${TA}35`, color: TA,
                  cursor: "pointer", fontFamily: ff, flexShrink: 0,
                }}
              >
                <Package size={14} />
                Request Parts
              </button>
              {/* The two things anyone actually does to a running job. "Update
                  Status" made every pause and every completion start with the
                  same extra choice, on a screen the technician had already
                  decided about before reaching for the mouse. */}
              <button
                onClick={() => setStatusModalJob({ id: activeJob.id, next: "Pending" })}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                  background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309",
                  cursor: "pointer", fontFamily: ff, flexShrink: 0,
                }}
              >
                <Pause size={14} />
                Mark as Paused
              </button>
              <button
                onClick={() => setStatusModalJob({ id: activeJob.id, next: "Completed" })}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                  background: TA, border: "none", color: "#000",
                  cursor: "pointer", fontFamily: ff, flexShrink: 0,
                }}
              >
                <CheckCircle size={14} />
                Mark as Completed
              </button>
            </div>
          </div>
        );
      })()) : (
        <div className="fade-up" style={{
          background: "var(--bg-card)", border: "1px dashed var(--border)",
          borderRadius: 16, padding: "22px", textAlign: "center",
        }}>
          <Wrench size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff, marginBottom: 4 }}>No active job</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Head to &quot;My Jobs&quot; to start working on a repair</p>
        </div>
      )}

      {/* Stat strip */}
      <div className="fade-up resp-grid-4" style={{ gap: 10 }}>
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => setOpenStat(s.label)}
              title={`See the ${s.value} behind this`}
              className="stat-card-clickable"
              style={{
                background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
                padding: "14px 16px", textAlign: "left", width: "100%", cursor: "pointer", font: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{s.label}</p>
                <Icon size={13} color={s.color} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: ff, letterSpacing: "-0.02em" }}>{s.value}</p>
            </button>
          );
        })}
      </div>

      {/* Lower row: Paused jobs + Approved parts notifications */}
      <div className="fade-up resp-grid-2" style={{ gap: 16 }}>

        {/* Paused jobs */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Timer size={14} color="#fbbf24" />
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Paused Jobs</p>
            {pendingJobs.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 20, padding: "2px 7px", fontFamily: ff, marginLeft: "auto" }}>
                {pendingJobs.length}
              </span>
            )}
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingJobs.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, padding: "8px 0" }}>No paused jobs</p>
            ) : pendingJobs.slice(0, 4).map(job => {
              const meta = jobMeta[job.id];
              return (
                <div key={job.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "9px 10px",
                  background: "var(--bg-secondary)", borderRadius: 9, border: "1px solid var(--border)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.id} · {job.brand} {job.model}
                    </p>
                    {meta?.pauseReason && (
                      <p style={{ fontSize: 11, color: "#fbbf24", fontFamily: ff, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {meta.pauseReason}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setStatusModalJob({ id: job.id })}
                    style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 7, background: `${TA}12`, border: `1px solid ${TA}30`, color: TA, cursor: "pointer", fontFamily: ff, flexShrink: 0 }}
                  >
                    Resume
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Part Requests + Up Next */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Part Requests card */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <Package size={14} color="#a78bfa" />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Part Requests</p>
              {partRequests.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 20, padding: "2px 7px", fontFamily: ff, marginLeft: "auto" }}>
                  {partRequests.length}
                </span>
              )}
            </div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {partRequests.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, padding: "8px 4px" }}>No part requests yet</p>
              ) : partRequests.map(r => {
                const rc = REQ_CFG[r.status] ?? REQ_CFG.Pending;
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", background: "var(--bg-secondary)", borderRadius: 9, border: "1px solid var(--border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.partName}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginTop: 1 }}>
                        {r.jobId} · Qty {r.quantity}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`, fontFamily: ff, flexShrink: 0 }}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Not started yet */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", flex: 1 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={14} color="var(--text-muted)" />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Up Next</p>
            </div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {notStarted.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, padding: "8px 4px" }}>All jobs started or no pending assignments</p>
              ) : notStarted.map(job => {
                const pc = PRIORITY_CFG[job.priority];
                return (
                  <div key={job.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <AlertCircle size={13} color={pc.color} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job.brand} {job.model} — {job.issue}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{job.id}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: pc.color, background: pc.bg, padding: "2px 6px", borderRadius: 5, fontFamily: ff, flexShrink: 0 }}>{job.priority}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Today's progress bar */}
      {myJobs.length > 0 && (() => {
        const done = myJobs.filter(j => j.status === "Completed" || j.status === "Delivered").length;
        const pct  = Math.round((done / myJobs.length) * 100);
        return (
          <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={14} color={TA} />
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Overall Progress</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 800, color: TA, fontFamily: ff }}>{done}/{myJobs.length} done</p>
            </div>
            <div style={{ height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${TA}, #60a5fa)`, borderRadius: 4, transition: "width 0.4s" }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, fontFamily: ff }}>{pct}% of assigned jobs completed</p>
          </div>
        );
      })()}

      {statusModalJob && activeJobModal && (
        <StatusUpdateModal job={activeJobModal} initialNext={statusModalJob.next} onClose={() => setStatusModalJob(null)} />
      )}

      {partReqJob && myJobs.find(j => j.id === partReqJob) && (
        <PartRequestModal job={myJobs.find(j => j.id === partReqJob)!} onClose={() => setPartReqJob(null)} />
      )}

      {/* Parts view modal */}
      {partsViewJob && (() => {
        const activeJob = myJobs.find(j => j.id === partsViewJob);
        if (!activeJob) return null;
        const jobParts = partRequests.filter(r => r.jobId === activeJob.id);
        const RC: Record<string, { color: string; bg: string; border: string }> = {
          Pending:  { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
          Approved: { color: TA,        bg: `${TA}10`,               border: `${TA}28`                },
          Issued:   { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)"  },
          Rejected: { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
        };
        const totalCost = jobParts.reduce((sum, r) => sum + (parts.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0);
        return (
          <>
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }} onClick={() => setPartsViewJob(null)} />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 580, maxHeight: "80vh", background: "var(--bg-card)",
              borderRadius: 16, border: "1px solid var(--border)",
              display: "flex", flexDirection: "column",
              zIndex: 61, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
            }}>
              {/* Header */}
              <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Package size={16} color="#a78bfa" />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Requested Parts</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{activeJob.id} · {activeJob.brand} {activeJob.model}</p>
                  </div>
                </div>
                <button onClick={() => setPartsViewJob(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>✕</button>
              </div>

              {/* Table */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                      {["Part", "SKU", "Qty", "Status", "Unit Cost", "Total"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap", fontFamily: ff }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobParts.map((r, i) => {
                      const unitCost = parts.find(p => p.sku === r.partSku)?.costPrice ?? 0;
                      const rc = RC[r.status] ?? RC.Pending;
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                          <td style={{ padding: "11px 14px", color: "var(--text-primary)", fontWeight: 600, fontFamily: ff }}>{r.partName}</td>
                          <td style={{ padding: "11px 14px", color: "var(--text-muted)", fontFamily: ff, whiteSpace: "nowrap" }}>{r.partSku}</td>
                          <td style={{ padding: "11px 14px", color: "var(--text-primary)", fontFamily: ff, textAlign: "center" }}>{r.quantity}</td>
                          <td style={{ padding: "11px 14px" }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`, fontFamily: ff }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: "11px 14px", color: "var(--text-secondary)", fontFamily: ff, whiteSpace: "nowrap" }}>
                            {unitCost > 0 ? `Rs. ${unitCost.toLocaleString()}` : "—"}
                          </td>
                          <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, whiteSpace: "nowrap" }}>
                            {unitCost > 0 ? `Rs. ${(unitCost * r.quantity).toLocaleString()}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer total */}
              <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{jobParts.length} part request{jobParts.length > 1 ? "s" : ""}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Total Parts Cost</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: TA, fontFamily: ff }}>Rs. {totalCost.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Breakdown behind whichever tile was clicked. Mounted at the end so it
          survives the re-render that opening it causes. */}
      {(() => {
        const stat = stats.find(x => x.label === openStat);
        if (!stat) return null;
        return <InsightModal {...stat.insight()} onClose={() => setOpenStat(null)} />;
      })()}

      <style>{`@keyframes pulse-tech { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}
