"use client";

import { useEffect, useState } from "react";
import { Wrench, ChevronDown } from "lucide-react";
import { useRepair, type RepairJob, type JobStatus } from "@/cashier/contexts/RepairContext";
import { useTechnicianRates } from "@/lib/settings/staffRules";
import { isUnassigned } from "@/lib/repair/api";
import { useTech } from "@/technician/contexts/TechContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import BenchCard, { type BenchAction } from "@/technician/components/bench/BenchCard";
import PersonalInsights from "@/technician/components/bench/PersonalInsights";
import BenchFilters, {
  applyBenchFilter, isFiltering, EMPTY_FILTER, type BenchFilter,
} from "@/technician/components/bench/BenchFilters";
import StatusUpdateModal from "@/technician/components/jobs/StatusUpdateModal";
import PartRequestModal from "@/technician/components/parts/PartRequestModal";
import DiagnosticModal from "@/technician/components/jobs/DiagnosticModal";
import ActivityLogPanel from "@/technician/components/jobs/ActivityLogPanel";
import InternalNotesModal from "@/technician/components/jobs/InternalNotesModal";
import EscalationModal from "@/technician/components/jobs/EscalationModal";
import CustomerMessageModal from "@/technician/components/jobs/CustomerMessageModal";
import TransferAgentModal from "@/technician/components/jobs/TransferAgentModal";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * The technician's whole day, on one screen.
 *
 * It replaces the Dashboard + My Jobs pair. The feedback was that the old
 * technician side had too many screens and too many buttons: seven sidebar
 * sections and eight equally-sized actions per job, so finding the next thing
 * to do meant reading everything first.
 *
 * Here the jobs are grouped by what they need from you, in the order you need
 * it — what you are working on, what to pick up next, what is stuck, what is
 * finished. Everything else the technician side can do is still there, one tap
 * behind the card's ⋯ menu or in the secondary nav.
 */

type ModalKind = Exclude<BenchAction, "start" | "resume">;

type SectionKey = "progress" | "todo" | "pool" | "waiting" | "ready";

interface Buckets { inProgress: RepairJob[]; toDo: RepairJob[]; pool: RepairJob[]; waiting: RepairJob[]; ready: RepairJob[] }

const COLUMNS: {
  key: SectionKey; title: string; tint?: string; empty: string;
  pick: (b: Buckets) => RepairJob[];
}[] = [
  { key: "progress", title: "In progress", tint: "#34d399", empty: "Nothing started",     pick: b => b.inProgress },
  { key: "todo",     title: "To start",    tint: undefined, empty: "Nothing waiting",     pick: b => b.toDo },
  // Work belonging to nobody. It sits between the technician's own untouched
  // jobs and their paused ones because that is when it gets picked up: after
  // you have seen your own queue and found room in it.
  { key: "pool",     title: "Available to claim", tint: "#a78bfa", empty: "Nothing unassigned", pick: b => b.pool },
  { key: "waiting",  title: "Waiting",     tint: "#fbbf24", empty: "Nothing on hold",     pick: b => b.waiting },
  { key: "ready",    title: "Finished",    tint: "#60a5fa", empty: "Nothing to collect",  pick: b => b.ready },
];

