"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, AlertTriangle, Play, Pause, CheckCircle,
  XCircle, ArrowRight, Shield, CheckSquare,
} from "lucide-react";
import { type RepairJob, type JobStatus, useRepair } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

const STATUS_CFG: Record<JobStatus, { label: string; color: string; bg: string; border: string }> = {
  "Non-Issued": { label: "Not Started", color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
  "Issued":     { label: "In Progress", color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.25)"  },
  "Pending":    { label: "Paused",       color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)"  },
  "Completed":  { label: "Completed",   color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)"  },
  "Delivered":  { label: "Delivered",   color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)" },
  "Cancelled":  { label: "Cancelled",   color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
};

const PAUSE_REASONS = [
  "Waiting for parts to arrive",
  "Waiting for customer approval",
  "Switched to higher priority job",
  "Needs further diagnosis",
  "Waiting for software download",
];

const ALLOWED_NEXT: Partial<Record<JobStatus, JobStatus[]>> = {
  "Non-Issued": ["Issued"],
  "Issued":     ["Pending", "Completed"],
  "Pending":    ["Issued"],
};

const FUNCTIONAL_TESTS = [
  "Powers on / off normally",
  "Touchscreen responsive",
  "Phone calls (earpiece & mic)",
  "WiFi connection",
  "Bluetooth",
  "Front camera",
  "Rear camera",
  "Charging",
  "Loudspeaker",
  "Volume & power buttons",
  "Fingerprint / Face ID",
];

const WARRANTY_OPTIONS = [
  { days: 0,   label: "No Warranty"  },
  { days: 7,   label: "7 Days"       },
  { days: 30,  label: "30 Days"      },
  { days: 90,  label: "90 Days"      },
  { days: 180, label: "6 Months"     },
  { days: 365, label: "1 Year"       },
];

function StatusBadge({ status }: { status: JobStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 6, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, fontFamily: ff, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

export default function StatusUpdateModal({ job, onClose }: { job: RepairJob; onClose: () => void }) {
  const { jobs, updateJob } = useRepair();
  const { technicianName, setJobMeta, getElapsedMinutes, diagnostics, addActivity, saveFunctionalTest, saveWarranty } = useTech();

  const [selectedNext, setSelectedNext] = useState<JobStatus | null>(null);
  const [pauseReason, setPauseReason]   = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmed, setConfirmed]       = useState(false);

  // Functional test state (shown when completing)
  const [testResults, setTestResults]   = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(FUNCTIONAL_TESTS.map(t => [t, null]))
  );
  const [testNotes, setTestNotes]       = useState("");
  const [warrantyDays, setWarrantyDays] = useState(30);

  const conflictJob = selectedNext === "Issued"
    ? jobs.find(j => j.technician === technicianName && j.status === "Issued" && j.id !== job.id)
    : undefined;

  const hasDiagnostic = !!diagnostics[job.id];
  const allowed = ALLOWED_NEXT[job.status] ?? [];

  const testsPassed = Object.values(testResults).filter(v => v === true).length;
  const testsFailed = Object.values(testResults).filter(v => v === false).length;
  const testsTotal  = FUNCTIONAL_TESTS.length;

  const canSubmit = (() => {
    if (!selectedNext) return false;
    if (selectedNext === "Pending")   return pauseReason.trim().length > 3;
    if (selectedNext === "Completed") return completionNotes.trim().length > 5;
    if (selectedNext === "Cancelled") return cancelReason.trim().length > 3;
    return true;
  })();

  const handleSubmit = () => {
    if (!selectedNext || !canSubmit) return;

    if (conflictJob) {
      updateJob(conflictJob.id, { status: "Pending" });
      setJobMeta(conflictJob.id, { lastPausedAt: new Date(), pauseReason: "Switched to another job" });
    }

    const now = new Date();

    if (selectedNext === "Issued") {
      const elapsed = getElapsedMinutes(job.id);
      setJobMeta(job.id, { startedAt: now, lastPausedAt: undefined, pauseReason: undefined, accumulatedMinutes: elapsed });
      addActivity({ jobId: job.id, type: "status_change", description: `Job started${hasDiagnostic ? " (diagnostic on record)" : " (no pre-repair diagnostic)"}` });
    } else if (selectedNext === "Pending") {
      setJobMeta(job.id, { lastPausedAt: now, pauseReason: pauseReason.trim() });
      addActivity({ jobId: job.id, type: "status_change", description: `Job paused — ${pauseReason.trim()}` });
    } else if (selectedNext === "Completed") {
      setJobMeta(job.id, { completedAt: now, completionNotes, lastPausedAt: now });
      // Save functional test
      const overallPass = testsFailed === 0;
      saveFunctionalTest({ jobId: job.id, completedAt: now, results: testResults, overallPass, notes: testNotes || undefined });
      // Save warranty
      if (warrantyDays > 0) {
        const expiresAt = new Date(now.getTime() + warrantyDays * 86_400_000);
        saveWarranty({ jobId: job.id, issuedAt: now, durationDays: warrantyDays, expiresAt });
        addActivity({ jobId: job.id, type: "warranty_issued", description: `Warranty issued: ${WARRANTY_OPTIONS.find(w => w.days === warrantyDays)?.label}` });
      }
      addActivity({ jobId: job.id, type: "test_completed", description: `Functional tests: ${testsPassed}/${testsTotal} passed${testsFailed > 0 ? `, ${testsFailed} failed` : ""}` });
      addActivity({ jobId: job.id, type: "status_change", description: `Job completed. ${completionNotes.slice(0, 80)}${completionNotes.length > 80 ? "…" : ""}` });
    }

    updateJob(job.id, { status: selectedNext });
    setConfirmed(true);
    setTimeout(onClose, 1400);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text-primary)",
    fontFamily: ff, outline: "none", resize: "none" as const,
  };

  const sec = (label: string) => (
    <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{label}</p>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 28px 24px", width: 520, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", fontFamily: ff }}>

        {/* Success */}
        {confirmed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${TA}14`, border: `2px solid ${TA}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={26} color={TA} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Status Updated</p>
            <StatusBadge status={selectedNext!} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3, fontFamily: ff }}>Update Job Status</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.brand} {job.model}</p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6 }}><X size={16} /></button>
            </div>

            {/* Diagnostic warning (start job) */}
            {!hasDiagnostic && job.status === "Non-Issued" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.55 }}>
                  <strong style={{ color: "#fbbf24" }}>No diagnostic on record.</strong> Consider running a pre-repair diagnostic before starting.
                </p>
              </div>
            )}

            {/* Status flow */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>Current</p>
                <StatusBadge status={job.status} />
              </div>
              <ArrowRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>New Status</p>
                {selectedNext ? <StatusBadge status={selectedNext} /> : <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Choose below</span>}
              </div>
            </div>

            {/* Transition buttons */}
            {allowed.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sec("Available Transitions")}
                {allowed.map(next => {
                  const cfg = STATUS_CFG[next];
                  const isSelected = selectedNext === next;
                  const icons: Record<string, any> = { Issued: Play, Pending: Pause, Completed: CheckCircle, Cancelled: XCircle };
                  const Icon = icons[next] ?? ArrowRight;
                  return (
                    <button key={next} onClick={() => setSelectedNext(next)} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10,
                      background: isSelected ? `${cfg.color}10` : "var(--bg-secondary)",
                      border: `1px solid ${isSelected ? cfg.color + "40" : "var(--border)"}`,
                      cursor: "pointer", transition: "all 0.15s", fontFamily: ff, textAlign: "left",
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                        <Icon size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{cfg.label}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
                          {next === "Issued"    && "Start / resume working on this job"}
                          {next === "Pending"   && "Pause this job — requires a reason"}
                          {next === "Completed" && "Mark as finished — includes QC checklist & warranty"}
                          {next === "Cancelled" && "Cancel this job — requires reason"}
                        </p>
                      </div>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSelected ? cfg.color : "var(--border)"}`, background: isSelected ? cfg.color : "transparent", flexShrink: 0, transition: "all 0.15s" }} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Conflict warning */}
            {conflictJob && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3, fontFamily: ff }}>Active Job Conflict</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55, fontFamily: ff }}>
                    <strong style={{ color: "var(--text-primary)" }}>{conflictJob.id}</strong> ({conflictJob.brand} {conflictJob.model}) is active and will be automatically <strong style={{ color: "#fbbf24" }}>paused</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* ── Pause inputs ── */}
            {selectedNext === "Pending" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sec("Pause Reason *")}
                <input list="pause-reason-list" value={pauseReason} onChange={e => setPauseReason(e.target.value)}
                  placeholder="Select a suggestion or type your own…" style={inputStyle} autoComplete="off" />
                <datalist id="pause-reason-list">{PAUSE_REASONS.map(r => <option key={r} value={r} />)}</datalist>
                <p style={{ fontSize: 11, color: pauseReason.trim().length > 3 ? TA : "var(--text-muted)", fontFamily: ff }}>
                  {pauseReason.trim().length} chars {pauseReason.trim().length > 3 ? "✓" : "(min 4)"}
                </p>
              </div>
            )}

            {/* ── Completion: work notes + functional tests + warranty ── */}
            {selectedNext === "Completed" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Work summary */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sec("Work Summary * (required)")}
                  <textarea placeholder="Describe all work performed — parts replaced, tests done, issues found…" value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={3} style={inputStyle} />
                  <p style={{ fontSize: 11, color: completionNotes.trim().length > 5 ? TA : "var(--text-muted)", fontFamily: ff }}>
                    {completionNotes.trim().length} chars {completionNotes.trim().length > 5 ? "✓" : "(min 6)"}
                  </p>
                </div>

                {/* Functional tests */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckSquare size={13} color={TA} />
                    {sec("Functional Test Checklist")}
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: testsFailed > 0 ? "#f87171" : TA, fontFamily: ff }}>
                      {testsPassed}/{testsTotal} passed
                    </span>
                  </div>
                  <div style={{ background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", padding: "4px 0" }}>
                    {FUNCTIONAL_TESTS.map(test => {
                      const v = testResults[test];
                      return (
                        <div key={test} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff }}>{test}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {([true, false, null] as const).map((s, i) => {
                              const isActive = v === s;
                              const col = s === true ? TA : s === false ? "#f87171" : "#94a3b8";
                              const label = s === true ? "✓" : s === false ? "✕" : "—";
                              return (
                                <button key={i} onClick={() => setTestResults(prev => ({ ...prev, [test]: s }))} style={{
                                  width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 700,
                                  border: `1px solid ${isActive ? col + "50" : "var(--border)"}`,
                                  background: isActive ? col + "14" : "var(--bg-card)",
                                  color: isActive ? col : "var(--text-muted)",
                                  cursor: "pointer", transition: "all 0.12s",
                                }}>{label}</button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <textarea placeholder="Test notes (optional)…" value={testNotes} onChange={e => setTestNotes(e.target.value)} rows={2} style={inputStyle} />
                </div>

                {/* Warranty */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Shield size={13} color="#a78bfa" />
                    {sec("Warranty")}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {WARRANTY_OPTIONS.map(o => (
                      <button key={o.days} onClick={() => setWarrantyDays(o.days)} style={{
                        padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: `1px solid ${warrantyDays === o.days ? "#a78bfa50" : "var(--border)"}`,
                        background: warrantyDays === o.days ? "rgba(167,139,250,0.12)" : "var(--bg-secondary)",
                        color: warrantyDays === o.days ? "#a78bfa" : "var(--text-muted)",
                        cursor: "pointer", fontFamily: ff, transition: "all 0.12s",
                      }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Cancel reason ── */}
            {selectedNext === "Cancelled" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sec("Cancellation Reason *")}
                <textarea placeholder="Reason for cancellation…" value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} style={inputStyle} />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
              <button onClick={handleSubmit} disabled={!canSubmit} style={{
                padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: canSubmit ? TA : "var(--bg-secondary)",
                border: `1px solid ${canSubmit ? TA : "var(--border)"}`,
                color: canSubmit ? "#000" : "var(--text-muted)",
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontFamily: ff, transition: "all 0.15s",
              }}>Confirm Update</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
