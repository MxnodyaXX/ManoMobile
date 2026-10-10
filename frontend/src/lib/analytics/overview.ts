"use client";

import type { RepairJob } from "@/cashier/contexts/RepairContext";
import type { SaleTx, TxCategory } from "@/cashier/contexts/SalesContext";
import type { AnalyticsData } from "./data";

/** What a repair's cost is read from — enough of AnalyticsData to use it outside Analytics. */
export type CostSources = Pick<AnalyticsData, "parts" | "partRequests">;
import { bucketsFor, daysSince, delta, inWindow, parseWhen, type Delta, type Window } from "./window";

/**
 * The figures on the Analytics Overview, and the alerts and sentences that
 * go with them. Pure functions of the loaded data and a window.
 *
 * Definitions, so every tab agrees:
 *   revenue        — sales.total of every non-voided sale sold in the window
 *   refunds        — returned amounts on sales (by return date) plus every
 *                    cash return in the window (advance refunds, dealer
 *                    cash returns); sale refunds are not written to
 *                    cash_returns, so nothing is counted twice
 *   net revenue    — revenue minus refunds
 *   gross profit   — accessory margin (line price minus buying price) plus
 *                    repair revenue minus parts cost and repair-agent cost;
 *                    an estimate wherever a part has no cost recorded
 *   credit         — payments taken on account in the window
 */

export const STREAMS: { key: TxCategory; label: string }[] = [
  { key: "Repair",      label: "Repairs" },
  { key: "Accessories", label: "Accessories" },
  { key: "Mobile",      label: "Phones" },
  { key: "Others",      label: "Other" },
];

export const live = (sales: SaleTx[], w: Window) => sales.filter(s => s.status !== "Voided" && inWindow(s.date, w));

export interface Streams { Repair: number; Accessories: number; Mobile: number; Others: number; total: number }

export function streams(sales: SaleTx[], w: Window): Streams {
  const out: Streams = { Repair: 0, Accessories: 0, Mobile: 0, Others: 0, total: 0 };
  for (const s of live(sales, w)) {
    const k = (s.category in out ? s.category : "Others") as keyof Omit<Streams, "total">;
    out[k] += s.total;
    out.total += s.total;
  }
  return out;
}

export function refunds(d: AnalyticsData, w: Window): { count: number; amount: number; onSales: number; cashReturns: number } {
  let count = 0, onSales = 0, cashReturns = 0;
  for (const s of d.sales) {
    if ((s.returnedAmount ?? 0) > 0 && inWindow(s.returnDate ?? s.date, w)) { count += 1; onSales += s.returnedAmount ?? 0; }
  }
  for (const c of d.cashReturns) {
    if (inWindow(c.returnedOn, w)) { count += 1; cashReturns += c.amount; }
  }
  return { count, amount: onSales + cashReturns, onSales, cashReturns };
}

export const creditCollected = (d: AnalyticsData, w: Window) =>
  d.creditEntries.filter(e => e.kind === "Payment" && inWindow(e.occurredOn, w)).reduce((t, e) => t + e.amount, 0);

/**
 * What a repair's parts cost, from what was actually issued to the job.
 *
 * Read from the part requests, which name the exact tag (SKU) and quantity:
 * "M02 Display" is two parts at two costs (HD+ and CROWN), and only the tag
 * says which one went into the phone. A batch bought at a different price
 * carries its own tag, so the tag's cost is that batch's cost.
 *
 * Jobs finished before parts were requested through the system have only the
 * typed "parts used" list; those fall back to a name match, quantity included
 * ("M02 Display ×2").
 */
