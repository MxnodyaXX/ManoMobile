"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchJobs } from "@/lib/repair/api";
import { fetchSales } from "@/lib/sales/api";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import type { SaleTx } from "@/cashier/contexts/SalesContext";

export type FigurePeriod = "Daily" | "Weekly" | "Monthly" | "Yearly" | "All";

export interface SalesByCategory {
  mobile: number;
  accessories: number;
  others: number;
}

export interface IssuedFigures {
  /** Value of jobs issued to customers in the period — repair income. */
  repairIncome: number;
  /** Money actually taken against those jobs. */
  collected: number;
  totalJobs: number;
  /** Counter sales in the period, by category. Voided sales are not sales. */
  sales: SalesByCategory;
  /** The three categories together. */
  salesRevenue: number;
  /** Repairs and counter sales together — what the shop took in. */
  totalRevenue: number;
  /**
   * IDs of the jobs counted above. This hook is deliberately independent of
   * RepairProvider/PartsContext (see below), so it can't compute a real
   * parts-cost figure itself — callers that ARE inside <PartsProvider> use
   * these ids to look up each job's actual approved part requests instead
   * of inventing a number.
   */
  issuedJobIds: string[];
  /** The jobs behind the totals, so a drill-down can show the actual rows
   *  rather than re-deriving them from a different filter and disagreeing. */
  issuedJobs: RepairJob[];
  /** The sales behind the totals, for the same reason. */
  periodSales: SaleTx[];
  /**
   * The same figures for the stretch one period back — yesterday for Daily,
   * the seven days before for Weekly, the same days of last month for
   * Monthly, the same days of last year for Yearly. Null on "All": there is
   * no earlier "everything" to compare with.
   */
  previous: Omit<IssuedFigures, "previous" | "compareLabel" | "allJobs" | "allSales"> | null;
  /** "vs yesterday", "vs last week", … — what `previous` is. Empty on All. */
  compareLabel: string;
  /** Everything loaded, for the charts and the activity feed to bucket their own way. */
  allJobs: RepairJob[];
  allSales: SaleTx[];
}

const EMPTY_BASE = {
  repairIncome: 0, collected: 0, totalJobs: 0,
  sales: { mobile: 0, accessories: 0, others: 0 }, salesRevenue: 0, totalRevenue: 0,
  issuedJobIds: [] as string[], issuedJobs: [] as RepairJob[], periodSales: [] as SaleTx[],
};
const EMPTY: IssuedFigures = { ...EMPTY_BASE, previous: null, compareLabel: "", allJobs: [], allSales: [] };

/** Exported so any other period-filtered view buckets dates the same way. */
export function periodStart(period: FigurePeriod): Date {
  return periodRange(period, 0)!.from;
}

/**
 * The window a period covers, `back` periods ago.
 *
 * Half-open: from ≤ t < to. `back = 0` is the window on screen; `back = 1`
 * is the one before it, cut to the same shape — not the whole of last month
 * against fourteen days of this one, which would make every month look like
 * a collapse until the 28th. Yesterday against today, last week's seven days
 * against this week's, the 1st–15th of last month against the 1st–15th of
 * this. Returns null where no earlier window exists ("All", back 1).
 */
export function periodRange(period: FigurePeriod, back = 0): { from: Date; to: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayAfter = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

  if (period === "All") {
    return back === 0 ? { from: new Date(0), to: dayAfter(today) } : null;
  }
  if (period === "Daily") {
    const from = new Date(today); from.setDate(today.getDate() - back);
    return { from, to: dayAfter(from) };
  }
  if (period === "Weekly") {
    const to = new Date(today); to.setDate(today.getDate() + 1 - 7 * back);
    const from = new Date(to); from.setDate(to.getDate() - 7);
    return { from, to };
  }
  if (period === "Monthly") {
    // The 1st to today, shifted back whole months and clamped to that
    // month's length — the 31st shifted into February is its 28th.
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const to = new Date(first.getFullYear(), first.getMonth(), Math.min(today.getDate(), lastDay) + 1);
    return { from: first, to };
  }
  // Yearly: 1 Jan to today, shifted back whole years.
  const first = new Date(today.getFullYear() - back, 0, 1);
  const to = new Date(today.getFullYear() - back, today.getMonth(), today.getDate() + 1);
  return { from: first, to };
}

