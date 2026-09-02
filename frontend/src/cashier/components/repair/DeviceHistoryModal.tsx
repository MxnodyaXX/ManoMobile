"use client";

import { createPortal } from "react-dom";
import { X, History, Smartphone, AlertCircle } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

/**
 * Everything this handset has been through, newest first.
 *
 * Shown at intake the moment an IMEI turns out to be one the shop has seen
 * before. A returning device changes the conversation — whether it is the same
 * fault, whether it is still under warranty, whether the last repair held — and
 * all of that has to be readable before the new job is written, not after.
 *
 * Read-only on purpose. This is the record of what happened; correcting it
 * belongs on the job itself, where the change is attributable.
 */

const ff = "'Plus Jakarta Sans', sans-serif";

const STATUS_TONE: Record<string, string> = {
  "Non-Issued": "var(--text-muted)",
  "Issued":     "var(--accent)",
  "Pending":    "var(--warning)",
  "Completed":  "var(--success)",
  "Delivered":  "var(--success)",
  "Cancelled":  "var(--danger)",
};

const rs = (n?: number) => `Rs. ${Math.round(n ?? 0).toLocaleString()}`;

const day = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function DeviceHistoryModal({ imei, jobs, onClose }: {
  imei: string;
  jobs: RepairJob[];
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  const row = (label: string, value: React.ReactNode, tone?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "5px 0" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: tone ?? "var(--text-primary)", fontFamily: ff, textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(680px, calc(100vw - 24px))", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <History size={14} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                Repair history · {jobs.length} {jobs.length === 1 ? "previous repair" : "previous repairs"}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>IMEI {imei}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {jobs.map((j, i) => {
            const tone = STATUS_TONE[j.status] ?? "var(--text-secondary)";
            const handover = j.handover as { handedOverAt?: string } | undefined;
            return (
              <div key={j.id} style={{
                border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden",
                background: "var(--bg-secondary)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                  <Smartphone size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text-primary)", fontFamily: ff }}>{j.id}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>
                    {j.brand} {j.model}
                  </span>
                  <span style={{
                    marginLeft: "auto", fontSize: 11, fontWeight: 700, color: tone,
                    padding: "3px 10px", borderRadius: 20, border: `1px solid ${tone}`,
                    fontFamily: ff, whiteSpace: "nowrap",
                  }}>
                    {j.status}{j.completionType ? ` · ${j.completionType}` : ""}
                  </span>
                  {/* The one that is almost always the reason this panel was
                      opened: is the phone in front of you the last one we did? */}
                  {i === 0 && jobs.length > 1 && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", fontFamily: ff }}>MOST RECENT</span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 22px", padding: "10px 14px 12px" }}>
                  <div>
                    {row("Customer", j.customerName || "—")}
                    {row("Contact", j.phone || "—")}
                    {row("Model number", j.modelNumber || "—")}
                    {row("Dealer", j.dealer || "—")}
                    {row("Technician", j.technician || "—")}
                    {row("Fault reported", j.issue || "—")}
                  </div>
                  <div>
                    {row("Received", day(j.createdAt))}
                    {row("Started", day(j.startedAt))}
                    {row("Completed", day(j.completedAt))}
                    {row("Returned", day(handover?.handedOverAt))}
                    {row("Charged", rs(j.estimatedCost))}
                    {row("Paid", rs(j.advancePaid), j.advancePaid > 0 ? "var(--success)" : undefined)}
                  </div>
                </div>

                {(j.partsUsed?.length || j.jobWarranty || j.techRemarks || j.futureFaults || j.cancelReason) && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                    {j.partsUsed?.length ? row("Parts used", j.partsUsed.join(", ")) : null}
                    {j.jobWarranty ? row("Warranty", j.jobWarranty, "var(--accent)") : null}
                    {j.labourCost != null ? row("Technician charge", rs(j.labourCost)) : null}
                    {j.techRemarks ? row("Work done", j.techRemarks) : null}
                    {j.futureFaults ? row("Faults noted then", j.futureFaults, "var(--warning)") : null}
                    {j.cancelReason ? row("Cancelled because", j.cancelReason, "var(--danger)") : null}
                  </div>
                )}
              </div>
            );
          })}

          {jobs.length === 0 && (
            <div style={{ display: "flex", gap: 9, padding: "12px 14px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <AlertCircle size={15} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.55 }}>
                No previous repairs found for this IMEI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
