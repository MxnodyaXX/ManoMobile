"use client";

import { createPortal } from "react-dom";
import { X, Eye } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import { useParts } from "@/cashier/contexts/PartsContext";

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n?: number) => `Rs. ${Math.round(n ?? 0).toLocaleString("en-LK")}`;
const day = (v?: string) => (v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/**
 * Somebody else's job, to look at and not to touch.
 *
 * Seeing across the workshop and being able to change it are two different
 * permissions. A technician covering the counter needs to answer "where is the
 * Nokia" without being able to start, pause or finish a repair that is on
 * another bench — the person holding that phone is the one who knows what
 * state it is in.
 *
 * So this has no buttons that do anything. Not disabled ones: absent ones. A
 * greyed-out Complete invites a second click and a question about why it is
 * refused, where nothing at all reads as what it is.
 */
export default function JobInfoModal({ job, onClose }: { job: RepairJob; onClose: () => void }) {
  const { activityLog } = useTech();
  const { partRequests } = useParts();

  // Keyed by job in the context, so no filtering — just the newest first.
  const history = (activityLog[job.id] ?? [])
    .slice()
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 12);

  const parts = partRequests.filter(r => r.jobId === job.id);

  const row = (k: string, v: React.ReactNode) => (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-primary)", textAlign: "right", minWidth: 0 }}>{v || "—"}</span>
    </div>
  );

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>{title}</p>
      {children}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 3200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ width: "min(560px, 100%)", maxHeight: "86vh", display: "flex", flexDirection: "column", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", fontFamily: ff }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <Eye size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              {job.dealerJobNo ? `#${job.dealerJobNo}` : job.id}
              <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)" }}> · {job.dealerJobNo ? job.id : job.status}</span>
            </p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>
              View only — this job is on {job.technician || "another"}&apos;s bench
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>

          {section("Device", (
            <>
              {row("Device", [job.brand, job.model].filter(Boolean).join(" "))}
              {row("Model number", job.modelNumber)}
              {row("IMEI", job.imei ? <span style={{ fontFamily: "monospace" }}>{job.imei}</span> : "")}
              {row("Reported fault", job.issue)}
            </>
          ))}

          {section("Customer", (
            <>
              {row("Name", job.customerName)}
              {row("Phone", job.phone)}
              {row("Dealer", job.dealer)}
            </>
          ))}

          {section("Progress", (
            <>
              {row("Status", job.status)}
              {row("Technician", job.technician)}
              {row("Priority", job.priority)}
              {row("Accepted", day(job.createdAt))}
              {row("Started", day(job.startedAt))}
              {row("Finished", day(job.completedAt))}
              {job.status === "Pending" && row("On hold because", job.pauseReason)}
              {row("Charged", rs(job.estimatedCost))}
            </>
          ))}

          {(job.techRemarks || job.futureFaults) && section("Remarks", (
            <>
              {row("Technician remarks", job.techRemarks)}
              {row("Future faults noted", job.futureFaults)}
            </>
          ))}

          {parts.length > 0 && section("Parts", (
            <>{parts.map(p => row(`${p.partName} × ${p.quantity}`, p.status))}</>
          ))}

          {history.length > 0 && section("Recent activity", (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {history.map(a => (
                <div key={a.id} style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, width: 108 }}>
                    {a.timestamp.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{a.description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12.5, fontFamily: ff }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
