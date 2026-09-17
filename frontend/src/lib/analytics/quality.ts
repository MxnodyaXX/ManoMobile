"use client";

import type { RepairJob } from "@/cashier/contexts/RepairContext";
import type { AnalyticsData } from "./data";
import { live, partsCost, refunds as refundTotals } from "./overview";
import { faultCategory } from "./repairs";
import { customerKey } from "./sales";
import { bucketsFor, daysBetween, delta, inWindow, type Delta, type Window } from "./window";

/**
 * What went wrong and what it cost — sections 20 (refunds), 21 (warranty)
 * and 22 (parts) of the brief.
 *
 * A warranty return is a re-job: a job opened against an earlier one
 * (RepairJob.rejobOf). The original job's technician, brand and fault are
 * what the return is charged to, because that is the work that did not hold.
 */

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const isFinished = (j: RepairJob) => j.status === "Completed" || j.status === "Delivered";
const isReturn = (j: RepairJob) => j.completionType === "Return" || j.completionType === "Cash Return";

/* ── Refunds ────────────────────────────────────────────────────────────── */

export interface RefundItem {
  when: string; ref: string; kind: string; amount: number; reason: string; who: string; customer: string; partial: boolean; category: string;
}

export function refundItems(d: AnalyticsData, w: Window): RefundItem[] {
  const items: RefundItem[] = [];
  for (const s of d.sales) {
    if ((s.returnedAmount ?? 0) > 0 && inWindow(s.returnDate ?? s.date, w)) {
      items.push({ when: s.returnDate ?? s.date, ref: s.invoiceNo, kind: s.category === "Accessories" ? "Accessory return" : `${s.category} refund`, amount: s.returnedAmount ?? 0, reason: s.returnReason ?? "", who: s.cashier ?? "", customer: s.customer, partial: (s.returnedAmount ?? 0) < s.total - 0.005, category: s.category });
    }
  }
  const dealerName = new Map(d.dealers.map(x => [x.id, x.name]));
  for (const c of d.cashReturns) {
    if (!inWindow(c.returnedOn, w)) continue;
    const job = c.jobId ? d.jobs.find(j => j.id === c.jobId) : undefined;
    items.push({ when: c.returnedOn, ref: c.ref, kind: c.kind, amount: c.amount, reason: c.reason, who: "", customer: c.payee ?? (c.dealerId ? dealerName.get(c.dealerId) ?? "" : job?.customerName ?? ""), partial: false, category: "Repair" });
  }
  return items.sort((a, b) => b.when.localeCompare(a.when));
}

export interface RefundKpis {
  count: Delta; amount: Delta; pctOfRevenue: number | null; avg: number | null;
  cashReturns: number; saleRefunds: number; repairReturns: number; accessoryReturns: number; partial: number; full: number;
  topReason: string | null;
}

export function refundKpis(d: AnalyticsData, w: Window, prev: Window | null, items: RefundItem[]): RefundKpis {
  const cur = refundTotals(d, w), pre = prev ? refundTotals(d, prev) : { count: 0, amount: 0 };
  const revenue = live(d.sales, w).reduce((t, s) => t + s.total, 0);
  const reasons = groupReasons(items);
  return {
    count: delta(cur.count, pre.count), amount: delta(cur.amount, pre.amount),
    pctOfRevenue: revenue > 0 ? cur.amount / revenue : null,
    avg: cur.count ? cur.amount / cur.count : null,
    cashReturns: items.filter(i => i.kind === "Advance Refund" || i.kind === "Dealer Cash Return").length,
    saleRefunds: items.filter(i => i.kind.endsWith("refund") || i.kind === "Accessory return").length,
    repairReturns: d.jobs.filter(j => isFinished(j) && isReturn(j) && inWindow(j.completedAt, w)).length,
    accessoryReturns: items.filter(i => i.kind === "Accessory return").length,
    partial: items.filter(i => i.partial).length, full: items.filter(i => !i.partial && i.kind !== "Advance Refund" && i.kind !== "Dealer Cash Return").length,
    topReason: reasons[0]?.name ?? null,
  };
}

