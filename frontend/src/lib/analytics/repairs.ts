"use client";

import type { RepairJob } from "@/cashier/contexts/RepairContext";
import type { AnalyticsData, JobEvent } from "./data";
import { partsCost, live } from "./overview";
import { daysBetween, daysSince, delta, inWindow, parseWhen, type Delta, type Window } from "./window";

/**
 * The repair business, in numbers — sections 4 to 7 and 23 to 27 of the
 * brief: volumes, money, turnaround stage by stage, faults, devices, the
 * queue, collection, and the two ways a job reaches a bench (claimed from
 * the pool, or assigned).
 *
 * Time is read from the job's own stamps (created, started, completed) and,
 * for what those do not hold, from the event trail: the moment a job was
 * delivered, claimed, reassigned or released.
 */

const DAY = 86_400_000;
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const isReturn = (j: RepairJob) => j.completionType === "Return" || j.completionType === "Cash Return";
const isOpen = (j: RepairJob) => j.status === "Non-Issued" || j.status === "Issued" || j.status === "Pending";
const isFinished = (j: RepairJob) => j.status === "Completed" || j.status === "Delivered";
const assigned = (j: RepairJob) => !!j.technician && j.technician.trim().toLowerCase() !== "unassigned";

/** When a job was handed over — the event trail first, the handover record as fallback. */
function deliveredAt(j: RepairJob, byJob: Map<string, JobEvent[]>): string | null {
  const ev = byJob.get(j.id)?.find(e => e.to === "Delivered");
  return ev?.changedAt ?? j.handover?.handedOverAt ?? null;
}

export function eventsByJob(events: JobEvent[]): Map<string, JobEvent[]> {
  const m = new Map<string, JobEvent[]>();
  for (const e of events) {
    const list = m.get(e.jobId) ?? [];
    list.push(e);
    m.set(e.jobId, list);
  }
  // Oldest first, so "the first time it reached X" is index-findable.
  m.forEach(list => list.sort((a, b) => a.changedAt.localeCompare(b.changedAt)));
  return m;
}

/* ── Volumes and money ──────────────────────────────────────────────────── */

export interface RepairKpis {
  received: Delta; started: Delta; finished: Delta; delivered: Delta; cancelled: Delta; returned: Delta; cashReturns: Delta;
  revenue: Delta; avgValue: Delta; highest: number; profit: Delta; margin: number | null;
  // Snapshots
  unassigned: number; assignedNotStarted: number; inProgress: number; waiting: number; ready: number; inShop: number;
  receivedToday: number; finishedToday: number;
}

