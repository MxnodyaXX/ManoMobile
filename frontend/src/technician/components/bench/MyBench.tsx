"use client";

import { useEffect, useState } from "react";
import { Wrench, ChevronDown, BellRing } from "lucide-react";
import { useRepair, type RepairJob, type JobStatus } from "@/cashier/contexts/RepairContext";
import { hasOpenInquiry, acknowledgeInquiry, INQUIRY_MESSAGE } from "@/lib/repair/inquiry";
import { useTechnicianRates } from "@/lib/settings/staffRules";
import { useWorkRules } from "@/lib/settings/workRules";
import { isUnassigned, claimRepairJob } from "@/lib/repair/api";
import { useTech } from "@/technician/contexts/TechContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import BenchCard, { type BenchAction } from "@/technician/components/bench/BenchCard";
import PersonalInsights from "@/technician/components/bench/PersonalInsights";
import BenchFilters, {
  applyBenchFilter, isFiltering, EMPTY_FILTER, type BenchFilter, type BenchView,
} from "@/technician/components/bench/BenchFilters";
import StatusUpdateModal from "@/technician/components/jobs/StatusUpdateModal";
import DeviceDetailsModal from "@/technician/components/jobs/DeviceDetailsModal";
import PartRequestModal from "@/technician/components/parts/PartRequestModal";
import DiagnosticModal from "@/technician/components/jobs/DiagnosticModal";
import ActivityLogPanel from "@/technician/components/jobs/ActivityLogPanel";
import InternalNotesModal from "@/technician/components/jobs/InternalNotesModal";
import EscalationModal from "@/technician/components/jobs/EscalationModal";
import CustomerMessageModal from "@/technician/components/jobs/CustomerMessageModal";
import TransferAgentModal from "@/technician/components/jobs/TransferAgentModal";
import JobInfoModal from "@/technician/components/jobs/JobInfoModal";

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
  // Straight after what is in hand. Unclaimed work is the only section with a
  // deadline attached to reading it — a job nobody has taken is a phone nobody
  // is working on — so it comes before this technician's own untouched queue,
  // which will still be theirs in an hour.
  { key: "pool",     title: "Available to claim", tint: "#a78bfa", empty: "Nothing unassigned", pick: b => b.pool },
  { key: "todo",     title: "To start",    tint: undefined, empty: "Nothing waiting",     pick: b => b.toDo },
  { key: "waiting",  title: "Waiting",     tint: "#fbbf24", empty: "Nothing on hold",     pick: b => b.waiting },
  { key: "ready",    title: "Finished",    tint: "#60a5fa", empty: "Nothing to collect",  pick: b => b.ready },
];