/** Reasons, folded by their first few words so "screen not fixed" and "Screen not fixed properly" land together. */
export function groupReasons(items: RefundItem[]): { name: string; value: number; amount: number }[] {
  const m = new Map<string, { name: string; value: number; amount: number }>();
  for (const i of items) {
    const raw = i.reason.trim();
    if (!raw) continue;
    const key = raw.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).slice(0, 3).join(" ");
    const r = m.get(key) ?? { name: raw.length > 60 ? raw.slice(0, 57) + "…" : raw, value: 0, amount: 0 };
    r.value += 1; r.amount += i.amount; m.set(key, r);
  }
  return Array.from(m.values()).sort((a, b) => b.value - a.value);
}

export const groupBy = (items: RefundItem[], keyOf: (i: RefundItem) => string) => {
  const m = new Map<string, { name: string; value: number; amount: number }>();
  for (const i of items) { const k = keyOf(i) || "—"; const r = m.get(k) ?? { name: k, value: 0, amount: 0 }; r.value += 1; r.amount += i.amount; m.set(k, r); }
  return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
};

export function refundTrend(d: AnalyticsData, w: Window): { name: string; refunds: number; revenue: number }[] {
  return bucketsFor(w).map(b => {
    const win: Window = { ...b, label: "", compareLabel: null };
    return { name: b.name, refunds: refundTotals(d, win).amount, revenue: live(d.sales, win).reduce((t, s) => t + s.total, 0) };
  });
}

export function repeatRefundCustomers(items: RefundItem[]): { name: string; value: number; amount: number }[] {
  return groupBy(items, i => i.customer).filter(r => r.value > 1 && r.name !== "—");
}

/** Repairs that came back as returns, by fault — where the shop cannot fix what it takes in. */
export function returnRateByFault(d: AnalyticsData, w: Window): { name: string; finished: number; returned: number; rate: number }[] {
  const m = new Map<string, { finished: number; returned: number }>();
  for (const j of d.jobs) {
    if (!isFinished(j) || !inWindow(j.completedAt, w)) continue;
    const k = faultCategory(j.issue);
    const r = m.get(k) ?? { finished: 0, returned: 0 };
    r.finished += 1; if (isReturn(j)) r.returned += 1; m.set(k, r);
  }
  return Array.from(m.entries()).map(([name, r]) => ({ name, ...r, rate: r.finished ? r.returned / r.finished : 0 })).filter(r => r.returned > 0).sort((a, b) => b.rate - a.rate);
}

/* ── Warranty ───────────────────────────────────────────────────────────── */

export interface WarrantyCase { rejob: RepairJob; original: RepairJob | null; daysAfter: number | null }

export function warrantyCases(d: AnalyticsData, w: Window): WarrantyCase[] {
  const byId = new Map(d.jobs.map(j => [j.id, j]));
  return d.jobs
    .filter(j => j.rejobOf && j.status !== "Cancelled" && inWindow(j.createdAt, w))
    .map(rejob => {
      const original = byId.get(rejob.rejobOf!) ?? null;
      const handedOver = original?.handover?.handedOverAt ?? original?.completedAt ?? null;
      return { rejob, original, daysAfter: daysBetween(handedOver, rejob.createdAt) };
    });
}

export interface WarrantyKpis {
  cases: Delta; rate: number | null; avgDaysBefore: number | null; repeatCases: number; partsCost: number; revenueGivenUp: number; reworkRate: number | null;
}

export function warrantyKpis(d: AnalyticsData, w: Window, prev: Window | null, cases: WarrantyCase[]): WarrantyKpis {
  const finished = d.jobs.filter(j => isFinished(j) && !isReturn(j) && inWindow(j.completedAt, w)).length;
  const prevCases = prev ? warrantyCases(d, prev).length : 0;
  const byDevice = new Map<string, number>();
  cases.forEach(c => { const k = (c.rejob.imei ?? "").replace(/\D/g, "") || c.rejob.id; byDevice.set(k, (byDevice.get(k) ?? 0) + 1); });
  return {
    cases: delta(cases.length, prevCases),
    rate: finished ? cases.length / finished : null,
    avgDaysBefore: mean(cases.map(c => c.daysAfter).filter((x): x is number => x !== null)),
    repeatCases: Array.from(byDevice.values()).filter(n => n > 1).length,
    partsCost: cases.reduce((t, c) => t + partsCost(c.rejob, d) + (d.agentCosts[c.rejob.id] ?? 0), 0),
    // What a re-job done free would otherwise have earned: the original's price.
    revenueGivenUp: cases.filter(c => c.rejob.estimatedCost === 0 || c.rejob.completionType === "FOC").reduce((t, c) => t + (c.original?.estimatedCost ?? 0), 0),
    reworkRate: finished ? cases.length / finished : null,
  };
}