export function partsCost(job: RepairJob, d: CostSources): number {
  const issued = d.partRequests.filter(r => r.jobId === job.id && (r.status === "Approved" || r.status === "Issued"));
  if (issued.length > 0) {
    const bySku = new Map(d.parts.map(p => [p.sku.trim().toUpperCase(), p.costPrice]));
    return issued.reduce((t, r) => t + (bySku.get(r.partSku.trim().toUpperCase()) ?? 0) * r.quantity, 0);
  }
  if (!job.partsUsed?.length) return 0;
  const byName = new Map<string, number>();
  for (const p of d.parts) {
    const k = p.name.trim().toLowerCase();
    // Several tags under one name: the dearest, so an unknown type is never
    // read as the cheaper one and profit is not flattered.
    byName.set(k, Math.max(byName.get(k) ?? 0, p.costPrice));
  }
  return job.partsUsed.reduce((t, line) => {
    const m = line.trim().match(/^(.*?)\s*[×x]\s*(\d+)$/i);
    const name = (m ? m[1] : line).trim().toLowerCase();
    const qty = m ? Number(m[2]) : 1;
    return t + (byName.get(name) ?? 0) * qty;
  }, 0);
}

export const isFinished = (j: RepairJob) => j.status === "Completed" || j.status === "Delivered";

// Older jobs were sometimes finished without a finish date being stamped; they
// fall back to the day they came in rather than dropping out of every period.
export const finishedIn = (jobs: RepairJob[], w: Window) =>
  jobs.filter(j => isFinished(j) && inWindow(j.completedAt ?? j.createdAt, w));

/**
 * What a finished repair cost the shop, apart from agent charges.
 *
 * Normally what was recorded: parts issued by tag plus the technician charge.
 * When an Admin has entered a cost for the job (Admin → Repair Costs), that one
 * figure IS the job's parts + technician cost, replacing what was recorded —
 * many older jobs have a technician charge but parts that were never issued in
 * the system, so what was recorded is only part of the story. Never both, so
 * nothing is counted twice.
 */
export function repairJobCost(job: RepairJob, d: CostSources): { parts: number; labour: number; estimated: number } {
  if (job.estimatedRepairCost != null) return { parts: 0, labour: 0, estimated: job.estimatedRepairCost };
  return { parts: partsCost(job, d), labour: job.labourCost ?? 0, estimated: 0 };
}

/** Parts + technician cost as recorded on the job, ignoring any entered figure. */
export const recordedRepairCost = (job: RepairJob, d: CostSources) => partsCost(job, d) + (job.labourCost ?? 0);

/** A finished job with no parts or technician cost recorded — one that needs an estimate. */
export const lacksRecordedCost = (job: RepairJob, d: CostSources) =>
  isFinished(job) && partsCost(job, d) + (job.labourCost ?? 0) === 0;

/** Cost of sales in a window, by where it came from. */
export interface CostOfSales {
  /** Buying price of each accessory tag sold. */
  accessories: number;
  /** Buying price of each phone sold, by the unit (IMEI) that went out. */
  devices: number;
  /** Parts issued to repairs finished in the window. */
  parts: number;
  /** Repair-agent charges on those repairs. */
  agents: number;
  /** Technician charges recorded when those repairs were finished. */
  labour: number;
  /** Admin estimates, on finished jobs with no parts or technician cost recorded. */
  estimated: number;
  estimatedJobs: number;
  total: number;
  /** Sales whose cost is not on record, so they count as all profit. */
  unknownAccessorySales: number;
  unknownPhoneSales: number;
  /** Revenue of each stream, for per-stream margins. */
  revenue: { accessories: number; phones: number; repairs: number; other: number };
}

