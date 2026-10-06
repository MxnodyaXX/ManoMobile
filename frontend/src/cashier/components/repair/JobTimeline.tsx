"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { fetchJobEvents, type JobEvent } from "@/lib/repair/api";
import { fetchJobTransfers, type AgentTransfer } from "@/lib/repair/agents";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Everything that happened to a job, in order, with who did it.
 *
 * Built from what is actually recorded rather than from the job row's
 * timestamps alone:
 *   * repair_job_events — one row per status change, written by trigger with
 *     the signed-in user (so "by whom" is real, and cannot be skipped);
 *   * repair_agent_transfers — each trip to an outside agent: to whom, by whom,
 *     why, and when it came back;
 *   * the job's handover record — who handed it back and who collected it.
 * Older or back-dated jobs with no events fall back to the job's own dates.
 */

export interface TimelineStep {
  key: string;
  at: string;
  title: string;
  by: string | null;
  /** Extra lines under the step: reason, agent, notes. */
  details: string[];
  tone: "neutral" | "start" | "pause" | "agent" | "done" | "issued" | "cancel";
}

export function useJobTimeline(job: RepairJob) {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [transfers, setTransfers] = useState<AgentTransfer[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  // Re-read when the job moves on, so a status changed in this modal shows up.
  const stamp = [job.id, job.status, job.startedAt, job.pausedAt, job.completedAt, job.handover?.handedOverAt].join("|");
  useEffect(() => {
    let live = true;
    const load = isSupabaseConfigured()
      ? Promise.all([
          fetchJobEvents(job.id).catch(() => [] as JobEvent[]),
          fetchJobTransfers(job.id).catch(() => [] as AgentTransfer[]),
        ])
      : Promise.resolve<[JobEvent[], AgentTransfer[]]>([[], []]);
    load.then(([ev, tr]) => {
      if (!live) return;
      setEvents(ev);
      setTransfers(tr);
      setLoading(false);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  const steps = buildSteps(job, events, transfers);
  const accepted = steps.find(s => s.key === "accepted");
  return { steps, loading, acceptedBy: accepted?.by ?? null, transfers };
}

function buildSteps(job: RepairJob, events: JobEvent[], transfers: AgentTransfer[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const asc = [...events].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  const handover = job.handover ?? null;
  const tech = job.technician && job.technician !== "Unassigned" ? job.technician : null;

  const created = asc.find(e => e.fromStatus === null);
  steps.push({
    key: "accepted", at: created?.changedAt ?? job.createdAt, title: "Accepted",
    by: created?.changedByName ?? null, details: [], tone: "neutral",
  });

  for (const e of asc) {
    if (e === created) continue;
    const by = e.changedByName;
    // Logged without a status change — e.g. a technician claiming the job
    // from the available pool. Shown as what the note says it was.
    if (e.fromStatus === e.toStatus) {
      steps.push({ key: `e${e.id}`, at: e.changedAt, title: e.note || "Updated", by, details: [], tone: "neutral" });
      continue;
    }
    switch (e.toStatus) {
      case "Issued":
        steps.push({
          key: `e${e.id}`, at: e.changedAt,
          title: e.fromStatus === "Pending" ? "Resumed" : e.fromStatus === "Non-Issued" ? "Started" : "Reopened",
          by, details: [], tone: "start",
        });
        break;
      case "Pending":
        steps.push({
          key: `e${e.id}`, at: e.changedAt, title: "Paused", by,
          details: [e.note || job.pauseReason ? `Reason: ${e.note || job.pauseReason}` : ""].filter(Boolean), tone: "pause",
        });
        break;
      case "Completed": {
        // The technician named on the completion form did the work; the event
        // knows who pressed the button. Show both when they differ.
        const details = [
          job.completionType ? `Outcome: ${job.completionType}` : "",
          tech && by && tech.toLowerCase() !== by.toLowerCase() ? `Recorded by ${by}` : "",
        ].filter(Boolean);
        steps.push({ key: `e${e.id}`, at: e.changedAt, title: "Finished", by: tech ?? by, details, tone: "done" });
        break;
      }
      case "Delivered":
        steps.push({
          key: `e${e.id}`, at: handover?.handedOverAt ?? e.changedAt, title: "Issued to customer",
          by: handover?.handedOverBy || by,
          details: [
            handover?.collectedBy ? `Collected by ${handover.collectedBy}${handover.relationship ? ` (${handover.relationship})` : ""}` : "",
            job.invoiceNo ? `Invoice ${job.invoiceNo}` : "",
          ].filter(Boolean),
          tone: "issued",
        });
        break;
      case "Cancelled":
        steps.push({
          key: `e${e.id}`, at: e.changedAt, title: "Cancelled", by: job.cancelledBy || by,
          details: [e.note || job.cancelReason ? `Reason: ${e.note || job.cancelReason}` : ""].filter(Boolean), tone: "cancel",
        });
        break;
      case "Non-Issued":
        steps.push({ key: `e${e.id}`, at: e.changedAt, title: "Moved back to New", by, details: [], tone: "neutral" });
        break;
    }
  }

  for (const t of transfers) {
    steps.push({
      key: `t${t.id}-out`, at: t.sentAt, title: `Transferred to agent${t.agentName ? ` — ${t.agentName}` : ""}`,
      by: t.sentBy,
      details: [
        t.reason ? `Reason: ${t.reason}` : "",
        t.expectedReturn ? `Expected back ${fmtDay(t.expectedReturn)}` : "",
        t.agreedCost != null ? `Agreed cost Rs. ${t.agreedCost.toLocaleString()}` : "",
      ].filter(Boolean),
      tone: "agent",
    });
    if (t.returnedAt) {
      steps.push({
        key: `t${t.id}-back`, at: t.returnedAt, title: `Returned from agent${t.agentName ? ` — ${t.agentName}` : ""}`,
        by: t.receivedBy,
        details: [
          t.actualCost != null ? `Cost Rs. ${t.actualCost.toLocaleString()}` : "",
          t.returnNotes ? `Notes: ${t.returnNotes}` : "",
        ].filter(Boolean),
        tone: "agent",
      });
    }
  }

  // Jobs with no event history (older, or entered as past records): fall back
  // to the dates on the job itself, so the timeline is never just "Accepted".
  if (asc.length <= 1) {
    if (job.startedAt) steps.push({ key: "f-start", at: job.startedAt, title: "Started", by: tech, details: [], tone: "start" });
    if (job.pausedAt) steps.push({ key: "f-pause", at: job.pausedAt, title: "Paused", by: null, details: job.pauseReason ? [`Reason: ${job.pauseReason}`] : [], tone: "pause" });
    if (job.completedAt) steps.push({ key: "f-done", at: job.completedAt, title: "Finished", by: tech, details: job.completionType ? [`Outcome: ${job.completionType}`] : [], tone: "done" });
    if (handover?.handedOverAt) steps.push({ key: "f-issued", at: handover.handedOverAt, title: "Issued to customer", by: handover.handedOverBy || null, details: handover.collectedBy ? [`Collected by ${handover.collectedBy}`] : [], tone: "issued" });
    if (job.cancelledAt) steps.push({ key: "f-cancel", at: job.cancelledAt, title: "Cancelled", by: job.cancelledBy || null, details: job.cancelReason ? [`Reason: ${job.cancelReason}`] : [], tone: "cancel" });
  }

  return steps.sort((a, b) => a.at.localeCompare(b.at));
}

const fmtDay = (iso: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso)
    .toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
/**
 * A full timestamp shows its time; a bare date ("2026-10-06" — the job row
 * keeps only the day for its started/paused/completed fields) shows the day
 * alone. Parsing a bare date as a time reads it as UTC midnight, which is the
 * "5:30 AM" Sri Lanka time it used to print for every fallback step.
 */
const fmtWhen = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })
    : new Date(iso).toLocaleString("en-LK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const TONE: Record<TimelineStep["tone"], string> = {
  neutral: "#94a3b8", start: "#60a5fa", pause: "#f59e0b", agent: "#a78bfa", done: "#22c55e", issued: "#14b8a6", cancel: "#ef4444",
};

const ff = "'Plus Jakarta Sans', sans-serif";

export default function JobTimeline({ steps, loading }: { steps: TimelineStep[]; loading: boolean }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
        <span style={{ width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#14b8a6", background: "#14b8a61a", border: "1px solid #14b8a64d" }}>
          <History size={11} strokeWidth={2.4} />
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: ff }}>Timeline</span>
        {loading && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", fontFamily: ff }}>Loading…</span>}
      </div>
      <div style={{ padding: "12px 14px" }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div key={s.key} style={{ display: "flex", gap: 12 }}>
              {/* Rail */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: TONE[s.tone], marginTop: 4, boxShadow: `0 0 0 3px ${TONE[s.tone]}26` }} />
                {!last && <span style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 3 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 12, fontFamily: ff }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{s.title}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtWhen(s.at)}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                  by <span style={{ color: s.by ? "var(--text-primary)" : "var(--text-muted)", fontWeight: s.by ? 600 : 400, fontStyle: s.by ? "normal" : "italic" }}>{s.by || "not recorded"}</span>
                </div>
                {s.details.map(d => (
                  <div key={d} style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.45 }}>{d}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