export function compareLabel(period: FigurePeriod): string {
  switch (period) {
    case "Daily":   return "vs yesterday";
    case "Weekly":  return "vs last week";
    case "Monthly": return "vs last month";
    case "Yearly":  return "vs last year";
    default:        return "";
  }
}

/** When the customer took the device away — the moment the money is earned. */
export const issuedOn = (j: RepairJob) => j.handover?.handedOverAt ?? j.completedAt ?? j.createdAt;

const within = (iso: string, r: { from: Date; to: Date }) => {
  const t = new Date(iso).getTime();
  return t >= r.from.getTime() && t < r.to.getTime();
};

function figuresIn(jobs: RepairJob[], sales: SaleTx[], range: { from: Date; to: Date }) {
  const issued = jobs.filter(j => j.status === "Delivered" && within(issuedOn(j), range));
  // Repair sales are the same money the jobs above already count, so only the
  // counter's own categories are summed here — otherwise a repair would be
  // revenue twice, once as a job and once as its invoice.
  const inPeriod = sales.filter(s => s.status !== "Voided" && within(`${s.date}T12:00:00`, range));
  const byCat = (c: SaleTx["category"]) => inPeriod.filter(s => s.category === c).reduce((t, s) => t + s.total, 0);
  const cats: SalesByCategory = {
    mobile: byCat("Mobile"),
    accessories: byCat("Accessories"),
    others: byCat("Others"),
  };
  const repairIncome = issued.reduce((sum, j) => sum + j.estimatedCost, 0);
  const salesRevenue = cats.mobile + cats.accessories + cats.others;
  return {
    repairIncome,
    collected:    issued.reduce((sum, j) => sum + j.advancePaid, 0),
    totalJobs:    issued.length,
    sales: cats,
    salesRevenue,
    totalRevenue: repairIncome + salesRevenue,
    issuedJobIds: issued.map(j => j.id),
    issuedJobs: issued,
    periodSales: inPeriod,
  };
}

export function computeIssuedFigures(jobs: RepairJob[], period: FigurePeriod, sales: SaleTx[] = []): IssuedFigures {
  const now = periodRange(period, 0)!;
  const before = periodRange(period, 1);
  return {
    ...figuresIn(jobs, sales, now),
    previous: before ? figuresIn(jobs, sales, before) : null,
    compareLabel: compareLabel(period),
    allJobs: jobs,
    allSales: sales,
  };
}

/**
 * Dashboard figures read straight from the database.
 *
 * Deliberately independent of RepairProvider: the page shell that owns the
 * period filter renders above the providers, so a context-based hook there
 * would silently read an empty job list and report zero revenue.
 */
export function useIssuedFigures(period: FigurePeriod): IssuedFigures {
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [sales, setSales] = useState<SaleTx[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    fetchJobs()
      .then(rows => { if (active) setJobs(rows); })
      .catch(() => { /* the dashboard degrades to zeros rather than breaking */ });
    fetchSales()
      .then(rows => { if (active) setSales(rows); })
      .catch(() => { /* likewise: repairs still show, sales read as none */ });
    return () => { active = false; };
  }, []);

  return jobs.length || sales.length ? computeIssuedFigures(jobs, period, sales) : EMPTY;
}

/* ── Series for the dashboard charts ──────────────────────────────────────── */

export interface SeriesPoint { name: string; value: number }

