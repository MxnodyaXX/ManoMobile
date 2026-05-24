"use client";

import React, { useState } from "react";
import {
  Search, Play, Pause, CheckCircle, Clock,
  AlertTriangle, Filter, Wrench, User, Phone,
  ChevronDown, MoreVertical, Calendar, DollarSign,
  Package, FileText, Activity, MessageCircle, AlertOctagon, ClipboardCheck,
} from "lucide-react";
import { useRepair, type RepairJob, type JobStatus } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import { SPARE_PARTS } from "@/technician/data/partsData";
import StatusUpdateModal from "@/technician/components/jobs/StatusUpdateModal";
import PartRequestModal from "@/technician/components/parts/PartRequestModal";
import DiagnosticModal from "@/technician/components/jobs/DiagnosticModal";
import ActivityLogPanel from "@/technician/components/jobs/ActivityLogPanel";
import InternalNotesModal from "@/technician/components/jobs/InternalNotesModal";
import EscalationModal from "@/technician/components/jobs/EscalationModal";
import CustomerMessageModal from "@/technician/components/jobs/CustomerMessageModal";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<JobStatus, { label: string; color: string; bg: string; border: string }> = {
  "Non-Issued": { label: "Not Started",  color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  "Issued":     { label: "In Progress",  color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
  "Pending":    { label: "Paused",        color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  "Completed":  { label: "Completed",    color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  "Delivered":  { label: "Delivered",    color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  "Cancelled":  { label: "Cancelled",    color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
};

const PRIORITY_CFG = {
  Low:    { color: "#94a3b8", dot: "#94a3b8" },
  Normal: { color: "#60a5fa", dot: "#60a5fa" },
  High:   { color: "#fbbf24", dot: "#fbbf24" },
  Urgent: { color: "#f87171", dot: "#f87171" },
};

// ─── SLA helpers ─────────────────────────────────────────────────────────────

function getDaysUntilDue(estimatedCompletion: string): number {
  const due = new Date(estimatedCompletion + "T23:59:59");
  return Math.ceil((due.getTime() - Date.now()) / 86_400_000);
}

function getSlaStatus(job: RepairJob): "overdue" | "due-today" | "due-soon" | "ok" {
  if (["Completed", "Delivered", "Cancelled"].includes(job.status)) return "ok";
  const days = getDaysUntilDue(job.estimatedCompletion);
  if (days < 0) return "overdue";
  if (days === 0) return "due-today";
  if (days <= 2) return "due-soon";
  return "ok";
}

const SLA_CFG = {
  overdue:   { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)", label: "Overdue"   },
  "due-today":{ color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)", label: "Due Today" },
  "due-soon": { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)", label: "Due Soon"  },
  ok:         { color: TA,        bg: `${TA}10`,              border: `${TA}28`,                label: "On Track"  },
};

type FilterTab = "All" | "Active" | "Paused" | "Not Started" | "Completed";
const FILTER_TABS: FilterTab[] = ["All", "Active", "Paused", "Not Started", "Completed"];

const STATUS_FOR_FILTER: Record<FilterTab, JobStatus[]> = {
  "All":         ["Non-Issued", "Issued", "Pending", "Completed"],
  "Active":      ["Issued"],
  "Paused":      ["Pending"],
  "Not Started": ["Non-Issued"],
  "Completed":   ["Completed"],
};

// ─── Job Detail Panel ─────────────────────────────────────────────────────────

function JobDetailPanel({ job, onClose, onStatusUpdate, onRequestParts }: { job: RepairJob; onClose: () => void; onStatusUpdate: () => void; onRequestParts?: () => void }) {
  const { jobMeta, partRequests, getElapsedMinutes } = useTech();
  const meta = jobMeta[job.id];
  const myRequests = partRequests.filter(r => r.jobId === job.id);
  const statusCfg = STATUS_CFG[job.status];
  const elapsedMin = getElapsedMinutes(job.id);

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)", width: 130, flexShrink: 0, fontFamily: ff, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, flex: 1 }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: 380,
      background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      zIndex: 50, boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
      fontFamily: ff,
    }}>
      {/* Header */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 3 }}>{job.id}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{job.brand} {job.model}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, fontFamily: ff }}>{statusCfg.label}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>✕</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Device & issue */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Device & Issue</p>
          {row("Brand / Model", `${job.brand} ${job.model}`)}
          {row("Issue", job.issue)}
          {row("IMEI", job.imei ?? "Not recorded")}
          {row("Priority", <span style={{ color: PRIORITY_CFG[job.priority].color, fontWeight: 600 }}>{job.priority}</span>)}
        </div>

        {/* Customer */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Customer</p>
          {row("Name", job.customerName)}
          {row("Phone", job.phone)}
        </div>

        {/* Financials */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Estimate</p>
          {row("Quoted Cost", <span style={{ fontWeight: 700, color: TA }}>Rs. {job.estimatedCost.toLocaleString()}</span>)}
          {row("Advance Paid", `Rs. ${job.advancePaid.toLocaleString()}`)}
          {row("Balance Due", <span style={{ fontWeight: 700, color: "#f87171" }}>Rs. {(job.estimatedCost - job.advancePaid).toLocaleString()}</span>)}
        </div>

        {/* Time tracking */}
        {meta?.startedAt && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Time Tracking</p>
            {row("Started At", meta.startedAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }))}
            {row("Time on Job", elapsedMin > 0 ? `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m` : "< 1 min")}
            {meta.pauseReason && row("Last Pause Reason", <span style={{ color: "#fbbf24" }}>{meta.pauseReason}</span>)}
            {meta.completionNotes && row("Work Summary", meta.completionNotes)}
          </div>
        )}

        {/* Parts requests for this job */}
        {myRequests.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Parts Requested</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {myRequests.map(r => {
                const rCfg: Record<string, { color: string }> = {
                  Pending: { color: "#fbbf24" }, Approved: { color: TA },
                  Issued: { color: "#60a5fa" }, Rejected: { color: "#f87171" },
                };
                return (
                  <div key={r.id} style={{ padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.partName}</p>
                      <span style={{ fontSize: 10, fontWeight: 600, color: rCfg[r.status]?.color ?? TA, fontFamily: ff }}>{r.status}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>SKU: {r.partSku} · Qty {r.quantity}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Received items */}
        {job.receivedItems && job.receivedItems.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Received with Device</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {job.receivedItems.map(item => (
                <span key={item} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: ff }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action footer */}
      {["Non-Issued", "Issued", "Pending"].includes(job.status) && (
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          {job.status === "Issued" && onRequestParts && (
            <button
              onClick={() => { onClose(); onRequestParts(); }}
              style={{
                width: "100%", padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: "rgba(52,211,153,0.1)", border: `1px solid ${TA}40`, color: TA,
                cursor: "pointer", fontFamily: ff, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <Package size={14} />
              Request Parts
            </button>
          )}
          <button
            onClick={() => { onClose(); onStatusUpdate(); }}
            style={{
              width: "100%", padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: TA, border: "none", color: "#000",
              cursor: "pointer", fontFamily: ff,
            }}
          >
            Update Status
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyJobs() {
  const { jobs } = useRepair();
  const { technicianName, partRequests, diagnostics, notes, activityLog, escalations } = useTech();

  const [search, setSearch]             = useState("");
  const [filterTab, setFilterTab]       = useState<FilterTab>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [detailJobId, setDetailJobId]     = useState<string | null>(null);
  const [statusModalId, setStatusModalId] = useState<string | null>(null);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [partReqJob, setPartReqJob]       = useState<RepairJob | null>(null);
  const [diagnosticJob, setDiagnosticJob] = useState<RepairJob | null>(null);
  const [activityJob, setActivityJob]     = useState<RepairJob | null>(null);
  const [notesJob, setNotesJob]           = useState<RepairJob | null>(null);
  const [escalationJob, setEscalationJob] = useState<RepairJob | null>(null);
  const [messageJob, setMessageJob]       = useState<RepairJob | null>(null);

  const { jobMeta } = useTech();

  const myJobs = jobs.filter(j => j.technician === technicianName);
  const activeJob = myJobs.find(j => j.status === "Issued");

  const filtered = myJobs.filter(j => {
    if (!STATUS_FOR_FILTER[filterTab].includes(j.status)) return false;
    if (priorityFilter !== "All" && j.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!j.id.toLowerCase().includes(q) && !j.model.toLowerCase().includes(q) &&
          !j.brand.toLowerCase().includes(q) && !j.customerName.toLowerCase().includes(q) &&
          !j.issue.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    // Sort: Active first, then Pending, Non-Issued, Completed
    const order: Record<JobStatus, number> = { Issued: 0, Pending: 1, "Non-Issued": 2, Completed: 3, Delivered: 4, Cancelled: 5 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const pOrder = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  const tabCounts: Record<FilterTab, number> = {
    "All":         myJobs.filter(j => STATUS_FOR_FILTER["All"].includes(j.status)).length,
    "Active":      myJobs.filter(j => j.status === "Issued").length,
    "Paused":      myJobs.filter(j => j.status === "Pending").length,
    "Not Started": myJobs.filter(j => j.status === "Non-Issued").length,
    "Completed":   myJobs.filter(j => j.status === "Completed").length,
  };

  const detailJob = detailJobId ? myJobs.find(j => j.id === detailJobId) : null;
  const statusModalJob = statusModalId ? myJobs.find(j => j.id === statusModalId) : null;

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: ff, outline: "none",
  };

  const getQuickAction = (job: RepairJob) => {
    if (job.status === "Non-Issued") return { label: "Start Job", color: TA, icon: Play };
    if (job.status === "Issued")     return { label: "Pause",     color: "#fbbf24", icon: Pause };
    if (job.status === "Pending")    return { label: "Resume",    color: "#60a5fa", icon: Play };
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff, flex: 1, minHeight: 0 }}>

      {/* Header */}
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>My Jobs</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>
          {myJobs.length} repair job{myJobs.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      {/* Active job quick bar */}
      {activeJob && (
        <div className="fade-up" style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", borderRadius: 12,
          background: `${TA}08`, border: `1px solid ${TA}28`,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: TA, flexShrink: 0, animation: "pulse-tech 2s infinite", display: "inline-block" }} />
          <p style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, flex: 1 }}>
            <strong>Active:</strong> {activeJob.id} — {activeJob.brand} {activeJob.model} ({activeJob.issue})
          </p>
          <button
            onClick={() => setStatusModalId(activeJob.id)}
            style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: 7, background: `${TA}14`, border: `1px solid ${TA}30`, color: TA, cursor: "pointer", fontFamily: ff }}
          >
            Update
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="fade-up" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>

        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            placeholder="Search jobs, device, customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>

        {/* Priority filter */}
        <div style={{ position: "relative" }}>
          <Filter size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 28, paddingRight: 28, appearance: "none", cursor: "pointer", minWidth: 130 }}
          >
            <option value="All">All Priorities</option>
            {["Urgent", "High", "Normal", "Low"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Status tabs */}
      <div className="fade-up" style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
        {FILTER_TABS.map(tab => {
          const active = filterTab === tab;
          const count = tabCounts[tab];
          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              style={{
                padding: "7px 14px", borderRadius: 7, fontSize: 12.5,
                background: active ? "var(--bg-secondary)" : "transparent",
                border: active ? `1px solid ${TA}30` : "1px solid transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: active ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s", fontFamily: ff,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {tab}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20,
                  background: active ? `${TA}20` : "var(--border)",
                  color: active ? TA : "var(--text-muted)",
                  fontFamily: ff,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Jobs table */}
      <div className="fade-up" style={{ flex: 1, overflow: "auto", borderRadius: 14, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Priority", "Job ID", "Device", "Issue", "Customer", "Est. Cost", "Status", "Actions"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", textAlign: "left", fontSize: 11,
                  color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap",
                  fontFamily: ff,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: ff }}>
                  No jobs match your filters.
                </td>
              </tr>
            ) : filtered.map((job, i) => {
              const sCfg = STATUS_CFG[job.status];
              const pCfg = PRIORITY_CFG[job.priority];
              const qa   = getQuickAction(job);
              const isExpanded = expandedId === job.id;

              return (
                <React.Fragment key={job.id}>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: job.status === "Issued" ? `${TA}04` : i % 2 === 0 ? "transparent" : "var(--bg-secondary)",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => { if (job.status !== "Issued") (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = job.status === "Issued" ? `${TA}04` : i % 2 === 0 ? "transparent" : "var(--bg-secondary)"; }}
                    onClick={() => setExpandedId(isExpanded ? null : job.id)}
                  >
                    {/* Priority */}
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.dot, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: pCfg.color, fontFamily: ff }}>{job.priority}</span>
                      </div>
                    </td>

                    {/* Job ID */}
                    <td style={{ padding: "11px 14px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{job.id}</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>{job.createdAt}</p>
                    </td>

                    {/* Device */}
                    <td style={{ padding: "11px 14px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, whiteSpace: "nowrap" }}>{job.brand} {job.model}</p>
                    </td>

                    {/* Issue */}
                    <td style={{ padding: "11px 14px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)", fontFamily: ff }}>
                      {job.issue}
                    </td>

                    {/* Customer */}
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <User size={11} color="var(--text-muted)" />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff, whiteSpace: "nowrap" }}>{job.customerName}</span>
                      </div>
                    </td>

                    {/* Cost */}
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                        Rs. {job.estimatedCost.toLocaleString()}
                      </span>
                      {(() => {
                        const jobReqs = partRequests.filter(r => r.jobId === job.id);
                        if (jobReqs.length === 0) return null;
                        const partsCost = jobReqs.reduce((s, r) => s + (SPARE_PARTS.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0);
                        return (
                          <p style={{ fontSize: 10.5, color: "#a78bfa", fontFamily: ff, marginTop: 2 }}>
                            +Rs. {partsCost.toLocaleString()} parts
                          </p>
                        );
                      })()}
                    </td>

                    {/* Status + SLA */}
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, color: sCfg.color, background: sCfg.bg, border: `1px solid ${sCfg.border}`, whiteSpace: "nowrap", fontFamily: ff }}>
                        {sCfg.label}
                      </span>
                      {(() => {
                        const sla = getSlaStatus(job);
                        if (sla === "ok") return null;
                        const sc = SLA_CFG[sla];
                        const days = getDaysUntilDue(job.estimatedCompletion);
                        return (
                          <p style={{ fontSize: 10, fontWeight: 700, color: sc.color, fontFamily: ff, marginTop: 3 }}>
                            {sla === "overdue" ? `${Math.abs(days)}d overdue` : sla === "due-today" ? "Due today" : `Due in ${days}d`}
                          </p>
                        );
                      })()}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "11px 14px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {qa && (
                          <button onClick={() => setStatusModalId(job.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: `${qa.color}12`, border: `1px solid ${qa.color}30`, color: qa.color, cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap", transition: "all 0.15s" }}>
                            <qa.icon size={11} />{qa.label}
                          </button>
                        )}
                        {/* Diagnostic button for not-started */}
                        {job.status === "Non-Issued" && (
                          <button onClick={() => setDiagnosticJob(job)} title="Pre-repair diagnostic" style={{ padding: "5px 7px", borderRadius: 7, background: diagnostics[job.id] ? `${TA}12` : "none", border: `1px solid ${diagnostics[job.id] ? TA + "30" : "var(--border)"}`, color: diagnostics[job.id] ? TA : "var(--text-muted)", cursor: "pointer" }}>
                            <ClipboardCheck size={13} />
                          </button>
                        )}
                        {/* Notes */}
                        <button onClick={() => setNotesJob(job)} title="Repair notes" style={{ padding: "5px 7px", borderRadius: 7, background: (notes[job.id]?.length ?? 0) > 0 ? "rgba(251,191,36,0.1)" : "none", border: `1px solid ${(notes[job.id]?.length ?? 0) > 0 ? "rgba(251,191,36,0.3)" : "var(--border)"}`, color: (notes[job.id]?.length ?? 0) > 0 ? "#fbbf24" : "var(--text-muted)", cursor: "pointer", position: "relative" }}>
                          <FileText size={13} />
                          {(notes[job.id]?.length ?? 0) > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#fbbf24", fontSize: 8, fontWeight: 700, color: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>{notes[job.id].length}</span>}
                        </button>
                        {/* Activity */}
                        <button onClick={() => setActivityJob(job)} title="Activity log" style={{ padding: "5px 7px", borderRadius: 7, background: (activityLog[job.id]?.length ?? 0) > 0 ? "rgba(96,165,250,0.1)" : "none", border: `1px solid ${(activityLog[job.id]?.length ?? 0) > 0 ? "rgba(96,165,250,0.3)" : "var(--border)"}`, color: (activityLog[job.id]?.length ?? 0) > 0 ? "#60a5fa" : "var(--text-muted)", cursor: "pointer" }}>
                          <Activity size={13} />
                        </button>
                        {/* Message */}
                        <button onClick={() => setMessageJob(job)} title="Message customer" style={{ padding: "5px 7px", borderRadius: 7, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
                          <MessageCircle size={13} />
                        </button>
                        {/* Escalation */}
                        {!["Completed", "Delivered", "Cancelled"].includes(job.status) && (
                          <button onClick={() => setEscalationJob(job)} title={escalations.some(e => e.jobId === job.id && !e.resolved) ? "Active escalation" : "Raise escalation"} style={{ padding: "5px 7px", borderRadius: 7, background: escalations.some(e => e.jobId === job.id && !e.resolved) ? "rgba(248,113,113,0.1)" : "none", border: `1px solid ${escalations.some(e => e.jobId === job.id && !e.resolved) ? "rgba(248,113,113,0.3)" : "var(--border)"}`, color: escalations.some(e => e.jobId === job.id && !e.resolved) ? "#f87171" : "var(--text-muted)", cursor: "pointer" }}>
                            <AlertOctagon size={13} />
                          </button>
                        )}
                        <button onClick={() => setDetailJobId(job.id)} title="View details" style={{ padding: "5px 7px", borderRadius: 7, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
                          <MoreVertical size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (() => {
                    const meta = jobMeta[job.id];
                    const jobReqs = partRequests.filter(r => r.jobId === job.id);
                    const partsCost = jobReqs.reduce((s, r) => s + (SPARE_PARTS.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0);
                    const REQ_COLORS: Record<string, string> = { Pending: "#fbbf24", Approved: TA, Issued: "#60a5fa", Rejected: "#f87171" };
                    return (
                      <tr key={`${job.id}-expanded`} style={{ borderBottom: "1px solid var(--border)", background: job.status === "Issued" ? `${TA}06` : "var(--bg-secondary)" }}>
                        <td colSpan={8} style={{ padding: "10px 14px 12px 40px" }}>
                          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                            {meta?.pauseReason && (
                              <div>
                                <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 3 }}>Pause Reason</p>
                                <p style={{ fontSize: 12, color: "#fbbf24", fontFamily: ff }}>{meta.pauseReason}</p>
                              </div>
                            )}
                            {meta?.completionNotes && (
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 3 }}>Work Summary</p>
                                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{meta.completionNotes}</p>
                              </div>
                            )}
                            <div>
                              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 3 }}>Due Date</p>
                              <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{job.estimatedCompletion}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 3 }}>Customer Phone</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Phone size={11} color="var(--text-muted)" />
                                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{job.phone}</p>
                              </div>
                            </div>
                            {jobReqs.length > 0 && (
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                  <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>Parts Requested</p>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 20, padding: "1px 6px", fontFamily: ff }}>
                                    Rs. {partsCost.toLocaleString()}
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {jobReqs.map(r => (
                                    <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "var(--bg-card)", border: "1px solid var(--border)", fontFamily: ff }}>
                                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{r.partName}</span>
                                      <span style={{ color: "var(--text-muted)" }}>× {r.quantity}</span>
                                      <span style={{ color: REQ_COLORS[r.status] ?? TA, fontWeight: 700 }}>· {r.status}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {job.status === "Issued" && (
                              <div style={{ marginLeft: "auto" }}>
                                <button
                                  onClick={e => { e.stopPropagation(); setPartReqJob(job); setExpandedId(null); }}
                                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: `${TA}10`, border: `1px solid ${TA}30`, color: TA, cursor: "pointer", fontFamily: ff }}
                                >
                                  <Package size={12} />
                                  Request Parts
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {detailJob && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }}
            onClick={() => setDetailJobId(null)}
          />
          <JobDetailPanel
            job={detailJob}
            onClose={() => setDetailJobId(null)}
            onStatusUpdate={() => { setDetailJobId(null); setStatusModalId(detailJob.id); }}
            onRequestParts={() => { setDetailJobId(null); setPartReqJob(detailJob); }}
          />
        </>
      )}

      {/* Status update modal */}
      {statusModalJob && (
        <StatusUpdateModal
          job={statusModalJob}
          onClose={() => setStatusModalId(null)}
        />
      )}

      {/* Part request modal */}
      {partReqJob && (
        <PartRequestModal
          job={partReqJob}
          onClose={() => setPartReqJob(null)}
        />
      )}

      {/* Diagnostic modal */}
      {diagnosticJob && (
        <DiagnosticModal
          job={diagnosticJob}
          onClose={() => setDiagnosticJob(null)}
        />
      )}

      {/* Activity log panel */}
      {activityJob && (
        <ActivityLogPanel
          job={activityJob}
          onClose={() => setActivityJob(null)}
        />
      )}

      {/* Internal notes modal */}
      {notesJob && (
        <InternalNotesModal
          job={notesJob}
          onClose={() => setNotesJob(null)}
        />
      )}

      {/* Escalation modal */}
      {escalationJob && (
        <EscalationModal
          job={escalationJob}
          onClose={() => setEscalationJob(null)}
        />
      )}

      {/* Customer message modal */}
      {messageJob && (
        <CustomerMessageModal
          job={messageJob}
          onClose={() => setMessageJob(null)}
        />
      )}

      <style>{`@keyframes pulse-tech{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
