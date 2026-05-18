"use client";

import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Search, Filter, ChevronDown, MoreHorizontal,
  CheckCircle, Clock, AlertCircle, XCircle, Wrench,
  X, CheckSquare, Send, Printer, ShieldCheck, CreditCard,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "Non-Issued" | "Issued" | "Pending" | "Completed" | "Cancelled";

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
  jobWarranty?: string;
  dealer?: string;
}

interface FinishJobData {
  actionTaken: string;
  checkedBy: string[];
  jobStatus: JobStatus;
  advance: number;
  totalPrice: number;
  partsCost: number;
  warranty: string;
}

interface IssueInvoiceData {
  job: RepairJob;
  name: string;
  phone: string;
  nic: string;
  email: string;
  imei: string;
  discount: number;
  paidAmount: number;
  dueAmount: number;
  isCredit: boolean;
  adminApprover: string;
  warranty: string;
  invoiceNo: string;
  createdAt: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_JOBS: RepairJob[] = [
  { id: "RM-001", customerName: "Kasun Perera",       phone: "+94 77 123 4567", brand: "Apple",   model: "iPhone 14 Pro",   issue: "Screen Damage",  technician: "Kamal",  status: "Non-Issued", priority: "High",   estimatedCost: 25000, advancePaid: 5000,  createdAt: "2025-04-20", estimatedCompletion: "2025-04-22", imei: "351988100241349", dealer: "MANO MOBILE" },
  { id: "RM-002", customerName: "Nimali Silva",        phone: "+94 71 234 5678", brand: "Samsung", model: "Galaxy S23",       issue: "Battery",        technician: "Nimal",  status: "Issued",     priority: "Normal", estimatedCost: 8000,  advancePaid: 2000,  createdAt: "2025-04-21", estimatedCompletion: "2025-04-23", imei: "354668771114184", dealer: "MANO MOBILE" },
  { id: "RM-003", customerName: "Roshan Fernando",     phone: "+94 76 345 6789", brand: "Xiaomi",  model: "Redmi Note 12",   issue: "Charging Port",  technician: "Suresh", status: "Pending",    priority: "Urgent", estimatedCost: 4500,  advancePaid: 1000,  createdAt: "2025-04-19", estimatedCompletion: "2025-04-21", imei: "354682282577565", dealer: "MANO MOBILE" },
  { id: "RM-004", customerName: "Dilini Rajapaksa",    phone: "+94 70 456 7890", brand: "Apple",   model: "iPhone 13",       issue: "Camera",         technician: "Kamal",  status: "Completed",  priority: "Normal", estimatedCost: 15000, advancePaid: 15000, createdAt: "2025-04-18", estimatedCompletion: "2025-04-20", imei: "356822002345678", jobWarranty: "3 MONTHS WARRANTY [NORMAL]", dealer: "MANO MOBILE" },
  { id: "RM-005", customerName: "Pradeep Jayawardena", phone: "+94 75 567 8901", brand: "Oppo",    model: "Reno 8",          issue: "Speaker / Mic",  technician: "Nimal",  status: "Non-Issued", priority: "Low",    estimatedCost: 3000,  advancePaid: 0,     createdAt: "2025-04-22", estimatedCompletion: "2025-04-25", dealer: "MANO MOBILE" },
  { id: "RM-006", customerName: "Samantha Bandara",    phone: "+94 78 678 9012", brand: "Samsung", model: "Galaxy A54",      issue: "Water Damage",   technician: "Suresh", status: "Issued",     priority: "High",   estimatedCost: 12000, advancePaid: 3000,  createdAt: "2025-04-21", estimatedCompletion: "2025-04-24", imei: "864562049583598", dealer: "MANO MOBILE" },
  { id: "RM-007", customerName: "Chamara Wijesinghe",  phone: "+94 72 789 0123", brand: "Huawei",  model: "P30 Pro",         issue: "Software",       technician: "Kamal",  status: "Pending",    priority: "Normal", estimatedCost: 5000,  advancePaid: 2000,  createdAt: "2025-04-20", estimatedCompletion: "2025-04-22", dealer: "MANO MOBILE" },
  { id: "RM-008", customerName: "Isuru Madushanka",    phone: "+94 74 890 1234", brand: "OnePlus", model: "Nord 3",          issue: "Back Glass",     technician: "Nimal",  status: "Completed",  priority: "Low",    estimatedCost: 6000,  advancePaid: 6000,  createdAt: "2025-04-17", estimatedCompletion: "2025-04-19", imei: "860123456789012", jobWarranty: "1 MONTH WARRANTY [NORMAL]", dealer: "MANO MOBILE" },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<JobStatus, { color: string; bg: string; border: string; icon: any }> = {
  "Non-Issued": { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", icon: Clock },
  "Issued":     { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)",  icon: Wrench },
  "Pending":    { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)",  icon: AlertCircle },
  "Completed":  { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)",  icon: CheckCircle },
  "Cancelled":  { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", icon: XCircle },
};

const priorityColor: Record<string, string> = {
  Low: "#94a3b8", Normal: "#60a5fa", High: "#fbbf24", Urgent: "#f87171",
};

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: 5,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 12, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
};

const invTd: React.CSSProperties = {
  padding: "4px 7px", border: "1px solid #ccc", fontSize: 10.5, fontStyle: "italic",
};

// ─── Info Block ───────────────────────────────────────────────────────────────

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Job Details Modal ────────────────────────────────────────────────────────

function JobDetailsModal({ job, allJobs, onClose, onFinishJob, onIssueJob }: {
  job: RepairJob;
  allJobs: RepairJob[];
  onClose: () => void;
  onFinishJob: () => void;
  onIssueJob: () => void;
}) {
  const [logSearch,        setLogSearch]        = useState("");
  const [showFinishedOnly, setShowFinishedOnly] = useState(false);

  const sc      = statusConfig[job.status];
  const StatusIcon = sc.icon;
  const balance = job.estimatedCost - job.advancePaid;

  const d = new Date(job.createdAt);
  const dayName   = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = d.toLocaleDateString("en-US", { month: "long" });

  const faultRows = [
    ["Display",   "Touch pad",   "Software",        "No signal",       "Mic fault",       "Speaker"],
    ["Key pad",   "Battery low", "Key stuck",       "Insert SIM",      "Earpiece fault",  "Water damage"],
    ["No power",  "Charging",    "Signal drop",     "Hands free mark", "Short"],
  ];

  const logJobs = allJobs.filter(j => {
    const s = logSearch.toLowerCase();
    const matchSearch = !s || j.customerName.toLowerCase().includes(s) || j.id.toLowerCase().includes(s) || (j.imei || "").includes(s) || j.issue.toLowerCase().includes(s);
    const matchDone   = !showFinishedOnly || j.status === "Completed" || j.status === "Issued";
    return matchSearch && matchDone;
  });

  const statusShort = (s: JobStatus) => ({ "Non-Issued": "N/I", "Issued": "ISS", "Pending": "PND", "Completed": "FIN", "Cancelled": "CXL" }[s]);

  const fieldBox: React.CSSProperties = { padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: 33, display: "flex", alignItems: "center" };
  const secHead: React.CSSProperties  = { fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10, fontFamily: "'Plus Jakarta Sans', sans-serif" };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 1240, maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 7, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: 11, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <StatusIcon size={9} strokeWidth={2.5} />{job.status}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: priorityColor[job.priority], fontFamily: "'Plus Jakarta Sans', sans-serif" }}>● {job.priority}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {job.status === "Non-Issued" && (
              <button onClick={onIssueJob} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid #60a5fa", background: "#60a5fa", color: "#fff", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <Send size={12} strokeWidth={2.2} />Issue This Job
              </button>
            )}
            {job.status === "Pending" && (
              <button onClick={onFinishJob} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <CheckSquare size={12} strokeWidth={2.2} />Mark as Finished
              </button>
            )}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Two-panel body ── */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* ─── LEFT: Job detail form ─── */}
          <div style={{ flex: "0 0 52%", borderRight: "1px solid var(--border)", overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Job details */}
            <div>
              <div style={secHead}>Job details</div>
              <div style={{ marginBottom: 8 }}>
                <label style={labelSt}>Dealer</label>
                <div style={{ ...fieldBox, color: "var(--text-secondary)" }}>{job.dealer || "MANO MOBILE CENTRE"}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={labelSt}>Internal number</label>
                  <div style={{ ...fieldBox, color: "var(--accent)", fontWeight: 600 }}>{job.id}</div>
                </div>
                <div>
                  <label style={labelSt}>Dealer Job number</label>
                  <div style={{ ...fieldBox, color: "var(--text-muted)", fontStyle: "italic" }}>—</div>
                </div>
              </div>
              <div>
                <label style={labelSt}>Agent</label>
                <div style={{ ...fieldBox, color: "var(--text-secondary)" }}>{job.technician}</div>
              </div>
            </div>

            {/* Owner data */}
            <div>
              <div style={secHead}>Owner data</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelSt}>Name</label>
                  <div style={{ ...fieldBox, fontWeight: 600 }}>{job.customerName}</div>
                </div>
                <div>
                  <label style={labelSt}>Contact no.</label>
                  <div style={{ ...fieldBox, color: "var(--text-secondary)" }}>{job.phone}</div>
                </div>
              </div>
            </div>