/**
 * How the chart buckets time, per filter.
 *
 * The two charts were empty arrays — placeholders left behind when the mock
 * data was stripped and never replaced with the real thing. The buckets
 * follow the filter, because a "last 7 months" line under a Daily filter
 * answers a question nobody just asked: a day view wants the last fortnight
 * by day, a week view the last eight weeks by week.
 */
export function seriesShape(period: FigurePeriod): { unit: "day" | "week" | "month"; count: number; label: string } {
  switch (period) {
    case "Daily":   return { unit: "day",   count: 14, label: "Last 14 days" };
    case "Weekly":  return { unit: "week",  count: 8,  label: "Last 8 weeks" };
    case "Monthly": return { unit: "month", count: 7,  label: "Last 7 months" };
    default:        return { unit: "month", count: 12, label: "Last 12 months" };
  }
}

export function bucketsFor(period: FigurePeriod): { from: Date; to: Date; name: string }[] {
  const { unit, count } = seriesShape(period);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: { from: Date; to: Date; name: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    if (unit === "day") {
      const from = new Date(today); from.setDate(today.getDate() - i);
      const to = new Date(from); to.setDate(from.getDate() + 1);
      out.push({ from, to, name: from.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) });
    } else if (unit === "week") {
      const to = new Date(today); to.setDate(today.getDate() + 1 - 7 * i);
      const from = new Date(to); from.setDate(to.getDate() - 7);
      out.push({ from, to, name: from.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) });
    } else {
      const from = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      out.push({ from, to, name: from.toLocaleDateString("en-GB", { month: "short", year: count > 7 ? "2-digit" : undefined }) });
    }
  }
  return out;
}

/** Repairs and counter sales together, per bucket. */
export function revenueSeries(jobs: RepairJob[], sales: SaleTx[], period: FigurePeriod): SeriesPoint[] {
  return bucketsFor(period).map(b => {
    const f = figuresIn(jobs, sales, b);
    return { name: b.name, value: f.totalRevenue };
  });
}

/** Counter sales only — Mobile, Accessories, Others — per bucket. */
export function salesSeries(jobs: RepairJob[], sales: SaleTx[], period: FigurePeriod): SeriesPoint[] {
  return bucketsFor(period).map(b => {
    const f = figuresIn(jobs, sales, b);
    return { name: b.name, value: f.salesRevenue };
  });
}

/* ── Recent activity ──────────────────────────────────────────────────────── */

export interface ActivityItem {
  kind: "booked" | "completed" | "delivered" | "sale";
  text: string;
  at: string;
  /** For the feed to deep-link: a job id, or an invoice number. */
  ref: string;
}

/**
 * The last things that happened at the shop, from what the records say.
 *
 * Read off the jobs and sales already loaded rather than a separate event
 * table: every job carries when it was booked, finished and handed over, and
 * every sale its date. Newest first, capped, so the panel is a glance and
 * not a log.
 */