export default function MyBench() {
  const { jobs, updateJob } = useRepair();
  const { technicianName, jobMeta, setJobMeta, partRequests, addActivity } = useTech();
  const { parts } = useParts();

  // Which job has which sheet open, and — for the status sheet — the
  // transition it opens on, so "Complete" lands on the completion form
  // rather than a list asking what the technician already pressed.
  const [modal, setModal] = useState<{ kind: ModalKind; jobId: string; next?: JobStatus } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, tick] = useState(0);
  // Finished work starts folded: it is the only section the technician has
  // nothing left to do about, and on a busy bench it is also the longest.
  const [sectionOpen, setSectionOpen] = useState<Record<SectionKey, boolean>>({
    progress: true, todo: true, pool: true, waiting: true, ready: false,
  });
  // One filter per section. Shared state would mean narrowing "to start" also
  // quietly hid jobs in a section the technician was not even looking at.
  const [filters, setFilters] = useState<Record<SectionKey, BenchFilter>>({
    progress: EMPTY_FILTER, todo: EMPTY_FILTER, pool: EMPTY_FILTER, waiting: EMPTY_FILTER, ready: EMPTY_FILTER,
  });

  const mine = jobs.filter(j => j.technician === technicianName);

  // Permissive until the rules load and if they cannot be read at all — the
  // bench must not quietly hide available work because of a slow fetch.
  const ratesFor = useTechnicianRates();
  const canClaim = ratesFor(technicianName)?.canClaimUnassigned ?? true;
  const byOldest = (a: RepairJob, b: RepairJob) =>
    new Date(a.startedAt ?? a.createdAt).getTime() - new Date(b.startedAt ?? b.createdAt).getTime();

  /**
   * A job that carries a completion is finished, whatever its status column
   * says.
   *
   * RM-006 and RM-007 sat as status "Issued" with a completed_at and a
   * completion type already on them — finished work showing on the bench as
   * still in progress, which is worse than useless: it is a technician being
   * told to work on a phone that already went back in its box. Whatever wrote
   * that half-state, the screen should not repeat it.
   */
  const isFinished = (j: RepairJob) =>
    j.status === "Completed" || j.status === "Delivered" || (!!j.completedAt && !!j.completionType);

  /**
   * Repairs with no technician on them.
   *
   * The bench only ever showed `j.technician === me`, so a job booked in
   * without an assignment was invisible to every technician in the shop — it
   * sat in the system waiting for somebody who was never told it existed. The
   * empty state even pointed at a "Job Pool" screen that does not exist.
   *
   * Hidden entirely from anyone whose permissions say they may not self-assign,
   * rather than shown and refused: a queue you can look at but never take from
   * is worse than one you cannot see.
   */
  const unassigned = canClaim
    ? jobs
        .filter(j => isUnassigned(j.technician))
        .filter(j => j.status !== "Cancelled" && !isFinished(j))
        .sort(byOldest)
    : [];

  const inProgress = mine.filter(j => j.status === "Issued"     && !isFinished(j)).sort(byOldest);
  const toDo       = mine.filter(j => j.status === "Non-Issued" && !isFinished(j)).sort(byOldest);
  const waiting    = mine.filter(j => j.status === "Pending"    && !isFinished(j)).sort(byOldest);
  const ready      = mine.filter(j => j.status !== "Delivered"  &&  isFinished(j)).sort(byOldest);

  // One interval for the whole screen rather than one per card: a bench with
  // six jobs open should not run six timers.
  useEffect(() => {
    if (inProgress.length === 0) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [inProgress.length]);

  const openJob = modal ? mine.find(j => j.id === modal.jobId) ?? null : null;

  /**
   * Starting and resuming are the only actions with no form behind them, so
   * they happen on the card. Everything else opens the sheet that already
   * knows the rules — none of that logic is reimplemented here.
   */
  const handle = async (action: BenchAction, job: RepairJob) => {
    /**
     * Take an unassigned job.
     *
     * Assignment only — it does not start the clock. A technician picking a
     * phone off the pile has taken responsibility for it; whether they begin
     * now or after lunch is the Start button's business, and conflating the
     * two would show work as in progress that nobody has touched.
     */
    if (action === "claim") {
      setBusyId(job.id);
      const result = await updateJob(job.id, {
        technician: technicianName,
        assignmentSource: "Self-Taken",
      });
      setBusyId(null);

      if (!result.ok) {
        setNotice(result.error ?? "That job could not be claimed.");
        return;
      }
      addActivity({
        jobId: job.id, type: "status_change",
        description: `Claimed by ${technicianName}`,
      });
      setNotice(`${job.id} is yours — it has moved to "To start".`);
      return;
    }

    if (action === "start" || action === "resume") {
      setBusyId(job.id);
      const now = new Date();
      const result = await updateJob(job.id, {
        status: "Issued",
        startedAt: job.startedAt ?? now.toISOString(),
        pauseReason: undefined,
      });
      setBusyId(null);

      if (!result.ok) {
        setNotice(result.error ?? "That job could not be started.");
        return;
      }
      setJobMeta(job.id, { startedAt: job.startedAt ? new Date(job.startedAt) : now, lastPausedAt: undefined, pauseReason: undefined });
      addActivity({
        jobId: job.id, type: "status_change",
        description: action === "resume" ? "Work resumed" : "Job started",
      });
      return;
    }

    setModal({
      kind: action,
      jobId: job.id,
      next: action === "complete" ? "Completed" : action === "pause" ? "Pending" : undefined,
    });
  };

  const pendingFor = (jobId: string) =>
    partRequests.filter(r => r.jobId === jobId && r.status === "Pending").length;

  // "Nothing at all" has to mean nothing to claim either, or the screen tells
  // a technician their bench is empty while unassigned work sits below it.
  const nothingAtAll = mine.length === 0 && unassigned.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, fontFamily: ff }}>
      <PersonalInsights
        jobs={mine}
        partRequests={partRequests}
        catalog={parts}
        technicianName={technicianName}
      />

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 3 }}>
          {technicianName}&apos;s bench
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {inProgress.length > 0
            ? `${inProgress.length} in progress · ${toDo.length} to start`
            : toDo.length > 0
              ? `${toDo.length} waiting to be started`
              : "Nothing in progress"}
        </p>
      </div>

      {notice && (
        <div
          onClick={() => setNotice(null)}
          style={{
            padding: "12px 14px", borderRadius: 11, cursor: "pointer",
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.4)",
            fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55,
          }}
        >
          {notice} <span style={{ color: "var(--text-muted)" }}>· tap to dismiss</span>
        </div>
      )}

      {nothingAtAll && (
        <div style={{
          padding: "40px 22px", textAlign: "center",
          background: "var(--bg-card)", border: "1px dashed var(--border)", borderRadius: 16,
        }}>
          <Wrench size={30} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>Nothing on your bench</p>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {canClaim
              ? "Nothing is waiting to be claimed either."
              : "You are not set up to claim unassigned repairs — a job has to be assigned to you."}
          </p>
        </div>
      )}

      {/* One accordion per state, jobs laid out four across inside each.
          Sections that need something from the technician open by default;
          finished work does not, so it starts folded — the bench should open
          on what is left to do, not on a wall of everything. */}
      {!nothingAtAll && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {COLUMNS.map(col => {
            const all  = col.pick({ inProgress, toDo, pool: unassigned, waiting, ready });
            const f    = filters[col.key];
            const list = applyBenchFilter(all, f);
            const open = sectionOpen[col.key];
            return (
              <section key={col.key} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 14, overflow: "hidden",
              }}>
                <button
                  onClick={() => setSectionOpen(o => ({ ...o, [col.key]: !o[col.key] }))}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    minHeight: 52, padding: "0 16px", cursor: "pointer",
                    background: "none", border: "none", textAlign: "left", fontFamily: ff,
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: col.tint ?? "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-primary)" }}>
                    {col.title}
                  </span>
                  <span style={{
                    fontSize: 11.5, fontWeight: 800, minWidth: 22, textAlign: "center",
                    padding: "2px 8px", borderRadius: 20,
                    color: list.length ? (col.tint ?? "var(--text-secondary)") : "var(--text-muted)",
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  }}>
                    {all.length}
                  </span>
                  {isFiltering(f) && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
                      filtered
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    style={{ marginLeft: "auto", color: "var(--text-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.18s" }}
                  />
                </button>

                {open && (
                  <div style={{ padding: "0 16px 16px" }}>
                    {all.length > 0 && (
                      <BenchFilters
                        jobs={all}
                        value={f}
                        shown={list.length}
                        onChange={next => setFilters(prev => ({ ...prev, [col.key]: next }))}
                      />
                    )}
                    {list.length === 0 ? (
                      <p style={{
                        fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff,
                        padding: "16px 12px", textAlign: "center",
                        border: "1px dashed var(--border)", borderRadius: 11,
                      }}>
                        {all.length === 0 ? col.empty : "Nothing matches that search"}
                      </p>
                    ) : (
                      <div style={{
                        display: "grid",
                        gap: 14,
                        alignItems: "start",
                        /* Four across, and fewer as the space narrows — driven by
                           the container rather than the viewport, because the
                           sidebar takes 225px of it and a viewport media query
                           does not know that. The 24% floor caps the row at four;
                           the 260px floor is where a card stops being readable,
                           so below that width it wraps to three, two, then one.
                           Inline on purpose: this laid out as one column per row
                           for a whole session because the stylesheet carrying it
                           had not reached the browser. */
                        gridTemplateColumns: "repeat(auto-fill, minmax(max(260px, 24%), 1fr))",
                      }}>
                        {list.map(j => (
                          <BenchCard
                            key={j.id}
                            job={j}
                            startedAt={jobMeta[j.id]?.startedAt ?? (j.startedAt ? new Date(j.startedAt) : undefined)}
                            partsPending={pendingFor(j.id)}
                            onAction={handle}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {busyId && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>Saving…</p>
      )}

      {/* Every sheet the old screens had, reached from the card instead of
          from a row of eight buttons. None of them changed. */}
      {openJob && modal?.kind === "complete" && (
        <StatusUpdateModal job={openJob} initialNext={modal.next} onClose={() => setModal(null)} />
      )}
      {openJob && modal?.kind === "pause" && (
        <StatusUpdateModal job={openJob} initialNext={modal.next} onClose={() => setModal(null)} />
      )}
      {openJob && modal?.kind === "parts" && (
        <PartRequestModal job={openJob} onClose={() => setModal(null)} />
      )}
      {openJob && modal?.kind === "diagnostic" && (
        <DiagnosticModal job={openJob} onClose={() => setModal(null)} />
      )}
      {openJob && modal?.kind === "activity" && (
        <ActivityLogPanel job={openJob} onClose={() => setModal(null)} />
      )}
      {openJob && modal?.kind === "notes" && (
        <InternalNotesModal job={openJob} onClose={() => setModal(null)} />
      )}
      {openJob && modal?.kind === "escalate" && (
        <EscalationModal job={openJob} onClose={() => setModal(null)} />
      )}
      {openJob && modal?.kind === "message" && (
        <CustomerMessageModal job={openJob} onClose={() => setModal(null)} />
      )}
      {openJob && modal?.kind === "transfer" && (
        <TransferAgentModal
          job={openJob}
          technicianName={technicianName}
          onClose={() => setModal(null)}
          onTransferred={(agentName, reason) => {
            // The job stays in this technician's queue but parks as Paused
            // while the device is out of the shop, so the counter can still
            // see where it physically is.
            void updateJob(openJob.id, {
              status: "Pending",
              pauseReason: `At external agent: ${agentName} — ${reason}`,
              pausedAt: new Date().toISOString().slice(0, 10),
            });
            setNotice(`${openJob.id} sent to ${agentName}. It stays on your bench as Waiting until it comes back.`);
            setModal(null);
          }}
        />
      )}

    </div>
  );
}