export function costOfSales(d: AnalyticsData, w: Window): CostOfSales {
  const sold = live(d.sales, w);
  const invoiceNos = new Set(sold.map(s => s.invoiceNo));

  const productCost = new Map(d.products.map(p => [String(p.id), p.buyingPrice]));
  let accessories = 0, unknownAccessorySales = 0, accessoryRevenue = 0;
  for (const l of d.saleLines) {
    if (l.kind !== "accessory" || !invoiceNos.has(l.invoiceNo)) continue;
    accessoryRevenue += l.lineTotal;
    const c = l.referenceId ? productCost.get(l.referenceId) : undefined;
    if (c === undefined) unknownAccessorySales += l.lineTotal; else accessories += c * l.qty;
  }

  // A phone carries the invoice it went out on. A replaced or refunded phone
  // gives the invoice up, so each invoice holds exactly the phones the
  // customer kept.
  let devices = 0;
  const phoneInvoices = new Set<string>();
  for (const dv of d.soldDevices) {
    if (!invoiceNos.has(dv.invoiceNo)) continue;
    devices += dv.buyingPrice;
    phoneInvoices.add(dv.invoiceNo);
  }
  let phoneRevenue = 0, unknownPhoneSales = 0;
  for (const l of d.saleLines) {
    if (l.kind !== "device" || !invoiceNos.has(l.invoiceNo)) continue;
    phoneRevenue += l.lineTotal;
    if (!phoneInvoices.has(l.invoiceNo)) unknownPhoneSales += l.lineTotal;
  }
  // Phone sales from before sales were linked to stock have no device lines.
  for (const s of sold) {
    if (s.category !== "Mobile" || phoneInvoices.has(s.invoiceNo)) continue;
    if (d.saleLines.some(l => l.invoiceNo === s.invoiceNo && l.kind === "device")) continue;
    phoneRevenue += s.total;
    unknownPhoneSales += s.total;
  }

  const finished = finishedIn(d.jobs, w);
  let parts = 0, labour = 0, estimated = 0, estimatedJobs = 0;
  for (const j of finished) {
    const c = repairJobCost(j, d);
    parts += c.parts; labour += c.labour; estimated += c.estimated;
    if (j.estimatedRepairCost != null) estimatedJobs += 1;
  }
  const agents = finished.reduce((t, j) => t + (d.agentCosts[j.id] ?? 0), 0);
  const repairs = sold.filter(s => s.category === "Repair").reduce((t, s) => t + s.total, 0);
  const total = sold.reduce((t, s) => t + s.total, 0);

  return {
    accessories, devices, parts, agents, labour, estimated, estimatedJobs,
    total: accessories + devices + parts + agents + labour + estimated,
    unknownAccessorySales, unknownPhoneSales,
    revenue: {
      accessories: accessoryRevenue, phones: phoneRevenue, repairs,
      other: Math.max(0, total - accessoryRevenue - phoneRevenue - repairs),
    },
  };
}

/** Sales less refunds less what everything sold cost. Expenses are not in it. */
export function grossProfit(d: AnalyticsData, w: Window): number {
  const net = live(d.sales, w).reduce((t, s) => t + s.total, 0) - refunds(d, w).amount;
  return net - costOfSales(d, w).total;
}

/* ── KPIs ───────────────────────────────────────────────────────────────── */

export interface OverviewKpis {
  revenue: Delta;
  netRevenue: Delta;
  grossProfit: Delta;
  invoices: Delta;
  avgInvoice: Delta;
  repairRevenue: Delta;
  accessoryRevenue: Delta;
  creditCollected: Delta;
  refunds: Delta;
  repairsReceived: Delta;
  repairsCompleted: Delta;
  avgTurnaround: Delta;
  /** Snapshots — no comparison. */
  outstandingCredit: number;
  supplierPayables: number;
  inventoryCost: number;
  inventoryRetail: number;
  openJobs: number;
  waitingForParts: number;
  readyForCollection: number;
  readyValue: number;
  customersServed: Delta;
  returningRate: number | null;
}

const avgTurnaround = (jobs: RepairJob[]): number => {
  const ds = jobs.map(j => {
    const s = parseWhen(j.startedAt ?? j.createdAt), e = parseWhen(j.completedAt);
    return s && e && e >= s ? (e.getTime() - s.getTime()) / 86_400_000 : null;
  }).filter((x): x is number => x !== null);
  return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0;
};