export function recentActivity(jobs: RepairJob[], sales: SaleTx[], limit = 8): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const j of jobs) {
    const device = [j.brand, j.model].filter(Boolean).join(" ") || "a device";
    items.push({ kind: "booked", text: `${j.id} booked in — ${device}${j.customerName ? ` for ${j.customerName}` : ""}`, at: j.createdAt, ref: j.id });
    if (j.completedAt) items.push({ kind: "completed", text: `${j.id} finished${j.technician && j.technician !== "Unassigned" ? ` by ${j.technician}` : ""} — ${device}`, at: j.completedAt, ref: j.id });
    if (j.status === "Delivered" && j.handover?.handedOverAt) items.push({ kind: "delivered", text: `${j.id} collected — ${device}`, at: j.handover.handedOverAt, ref: j.id });
  }
  for (const s of sales) {
    if (s.status === "Voided") continue;
    items.push({ kind: "sale", text: `${s.invoiceNo} — ${s.category} sale to ${s.customer || "walk-in"}, Rs. ${Math.round(s.total).toLocaleString("en-LK")}`, at: `${s.date}T12:00:00`, ref: s.invoiceNo });
  }
  return items
    .filter(i => !isNaN(new Date(i.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

/* ── Series for the four dashboard charts ─────────────────────────────────── */

/** Revenue per bucket, split by where it came from — the stacked-area chart. */
export interface RevenueByCategoryPoint {
  name: string;
  repair: number;
  accessories: number;
  mobile: number;
  others: number;
  total: number;
}

export function revenueByCategorySeries(jobs: RepairJob[], sales: SaleTx[], period: FigurePeriod): RevenueByCategoryPoint[] {
  return bucketsFor(period).map(b => {
    const f = figuresIn(jobs, sales, b);
    return {
      name: b.name,
      repair: f.repairIncome,
      accessories: f.sales.accessories,
      mobile: f.sales.mobile,
      others: f.sales.others,
      total: f.totalRevenue,
    };
  });
}

/**
 * Where every open job stands, in four groups.
 *
 * Four rather than the six a status list suggests, because a donut is read by
 * colour and this palette validates four wedges for every kind of colour
 * vision and not five — "Received" and "Assigned" are one wedge with the
 * split named in its label, which is also the more honest grouping: both are
 * phones nobody has started on.
 */
export interface StatusSlice {
  key: "waiting" | "active" | "hold" | "ready";
  label: string;
  count: number;
  /** A line under the label — the unassigned share of the waiting wedge. */
  detail?: string;
  /** Which Repair Management tab shows exactly these jobs. */
  section: "Not Started" | "Started" | "Pending" | "Non-Issued";
}

export function repairStatusSlices(jobs: RepairJob[]): StatusSlice[] {
  const open = jobs.filter(j => j.status !== "Delivered" && j.status !== "Cancelled");
  const notStarted = open.filter(j => j.status === "Non-Issued");
  const unassigned = notStarted.filter(j => !j.technician || j.technician.trim() === "" || j.technician.trim().toLowerCase() === "unassigned").length;
  return [
    {
      key: "waiting", label: "Waiting to start", count: notStarted.length,
      detail: notStarted.length ? `${unassigned} unassigned · ${notStarted.length - unassigned} assigned` : undefined,
      section: "Not Started",
    },
    { key: "active", label: "In progress",      count: open.filter(j => j.status === "Issued").length,    section: "Started" },
    { key: "hold",   label: "On hold",          count: open.filter(j => j.status === "Pending").length,   section: "Pending" },
    { key: "ready",  label: "Ready to collect", count: open.filter(j => j.status === "Completed").length, section: "Non-Issued" },
  ];
}

/** Jobs taken in and jobs finished, per bucket — the backlog chart. */
export interface FlowPoint { name: string; received: number; completed: number }

export function receivedVsCompletedSeries(jobs: RepairJob[], period: FigurePeriod): FlowPoint[] {
  return bucketsFor(period).map(b => ({
    name: b.name,
    received:  jobs.filter(j => within(j.createdAt, b)).length,
    completed: jobs.filter(j => !!j.completedAt && within(j.completedAt, b)).length,
  }));
}

/** How the bench is loaded, per technician. */
export type WorkloadMode = "active" | "today" | "month";

export interface WorkloadRow { name: string; count: number }

export function technicianWorkload(jobs: RepairJob[], mode: WorkloadMode): WorkloadRow[] {
  const today = periodRange("Daily", 0)!;
  const month = periodRange("Monthly", 0)!;
  const counted = jobs.filter(j => {
    if (!j.technician || j.technician.trim().toLowerCase() === "unassigned") return false;
    if (mode === "active") return j.status === "Non-Issued" || j.status === "Issued" || j.status === "Pending";
    if (!j.completedAt) return false;
    return within(j.completedAt, mode === "today" ? today : month);
  });
  const by = new Map<string, number>();
  for (const j of counted) by.set(j.technician.trim(), (by.get(j.technician.trim()) ?? 0) + 1);
  return [...by.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