export function repairKpis(d: AnalyticsData, w: Window, prev: Window | null, byJob: Map<string, JobEvent[]>): RepairKpis {
  const jobs = d.jobs;
  const inW = (p: (j: RepairJob) => string | null | undefined, win: Window) => jobs.filter(j => inWindow(p(j), win));
  const count = (p: (j: RepairJob) => string | null | undefined, f: (j: RepairJob) => boolean = () => true) =>
    delta(inW(p, w).filter(f).length, prev ? inW(p, prev).filter(f).length : 0);

  const finishedIn = (win: Window) => jobs.filter(j => isFinished(j) && inWindow(j.completedAt, win));
  const priced = (win: Window) => finishedIn(win).filter(j => !isReturn(j) && j.estimatedCost > 0);
  const revenueIn = (win: Window) => live(d.sales, win).filter(s => s.category === "Repair").reduce((t, s) => t + s.total, 0);
  const costIn = (win: Window) => finishedIn(win).reduce((t, j) => t + partsCost(j, d) + (d.agentCosts[j.id] ?? 0), 0);
  const rev = revenueIn(w), revPrev = prev ? revenueIn(prev) : 0;
  const profit = rev - costIn(w), profitPrev = prev ? revPrev - costIn(prev) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayW: Window = { from: parseWhen(today)!, to: new Date(parseWhen(today)!.getTime() + DAY), label: "", compareLabel: null };

  return {
    received:   count(j => j.createdAt, j => j.status !== "Cancelled"),
    started:    count(j => j.startedAt),
    finished:   delta(finishedIn(w).length, prev ? finishedIn(prev).length : 0),
    delivered:  delta(jobs.filter(j => j.status === "Delivered" && inWindow(deliveredAt(j, byJob), w)).length, prev ? jobs.filter(j => j.status === "Delivered" && inWindow(deliveredAt(j, byJob), prev)).length : 0),
    cancelled:  count(j => j.cancelledAt ?? (j.status === "Cancelled" ? j.createdAt : null), j => j.status === "Cancelled"),
    returned:   delta(finishedIn(w).filter(j => j.completionType === "Return").length, prev ? finishedIn(prev).filter(j => j.completionType === "Return").length : 0),
    cashReturns: delta(finishedIn(w).filter(j => j.completionType === "Cash Return").length, prev ? finishedIn(prev).filter(j => j.completionType === "Cash Return").length : 0),
    revenue:    delta(rev, revPrev),
    avgValue:   delta(mean(priced(w).map(j => j.estimatedCost)) ?? 0, prev ? (mean(priced(prev).map(j => j.estimatedCost)) ?? 0) : 0),
    highest:    Math.max(0, ...priced(w).map(j => j.estimatedCost)),
    profit:     delta(profit, profitPrev),
    margin:     rev > 0 ? profit / rev : null,
    unassigned: jobs.filter(j => j.status === "Non-Issued" && !assigned(j)).length,
    assignedNotStarted: jobs.filter(j => j.status === "Non-Issued" && assigned(j)).length,
    inProgress: jobs.filter(j => j.status === "Issued").length,
    waiting:    jobs.filter(j => j.status === "Pending").length,
    ready:      jobs.filter(j => j.status === "Completed").length,
    inShop:     jobs.filter(j => isOpen(j) || j.status === "Completed").length,
    receivedToday: jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, todayW)).length,
    finishedToday: jobs.filter(j => isFinished(j) && inWindow(j.completedAt, todayW)).length,
  };
}

/* ── Turnaround ─────────────────────────────────────────────────────────── */

export interface Turnaround {
  createdToStarted: number | null;
  startedToFinished: number | null;
  finishedToCollected: number | null;
  createdToCollected: number | null;
  waitingForParts: number | null;
  sameDay: number; sameDayPct: number | null;
  within24h: number; within48h: number; over7d: number;
  finishedCount: number;
  oldestUnfinished: { id: string; days: number; device: string } | null;
  delayed: number;
  dueSoon: number;
}

export function turnaround(d: AnalyticsData, w: Window, byJob: Map<string, JobEvent[]>, now = new Date()): Turnaround {
  const finished = d.jobs.filter(j => isFinished(j) && inWindow(j.completedAt, w));
  const q: number[] = [], b: number[] = [], c: number[] = [], t: number[] = [], p: number[] = [];
  let sameDay = 0, w24 = 0, w48 = 0, o7 = 0;
  for (const j of finished) {
    const qd = daysBetween(j.createdAt, j.startedAt); if (qd !== null) q.push(qd);
    const bd = daysBetween(j.startedAt ?? j.createdAt, j.completedAt); if (bd !== null) b.push(bd);
    const del = deliveredAt(j, byJob);
    const cd = daysBetween(j.completedAt, del); if (cd !== null) c.push(cd);
    const td = daysBetween(j.createdAt, del ?? j.completedAt); if (td !== null) t.push(td);
    const total = daysBetween(j.createdAt, j.completedAt) ?? 0;
    const s = parseWhen(j.createdAt), e = parseWhen(j.completedAt);
    if (s && e && s.toDateString() === e.toDateString()) sameDay += 1;
    if (total <= 1) w24 += 1;
    if (total <= 2) w48 += 1;
    if (total > 7) o7 += 1;
    // Time on hold: every Pending stretch in the trail.
    const ev = byJob.get(j.id) ?? [];
    let onHold = 0;
    for (let i = 0; i < ev.length; i++) {
      if (ev[i].to === "Pending") {
        const end = ev.slice(i + 1).find(x => x.to !== "Pending")?.changedAt ?? j.completedAt;
        onHold += daysBetween(ev[i].changedAt, end) ?? 0;
      }
    }
    if (onHold > 0) p.push(onHold);
  }
  const open = d.jobs.filter(isOpen);
  const oldest = open.map(j => ({ id: j.id, days: daysSince(j.createdAt, now) ?? 0, device: `${j.brand} ${j.model}`.trim() })).sort((a, b) => b.days - a.days)[0] ?? null;
  const today = now.toISOString().slice(0, 10);
  const soon = new Date(now.getTime() + 2 * DAY).toISOString().slice(0, 10);
  return {
    createdToStarted: mean(q), startedToFinished: mean(b), finishedToCollected: mean(c), createdToCollected: mean(t), waitingForParts: mean(p),
    sameDay, sameDayPct: finished.length ? sameDay / finished.length : null,
    within24h: w24, within48h: w48, over7d: o7, finishedCount: finished.length,
    oldestUnfinished: oldest,
    delayed: open.filter(j => j.estimatedCompletion && j.estimatedCompletion < today).length,
    dueSoon: open.filter(j => j.estimatedCompletion && j.estimatedCompletion >= today && j.estimatedCompletion <= soon).length,
  };
}