/** Distinct customers by phone (or name when no phone) across sales and intakes. */
function customersIn(d: AnalyticsData, w: Window): Set<string> {
  const keys = new Set<string>();
  const key = (phone: string | null | undefined, name: string | null | undefined) => {
    const p = (phone ?? "").replace(/\D/g, "");
    return p.length >= 9 ? p.slice(-9) : (name ?? "").trim().toLowerCase();
  };
  live(d.sales, w).forEach(s => { const k = key(null, s.customer); if (k && k !== "walk-in") keys.add(k); });
  d.jobs.filter(j => inWindow(j.createdAt, w)).forEach(j => { const k = key(j.phone, j.customerName); if (k) keys.add(k); });
  return keys;
}

export function overviewKpis(d: AnalyticsData, w: Window, prev: Window | null): OverviewKpis {
  const cur = streams(d.sales, w), pre = prev ? streams(d.sales, prev) : null;
  const refCur = refunds(d, w), refPre = prev ? refunds(d, prev) : { count: 0, amount: 0 };
  const salesCur = live(d.sales, w), salesPre = prev ? live(d.sales, prev) : [];
  const finCur = finishedIn(d.jobs, w), finPre = prev ? finishedIn(d.jobs, prev) : [];
  const recCur = d.jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, w)).length;
  const recPre = prev ? d.jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, prev)).length : 0;
  const custCur = customersIn(d, w);
  const custPre = prev ? customersIn(d, prev) : new Set<string>();
  // Returning: seen in the window and also before it.
  const before = { from: new Date(0), to: w.from, label: "", compareLabel: null };
  const seenBefore = customersIn(d, before);
  const returning = Array.from(custCur).filter(k => seenBefore.has(k)).length;

  const open = d.jobs.filter(j => j.status === "Non-Issued" || j.status === "Issued" || j.status === "Pending");
  const ready = d.jobs.filter(j => j.status === "Completed");

  return {
    revenue:          delta(cur.total, pre?.total ?? 0),
    netRevenue:       delta(cur.total - refCur.amount, (pre?.total ?? 0) - refPre.amount),
    grossProfit:      delta(grossProfit(d, w), prev ? grossProfit(d, prev) : 0),
    invoices:         delta(salesCur.length, salesPre.length),
    avgInvoice:       delta(salesCur.length ? cur.total / salesCur.length : 0, salesPre.length ? (pre?.total ?? 0) / salesPre.length : 0),
    repairRevenue:    delta(cur.Repair, pre?.Repair ?? 0),
    accessoryRevenue: delta(cur.Accessories, pre?.Accessories ?? 0),
    creditCollected:  delta(creditCollected(d, w), prev ? creditCollected(d, prev) : 0),
    refunds:          delta(refCur.amount, refPre.amount),
    repairsReceived:  delta(recCur, recPre),
    repairsCompleted: delta(finCur.length, finPre.length),
    avgTurnaround:    delta(avgTurnaround(finCur), avgTurnaround(finPre)),
    outstandingCredit: d.accounts.reduce((t, a) => t + Math.max(0, a.balance), 0),
    supplierPayables:  d.suppliers.reduce((t, s) => t + Math.max(0, s.balance), 0),
    inventoryCost:     d.products.reduce((t, p) => t + p.stock * p.buyingPrice, 0),
    inventoryRetail:   d.products.reduce((t, p) => t + p.stock * p.sellingPrice, 0),
    openJobs:          open.length,
    waitingForParts:   d.jobs.filter(j => j.status === "Pending").length,
    readyForCollection: ready.length,
    readyValue:        ready.reduce((t, j) => t + Math.max(0, j.estimatedCost - j.advancePaid - (j.writtenOff ?? 0)), 0),
    customersServed:   delta(custCur.size, custPre.size),
    returningRate:     custCur.size ? returning / custCur.size : null,
  };
}

/* ── Series ─────────────────────────────────────────────────────────────── */