export default function MyBench() {
  const { jobs, updateJob, refresh } = useRepair();
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
    progress: true, pool: true, todo: true, waiting: true, ready: false,
  });
  // One filter for the whole bench. It was per section, which is fine at six
  // jobs and useless at fifty: looking for one job number means searching
  // every section in turn to find out which one it is in.
  const [filter, setFilter] = useState<BenchFilter>(EMPTY_FILTER);
  // "" is every section. The pills set this; it is a narrowing of what is on
  // screen, not a filter on the jobs, so the counts stay honest either way.
  const [only, setOnly] = useState<string>("");
  const [view, setView] = useState<BenchView>("cards");

  const mine = jobs.filter(j => j.technician === technicianName);

  /**
   * Whose work the sections show.
   *
   * The bench was only ever this technician's own queue, which is right for
   * getting through a day and wrong for every question that starts "where is
   * the…". A technician covering the counter, picking up after someone on
   * leave, or answering for a phone a customer is asking about needs to see
   * the shop's work, not just theirs.
   *
   * It changes what is listed and nothing else. Personal Insights above stays
   * on this technician's own jobs in both modes — those are their figures, and
   * a toggle that quietly rewrote them into shop totals would be the fastest
   * way to make the number meaningless.
   */
  const [scope, setScope] = useState<"mine" | "shop">("mine");
  const shopWide = scope === "shop";

  // Cancelled work is nobody's queue. It is excluded here rather than in each
  // bucket, since the buckets filter on status and Cancelled matches none of
  // them anyway — this only keeps the count honest.
  const scoped = shopWide
    ? jobs.filter(j => j.status !== "Cancelled")
    : mine;

  // Permissive until the rules load and if they cannot be read at all — the
  // bench must not quietly hide available work because of a slow fetch.
  // Defaults to on until the row loads, so a slow fetch never blanks a timer
  // that is about to come back.
  const { rules: shopRules } = useWorkRules();
  const showTimer = shopRules.trackJobTime;

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

  const inProgress = scoped.filter(j => j.status === "Issued"     && !isFinished(j)).sort(byOldest);
  const toDo       = scoped.filter(j => j.status === "Non-Issued" && !isFinished(j)).sort(byOldest);
  const waiting    = scoped.filter(j => j.status === "Pending"    && !isFinished(j)).sort(byOldest);
  const ready      = scoped.filter(j => j.status !== "Delivered"  &&  isFinished(j)).sort(byOldest);

  // One interval for the whole screen rather than one per card: a bench with
  // six jobs open should not run six timers. And none at all where the shop
  // has turned timing off — there would be nothing on screen for it to move.
  useEffect(() => {
    if (inProgress.length === 0 || !showTimer) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [inProgress.length, showTimer]);

  const openJob = modal ? jobs.find(j => j.id === modal.jobId) ?? null : null;

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
    if (action === "claim" || action === "claimStart") {
      setBusyId(job.id);
      try {
        // Through the database function, not updateJob: the check has to be
        // part of the write or two technicians looking at the same pool can
        // both win. See migration 20260902000019.
        await claimRepairJob(job.id);
        // The claim is a database function, so nothing in this app's state
        // knows it happened. Without this the job stayed in "Available to
        // claim", and tapping it again told the technician it had been taken —
        // by themselves. Realtime would catch up a moment later; waiting for
        // that would still leave the row wrong for as long as it took.
        await refresh();
      } catch (e) {
        setBusyId(null);
        setNotice(e instanceof Error ? e.message : "That job could not be claimed.");
        return;
      }
      setBusyId(null);
      addActivity({
        jobId: job.id, type: "status_change",
        description: `Claimed by ${technicianName}`,
      });
      /**
       * Claimed and started in one press.
       *
       * Falls through to the start branch rather than repeating it: the clock,
       * the job meta and the activity line are all set there, and a second
       * copy here is how one of them ends up not being set at all. The job
       * object is refreshed from the register first, because it now has this
       * technician's name on it and starting the stale one would write the
       * unassigned version back.
       */
      if (action === "claimStart") {
        const claimed = jobs.find(j => j.id === job.id) ?? job;
        await handle("start", claimed);
        setNotice(`${job.id} is yours and the clock is running.`);
        return;
      }

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

  /**
   * The bench says it has seen the question.
   *
   * Only the seeing — it changes nothing about the repair, and it must not:
   * the customer asked, somebody read it, and the work still has to happen.
   * Marking it seen while a newer question is arriving cannot bury that one
   * either; acknowledge_customer_inquiry only moves the marker forward.
   */
  const [ackBusy, setAckBusy] = useState<string | null>(null);
  const acknowledge = async (jobId: string) => {
    setAckBusy(jobId);
    try {
      await acknowledgeInquiry(jobId);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setAckBusy(null);
    }
  };

  const pendingFor = (jobId: string) =>
    partRequests.filter(r => r.jobId === jobId && r.status === "Pending").length;

  const buckets: Buckets = { inProgress, toDo, pool: unassigned, waiting, ready };
  // Everything on the bench, for the toolbar's dealer/brand lists and its
  // "n of m" count. A job can only sit in one bucket, so this does not
  // double-count.
  const everything = COLUMNS.flatMap(c => c.pick(buckets));
  const filtered = COLUMNS.map(col => {
    const all = col.pick(buckets);
    return { col, all, list: applyBenchFilter(all, filter) };
  });
  const shownTotal = filtered.reduce((n, f) => n + f.list.length, 0);
  /**
   * The jobs somebody has come in and asked about.
   *
   * Above the board rather than inside it, and never filtered by the toolbar:
   * a customer waiting is not one more job to sort by dealer or due date, it
   * is the reason to put the current one down. Newest question first, because
   * that is the one the counter is still fielding.
   */
  const inquiries = everything
    .filter(hasOpenInquiry)
    .sort((a, b) => new Date(b.inquiryAt ?? 0).getTime() - new Date(a.inquiryAt ?? 0).getTime());
  const searching = isFiltering(filter);

  // "Nothing at all" has to mean nothing to claim either, or the screen tells
  // a technician their bench is empty while unassigned work sits below it.
  const nothingAtAll = mine.length === 0 && unassigned.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, fontFamily: ff }}>
      {/* Follows the switch below. Their own figures on My bench, the shop's
          on Whole shop — the same five questions either way, so the row does
          not change shape when the scope does.

          Keyed on the scope so the drill-down modal cannot survive a switch
          still holding the previous list. */}
      <PersonalInsights
        key={scope}
        jobs={shopWide ? scoped : mine}
        partRequests={partRequests}
        catalog={parts}
        technicianName={technicianName}
        scope={scope}
      />

      {inquiries.length > 0 && (
        <div style={{ borderRadius: 14, border: "1px solid rgba(248,113,113,0.45)", background: "rgba(248,113,113,0.07)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 15px", borderBottom: "1px solid rgba(248,113,113,0.3)" }}>
            <BellRing size={14} style={{ color: "#f87171", flexShrink: 0 }} />
            <p style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, color: "#f87171", letterSpacing: "0.02em" }}>
              Customer inquiries · {inquiries.length}
            </p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{INQUIRY_MESSAGE}</p>
          </div>

          {inquiries.map(job => (
            <div key={job.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 15px", borderTop: "1px solid rgba(248,113,113,0.18)" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  {job.dealerJobNo ? `#${job.dealerJobNo}` : job.id}
                  <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>
                    {" · "}{[job.brand, job.model].filter(Boolean).join(" ")}
                    {" · "}{job.status === "Issued" ? "in progress"
                            : job.status === "Pending" ? "waiting"
                            : job.status === "Non-Issued" ? "not started"
                            : job.status.toLowerCase()}
                  </span>
                </p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>
                  {/* Who took the question and how many times it has been
                      asked. The third ask is not the first, and a technician
                      deciding what to pick up next should be able to see the
                      difference. */}
                  Asked at the counter{job.inquiryBy ? ` — taken by ${job.inquiryBy}` : ""}
                  {(job.inquiryCount ?? 0) > 1 ? ` · chased ${job.inquiryCount} times` : ""}
                  {job.inquiryNote ? ` · "${job.inquiryNote}"` : ""}
                </p>
              </div>

              <button
                onClick={() => acknowledge(job.id)}
                disabled={ackBusy === job.id}
                style={{
                  padding: "8px 16px", borderRadius: 9, flexShrink: 0,
                  border: "1px solid rgba(248,113,113,0.5)", background: "transparent",
                  color: "#f87171", cursor: ackBusy === job.id ? "wait" : "pointer",
                  fontSize: 12.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap",
                }}
              >
                {ackBusy === job.id ? "Marking…" : "Got it"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 3 }}>
            {shopWide ? "The whole shop" : `${technicianName}'s bench`}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {inProgress.length > 0
              ? `${inProgress.length} in progress · ${toDo.length} to start`
              : toDo.length > 0
                ? `${toDo.length} waiting to be started`
                : "Nothing in progress"}
            {/* Their own count stays visible while looking at everyone's, so
                switching over does not lose track of what is theirs. */}
            {shopWide && mine.length > 0 && (
              <span> · {mine.filter(j => !isFinished(j) && j.status !== "Cancelled").length} of them yours</span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {([
            ["mine", "My bench", `${mine.length}`],
            ["shop", "Whole shop", `${jobs.filter(j => j.status !== "Cancelled").length}`],
          ] as const).map(([id, text, count]) => {
            const on = scope === id;
            return (
              <button
                key={id}
                onClick={() => setScope(id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
                  fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: ff,
                  border: on ? "1px solid var(--accent-glow)" : "1px solid transparent",
                  background: on ? "var(--accent-dim)" : "transparent",
                  color: on ? "var(--accent)" : "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {text}
                <span style={{ fontSize: 11, opacity: 0.75 }}>{count}</span>
              </button>
            );
          })}
        </div>
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
        <BenchFilters
          jobs={everything}
          value={filter}
          onChange={setFilter}
          shown={shownTotal}
          view={view}
          onViewChange={setView}
          active={only}
          onActiveChange={setOnly}
          sections={filtered.map(({ col, list }) => ({
            key: col.key, title: col.title, tint: col.tint, count: list.length,
          }))}
        />
      )}

      {!nothingAtAll && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(({ col, all, list }) => {
            if (only !== "" && only !== col.key) return null;
            // A search opens whatever holds a hit. Leaving a matching section
            // folded is the same as not finding it — and "Finished" starts
            // folded, so that is exactly where a search would go quiet.
            const open = (searching && list.length > 0) || sectionOpen[col.key];
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
                    {searching ? `${list.length}/${all.length}` : all.length}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{ marginLeft: "auto", color: "var(--text-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.18s" }}
                  />
                </button>

                {open && (
                  <div style={{ padding: "0 16px 16px" }}>
                    {list.length === 0 ? (
                      <p style={{
                        fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff,
                        padding: "16px 12px", textAlign: "center",
                        border: "1px dashed var(--border)", borderRadius: 11,
                      }}>
                        {all.length === 0 ? col.empty : "Nothing here matches that search"}
                      </p>
                    ) : (
                      <div style={view === "list" ? {
                        display: "flex", flexDirection: "column", gap: 6,
                      } : view === "compact" ? {
                        display: "grid", gap: 8, alignItems: "start",
                        /* Five across at full width, dropping to four and then
                           three as the space narrows — the 19% floor is what
                           caps the row at five, and 230px is where a compact
                           tile stops holding a job number, a device and its
                           buttons on one line. */
                        gridTemplateColumns: "repeat(auto-fill, minmax(max(230px, 19%), 1fr))",
                      } : {
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
                            variant={view === "list" ? "row" : view === "compact" ? "compact" : "card"}
                            showTimer={showTimer}
                            // Only where it tells you something. On your own
                            // bench every card would say your name.
                            showTechnician={shopWide}
                            // Visible to everyone, actionable only by the
                            // technician holding it. Unclaimed work stays
                            // claimable — that is the whole point of the pool.
                            readOnly={shopWide && !isUnassigned(j.technician) && j.technician !== technicianName}
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
      {openJob && modal?.kind === "device" && (
        <DeviceDetailsModal job={openJob} onClose={() => setModal(null)} />
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
      {openJob && modal?.kind === "info" && (
        <JobInfoModal job={openJob} onClose={() => setModal(null)} />
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