/** Mean days on the bench, grouped by whatever the caller keys on. */
export function turnaroundBy(jobs: RepairJob[], w: Window, keyOf: (j: RepairJob) => string): { name: string; value: number; sub: string }[] {
  const m = new Map<string, number[]>();
  for (const j of jobs) {
    if (!isFinished(j) || !inWindow(j.completedAt, w)) continue;
    const dd = daysBetween(j.startedAt ?? j.createdAt, j.completedAt);
    if (dd === null) continue;
    const k = keyOf(j) || "Unknown";
    m.set(k, [...(m.get(k) ?? []), dd]);
  }
  return Array.from(m.entries()).map(([name, ds]) => ({ name, value: mean(ds) ?? 0, sub: `${ds.length} job${ds.length === 1 ? "" : "s"}` }))
    .filter(r => r.sub !== "0 jobs").sort((a, b) => b.value - a.value);
}

/* ── Faults ─────────────────────────────────────────────────────────────── */

export const FAULT_RULES: { name: string; test: RegExp }[] = [
  { name: "Screen / display",  test: /screen|display|lcd|touch|glass|crack|broken|line/i },
  { name: "Battery",           test: /batter|drain|swell|backup/i },
  { name: "Charging",          test: /charg|port|type-?c|pin|cable/i },
  { name: "Software",          test: /software|flash|unlock|frp|reset|update|hang|restart|boot|os\b|android|ios|pattern|password|virus/i },
  { name: "Board / IC",        test: /board|ic\b|chip|motherboard|dead|no power|short|power ic|cpu|emmc/i },
  { name: "Water damage",      test: /water|liquid|wet|damp|moist/i },
  { name: "Camera",            test: /camera|lens|focus/i },
  { name: "Speaker / audio",   test: /speaker|mic|audio|sound|ear ?piece|ringer|volume/i },
  { name: "Network / SIM",     test: /network|sim|signal|wifi|wi-fi|bluetooth|imei/i },
  { name: "Buttons / body",    test: /button|key|back cover|housing|frame|hinge|body/i },
];

export const faultCategory = (issue: string | undefined | null): string =>
  FAULT_RULES.find(r => r.test.test(issue ?? ""))?.name ?? "Other";

export interface FaultRow { name: string; count: number; share: number; avgCost: number | null; avgDays: number | null; revenue: number; repeats: number; profit: number }

export function faultRows(d: AnalyticsData, w: Window): FaultRow[] {
  const inW = d.jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, w));
  const m = new Map<string, { count: number; costs: number[]; days: number[]; revenue: number; repeats: number; cost: number }>();
  for (const j of inW) {
    const k = faultCategory(j.issue);
    const r = m.get(k) ?? { count: 0, costs: [], days: [], revenue: 0, repeats: 0, cost: 0 };
    r.count += 1;
    if (j.rejobOf) r.repeats += 1;
    if (isFinished(j) && !isReturn(j)) {
      if (j.estimatedCost > 0) r.costs.push(j.estimatedCost);
      r.revenue += j.estimatedCost;
      r.cost += partsCost(j, d) + (d.agentCosts[j.id] ?? 0);
      const dd = daysBetween(j.startedAt ?? j.createdAt, j.completedAt); if (dd !== null) r.days.push(dd);
    }
    m.set(k, r);
  }
  const total = inW.length || 1;
  return Array.from(m.entries()).map(([name, r]) => ({
    name, count: r.count, share: r.count / total, avgCost: mean(r.costs), avgDays: mean(r.days), revenue: r.revenue, repeats: r.repeats, profit: r.revenue - r.cost,
  })).sort((a, b) => b.count - a.count);
}

