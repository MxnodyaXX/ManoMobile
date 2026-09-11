"use client";

import { MoreHorizontal } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import type { BenchAction } from "@/technician/components/bench/BenchCard";
import { benchActions } from "@/technician/components/bench/benchActions";
import { isUnassigned } from "@/lib/repair/api";
import { hasOpenInquiry } from "@/lib/repair/inquiry";

const TA = "#34d399";
const AGENT = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;

const PRIORITY: Record<string, string> = {
  Low: "#94a3b8", Normal: "#60a5fa", High: "#fbbf24", Urgent: "#f87171",
};

/** Days past the date the shop promised, or 0 for work that is not open. */
function daysOverdue(job: RepairJob): number {
  if (!job.estimatedCompletion) return 0;
  if (!["Non-Issued", "Issued", "Pending"].includes(job.status)) return 0;
  const due = new Date(`${job.estimatedCompletion}T23:59:59`).getTime();
  if (isNaN(due)) return 0;
  return Math.max(0, Math.floor((Date.now() - due) / 86_400_000));
}

const fmtDate = (d?: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

/**
 * The bench as columns and rows.
 *
 * The fourth view, and the one for a question the other three answer badly:
 * not "what is this job" but "how do forty of them compare". Cards and tiles
 * put every field in a different place on every job, which is what makes them
 * good to work from and useless to scan down — a column of due dates can be
 * read in one pass, forty cards cannot.
 *
 * Which actions a row offers is not decided here. That lives in benchActions,
 * shared with the card, because a device out at an agent must not offer Resume
 * on one view and not the other.
 */
export default function BenchTable({
  jobs, onAction, showTechnician = false, technicianName, shopWide = false,
  transferFor, partsPendingFor,
}: {
  jobs: RepairJob[];
  onAction: (action: BenchAction, job: RepairJob) => void;
  showTechnician?: boolean;
  technicianName: string;
  shopWide?: boolean;
  /** The open transfer for a job, when the device is out at an agent. */
  transferFor: (jobId: string) => { agentName: string | null } | null | undefined;
  partsPendingFor: (jobId: string) => number;
}) {
  const th: React.CSSProperties = {
    position: "sticky", top: 0, zIndex: 1,
    padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap",
    fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
    color: "var(--text-muted)", background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)", fontFamily: ff,
  };
  const td: React.CSSProperties = {
    padding: "10px 12px", fontSize: 12.5, color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)", verticalAlign: "top", fontFamily: ff,
  };
  const clip: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    // Its own scrollport in both directions: nine columns do not fit a phone,
    // and a table that widens the page instead of scrolling inside its own box
    // pushes every other thing on the screen sideways.
    <div className="table-scroll" style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
        <thead>
          <tr>
            <th style={th}>Job</th>
            <th style={th}>Device</th>
            <th style={th}>Customer</th>
            <th style={th}>Fault</th>
            {showTechnician && <th style={th}>Technician</th>}
            <th style={th}>Priority</th>
            <th style={th}>Due</th>
            <th style={{ ...th, textAlign: "right" }}>Charge</th>
            <th style={{ ...th, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, i) => {
            const agent = transferFor(job.id) ?? null;
            const readOnly = shopWide && !isUnassigned(job.technician) && job.technician !== technicianName;
            const actions = benchActions(job, { atAgent: agent, readOnly });
            const late = daysOverdue(job);
            const pending = partsPendingFor(job.id);
            const asking = hasOpenInquiry(job);

            return (
              <tr
                key={job.id}
                style={{ background: i % 2 ? "var(--bg-secondary)" : "transparent", transition: "background 0.12s" }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i % 2 ? "var(--bg-secondary)" : "transparent"}
              >
                {/* Both numbers, ours underneath. A dealer's job carries two,
                    and the one quoted down the phone is usually theirs. */}
                <td style={td}>
                  {job.dealerJobNo ? (
                    <>
                      <p style={{ fontWeight: 700, color: "var(--accent)" }} title="The dealer's own job number">#{job.dealerJobNo}</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }} title="Our job number">{job.id}</p>
                    </>
                  ) : (
                    <p style={{ fontWeight: 600, color: "var(--accent)" }}>{job.id}</p>
                  )}
                  {/* The two things that change what you do next, and neither
                      is a status: somebody is waiting at the counter, or the
                      phone is not in the building. */}
                  {asking && (
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#f87171", marginTop: 2 }}>CUSTOMER ASKING</p>
                  )}
                  {agent && (
                    <p style={{ fontSize: 10, fontWeight: 700, color: AGENT, marginTop: 2 }} title={`At ${agent.agentName ?? "an agent"}`}>
                      AT {(agent.agentName ?? "AGENT").toUpperCase()}
                    </p>
                  )}
                </td>

                <td style={{ ...td, maxWidth: 190 }}>
                  <p style={{ ...clip, fontWeight: 500 }}>{[job.brand, job.model].filter(Boolean).join(" ") || "—"}</p>
                  {job.imei && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1, fontFamily: "monospace" }}>{job.imei}</p>}
                </td>

                <td style={{ ...td, maxWidth: 170 }}>
                  <p style={clip}>{job.customerName || "—"}</p>
                  {job.phone && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>{job.phone}</p>}
                </td>

                <td style={{ ...td, maxWidth: 240, color: "var(--text-secondary)" }}>
                  <p style={clip} title={job.issue}>{job.issue || "—"}</p>
                  {pending > 0 && (
                    <p style={{ fontSize: 10.5, color: "#fbbf24", marginTop: 2 }}>
                      {pending} part{pending === 1 ? "" : "s"} awaiting approval
                    </p>
                  )}
                </td>

                {showTechnician && (
                  <td style={{ ...td, maxWidth: 140, color: "var(--text-secondary)" }}>
                    <p style={clip}>{isUnassigned(job.technician) ? "Unassigned" : job.technician}</p>
                  </td>
                )}

                <td style={td}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: PRIORITY[job.priority] ?? "var(--text-muted)" }}>
                    ● {job.priority}
                  </span>
                </td>

                <td style={td}>
                  <p style={{ color: late > 0 ? "#f87171" : "var(--text-secondary)", fontWeight: late > 0 ? 700 : 400 }}>
                    {fmtDate(job.estimatedCompletion)}
                  </p>
                  {late > 0 && <p style={{ fontSize: 10.5, color: "#f87171", marginTop: 1 }}>{late}d late</p>}
                </td>

                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {rs(job.estimatedCost)}
                </td>

                <td style={{ ...td, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                    {/* Icon-only, with the label on hover. Nine columns is
                        already the most a bench screen can hold; labelled
                        buttons here would cost another two hundred pixels and
                        push the fault text off the row. */}
                    {actions.map(a => {
                      const Icon = a.icon;
                      const colour = a.tone === "primary" ? TA : a.tone === "warn" ? "#fbbf24" : "var(--text-muted)";
                      return (
                        <button
                          key={a.id}
                          onClick={() => onAction(a.id, job)}
                          title={a.title ?? a.label}
                          aria-label={a.label}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            width: 30, height: 30, borderRadius: 8, cursor: "pointer",
                            background: a.tone === "primary" ? `${TA}14` : "transparent",
                            border: `1px solid ${a.tone === "quiet" ? "var(--border)" : colour + "4d"}`,
                            color: colour,
                          }}
                        >
                          <Icon size={14} />
                        </button>
                      );
                    })}
                    {/* Always available, including on a finished job, which
                        offers nothing else. */}
                    <button
                      onClick={() => onAction("info", job)}
                      title="Job details"
                      aria-label="Job details"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 30, height: 30, borderRadius: 8, cursor: "pointer",
                        background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)",
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