            {/* Dates + Device */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Accepted date</label>
                <div style={{ ...fieldBox, color: "var(--text-secondary)" }}>{dayName}, {monthName} {d.getDate()}, {d.getFullYear()}</div>
              </div>
              <div>
                <label style={labelSt}>Model</label>
                <div style={{ ...fieldBox, fontWeight: 600 }}>{job.brand} {job.model}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Accepted by</label>
                <div style={{ ...fieldBox, color: "var(--text-muted)", fontStyle: "italic" }}>—</div>
              </div>
              <div>
                <label style={labelSt}>IMEI no.</label>
                <div style={{ ...fieldBox, color: "var(--text-secondary)", fontFamily: "monospace" }}>{job.imei || "—"}</div>
              </div>
            </div>

            {/* Comment */}
            <div>
              <label style={labelSt}>Comment</label>
              <div style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-muted)", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: "italic", minHeight: 48 }}>—</div>
            </div>

            {/* Warranty */}
            <div>
              <label style={labelSt}>Select repair warranty (Optional)</label>
              <div style={{ ...fieldBox, color: job.jobWarranty ? "var(--text-primary)" : "var(--text-muted)" }}>{job.jobWarranty || "— SELECT —"}</div>
            </div>

            {/* Submission details */}
            <div>
              <div style={secHead}>Submission details</div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", background: "var(--bg-secondary)" }}>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                  {["Equipment", "Antenna", "Back cover", "Other issue"].map(item => (
                    <label key={item} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", cursor: "default", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <input type="checkbox" disabled readOnly style={{ accentColor: "var(--accent)" }} />{item}
                    </label>
                  ))}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Warranty</span>
                    {(["Yes", "No"] as const).map(opt => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", cursor: "default", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <input type="radio" disabled readOnly checked={opt === "No"} style={{ accentColor: "var(--accent)" }} />{opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18 }}>
                  {["Battery", "Charger", "SIM card"].map(item => (
                    <label key={item} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", cursor: "default", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <input type="checkbox" disabled readOnly style={{ accentColor: "var(--accent)" }} />{item}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Fault type */}
            <div>
              <div style={secHead}>Fault type</div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", gap: 8 }}>
                {faultRows.map((row, ri) => (
                  <div key={ri} style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {row.map(fault => {
                      const checked = job.issue.toLowerCase().includes(fault.toLowerCase());
                      return (
                        <label key={fault} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: checked ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: checked ? 600 : 400, cursor: "default", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          <input type="checkbox" disabled readOnly checked={checked} style={{ accentColor: "var(--accent)" }} />{fault}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Daily log ─── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

            {/* Log toolbar */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={secHead}>Daily log</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                  <input
                    value={logSearch} onChange={e => setLogSearch(e.target.value)}
                    placeholder="Search..."
                    style={{ width: "100%", padding: "7px 10px 7px 28px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box" }}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <input type="checkbox" checked={showFinishedOnly} onChange={e => setShowFinishedOnly(e.target.checked)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                  Show only finished jobs
                </label>
              </div>
            </div>

            {/* Log table */}
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Dealer name", "Job number", "IMEI number", "Fault", "Advance", "Total amount", "Job"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--bg-secondary)", position: "sticky" as const, top: 0 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logJobs.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No jobs found</td></tr>
                  ) : logJobs.map(j => {
                    const jsc      = statusConfig[j.status];
                    const isCurrent = j.id === job.id;
                    return (
                      <tr key={j.id} style={{ borderBottom: "1px solid var(--border)", background: isCurrent ? jsc.bg : "transparent" }}>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{j.dealer || "MANO MOBILE"}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--accent)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{j.id}</td>
                        <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{j.imei || "—"}</td>
                        <td style={{ padding: "8px 12px", fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.issue}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-primary)", textAlign: "right", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{j.advancePaid.toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textAlign: "right", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{j.estimatedCost.toLocaleString()}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: jsc.bg, border: `1px solid ${jsc.border}`, color: jsc.color, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
                            {statusShort(j.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary footer */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 24, marginBottom: 10, alignItems: "center" }}>
                {[
                  { label: "Advance",  value: job.advancePaid.toLocaleString(),  color: "var(--text-primary)" },
                  { label: "Total",    value: job.estimatedCost.toLocaleString(), color: "var(--text-primary)" },
                  { label: "Balance",  value: balance.toLocaleString(),           color: balance > 0 ? "#f87171" : "#4ade80" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <span style={{ color: "var(--text-muted)" }}>{label}: </span>
                    <span style={{ fontWeight: 700, color }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-glow)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}>
                  Jobs issued on credit
                </button>
                <button style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-glow)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}>
                  View open jobs
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Issue Job Modal ──────────────────────────────────────────────────────────

function IssueJobModal({ job, onClose, onIssued }: {
  job: RepairJob;
  onClose: () => void;
  onIssued: (data: Omit<IssueInvoiceData, "job" | "invoiceNo" | "createdAt">) => void;
}) {
  const [name,          setName]          = useState(job.customerName);
  const [phone,         setPhone]         = useState(job.phone);
  const [nic,           setNic]           = useState("");
  const [email,         setEmail]         = useState("");
  const [imei,          setImei]          = useState(job.imei || "");
  const [discount,      setDiscount]      = useState("0");
  const [payingNow,     setPayingNow]     = useState("");
  const [adminApprover, setAdminApprover] = useState("");
  const [warranty,      setWarranty]      = useState("NO WARRANTY [NORMAL]");

  const discountAmt      = parseFloat(discount) || 0;
  const lineTotal        = Math.max(0, job.estimatedCost - discountAmt);
  const netDue           = Math.max(0, lineTotal - job.advancePaid);
  // Default the paid amount input to the full net due until the user changes it
  const payingNowDisplay = payingNow === "" ? netDue.toString() : payingNow;
  const effectivePaying  = parseFloat(payingNowDisplay) || 0;
  const effectiveDue     = Math.max(0, netDue - effectivePaying);
  const effectiveCredit  = effectiveDue > 0;
  const canIssue         = !!name && !!phone && (!effectiveCredit || !!adminApprover.trim());

  const fields = [
    { label: "Full Name",  value: name,  set: setName,  placeholder: "Customer name" },
    { label: "Phone",      value: phone, set: setPhone, placeholder: "07X XXX XXXX" },
    { label: "NIC",        value: nic,   set: setNic,   placeholder: "XXXXXXXXX V" },
    { label: "Email",      value: email, set: setEmail, placeholder: "Optional" },
    { label: "IMEI No.",   value: imei,  set: setImei,  placeholder: "15-digit IMEI" },
  ];

  const handleIssue = () => {
    onIssued({
      name, phone, nic, email, imei,
      discount: discountAmt,
      paidAmount: job.advancePaid + effectivePaying,
      dueAmount: effectiveDue,
      isCredit: effectiveCredit,
      adminApprover: adminApprover.trim(),
      warranty,
    });
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(720px, calc(100vw - 24px))", maxHeight: "92vh", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Issue This Job</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id} · {job.brand} {job.model} · {job.issue}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Body — two columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", overflowY: "auto", flex: 1 }}>

          {/* Left: Customer Info */}
          <div style={{ padding: "16px 18px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 11 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Customer Information</p>
            {fields.map(f => (
              <div key={f.label}>
                <label style={labelSt}>{f.label}</label>
                <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} style={inputSt} />
              </div>
            ))}
          </div>

          {/* Right: Bill Summary */}
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Bill Summary</p>

            {/* Job info */}
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { k: "Device",     v: `${job.brand} ${job.model}` },
                { k: "Issue",      v: job.issue },
                { k: "Technician", v: job.technician },
                { k: "Priority",   v: job.priority },
              ].map(r => (
                <div key={r.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.k}</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.v}</span>
                </div>
              ))}
            </div>

            {/* Financials */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Static rows */}
              {[
                { k: "Estimated Cost", v: `Rs. ${job.estimatedCost.toLocaleString()}` },
                { k: "Advance Paid",   v: `Rs. ${job.advancePaid.toLocaleString()}` },
              ].map(r => (
                <div key={r.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.k}</span>
                  <span style={{ color: "var(--text-primary)" }}>{r.v}</span>
                </div>
              ))}

              {/* Discount */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Discount</span>
                <input
                  type="number" min={0} value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  style={{ width: 90, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", textAlign: "right" }}
                />
              </div>

              {/* Line Total */}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 2, paddingTop: 7, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: "var(--text-primary)" }}>Line Total</span>
                <span style={{ color: "var(--accent)" }}>Rs. {lineTotal.toLocaleString()}</span>
              </div>

              {/* Net balance after advance */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                <span style={{ color: "var(--text-muted)" }}>Balance After Advance</span>
                <span style={{ color: "var(--text-secondary)" }}>Rs. {netDue.toLocaleString()}</span>
              </div>

              {/* Paying Now */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Paid Amount</span>
                <input
                  type="number" min={0} max={netDue}
                  value={payingNowDisplay}
                  onChange={(e) => setPayingNow(e.target.value)}
                  style={{ width: 110, padding: "4px 8px", borderRadius: 6, border: `1px solid ${effectiveCredit ? "rgba(251,191,36,0.5)" : "var(--border)"}`, background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", textAlign: "right" }}
                />
              </div>

              {/* Credit / Settled indicator */}
              {effectiveCredit ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", marginTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <CreditCard size={12} color="#fbbf24" strokeWidth={2.2} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.04em" }}>CREDIT PAYMENT</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>Rs. {effectiveDue.toLocaleString()} due</span>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)", marginTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <CheckCircle size={12} color="#4ade80" strokeWidth={2.2} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#4ade80" }}>FULLY SETTLED</span>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Approval — only when credit */}
            {effectiveCredit && (
              <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "12px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={13} color="#fbbf24" strokeWidth={2.2} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Admin Approval Required</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  This job has a credit balance of <strong style={{ color: "#fbbf24" }}>Rs. {effectiveDue.toLocaleString()}</strong>. An admin must approve before issuing.
                </p>
                <div>
                  <label style={{ ...labelSt, color: "#fbbf24" }}>Approving Admin Name</label>
                  <input
                    value={adminApprover}
                    onChange={(e) => setAdminApprover(e.target.value)}
                    placeholder="Enter admin name to approve"
                    style={{ ...inputSt, border: "1px solid rgba(251,191,36,0.4)", background: "var(--bg-primary)" }}
                  />
                </div>
              </div>
            )}

            {/* Warranty */}
            <div>
              <label style={labelSt}>Warranty</label>
              <select value={warranty} onChange={(e) => setWarranty(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
                {["NO WARRANTY [NORMAL]", "NO WARRANTY [RETURN]", "NO WARRANTY [FOC]", "1 MONTH WARRANTY [NORMAL]", "3 MONTHS WARRANTY [NORMAL]", "6 MONTHS WARRANTY [NORMAL]", "1 YEAR WARRANTY [NORMAL]"].map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Cancel
          </button>
          <button
            onClick={handleIssue}
            disabled={!canIssue}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${effectiveCredit ? "#fbbf24" : "#60a5fa"}`, background: effectiveCredit ? "#fbbf24" : "#60a5fa", color: effectiveCredit ? "#000" : "#fff", cursor: canIssue ? "pointer" : "not-allowed", opacity: canIssue ? 1 : 0.45, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {effectiveCredit ? <ShieldCheck size={12} strokeWidth={2.2} /> : <Send size={12} strokeWidth={2.2} />}
            {effectiveCredit ? "Approve & Issue" : "Issue Job"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Repair Invoice Preview ───────────────────────────────────────────────────

function RepairInvoicePreview({ data, onClose }: { data: IssueInvoiceData; onClose: () => void }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const lineTotal = data.job.estimatedCost - data.discount;
  const paymentType = data.isCredit ? "CREDIT" : "CASH / FULL";

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printDiv = document.createElement("div");
    printDiv.id = "__rp__";
    printDiv.innerHTML = invoiceRef.current.outerHTML;
    document.body.appendChild(printDiv);
    const styleEl = document.createElement("style");
    styleEl.id = "__rp_style__";
    styleEl.textContent = `
      @page { size: A4 portrait; margin: 15mm; }
      #__rp__ { display: none; }
      @media print {
        body { visibility: hidden; }
        #__rp__ { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
        #__rp__ * { visibility: visible; }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
    setTimeout(() => {
      document.getElementById("__rp__")?.remove();
      document.getElementById("__rp_style__")?.remove();
    }, 500);
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1002, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(780px, calc(100vw - 24px))", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>

        {/* Modal header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Invoice Preview — {data.invoiceNo}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Printer size={12} /> Print
            </button>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Invoice content */}
        <div style={{ overflowY: "auto", padding: 20 }}>
          <div ref={invoiceRef} style={{ background: "#ffffff", padding: "36px 44px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000000" }}>

            <h1 style={{ textAlign: "center", fontWeight: 900, textDecoration: "underline", fontSize: 22, margin: 0, letterSpacing: "0.05em" }}>
              SALES INVOICE
            </h1>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <table style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 10px", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>INVOICE NUMBER:</td>
                    <td style={{ padding: "4px 12px", background: "#e0e0e0", border: "1px solid #aaa", minWidth: 180, fontWeight: 700, fontSize: 13 }}>{data.invoiceNo}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 10px", fontWeight: 700, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>DATE and CREATED BY:</td>
                    <td style={{ padding: "4px 12px", background: "#e0e0e0", border: "1px solid #aaa", fontWeight: 700, fontSize: 11 }}>{data.createdAt} | MANOMOBILE</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>CUSTOMER NAME: {data.name.toUpperCase()}</p>

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 10.5, border: "1px solid #999" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  {["No.", "Item type", "Item name", "IMEI no.", "Warranty", "Quantity", "Advance", "Unit price", "Discount", "Line total"].map(h => (
                    <th key={h} style={{ padding: "5px 7px", border: "1px solid #999", fontWeight: 700, fontStyle: "italic", textAlign: "left", whiteSpace: "nowrap", fontSize: 10.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={invTd}>1.</td>
                  <td style={invTd}>Repair</td>
                  <td style={invTd}>{data.job.id} | {data.job.brand} | {data.job.model}</td>
                  <td style={invTd}>{data.imei || "—"}</td>
                  <td style={invTd}>{data.warranty}</td>
                  <td style={{ ...invTd, textAlign: "right" }}>1</td>
                  <td style={{ ...invTd, textAlign: "right" }}>{data.job.advancePaid}</td>
                  <td style={{ ...invTd, textAlign: "right" }}>{data.job.estimatedCost}</td>
                  <td style={{ ...invTd, textAlign: "right" }}>{data.discount}</td>
                  <td style={{ ...invTd, textAlign: "right", fontWeight: 700, fontStyle: "normal" }}>{lineTotal}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ borderTop: "2px solid #000", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                  <span>TOTAL</span>
                  <span>Rs. {lineTotal.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#555" }}>Paid Amount</span>
                  <span style={{ fontWeight: 600 }}>Rs. {data.paidAmount.toLocaleString()}</span>
                </div>
                {data.isCredit ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: 4, padding: "3px 6px", marginTop: 2 }}>
                    <span style={{ fontWeight: 700, color: "#b45309" }}>CREDIT DUE</span>
                    <span style={{ fontWeight: 700, color: "#b45309" }}>Rs. {data.dueAmount.toLocaleString()}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "#f0fdf4", border: "1px solid #4ade80", borderRadius: 4, padding: "3px 6px", marginTop: 2 }}>
                    <span style={{ fontWeight: 700, color: "#166534" }}>SETTLED</span>
                    <span style={{ fontWeight: 700, color: "#166534" }}>✓</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Type row */}
            <div style={{ marginTop: 18, display: "flex", gap: 32, fontSize: 11 }}>
              <div>
                <span style={{ fontWeight: 700 }}>Payment Type: </span>
                <span style={{ fontWeight: 700, color: data.isCredit ? "#b45309" : "#166534", background: data.isCredit ? "#fff8e1" : "#f0fdf4", border: `1px solid ${data.isCredit ? "#f59e0b" : "#4ade80"}`, borderRadius: 4, padding: "2px 8px" }}>{paymentType}</span>
              </div>
              {data.isCredit && data.adminApprover && (
                <div>
                  <span style={{ fontWeight: 700 }}>Credit Approved By: </span>
                  <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{data.adminApprover}</span>
                </div>
              )}
            </div>

            <p style={{ marginTop: 20, fontSize: 10, color: "#666", textAlign: "center" }}>
              This is a computer-generated invoice. No signature required.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Finish Job Modal ─────────────────────────────────────────────────────────

function FinishJobModal({ job, onClose, onFinish }: {
  job: RepairJob;
  onClose: () => void;
  onFinish: (data: FinishJobData) => void;
}) {
  const [actionTaken,    setActionTaken]    = useState("");
  const [checkedByInput, setCheckedByInput] = useState("");
  const [checkedByList,  setCheckedByList]  = useState<string[]>([]);
  const [jobStatus,      setJobStatus]      = useState<JobStatus | "">("");
  const [advance,        setAdvance]        = useState(job.advancePaid.toString());
  const [totalPrice,     setTotalPrice]     = useState(job.estimatedCost.toString());
  const [partsCost,      setPartsCost]      = useState("0");
  const [warranty,       setWarranty]       = useState("");

  const addCheckedBy = () => {
    const name = checkedByInput.trim().toUpperCase();
    if (name && !checkedByList.includes(name)) {
      setCheckedByList(prev => [...prev, name]);
      setCheckedByInput("");
    }
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(520px, calc(100vw - 24px))", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Finish Job</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id} · {job.brand} {job.model} · {job.customerName}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Action taken</label>
              <textarea value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="Describe the action taken..." rows={5}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, resize: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Checked by</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input value={checkedByInput} onChange={(e) => setCheckedByInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheckedBy(); } }}
                  placeholder="Name"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                />
                <button onClick={addCheckedBy} style={{ padding: "7px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>add</button>
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, minHeight: 80, padding: "6px 10px", background: "var(--bg-primary)" }}>
                {checkedByList.length === 0
                  ? <p style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", paddingTop: 2 }}>No names added</p>
                  : checkedByList.map((n, i) => <p key={i} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", padding: "2px 0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{n}</p>)
                }
              </div>
            </div>
          </div>

          <div>
            <label style={labelSt}>Job status</label>
            <select value={jobStatus} onChange={(e) => setJobStatus(e.target.value as JobStatus)}
              style={{ ...inputSt, cursor: "pointer", color: jobStatus ? "var(--text-primary)" : "var(--text-muted)" }}>
              <option value="">-- Select --</option>
              {(["Non-Issued", "Issued", "Pending", "Completed", "Cancelled"] as JobStatus[]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><label style={labelSt}>Advance</label><input type="number" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>Total price</label><input type="number" min={0} value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>Part(s) cost</label><input type="number" min={0} value={partsCost} onChange={(e) => setPartsCost(e.target.value)} style={inputSt} /></div>
          </div>

          <div>
            <label style={labelSt}>Select warranty (Optional)</label>
            <select value={warranty} onChange={(e) => setWarranty(e.target.value)}
              style={{ ...inputSt, cursor: "pointer", color: warranty ? "var(--text-primary)" : "var(--text-muted)" }}>
              <option value="">-- SELECT --</option>
              {["1 Month", "3 Months", "6 Months", "1 Year", "2 Years"].map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button
            onClick={() => onFinish({ actionTaken, checkedBy: checkedByList, jobStatus: jobStatus as JobStatus, advance: parseFloat(advance) || 0, totalPrice: parseFloat(totalPrice) || 0, partsCost: parseFloat(partsCost) || 0, warranty })}
            disabled={!jobStatus}
            style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: jobStatus ? "pointer" : "not-allowed", opacity: jobStatus ? 1 : 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >Finish job</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Jobs Table ───────────────────────────────────────────────────────────────

interface JobsTableProps {
  filterStatus?: JobStatus | "All";
  title: string;
}

export default function JobsTable({ filterStatus = "All" }: JobsTableProps) {
  const [allJobs,        setAllJobs]        = useState<RepairJob[]>(INITIAL_JOBS);
  const [search,         setSearch]         = useState("");
  const [showFilters,    setShowFilters]    = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [brandFilter,    setBrandFilter]    = useState("All");
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [detailsJob,     setDetailsJob]     = useState<RepairJob | null>(null);
  const [finishJob,      setFinishJob]      = useState<RepairJob | null>(null);
  const [issueJobTarget, setIssueJobTarget] = useState<RepairJob | null>(null);
  const [invoiceData,    setInvoiceData]    = useState<IssueInvoiceData | null>(null);

  const jobs = allJobs.filter(j => {
    const matchStatus   = filterStatus === "All" || j.status === filterStatus;
    const matchSearch   = !search || j.customerName.toLowerCase().includes(search.toLowerCase()) || j.id.toLowerCase().includes(search.toLowerCase()) || j.model.toLowerCase().includes(search.toLowerCase()) || j.brand.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "All" || j.priority === priorityFilter;
    const matchBrand    = brandFilter === "All" || j.brand === brandFilter;
    return matchStatus && matchSearch && matchPriority && matchBrand;
  });

  const handleFinish = (data: FinishJobData) => {
    setAllJobs(prev => prev.map(j =>
      j.id === finishJob!.id ? { ...j, status: data.jobStatus, advancePaid: data.advance, estimatedCost: data.totalPrice } : j
    ));
    setFinishJob(null);
  };

  const openFinish = (job: RepairJob) => { setDetailsJob(null); setFinishJob(job); };
  const openIssueJob = (job: RepairJob) => { setDetailsJob(null); setIssueJobTarget(job); };

  const handleIssueComplete = (data: Omit<IssueInvoiceData, "job" | "invoiceNo" | "createdAt">) => {
    const invoiceNo = Date.now().toString().slice(-10).padStart(10, "0");
    const createdAt = new Date().toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });
    setAllJobs(prev => prev.map(j =>
      j.id === issueJobTarget!.id
        ? { ...j, status: "Issued", imei: data.imei, jobWarranty: data.warranty, advancePaid: data.paidAmount }
        : j
    ));
    setInvoiceData({ job: issueJobTarget!, ...data, invoiceNo, createdAt });
    setIssueJobTarget(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: searchFocused ? "var(--accent)" : "var(--text-muted)", transition: "color 0.18s", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search by name, ID, device..."
            style={{ width: "100%", background: "var(--bg-card)", border: `1px solid ${searchFocused ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "10px 14px 10px 36px", fontSize: 13.5, color: "var(--text-primary)", outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "border-color 0.18s" }}
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: `1px solid ${showFilters ? "var(--accent-glow)" : "var(--border)"}`, background: showFilters ? "var(--accent-dim)" : "var(--bg-card)", color: showFilters ? "var(--accent)" : "var(--text-secondary)", fontSize: 13.5, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.18s" }}
        >
          <Filter size={14} />Filters
          <ChevronDown size={13} style={{ transform: showFilters ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </button>
        <div style={{ marginLeft: "auto" }}>
          <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
          </span>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 20, alignItems: "flex-end", animation: "fadeUp 0.2s ease both" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block", marginBottom: 6 }}>Priority</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Low", "Normal", "High", "Urgent"].map(p => (
                <button key={p} onClick={() => setPriorityFilter(p)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, border: `1px solid ${priorityFilter === p ? "var(--accent-glow)" : "var(--border)"}`, background: priorityFilter === p ? "var(--accent-dim)" : "transparent", color: priorityFilter === p ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block", marginBottom: 6 }}>Brand</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Apple", "Samsung", "Xiaomi", "Oppo", "OnePlus", "Huawei"].map(b => (
                <button key={b} onClick={() => setBrandFilter(b)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, border: `1px solid ${brandFilter === b ? "var(--accent-glow)" : "var(--border)"}`, background: brandFilter === b ? "var(--accent-dim)" : "transparent", color: brandFilter === b ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}>{b}</button>
              ))}
            </div>
          </div>
          <button onClick={() => { setPriorityFilter("All"); setBrandFilter("All"); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="table-scroll">
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Job ID", "Dealer Name", "Customer", "Device", "Issue", "Technician", "Status", "Priority", "Est. Cost", "Advance", "Balance", "Date"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11.5, color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--bg-secondary)" }}>{h}</th>
              ))}
              <th style={{ padding: "12px 16px", background: "var(--bg-secondary)" }} />
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={13} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No jobs found</td></tr>
            ) : jobs.map((job, i) => {
              const sc = statusConfig[job.status];
              const StatusIcon = sc.icon;
              const balance = job.estimatedCost - job.advancePaid;
              return (
                <tr key={job.id} style={{ borderBottom: i < jobs.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                >
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.id}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{job.dealer || "MANO MOBILE"}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{job.customerName}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{job.phone}</p>
                  </td>
                  <td style={{ padding: "14px 16px" }}><p style={{ fontSize: 13, color: "var(--text-primary)" }}>{job.brand} {job.model}</p></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{job.issue}</span></td>
                  <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{job.technician}</span></td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                      <StatusIcon size={10} strokeWidth={2.5} />{job.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: priorityColor[job.priority] }}>● {job.priority}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Rs. {job.estimatedCost.toLocaleString()}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {job.advancePaid > 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#4ade80", padding: "2px 8px", borderRadius: 6, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
                        <CheckCircle size={10} strokeWidth={2.5} />Rs. {job.advancePaid.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 13, color: balance > 0 ? "#f87171" : "#4ade80", fontWeight: 600 }}>Rs. {balance.toLocaleString()}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{job.createdAt}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() => setDetailsJob(job)}
                      style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-glow)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-dim)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {/* Modals */}
      {detailsJob && (
        <JobDetailsModal
          job={detailsJob}
          allJobs={allJobs}
          onClose={() => setDetailsJob(null)}
          onFinishJob={() => openFinish(detailsJob)}
          onIssueJob={() => openIssueJob(detailsJob)}
        />
      )}
      {finishJob && (
        <FinishJobModal job={finishJob} onClose={() => setFinishJob(null)} onFinish={handleFinish} />
      )}
      {issueJobTarget && (
        <IssueJobModal job={issueJobTarget} onClose={() => setIssueJobTarget(null)} onIssued={handleIssueComplete} />
      )}
      {invoiceData && (
        <RepairInvoicePreview data={invoiceData} onClose={() => setInvoiceData(null)} />
      )}
    </div>
  );
}
