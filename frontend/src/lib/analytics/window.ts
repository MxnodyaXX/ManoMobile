"use client";

/**
 * Time, for Analytics.
 *
 * One window model every tab shares: a preset or a custom range, the
 * previous stretch of the same length to compare against, and the buckets
 * a series is drawn in. Kept here so "This month vs last month" means the
 * same thing on the Sales tab as on the Repairs tab.
 *
 * Every window is [from, to) in local time — from is midnight on its first
 * day, to is midnight after its last — so a sale at 23:59 belongs to the day
 * it was made and a bare date (a sale's sold_on) lands on its own day.
 */

export type Preset =
  | "today" | "yesterday" | "last7" | "thisWeek" | "prevWeek" | "last30"
  | "thisMonth" | "prevMonth" | "thisQuarter" | "prevQuarter" | "thisYear" | "prevYear" | "all" | "custom";

export interface Window {
  from: Date;
  to: Date;
  /** For the heading: "This month", "12 Aug – 18 Aug". */
  label: string;
  /** What the comparison is against: "last month". Null when nothing sensible. */
  compareLabel: string | null;
}

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "today",       label: "Today" },
  { id: "yesterday",   label: "Yesterday" },
  { id: "last7",       label: "Last 7 days" },
  { id: "thisWeek",    label: "This week" },
  { id: "prevWeek",    label: "Previous week" },
  { id: "last30",      label: "Last 30 days" },
  { id: "thisMonth",   label: "This month" },
  { id: "prevMonth",   label: "Previous month" },
  { id: "thisQuarter", label: "This quarter" },
  { id: "prevQuarter", label: "Previous quarter" },
  { id: "thisYear",    label: "This year" },
  { id: "prevYear",    label: "Previous year" },
  { id: "all",         label: "All time" },
  { id: "custom",      label: "Custom range" },
];

const DAY = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
/** Monday-first week start. */
const weekStart = (d: Date) => addDays(midnight(d), -((d.getDay() + 6) % 7));
const quarterStart = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);

const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const fmtRange = (from: Date, to: Date) => `${fmtDay(from)} – ${fmtDay(addDays(to, -1))}`;