export interface StreamPoint { name: string; Repair: number; Accessories: number; Mobile: number; Others: number; total: number }
export function revenueTrend(sales: SaleTx[], w: Window): StreamPoint[] {
  return bucketsFor(w).map(b => {
    const s = streams(sales, { ...b, label: "", compareLabel: null });
    return { name: b.name, ...s };
  });
}

export interface FlowPoint { name: string; received: number; completed: number }
export function repairFlow(jobs: RepairJob[], w: Window): FlowPoint[] {
  return bucketsFor(w).map(b => ({
    name: b.name,
    received: jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, b)).length,
    completed: jobs.filter(j => !!j.completedAt && j.status !== "Cancelled" && inWindow(j.completedAt, b)).length,
  }));
}

export interface NamedValue { name: string; value: number; sub?: string }

export function topProducts(d: AnalyticsData, w: Window, n = 8): NamedValue[] {
  const invoiceNos = new Set(live(d.sales, w).map(s => s.invoiceNo));
  const byProduct = new Map<string, { name: string; qty: number; value: number }>();
  for (const l of d.saleLines) {
    if (l.kind !== "accessory" || !invoiceNos.has(l.invoiceNo)) continue;
    const k = l.referenceId ?? l.description;
    const cur = byProduct.get(k) ?? { name: l.description, qty: 0, value: 0 };
    cur.qty += l.qty; cur.value += l.lineTotal;
    byProduct.set(k, cur);
  }
  return Array.from(byProduct.values()).sort((a, b) => b.value - a.value).slice(0, n)
    .map(p => ({ name: p.name, value: p.value, sub: `${p.qty} sold` }));
}

