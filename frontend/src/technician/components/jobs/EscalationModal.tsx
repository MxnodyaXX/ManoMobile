"use client";

import { useState } from "react";
import { X, AlertTriangle, CheckCircle } from "lucide-react";
import { useTech, type EscalationPriority } from "@/technician/contexts/TechContext";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

const PRIORITY_CFG: Record<EscalationPriority, { color: string; bg: string; border: string }> = {
  Low:    { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)" },
  Medium: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
  High:   { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
};

const REASONS = [
  "Board-level fault beyond my skill level",
  "Requires specialist equipment not available",
  "Unusual software issue — needs senior tech",
  "Customer is disputing the quote",
  "Conflicting diagnosis — needs second opinion",
  "Possible counterfeit part detected",
  "Safety concern with the device",
];

interface Props { job: RepairJob; onClose: () => void; }

export default function EscalationModal({ job, onClose }: Props) {
  const { escalations, raiseEscalation, resolveEscalation, addActivity } = useTech();
  const activeEsc = escalations.find(e => e.jobId === job.id && !e.resolved);

  const [reason, setReason]       = useState("");
  const [priority, setPriority]   = useState<EscalationPriority>("Medium");
  const [done, setDone]           = useState(false);

  const submit = () => {
    if (!reason.trim()) return;
    raiseEscalation({ jobId: job.id, reason: reason.trim(), priority });
    addActivity({ jobId: job.id, type: "escalated", description: `Escalated (${priority}): ${reason.trim()}` });
    setDone(true);
  };

  const resolve = () => {
    if (!activeEsc) return;
    resolveEscalation(activeEsc.id);
    addActivity({ jobId: job.id, type: "escalation_resolved", description: `Escalation resolved: ${activeEsc.reason}` });
    onClose();
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 480, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 71,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={16} color="#f87171" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                {activeEsc ? "Active Escalation" : "Raise Escalation"}
              </p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.brand} {job.model}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ padding: "20px" }}>
          {done ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={22} color="#f87171" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Escalation Raised</p>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, textAlign: "center" }}>Admin has been notified. Continue monitoring this job.</p>
              <button onClick={onClose} style={{ marginTop: 8, padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: TA, border: "none", color: "#000", cursor: "pointer", fontFamily: ff }}>Done</button>
            </div>
          ) : activeEsc ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: "12px 14px", background: "rgba(248,113,113,0.08)", borderRadius: 10, border: "1px solid rgba(248,113,113,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.06em" }}>Active Escalation</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, fontFamily: ff,
                    color: PRIORITY_CFG[activeEsc.priority].color, background: PRIORITY_CFG[activeEsc.priority].bg, border: `1px solid ${PRIORITY_CFG[activeEsc.priority].border}`,
                  }}>{activeEsc.priority}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: ff, marginBottom: 4 }}>{activeEsc.reason}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Raised: {activeEsc.raisedAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <button onClick={resolve} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: TA, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <CheckCircle size={14} /> Mark as Resolved
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Priority */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Priority</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["Low", "Medium", "High"] as EscalationPriority[]).map(p => {
                    const c = PRIORITY_CFG[p];
                    return (
                      <button key={p} onClick={() => setPriority(p)} style={{
                        flex: 1, padding: "9px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                        border: `1px solid ${priority === p ? c.border : "var(--border)"}`,
                        background: priority === p ? c.bg : "var(--bg-secondary)",
                        color: priority === p ? c.color : "var(--text-muted)",
                        cursor: "pointer", fontFamily: ff, transition: "all 0.12s",
                      }}>{p}</button>
                    );
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Reason</p>
                <input list="esc-reasons" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Select a suggestion or describe the issue…" autoComplete="off"
                  style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none", boxSizing: "border-box" }} />
                <datalist id="esc-reasons">{REASONS.map(r => <option key={r} value={r} />)}</datalist>
              </div>

              <button onClick={submit} disabled={!reason.trim()} style={{
                width: "100%", padding: "11px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, fontFamily: ff,
                background: reason.trim() ? "#f87171" : "var(--bg-secondary)",
                color: reason.trim() ? "#fff" : "var(--text-muted)",
                cursor: reason.trim() ? "pointer" : "not-allowed",
              }}>
                Raise Escalation
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
