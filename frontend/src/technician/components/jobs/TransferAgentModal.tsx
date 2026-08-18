"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, AlertCircle, Building2 } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { useAgents, transferJobToAgent } from "@/lib/repair/agents";
import { useToast } from "@/lib/ui/toast";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * Send a repair out to an external agent.
 *
 * Raised from the technician's own queue — they are the one who finds the job
 * is beyond in-house repair. The agent list is maintained by Admin, so this
 * only picks from it.
 */
export default function TransferAgentModal({
  job, technicianName, onClose, onTransferred,
}: {
  job: RepairJob;
  technicianName: string;
  onClose: () => void;
  onTransferred: (agentName: string, reason: string) => void;
}) {
  const { agents, loading, configured } = useAgents();
  const [agentId, setAgentId] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [agreedCost, setAgreedCost] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const activeAgents = agents.filter(a => a.active);

  const submit = async () => {
    if (agentId === "") { setError("Choose the agent this device is going to."); return; }
    if (!reason.trim()) { setError("Say why it is being sent out — it goes on the job record."); return; }

    setBusy(true);
    setError(null);
    const agent = agents.find(a => a.id === agentId);
    try {
      if (configured) {
        await transferJobToAgent({
          jobId: job.id,
          agentId: agentId as number,
          reason: reason.trim(),
          expectedReturn: expectedReturn || undefined,
          agreedCost: agreedCost ? parseFloat(agreedCost) : undefined,
          sentBy: technicianName,
        });
      }
      toast.dialog("success", `${job.id} sent out`, `The device is now with ${agent?.name ?? "the agent"}.`);
      onTransferred(agent?.name ?? "external agent", reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: 13, fontFamily: ff, outline: "none", boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em",
    textTransform: "uppercase", marginBottom: 5, display: "block", fontFamily: ff,
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        width: "min(480px, calc(100vw - 24px))", maxHeight: "90vh", overflow: "auto",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Building2 size={16} color={TA} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Transfer to Repair Agent</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{job.id} · {job.brand} {job.model}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, width: 28, height: 28, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label}>Repair Agent *</label>
            {loading ? (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading agents…</p>
            ) : activeAgents.length === 0 ? (
              <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: 9, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
                <AlertCircle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  No active repair agents. An admin adds them under{" "}
                  <strong>Admin Control → Repair Agents</strong>.
                </p>
              </div>
            ) : (
              <select
                value={agentId}
                onChange={e => setAgentId(e.target.value ? Number(e.target.value) : "")}
                style={{ ...input, cursor: "pointer" }}
              >
                <option value="">— Choose an agent —</option>
                {activeAgents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.speciality ? ` · ${a.speciality}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label style={label}>Reason for sending out *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. IC-level fault — needs microscope rework"
              style={{ ...input, resize: "vertical", minHeight: 66 }}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Expected back</label>
              <input type="date" value={expectedReturn} onChange={e => setExpectedReturn(e.target.value)} style={input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Agreed cost (LKR)</label>
              <input type="number" min={0} value={agreedCost} onChange={e => setAgreedCost(e.target.value)} placeholder="0.00" style={input} />
            </div>
          </div>

          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            The job stays yours and moves to <strong>Pending</strong> while it is out, so the counter can
            see where the device actually is.
          </p>

          {error && (
            <div style={{ display: "flex", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
              <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600 }}>{error}</p>
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || activeAgents.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, border: "none",
              background: TA, color: "#04231a", fontSize: 13, fontWeight: 700,
              cursor: busy || activeAgents.length === 0 ? "not-allowed" : "pointer",
              opacity: busy || activeAgents.length === 0 ? 0.6 : 1, fontFamily: ff,
            }}
          >
            <Send size={13} /> {busy ? "Sending…" : "Send to Agent"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