export function salesByCashier(sales: SaleTx[], w: Window): NamedValue[] {
  const m = new Map<string, number>();
  live(sales, w).forEach(s => { const k = s.cashier?.trim() || "Not recorded"; m.set(k, (m.get(k) ?? 0) + s.total); });
  return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export interface WorkloadPoint { name: string; notStarted: number; inProgress: number; waiting: number }
export function workloadNow(jobs: RepairJob[]): WorkloadPoint[] {
  const m = new Map<string, WorkloadPoint>();
  for (const j of jobs) {
    if (!(j.status === "Non-Issued" || j.status === "Issued" || j.status === "Pending")) continue;
    const name = j.technician?.trim() || "Unassigned";
    const r = m.get(name) ?? { name, notStarted: 0, inProgress: 0, waiting: 0 };
    if (j.status === "Non-Issued") r.notStarted += 1; else if (j.status === "Issued") r.inProgress += 1; else r.waiting += 1;
    m.set(name, r);
  }
  return Array.from(m.values()).sort((a, b) => (b.notStarted + b.inProgress + b.waiting) - (a.notStarted + a.inProgress + a.waiting));
}

/* ── Alerts ─────────────────────────────────────────────────────────────── */

export type AlertTone = "red" | "amber" | "blue";
export interface Alert { id: string; tone: AlertTone; count: number; label: string; hint: string }

export function alerts(d: AnalyticsData, w: Window, now = new Date()): Alert[] {
  const today = now.toISOString().slice(0, 10);
  const open = d.jobs.filter(j => j.status === "Non-Issued" || j.status === "Issued" || j.status === "Pending");
  const cost = new Map(d.products.map(p => [String(p.id), p.buyingPrice]));
  const invoiceNos = new Set(live(d.sales, w).map(s => s.invoiceNo));
  const ref = refunds(d, w);
  const revenue = streams(d.sales, w).total;
  const list: Alert[] = [
    { id: "out",        tone: "red",   count: d.products.filter(p => p.stock <= 0).length, label: "Out of stock", hint: "Products with nothing on the shelf" },
    { id: "low",        tone: "amber", count: d.products.filter(p => p.stock > 0 && p.stock <= p.minStock).length, label: "Low stock", hint: "At or below the product's minimum" },
    { id: "overdue",    tone: "red",   count: open.filter(j => j.estimatedCompletion && j.estimatedCompletion < today).length, label: "Overdue repairs", hint: "Open jobs past their promised date" },
    { id: "parts",      tone: "amber", count: d.jobs.filter(j => j.status === "Pending").length, label: "Waiting for parts", hint: "Jobs on hold" },
    { id: "ready",      tone: "blue",  count: d.jobs.filter(j => j.status === "Completed").length, label: "Ready for collection", hint: "Finished, not yet handed over" },
    { id: "credit",     tone: "red",   count: d.accounts.filter(a => a.balance > 0 && (daysSince(a.firstChargeOn) ?? 0) > a.termsDays).length, label: "Overdue credit", hint: "Accounts past their terms with a balance" },
    { id: "payables",   tone: "amber", count: d.suppliers.filter(s => s.balance > 0).length, label: "Supplier payments due", hint: "Suppliers with a balance owed" },
    { id: "warranty",   tone: "red",   count: d.jobs.filter(j => j.rejobOf && inWindow(j.createdAt, w)).length, label: "Warranty returns", hint: `Re-jobs opened · ${w.label.toLowerCase()}` },
    { id: "refunds",    tone: "amber", count: ref.count, label: "High refund activity", hint: revenue ? `${((ref.amount / revenue) * 100).toFixed(1)}% of revenue refunded` : "Refunds in the window" },
    { id: "negative",   tone: "red",   count: d.saleLines.filter(l => l.kind === "accessory" && invoiceNos.has(l.invoiceNo) && l.referenceId && cost.has(l.referenceId) && l.lineTotal < (cost.get(l.referenceId) ?? 0) * l.qty).length, label: "Negative-margin sales", hint: "Accessory lines sold below buying price" },
    { id: "unassigned", tone: "blue",  count: d.jobs.filter(j => j.status === "Non-Issued" && (!j.technician || j.technician.trim().toLowerCase() === "unassigned")).length, label: "Unassigned repair jobs", hint: "Waiting for a technician" },
    { id: "notstarted", tone: "amber", count: d.jobs.filter(j => j.status === "Non-Issued" && j.technician && j.technician.trim().toLowerCase() !== "unassigned").length, label: "Assigned but not started", hint: "On a bench, untouched" },
    { id: "uncollected", tone: "red",  count: d.jobs.filter(j => j.status === "Completed" && (daysSince(j.completedAt) ?? 0) > 7).length, label: "Old uncollected jobs", hint: "Finished more than 7 days ago" },
  ];
  // Refund activity is only an alert when it is actually high.
  return list.map(a => (a.id === "refunds" && revenue > 0 && ref.amount / revenue < 0.05 && ref.count < 3 ? { ...a, count: 0 } : a));
}

/* ── Sentences ──────────────────────────────────────────────────────────── */

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const pctStr = (p: number | null) => (p === null ? "" : `${p >= 0 ? "+" : "−"}${Math.abs(p * 100).toFixed(0)}%`);

export function insights(d: AnalyticsData, w: Window, prev: Window | null, k: OverviewKpis, al: Alert[]): string[] {
  const out: string[] = [];
  const count = (id: string) => al.find(a => a.id === id)?.count ?? 0;

  if (prev && k.revenue.previous > 0 && k.revenue.pct !== null) {
    out.push(`Revenue is ${k.revenue.pct >= 0 ? "up" : "down"} ${pctStr(k.revenue.pct)} against ${prev.label} — ${rs(k.revenue.current)} vs ${rs(k.revenue.previous)}.`);
  } else if (k.revenue.current > 0) {
    out.push(`${rs(k.revenue.current)} taken across ${k.invoices.current} invoices ${w.label.toLowerCase()}.`);
  }
  if (k.revenue.current > 0) {
    const share = k.repairRevenue.current / k.revenue.current;
    out.push(`Repairs bring in ${(share * 100).toFixed(0)}% of revenue; accessories ${((k.accessoryRevenue.current / k.revenue.current) * 100).toFixed(0)}%.`);
  }
  if (prev && k.accessoryRevenue.previous > 0 && k.accessoryRevenue.pct !== null && Math.abs(k.accessoryRevenue.pct) >= 0.1) {
    out.push(`Accessory sales are ${k.accessoryRevenue.pct > 0 ? "growing" : "falling"} — ${pctStr(k.accessoryRevenue.pct)} on ${prev.label}.`);
  }
  const restock = count("out") + count("low");
  if (restock) out.push(`${restock} product${restock === 1 ? "" : "s"} need restocking (${count("out")} out of stock).`);
  if (count("overdue")) out.push(`${count("overdue")} repair${count("overdue") === 1 ? " is" : "s are"} past the date promised to the customer.`);
  if (k.readyForCollection) out.push(`${k.readyForCollection} finished repair${k.readyForCollection === 1 ? "" : "s"} await collection, worth ${rs(k.readyValue)} still to collect.`);
  if (count("credit")) out.push(`${count("credit")} customer balance${count("credit") === 1 ? " is" : "s are"} past terms; ${rs(k.outstandingCredit)} is on account in all.`);
  if (count("warranty")) out.push(`${count("warranty")} warranty return${count("warranty") === 1 ? "" : "s"} ${w.label.toLowerCase()}.`);

  // Uneven bench: the busiest technician carrying more than twice the quietest.
  const load = workloadNow(d.jobs).filter(x => x.name !== "Unassigned").map(x => ({ name: x.name, n: x.notStarted + x.inProgress + x.waiting }));
  if (load.length >= 2) {
    const max = load[0], min = load[load.length - 1];
    if (max.n >= 4 && max.n >= 2 * Math.max(1, min.n)) out.push(`Technician workload is uneven: ${max.name} has ${max.n} open jobs, ${min.name} has ${min.n}.`);
  }

  // Busiest hour, from the clocks the ledgers carry.
  const hours = new Array<number>(24).fill(0);
  live(d.sales, w).forEach(s => { const t = parseWhen(s.createdAt); if (t) hours[t.getHours()] += 1; });
  d.jobs.filter(j => inWindow(j.createdAt, w)).forEach(j => { const t = parseWhen(j.createdAt); if (t && j.createdAt.length > 10) hours[t.getHours()] += 1; });
  const total = hours.reduce((a, b) => a + b, 0);
  if (total >= 10) {
    const h = hours.indexOf(Math.max(...hours));
    const label = (x: number) => `${((x + 11) % 12) + 1}${x < 12 ? "am" : "pm"}`;
    out.push(`Most customer activity lands between ${label(h)} and ${label((h + 1) % 24)}.`);
  }

  // Selling faster than the shelf can carry: two weeks of recent pace exceeds stock.
  const fortnight = { from: new Date(Date.now() - 14 * 86_400_000), to: new Date(8.64e15), label: "", compareLabel: null };
  const recentNos = new Set(live(d.sales, fortnight).map(s => s.invoiceNo));
  const pace = new Map<string, number>();
  d.saleLines.forEach(l => { if (l.kind === "accessory" && l.referenceId && recentNos.has(l.invoiceNo)) pace.set(l.referenceId, (pace.get(l.referenceId) ?? 0) + l.qty); });
  const outpaced = d.products.filter(p => (pace.get(String(p.id)) ?? 0) > p.stock && p.stock >= 0);
  if (outpaced.length) out.push(`${outpaced[0].name} is selling faster than its stock can support${outpaced.length > 1 ? `, and ${outpaced.length - 1} other${outpaced.length > 2 ? "s" : ""} like it` : ""}.`);

  if (k.returningRate !== null && k.customersServed.current >= 10) out.push(`${(k.returningRate * 100).toFixed(0)}% of the ${k.customersServed.current} customers served were returning customers.`);
  return out;
}
