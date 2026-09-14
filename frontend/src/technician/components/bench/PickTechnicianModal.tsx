"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Play, AlertCircle, Wrench } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { useTechnicians, useDefaultTechnician } from "@/lib/repair/technicians";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * Who is doing this one?
 *
 * Asked on the whole-shop bench the moment an unassigned job is started, not
 * when it is finished. The name has to be on the job from the first minute:
 * that is what puts it in the technician's own In progress section while they
 * are logged in beside the cashier, what makes it land in their Finished when
 * it is done, and what their rate and their numbers are read from. Naming the
 * technician at the end would have had the job sitting under nobody for the
 * whole time it was on the bench.
 *
 * Pre-selects the shop's default technician, so in a one-technician shop this
 * is one press.
 */
export default function PickTechnicianModal({ job, onPick, onClose, busy = false, error = null }: {
  job: RepairJob;
  onPick: (technicianName: string) => void;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { technicians, loading } = useTechnicians();
  const fallback = useDefaultTechnician(technicians);
  // What the cashier chose, or nothing yet. The default is applied when it is
  // read, not written into state: a choice already made wins, and the default
  // arriving a beat later fills only an empty box.
  const [chosen, setChosen] = useState("");
  const picked = chosen || fallback || "";
  const setPicked = setChosen;

  const active = technicians.filter(t => t.available);

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 9,
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: 13.5, fontFamily: ff, outline: "none", boxSizing: "border-box",
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
        width: "min(440px, calc(100vw - 24px))",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Wrench size={16} color={TA} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Who is doing this repair?</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{job.id} · {[job.brand, job.model].filter(Boolean).join(" ")}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, width: 28, height: 28, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading technicians…</p>
          ) : (
            <select value={picked} onChange={e => setPicked(e.target.value)} style={{ ...input, cursor: "pointer" }} autoFocus>
              <option value="">— Choose the technician —</option>
              {active.map(t => (
                <option key={t.id} value={t.name}>{t.name}{t.speciality ? ` · ${t.speciality}` : ""}</option>
              ))}
            </select>
          )}
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            The job goes onto their bench and starts now. It shows in <strong>their</strong> In progress —
            and in their Finished when it is done — and their rate fills in the charge. You are recorded
            as the one who started it.
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
            onClick={() => picked && onPick(picked)}
            disabled={busy || !picked}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, border: "none",
              background: TA, color: "#04231a", fontSize: 13, fontWeight: 700, fontFamily: ff,
              cursor: busy || !picked ? "not-allowed" : "pointer", opacity: busy || !picked ? 0.55 : 1,
            }}
          >
            <Play size={13} /> {busy ? "Starting…" : "Start the job"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