export const warrantyBy = (cases: WarrantyCase[], keyOf: (c: WarrantyCase) => string) => {
  const m = new Map<string, number>();
  cases.forEach(c => { const k = keyOf(c) || "—"; m.set(k, (m.get(k) ?? 0) + 1); });
  return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

/** Each technician's completed work against the re-jobs it produced. */
export function reworkByTechnician(d: AnalyticsData, w: Window, cases: WarrantyCase[]): { name: string; completed: number; rework: number; rate: number | null }[] {
  const m = new Map<string, { completed: number; rework: number }>();
  d.jobs.filter(j => isFinished(j) && !isReturn(j) && inWindow(j.completedAt, w)).forEach(j => {
    const k = j.technician?.trim() || "Unassigned"; const r = m.get(k) ?? { completed: 0, rework: 0 }; r.completed += 1; m.set(k, r);
  });
  cases.forEach(c => { const k = c.original?.technician?.trim() || "Unknown"; const r = m.get(k) ?? { completed: 0, rework: 0 }; r.rework += 1; m.set(k, r); });
  return Array.from(m.entries()).map(([name, r]) => ({ name, ...r, rate: r.completed ? r.rework / r.completed : null })).sort((a, b) => b.rework - a.rework || b.completed - a.completed);
}

/* ── Parts ──────────────────────────────────────────────────────────────── */

export interface PartsKpis { used: number; cost: number; perJob: number | null; jobsWithParts: number; costVsRevenue: number | null; profitAfterParts: number; onRejobs: number }

export function partsKpis(d: AnalyticsData, w: Window): PartsKpis {
  const finished = d.jobs.filter(j => isFinished(j) && inWindow(j.completedAt, w));
  const used = finished.reduce((t, j) => t + (j.partsUsed?.length ?? 0), 0);
  const cost = finished.reduce((t, j) => t + partsCost(j, d), 0);
  const revenue = finished.filter(j => !isReturn(j)).reduce((t, j) => t + j.estimatedCost, 0);
  return {
    used, cost, perJob: finished.length ? used / finished.length : null,
    jobsWithParts: finished.filter(j => (j.partsUsed?.length ?? 0) > 0).length,
    costVsRevenue: revenue > 0 ? cost / revenue : null,
    profitAfterParts: revenue - cost,
    onRejobs: finished.filter(j => j.rejobOf).reduce((t, j) => t + (j.partsUsed?.length ?? 0), 0),
  };
}

export function partsUsage(d: AnalyticsData, w: Window, keyOf: (j: RepairJob, part: string) => string): { name: string; value: number; cost: number }[] {
  const byName = new Map(d.parts.map(p => [p.name.trim().toLowerCase(), p.costPrice]));
  const m = new Map<string, { value: number; cost: number }>();
  for (const j of d.jobs) {
    if (!isFinished(j) || !inWindow(j.completedAt, w)) continue;
    for (const part of j.partsUsed ?? []) {
      const k = keyOf(j, part) || "—";
      const r = m.get(k) ?? { value: 0, cost: 0 };
      r.value += 1; r.cost += byName.get(part.trim().toLowerCase()) ?? 0; m.set(k, r);
    }
  }
  return Array.from(m.entries()).map(([name, r]) => ({ name, ...r })).sort((a, b) => b.value - a.value);
}

export function partsTrend(d: AnalyticsData, w: Window): { name: string; parts: number; cost: number }[] {
  return bucketsFor(w).map(b => {
    const js = d.jobs.filter(j => isFinished(j) && inWindow(j.completedAt, b));
    return { name: b.name, parts: js.reduce((t, j) => t + (j.partsUsed?.length ?? 0), 0), cost: js.reduce((t, j) => t + partsCost(j, d), 0) };
  });
}

export { customerKey };