/** Top brands × top faults, as counts. */
export function faultsByBrand(d: AnalyticsData, w: Window, brands = 6, faults = 5): { brands: string[]; faults: string[]; cell: (b: string, f: string) => number } {
  const inW = d.jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, w));
  const bc = new Map<string, number>(), fc = new Map<string, number>(), cell = new Map<string, number>();
  for (const j of inW) {
    const b = (j.brand || "Unknown").trim(), f = faultCategory(j.issue);
    bc.set(b, (bc.get(b) ?? 0) + 1); fc.set(f, (fc.get(f) ?? 0) + 1); cell.set(`${b} ${f}`, (cell.get(`${b} ${f}`) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n: number) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  return { brands: top(bc, brands), faults: top(fc, faults), cell: (b, f) => cell.get(`${b} ${f}`) ?? 0 };
}

/* ── Devices ────────────────────────────────────────────────────────────── */

export interface DeviceRow { name: string; jobs: number; revenue: number; avgCost: number | null; avgDays: number | null; repeats: number; warranty: number }

export function deviceRows(d: AnalyticsData, w: Window, keyOf: (j: RepairJob) => string, limit = 12): DeviceRow[] {
  const inW = d.jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, w));
  const m = new Map<string, { jobs: number; revenue: number; costs: number[]; days: number[]; repeats: number; warranty: number }>();
  for (const j of inW) {
    const k = keyOf(j) || "Unknown";
    const r = m.get(k) ?? { jobs: 0, revenue: 0, costs: [], days: [], repeats: 0, warranty: 0 };
    r.jobs += 1;
    if (j.rejobOf) { r.repeats += 1; if (j.completionType === "FOC" || j.estimatedCost === 0) r.warranty += 1; }
    if (isFinished(j) && !isReturn(j)) {
      r.revenue += j.estimatedCost;
      if (j.estimatedCost > 0) r.costs.push(j.estimatedCost);
      const dd = daysBetween(j.startedAt ?? j.createdAt, j.completedAt); if (dd !== null) r.days.push(dd);
    }
    m.set(k, r);
  }
  return Array.from(m.entries()).map(([name, r]) => ({ name, jobs: r.jobs, revenue: r.revenue, avgCost: mean(r.costs), avgDays: mean(r.days), repeats: r.repeats, warranty: r.warranty }))
    .sort((a, b) => b.jobs - a.jobs || b.revenue - a.revenue).slice(0, limit);
}

export interface RepeatDevice { imei: string; device: string; customer: string; visits: number; last: string; jobs: string[] }

/** Devices seen more than once, by IMEI — all time, since a repeat is a repeat whenever it happened. */
export function repeatDevices(d: AnalyticsData, limit = 15): RepeatDevice[] {
  const m = new Map<string, RepairJob[]>();
  for (const j of d.jobs) {
    const imei = (j.imei ?? "").replace(/\D/g, "");
    if (imei.length < 14 || j.status === "Cancelled") continue;
    m.set(imei, [...(m.get(imei) ?? []), j]);
  }
  return Array.from(m.entries()).filter(([, js]) => js.length > 1).map(([imei, js]) => {
    const sorted = js.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { imei, device: `${sorted[0].brand} ${sorted[0].model}`.trim(), customer: sorted[0].customerName, visits: js.length, last: sorted[0].createdAt.slice(0, 10), jobs: sorted.map(j => j.id) };
  }).sort((a, b) => b.visits - a.visits || b.last.localeCompare(a.last)).slice(0, limit);
}

/* ── Queue and collection ───────────────────────────────────────────────── */

export interface QueueStage { key: string; label: string; count: number; avgAge: number | null; oldest: number }
export interface Queue {
  stages: QueueStage[];
  size: number;
  avgAge: number | null;
  bottleneck: string | null;
  enteringPerDay: number;
  leavingPerDay: number;
  backlogChange: number;
}

