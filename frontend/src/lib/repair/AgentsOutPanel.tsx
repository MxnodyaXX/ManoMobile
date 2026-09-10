"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import type { AgentTransfer } from "@/lib/repair/agents";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

/**
 * The devices that are not in the building.
 *
 * A phone sent to an outside workshop parks as Pending, which is true — nobody
 * here is working on it — and useless, because it reads exactly like a phone on
 * a shelf upstairs waiting for a part. The row badge fixes that for one job at
 * a time. This fixes the other question, the one about the set: which of our
 * stock is out, with who, and how long has it been gone.
 *
 * One component for both screens. The counter and the bench were never going to
 * disagree about what "out at RIZVI since Tuesday" means, and two copies of
 * this would have started saying it two different ways within a month.
 */

const ff = "'Plus Jakarta Sans', sans-serif";
const AGENT = "#a78bfa";

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/** Whole days since a device was handed to an outside workshop. */
export const daysAtAgent = (t: AgentTransfer) =>
  Math.max(0, Math.floor((Date.now() - new Date(t.sentAt).getTime()) / 86_400_000));

/**
 * Days past the date the agent said it would be back, or 0.
 *
 * A transfer raised without a date is never late — the shop agreed to no date,
 * and inventing one to go red about would be inventing a promise nobody made.
 * Day granularity, like the job SLA: due today is not late until tomorrow.
 */
export const daysLateFromAgent = (t: AgentTransfer) => {
  if (!t.expectedReturn) return 0;
  const due = new Date(`${t.expectedReturn}T23:59:59`).getTime();
  if (isNaN(due)) return 0;
  return Math.max(0, Math.floor((Date.now() - due) / 86_400_000));
};

export interface AgentsOutPanelProps {
  /** Every transfer still open. */
  transfers: AgentTransfer[];
  /** Whatever jobs the caller has, to put a device and a customer on each row. */
  jobs: RepairJob[];
  /** Opening a row, when the calling screen has somewhere to open it. */
  onOpenJob?: (job: RepairJob) => void;
  /** Closed by default — see the comment on the header. */
  defaultOpen?: boolean;
  /** Said under the last row, because the two screens do different things. */
  footnote?: string;
}

export default function AgentsOutPanel({
  transfers, jobs, onOpenJob, defaultOpen = false, footnote,
}: AgentsOutPanelProps) {
  // Closed to start. It is a standing answer to a question nobody is asking
  // most of the time, and an open panel would push the actual list of work down
  // the screen on every visit.
  const [open, setOpen] = useState(defaultOpen);

  /**
   * Every device out, paired with its job.
   *
   * A transfer whose job the caller does not hold still gets a row — the row is
   * the device, and dropping one silently is the single failure that matters
   * here. The bench, for instance, only has its own jobs.
   */
  const rows = useMemo(
    () => transfers.map(t => ({ transfer: t, job: jobs.find(j => j.id === t.jobId) })),
    [transfers, jobs],
  );

  const overdue = useMemo(
    () => rows.filter(({ transfer }) => daysLateFromAgent(transfer) > 0).length,
    [rows],
  );

  // Grouped by agent, because that is how it gets acted on: somebody rings
  // RIZVI once about four phones, not four times about one.
  const groups = useMemo(() => {
    const by = new Map<string, typeof rows>();
    for (const row of rows) {
      const name = row.transfer.agentName ?? "Unnamed agent";
      const list = by.get(name);
      if (list) list.push(row); else by.set(name, [row]);
    }
    // Whoever holds the most of our stock first, then alphabetically so the
    // order does not shuffle when two agents hold the same number.
    return [...by.entries()]
      .map(([agentName, items]) => ({
        agentName,
        items: [...items].sort((a, b) => a.transfer.sentAt.localeCompare(b.transfer.sentAt)),
      }))
      .sort((a, b) => b.items.length - a.items.length || a.agentName.localeCompare(b.agentName));
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div style={{ background: "var(--bg-card)", border: `1px solid ${AGENT}47`, borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "12px 16px", background: open ? `${AGENT}12` : "transparent",
          border: "none", cursor: "pointer", textAlign: "left",
          fontFamily: ff, transition: "background 0.15s",
        }}
      >
        <Building2 size={15} color={AGENT} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          On Agents&rsquo; Hands
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", padding: "2px 8px", borderRadius: 20, color: AGENT, background: `${AGENT}1f`, border: `1px solid ${AGENT}4d` }}>
          {rows.length} {rows.length === 1 ? "DEVICE" : "DEVICES"}
        </span>
        {/* Overdue is said on the closed header too. A device a week past the
            date it was promised back is the whole reason to open this, and it
            must not need a click to be discovered. */}
        {overdue > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", padding: "2px 8px", borderRadius: 20, color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.32)" }}>
            {overdue} OVERDUE
          </span>
        )}
        <ChevronDown
          size={15}
          color="var(--text-muted)"
          style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}
        />
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {groups.map(g => (
            <div key={g.agentName} style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "9px 16px", background: "var(--bg-secondary)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: AGENT, fontFamily: ff }}>{g.agentName}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
                  {g.items.length} {g.items.length === 1 ? "device" : "devices"}
                </span>
              </div>

              {g.items.map(({ transfer, job }) => {
                const out  = daysAtAgent(transfer);
                const late = daysLateFromAgent(transfer);
                const clickable = !!job && !!onOpenJob;
                return (
                  <button
                    key={transfer.id}
                    onClick={() => { if (job && onOpenJob) onOpenJob(job); }}
                    disabled={!clickable}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                      padding: "10px 16px", background: "transparent", border: "none",
                      borderTop: "1px solid var(--border)", textAlign: "left",
                      cursor: clickable ? "pointer" : "default", fontFamily: ff,
                    }}
                    onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card-hover)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <span style={{ minWidth: 92 }}>
                      {job?.dealerJobNo ? (
                        <>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>#{job.dealerJobNo}</span>
                          <span style={{ fontSize: 10.5, color: "var(--text-muted)", display: "block", marginTop: 1 }}>{transfer.jobId}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{transfer.jobId}</span>
                      )}
                    </span>

                    <span style={{ flex: 1, minWidth: 130 }}>
                      <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500, display: "block" }}>
                        {job ? [job.brand, job.model].filter(Boolean).join(" ") || "—" : "Not one of the jobs on this screen"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job?.customerName || "—"}{transfer.reason ? ` · ${transfer.reason}` : ""}
                      </span>
                    </span>

                    <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {out === 0 ? "sent today" : `${out}d out`}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: late > 0 ? 700 : 400, color: late > 0 ? "#f87171" : "var(--text-muted)", whiteSpace: "nowrap", minWidth: 104, textAlign: "right" }}>
                      {transfer.expectedReturn
                        ? late > 0 ? `${late}d late` : `due ${fmtDate(transfer.expectedReturn)}`
                        : "no date given"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {footnote && (
            <p style={{ padding: "9px 16px", fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
              {footnote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
