"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, PackageCheck, AlertCircle, Building2 } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { markTransferReturned, type AgentTransfer } from "@/lib/repair/agents";
import { useToast } from "@/lib/ui/toast";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;

/**
 * Take a device back in from an outside workshop.
 *
 * The charge is asked for here because here is the only moment somebody is
 * holding the agent's slip. A repair whose outside cost gets typed in a week
 * later is a repair that was priced without it — and the price is quoted to
 * the customer long before then.
 *
 * The quote is shown beside the field rather than pre-filled into it. Pre-
 * filling would make the agreed figure the default answer, and the whole reason
 * for a second number is that the two are sometimes different.
 */
export default function ReceiveFromAgentModal({
  transfer, job, technicianName, onClose, onReceived,
}: {
  transfer: AgentTransfer;
  job: RepairJob | undefined;
  technicianName: string;
  onClose: () => void;
  onReceived: () => void;
}) {
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [fixed, setFixed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const typed = cost.trim() === "" ? null : Number(cost);

  const submit = async () => {
    if (typed !== null && (!isFinite(typed) || typed < 0)) {
      setError("The charge has to be a number, or left empty if it is not known yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await markTransferReturned(transfer.id, {
        actualCost: typed,
        // Whether it came back fixed belongs on the record: an unrepaired
        // return is the reason a job goes back to the bench rather than
        // straight to the counter, and it still cost whatever the agent charged.
        notes: [fixed ? "Repaired" : "Returned unrepaired", notes.trim()].filter(Boolean).join(" — "),
        receivedBy: technicianName,
      });
      toast.dialog(
        "success",
        `${transfer.jobId} is back in the shop`,
        typed !== null
          ? `Received from ${transfer.agentName ?? "the agent"} at ${rs(typed)}.`
          : `Received from ${transfer.agentName ?? "the agent"}.`,
      );
      onReceived();
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
        width: "min(470px, calc(100vw - 24px))", maxHeight: "90vh", overflow: "auto",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <PackageCheck size={16} color={TA} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Receive from Agent</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {transfer.jobId}{job ? ` · ${[job.brand, job.model].filter(Boolean).join(" ")}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, width: 28, height: 28, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 9, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.28)" }}>
            <Building2 size={13} color="#a78bfa" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Sent to <strong style={{ color: "var(--text-primary)" }}>{transfer.agentName ?? "an agent"}</strong>
              {" "}on {new Date(transfer.sentAt).toLocaleDateString("en-GB")}
              {transfer.reason ? ` — ${transfer.reason}` : ""}
            </p>
          </div>

          <div>
            <label style={label}>What the agent charged (LKR)</label>
            <input
              type="number"
              min={0}
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder={transfer.agreedCost != null ? String(transfer.agreedCost) : "0.00"}
              style={input}
              autoFocus
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5, lineHeight: 1.5 }}>
              {transfer.agreedCost != null
                ? <>Quoted {rs(transfer.agreedCost)} when it went out. Enter what was actually charged — the quote is kept either way.</>
                : <>No cost was agreed when it went out. Leave empty if the bill has not come yet.</>}
            </p>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <input type="checkbox" checked={fixed} onChange={e => setFixed(e.target.checked)} style={{ width: 15, height: 15, accentColor: TA, cursor: "pointer" }} />
            <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>The agent repaired it</span>
          </label>
          {!fixed && (
            <p style={{ fontSize: 11.5, color: "#fbbf24", lineHeight: 1.5, marginTop: -6 }}>
              Recorded as returned unrepaired. The charge, if there was one, still counts against the job.
            </p>
          )}

          <div>
            <label style={label}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. board reballed, 30-day guarantee from the agent"
              style={{ ...input, resize: "vertical", minHeight: 60 }}
            />
          </div>

          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            The job comes back to your bench <strong>in progress</strong>, and the charge is added to what
            this repair has cost — alongside parts and your own labour.
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
            disabled={busy}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, border: "none",
              background: TA, color: "#04231a", fontSize: 13, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: ff,
            }}
          >
            <PackageCheck size={13} /> {busy ? "Receiving…" : "Mark received"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