export function queue(d: AnalyticsData, w: Window, now = new Date()): Queue {
  const stageOf = (j: RepairJob) => j.status === "Non-Issued" ? "notStarted" : j.status === "Issued" ? "inProgress" : j.status === "Pending" ? "waiting" : j.status === "Completed" ? "ready" : null;
  const defs = [
    { key: "notStarted", label: "Waiting to start" }, { key: "inProgress", label: "In progress" },
    { key: "waiting", label: "Waiting for parts" }, { key: "ready", label: "Ready for collection" },
  ];
  const stages = defs.map(s => {
    const js = d.jobs.filter(j => stageOf(j) === s.key);
    // Age since the job entered this stage: the stage's own stamp, else intake.
    const ages = js.map(j => daysSince(s.key === "inProgress" ? (j.startedAt ?? j.createdAt) : s.key === "ready" ? (j.completedAt ?? j.createdAt) : j.createdAt, now) ?? 0);
    return { ...s, count: js.length, avgAge: mean(ages), oldest: Math.max(0, ...ages) };
  });
  const open = d.jobs.filter(j => isOpen(j) || j.status === "Completed");
  const spanDays = Math.max(1, (Math.min(w.to.getTime(), now.getTime()) - Math.max(w.from.getTime(), 0)) / DAY);
  const entering = d.jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, w)).length;
  const leaving = d.jobs.filter(j => isFinished(j) && inWindow(j.completedAt, w)).length;
  const slowest = stages.filter(s => s.count > 0 && s.key !== "ready").sort((a, b) => (b.avgAge ?? 0) - (a.avgAge ?? 0))[0];
  return {
    stages, size: open.length,
    avgAge: mean(open.map(j => daysSince(j.createdAt, now) ?? 0)),
    bottleneck: slowest ? slowest.label : null,
    enteringPerDay: entering / spanDays, leavingPerDay: leaving / spanDays, backlogChange: entering - leaving,
  };
}

export interface Collection {
  awaiting: number; value: number; avgDelay: number | null;
  over1: number; over3: number; over7: number;
  longest: { id: string; days: number; device: string; customer: string } | null;
  remindersSent: number; collectedAfterReminder: number; remindedJobs: number;
}

export function collection(d: AnalyticsData, w: Window, byJob: Map<string, JobEvent[]>, now = new Date()): Collection {
  const ready = d.jobs.filter(j => j.status === "Completed");
  const ages = ready.map(j => ({ j, days: daysSince(j.completedAt ?? j.createdAt, now) ?? 0 }));
  const delivered = d.jobs.filter(j => j.status === "Delivered" && inWindow(deliveredAt(j, byJob), w));
  const delays = delivered.map(j => daysBetween(j.completedAt, deliveredAt(j, byJob))).filter((x): x is number => x !== null);
  const reminders = d.sms.filter(s => s.purpose === "pickup-reminder" && inWindow(s.createdAt, w));
  const remindedJobs = new Set(reminders.map(r => r.jobId).filter((x): x is string => !!x));
  const collectedAfter = Array.from(remindedJobs).filter(id => {
    const j = d.jobs.find(x => x.id === id);
    const del = j ? deliveredAt(j, byJob) : null;
    const first = reminders.filter(r => r.jobId === id).map(r => r.createdAt).sort()[0];
    return !!del && !!first && del > first;
  }).length;
  const longest = ages.sort((a, b) => b.days - a.days)[0];
  return {
    awaiting: ready.length,
    value: ready.reduce((t, j) => t + Math.max(0, j.estimatedCost - j.advancePaid - (j.writtenOff ?? 0)), 0),
    avgDelay: mean(delays),
    over1: ages.filter(a => a.days > 1).length, over3: ages.filter(a => a.days > 3).length, over7: ages.filter(a => a.days > 7).length,
    longest: longest ? { id: longest.j.id, days: longest.days, device: `${longest.j.brand} ${longest.j.model}`.trim(), customer: longest.j.customerName } : null,
    remindersSent: reminders.length, collectedAfterReminder: collectedAfter, remindedJobs: remindedJobs.size,
  };
}

/* ── Hall-shop (claimed) and assigned mode ──────────────────────────────── */