/** A bare date is a local day, not UTC midnight. */
export function parseWhen(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export const inWindow = (iso: string | null | undefined, w: { from: Date; to: Date }): boolean => {
  const d = parseWhen(iso);
  return !!d && d >= w.from && d < w.to;
};

export function windowFor(preset: Preset, custom: { from: string; to: string }, now = new Date()): Window {
  const today = midnight(now);
  const tomorrow = addDays(today, 1);
  switch (preset) {
    case "today":       return { from: today, to: tomorrow, label: "Today", compareLabel: "yesterday" };
    case "yesterday":   return { from: addDays(today, -1), to: today, label: "Yesterday", compareLabel: "the day before" };
    case "last7":       return { from: addDays(today, -6), to: tomorrow, label: "Last 7 days", compareLabel: "the 7 days before" };
    case "thisWeek":    return { from: weekStart(today), to: tomorrow, label: "This week", compareLabel: "the same days last week" };
    case "prevWeek":    { const s = addDays(weekStart(today), -7); return { from: s, to: addDays(s, 7), label: "Previous week", compareLabel: "the week before" }; }
    case "last30":      return { from: addDays(today, -29), to: tomorrow, label: "Last 30 days", compareLabel: "the 30 days before" };
    case "thisMonth":   return { from: addMonths(today, 0), to: tomorrow, label: "This month", compareLabel: "the same days last month" };
    case "prevMonth":   { const s = addMonths(today, -1); return { from: s, to: addMonths(today, 0), label: "Previous month", compareLabel: "the month before" }; }
    case "thisQuarter": return { from: quarterStart(today), to: tomorrow, label: "This quarter", compareLabel: "the same stretch last quarter" };
    case "prevQuarter": { const q = quarterStart(today); const s = new Date(q.getFullYear(), q.getMonth() - 3, 1); return { from: s, to: q, label: "Previous quarter", compareLabel: "the quarter before" }; }
    case "thisYear":    return { from: new Date(today.getFullYear(), 0, 1), to: tomorrow, label: "This year", compareLabel: "the same days last year" };
    case "prevYear":    return { from: new Date(today.getFullYear() - 1, 0, 1), to: new Date(today.getFullYear(), 0, 1), label: "Previous year", compareLabel: "the year before" };
    case "all":         return { from: new Date(0), to: tomorrow, label: "All time", compareLabel: null };
    case "custom": {
      const from = parseWhen(custom.from) ?? addDays(today, -29);
      const toDay = parseWhen(custom.to) ?? today;
      const to = addDays(midnight(toDay), 1);
      return { from, to: to > from ? to : addDays(from, 1), label: fmtRange(from, to > from ? to : addDays(from, 1)), compareLabel: "the stretch before" };
    }
  }
}

/**
 * The stretch before, of the same length. For calendar windows the whole
 * previous unit, clipped to the same number of elapsed days — "this month so
 * far" is compared with the same days of last month, not with all of it.
 */
export function previousWindow(w: Window, preset: Preset, now = new Date()): Window | null {
  if (!w.compareLabel) return null;
  const today = midnight(now);
  const elapsedDays = Math.max(1, Math.round((w.to.getTime() - w.from.getTime()) / DAY));
  let from: Date;
  switch (preset) {
    case "thisMonth":   from = addMonths(today, -1); break;
    case "thisQuarter": { const q = quarterStart(today); from = new Date(q.getFullYear(), q.getMonth() - 3, 1); break; }
    case "thisYear":    from = new Date(today.getFullYear() - 1, 0, 1); break;
    case "prevMonth":   from = addMonths(today, -2); break;
    case "prevQuarter": { const q = quarterStart(today); from = new Date(q.getFullYear(), q.getMonth() - 6, 1); break; }
    case "prevYear":    from = new Date(today.getFullYear() - 2, 0, 1); break;
    default:            from = addDays(w.from, -elapsedDays);
  }
  const to = preset === "prevMonth" ? addMonths(today, -1)
    : preset === "prevQuarter" ? new Date(quarterStart(today).getFullYear(), quarterStart(today).getMonth() - 3, 1)
    : preset === "prevYear" ? new Date(today.getFullYear() - 1, 0, 1)
    : addDays(from, elapsedDays);
  return { from, to: to > from ? to : addDays(from, 1), label: w.compareLabel, compareLabel: null };
}

/** Current against previous: the difference, and the change as a fraction. */
export interface Delta { current: number; previous: number; diff: number; pct: number | null }
export const delta = (current: number, previous: number): Delta => ({
  current, previous, diff: current - previous,
  pct: previous === 0 ? (current === 0 ? 0 : null) : (current - previous) / Math.abs(previous),
});

/* ── Buckets ────────────────────────────────────────────────────────────── */

export interface Bucket { from: Date; to: Date; name: string }

/**
 * How a series is drawn across the window: by day up to five weeks, by week
 * up to a season, by month past that. All-time draws the last 12 months.
 */
export function bucketsFor(w: Window): Bucket[] {
  const spanDays = (w.to.getTime() - Math.max(w.from.getTime(), 0)) / DAY;
  const out: Bucket[] = [];
  if (w.from.getTime() === 0 || spanDays > 400) {
    const end = new Date(w.to.getFullYear(), w.to.getMonth() + (w.to.getDate() > 1 ? 1 : 0), 1);
    for (let i = 11; i >= 0; i--) {
      const from = new Date(end.getFullYear(), end.getMonth() - i - 1, 1);
      out.push({ from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1), name: from.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) });
    }
    return out;
  }
  if (spanDays <= 35) {
    for (let d = midnight(w.from); d < w.to; d = addDays(d, 1)) out.push({ from: d, to: addDays(d, 1), name: fmtDay(d) });
  } else if (spanDays <= 120) {
    for (let d = weekStart(w.from); d < w.to; d = addDays(d, 7)) out.push({ from: d, to: addDays(d, 7), name: fmtDay(d) });
  } else {
    for (let d = addMonths(w.from, 0); d < w.to; d = addMonths(d, 1)) out.push({ from: d, to: addMonths(d, 1), name: d.toLocaleDateString("en-GB", { month: "short", year: spanDays > 365 ? "2-digit" : undefined }) });
  }
  return out;
}

export const daysBetween = (a: string | null | undefined, b: string | null | undefined): number | null => {
  const s = parseWhen(a), e = parseWhen(b);
  return s && e && e >= s ? (e.getTime() - s.getTime()) / DAY : null;
};
export const daysSince = (iso: string | null | undefined, now = new Date()): number | null => {
  const s = parseWhen(iso);
  return s ? (now.getTime() - s.getTime()) / DAY : null;
};