export interface BenchModes {
  availableNow: number;
  claimed: number; assigned: number;
  claimToStart: number | null; claimToFinish: number | null;
  assignToStart: number | null; assignToFinish: number | null;
  timeUntilClaimed: number | null;
  abandonedClaims: number;
  reassignments: number; released: number;
  claimsPer: { name: string; value: number }[];
  assignedPer: { name: string; value: number }[];
  waitingLongAfterAssign: number;
}

export function benchModes(d: AnalyticsData, w: Window, byJob: Map<string, JobEvent[]>, now = new Date()): BenchModes {
  const inW = d.jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, w));
  const claimEvent = (j: RepairJob) => byJob.get(j.id)?.find(e => /claimed from the available pool/i.test(e.note ?? ""));
  const claimed = inW.filter(j => j.assignmentSource === "Self-Taken" || !!claimEvent(j));
  const assignedJobs = inW.filter(j => assigned(j) && !claimed.includes(j));
  const cs: number[] = [], cf: number[] = [], as: number[] = [], af: number[] = [], tuc: number[] = [];
  for (const j of claimed) {
    const at = claimEvent(j)?.changedAt ?? j.startedAt;
    const a = daysBetween(j.createdAt, at); if (a !== null) tuc.push(a);
    const s = daysBetween(at, j.startedAt); if (s !== null) cs.push(s);
    const f = daysBetween(at, j.completedAt); if (f !== null) cf.push(f);
  }
  for (const j of assignedJobs) {
    const s = daysBetween(j.createdAt, j.startedAt); if (s !== null) as.push(s);
    const f = daysBetween(j.createdAt, j.completedAt); if (f !== null) af.push(f);
  }
  const per = (js: RepairJob[]) => {
    const m = new Map<string, number>();
    js.forEach(j => { const k = j.technician?.trim() || "Unassigned"; m.set(k, (m.get(k) ?? 0) + 1); });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const evIn = d.events.filter(e => inWindow(e.changedAt, w));
  return {
    availableNow: d.jobs.filter(j => j.status === "Non-Issued" && !assigned(j)).length,
    claimed: claimed.length, assigned: assignedJobs.length,
    claimToStart: mean(cs), claimToFinish: mean(cf), assignToStart: mean(as), assignToFinish: mean(af), timeUntilClaimed: mean(tuc),
    abandonedClaims: claimed.filter(j => j.status === "Non-Issued" && (daysSince(claimEvent(j)?.changedAt ?? j.createdAt, now) ?? 0) > 2).length,
    reassignments: evIn.filter(e => /reassigned/i.test(e.note ?? "")).length,
    released: evIn.filter(e => /released back/i.test(e.note ?? "")).length,
    claimsPer: per(claimed), assignedPer: per(assignedJobs),
    waitingLongAfterAssign: d.jobs.filter(j => j.status === "Non-Issued" && assigned(j) && (daysSince(j.createdAt, now) ?? 0) > 2).length,
  };
}

/* ── Hour and weekday ───────────────────────────────────────────────────── */

export function byHour(d: AnalyticsData, w: Window): { name: string; received: number; completed: number }[] {
  const rec = new Array<number>(24).fill(0), done = new Array<number>(24).fill(0);
  d.jobs.forEach(j => {
    if (j.status === "Cancelled") return;
    if (inWindow(j.createdAt, w) && j.createdAt.length > 10) { const t = parseWhen(j.createdAt); if (t) rec[t.getHours()] += 1; }
    if (inWindow(j.completedAt, w) && (j.completedAt ?? "").length > 10) { const t = parseWhen(j.completedAt); if (t) done[t.getHours()] += 1; }
  });
  return rec.map((r, h) => ({ name: `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`, received: r, completed: done[h] })).filter((_, h) => h >= 7 && h <= 21);
}

export function byWeekday(d: AnalyticsData, w: Window): { name: string; received: number; completed: number }[] {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const rec = new Array<number>(7).fill(0), done = new Array<number>(7).fill(0);
  d.jobs.forEach(j => {
    if (j.status === "Cancelled") return;
    const c = parseWhen(j.createdAt); if (c && inWindow(j.createdAt, w)) rec[(c.getDay() + 6) % 7] += 1;
    const e = parseWhen(j.completedAt); if (e && inWindow(j.completedAt, w)) done[(e.getDay() + 6) % 7] += 1;
  });
  return names.map((name, i) => ({ name, received: rec[i], completed: done[i] }));
}
