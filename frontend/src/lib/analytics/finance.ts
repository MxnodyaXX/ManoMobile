"use client";

import type { AnalyticsData } from "./data";
import { live, streams, refunds, creditCollected, partsCost, finishedIn, STREAMS } from "./overview";
import { bucketsFor, daysSince, delta, inWindow, type Delta, type Window } from "./window";

/**
 * Money — sections 18 (credit), 19 (advances), 36 (financial), 37 (revenue
 * streams) and 38 (cash flow) of the brief.
 *
 * What the ledgers do not hold is said, not guessed: there is no expenses
 * table and no record of payments to suppliers, so net profit and supplier
 * outflow are not shown. Gross profit is an estimate wherever a part or a
 * phone has no cost recorded against it.
 */

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface PnL {
  gross: number; discounts: number; refunds: number; net: number;
  cogsAccessories: number; cogsParts: number; cogsAgents: number; cogs: number;
  grossProfit: number; grossMargin: number | null;
  unknownCostShare: number | null;
}

/** Cost of what was sold — accessory buying prices, parts, and agent fees. */
export function pnl(d: AnalyticsData, w: Window): PnL {
  const sold = live(d.sales, w);
  const gross = sold.reduce((t, s) => t + s.total, 0);
  const discounts = sold.reduce((t, s) => t + (s.discountAmount ?? 0), 0);
  const ref = refunds(d, w).amount;
  const nos = new Set(sold.map(s => s.invoiceNo));
  const cost = new Map(d.products.map(p => [String(p.id), p.buyingPrice]));
  let cogsAccessories = 0, unknown = 0, accessoryLineValue = 0;
  for (const l of d.saleLines) {
    if (l.kind !== "accessory" || !nos.has(l.invoiceNo)) continue;
    accessoryLineValue += l.lineTotal;
    const c = l.referenceId ? cost.get(l.referenceId) : undefined;
    if (c === undefined) unknown += l.lineTotal; else cogsAccessories += c * l.qty;
  }
  const finished = finishedIn(d.jobs, w);
  const cogsParts = finished.reduce((t, j) => t + partsCost(j, d), 0);
  const cogsAgents = finished.reduce((t, j) => t + (d.agentCosts[j.id] ?? 0), 0);
  const cogs = cogsAccessories + cogsParts + cogsAgents;
  const net = gross - ref;
  return {
    gross, discounts, refunds: ref, net, cogsAccessories, cogsParts, cogsAgents, cogs,
    grossProfit: net - cogs, grossMargin: net > 0 ? (net - cogs) / net : null,
    unknownCostShare: accessoryLineValue > 0 ? unknown / accessoryLineValue : null,
  };
}

export interface StreamRow { key: string; label: string; revenue: number; share: number; growth: number | null; previous: number }

export function streamRows(d: AnalyticsData, w: Window, prev: Window | null): StreamRow[] {
  const cur = streams(d.sales, w), pre = prev ? streams(d.sales, prev) : null;
  const credit = creditCollected(d, w), creditPrev = prev ? creditCollected(d, prev) : 0;
  const rows: StreamRow[] = STREAMS.map(s => {
    const p = pre?.[s.key] ?? 0;
    return { key: s.key, label: s.label, revenue: cur[s.key], share: cur.total ? cur[s.key] / cur.total : 0, growth: prev ? (p ? (cur[s.key] - p) / p : null) : null, previous: p };
  });
  rows.push({ key: "credit", label: "Credit collections", revenue: credit, share: 0, growth: prev ? (creditPrev ? (credit - creditPrev) / creditPrev : null) : null, previous: creditPrev });
  return rows;
}

export function profitTrend(d: AnalyticsData, w: Window): { name: string; revenue: number; cost: number; profit: number }[] {
  return bucketsFor(w).map(b => { const p = pnl(d, { ...b, label: "", compareLabel: null }); return { name: b.name, revenue: p.net, cost: p.cogs, profit: p.grossProfit }; });
}

/* ── Cash flow ──────────────────────────────────────────────────────────── */

export interface CashFlow {
  cashIn: number; cardIn: number; bankIn: number; creditCollections: number; advances: number;
  refundsOut: number; netMovement: number;
  receivables: number; payables: number; expectedIn: number;
}

export function cashFlow(d: AnalyticsData, w: Window): CashFlow {
  const sold = live(d.sales, w);
  let cashIn = 0, cardIn = 0, bankIn = 0;
  for (const s of sold) {
    const paid = s.paid ?? s.total;
    switch (s.paymentMethod) {
      case "Card": cardIn += paid; break;
      case "Bank Transfer": case "Cheque": bankIn += paid; break;
      case "Split": cashIn += s.cashAmount ?? 0; cardIn += s.cardAmount ?? 0; break;
      default: cashIn += paid;
    }
  }
  // Advances taken at intake in the window: what a job received before its handover took the rest.
  const advances = d.jobs.filter(j => inWindow(j.createdAt, w)).reduce((t, j) => t + Math.max(0, (j.advancePaid ?? 0) - (j.handover?.balanceSettled ?? 0)), 0);
  const credit = creditCollected(d, w);
  const out = refunds(d, w).amount;
  const receivables = d.accounts.reduce((t, a) => t + Math.max(0, a.balance), 0);
  const ready = d.jobs.filter(j => j.status === "Completed").reduce((t, j) => t + Math.max(0, j.estimatedCost - j.advancePaid - (j.writtenOff ?? 0)), 0);
  return {
    cashIn, cardIn, bankIn, creditCollections: credit, advances, refundsOut: out,
    netMovement: cashIn + cardIn + bankIn + credit + advances - out,
    receivables, payables: d.suppliers.reduce((t, s) => t + Math.max(0, s.balance), 0), expectedIn: receivables + ready,
  };
}

export function cashTrend(d: AnalyticsData, w: Window): { name: string; received: number; refunded: number }[] {
  return bucketsFor(w).map(b => {
    const win: Window = { ...b, label: "", compareLabel: null };
    const f = cashFlow(d, win);
    return { name: b.name, received: f.cashIn + f.cardIn + f.bankIn + f.creditCollections, refunded: f.refundsOut };
  });
}

/* ── Credit ─────────────────────────────────────────────────────────────── */

export interface CreditKpis {
  issued: Delta; collected: Delta; writtenOff: Delta; outstanding: number; overdue: number; overdueAccounts: number;
  customers: number; avgCharge: number | null; avgPayment: number | null; collectionRate: number | null;
  oldest: { name: string; days: number; balance: number } | null;
  aging: { name: string; value: number; accounts: number }[];
}

export function creditKpis(d: AnalyticsData, w: Window, prev: Window | null, now = new Date()): CreditKpis {
  const kindIn = (kind: string, win: Window) => d.creditEntries.filter(e => e.kind === kind && inWindow(e.occurredOn, win));
  const sum = (xs: { amount: number }[]) => xs.reduce((t, e) => t + e.amount, 0);
  const charges = kindIn("Charge", w), payments = kindIn("Payment", w), writeOffs = kindIn("Write-off", w);
  const owing = d.accounts.filter(a => a.balance > 0);
  const bands: [string, number, number][] = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["90+ days", 91, Infinity]];
  // Age of an account's debt: since its oldest charge that is still uncovered by payments.
  const ageOf = (id: string) => {
    const es = d.creditEntries.filter(e => e.accountId === id).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
    let paid = es.filter(e => e.kind === "Payment" || e.kind === "Write-off").reduce((t, e) => t + e.amount, 0);
    for (const e of es) {
      if (e.kind !== "Charge") continue;
      if (paid >= e.amount) { paid -= e.amount; continue; }
      return daysSince(e.occurredOn, now) ?? 0;
    }
    return 0;
  };
  const ages = owing.map(a => ({ a, days: ageOf(a.id) }));
  const oldest = ages.sort((x, y) => y.days - x.days)[0];
  return {
    issued: delta(sum(charges), prev ? sum(kindIn("Charge", prev)) : 0),
    collected: delta(sum(payments), prev ? sum(kindIn("Payment", prev)) : 0),
    writtenOff: delta(sum(writeOffs), prev ? sum(kindIn("Write-off", prev)) : 0),
    outstanding: sum(owing.map(a => ({ amount: a.balance }))),
    overdue: owing.filter(a => (daysSince(a.firstChargeOn, now) ?? 0) > a.termsDays).reduce((t, a) => t + a.balance, 0),
    overdueAccounts: owing.filter(a => (daysSince(a.firstChargeOn, now) ?? 0) > a.termsDays).length,
    customers: owing.length,
    avgCharge: mean(charges.map(e => e.amount)), avgPayment: mean(payments.map(e => e.amount)),
    collectionRate: sum(charges) > 0 ? sum(payments) / sum(charges) : null,
    oldest: oldest ? { name: oldest.a.name, days: oldest.days, balance: oldest.a.balance } : null,
    aging: bands.map(([name, lo, hi]) => { const inBand = ages.filter(x => x.days >= lo && x.days <= hi); return { name, value: sum(inBand.map(x => ({ amount: x.a.balance }))), accounts: inBand.length }; }),
  };
}

export function creditTrend(d: AnalyticsData, w: Window): { name: string; issued: number; collected: number }[] {
  return bucketsFor(w).map(b => ({
    name: b.name,
    issued: d.creditEntries.filter(e => e.kind === "Charge" && inWindow(e.occurredOn, b)).reduce((t, e) => t + e.amount, 0),
    collected: d.creditEntries.filter(e => e.kind === "Payment" && inWindow(e.occurredOn, b)).reduce((t, e) => t + e.amount, 0),
  }));
}

/* ── Advances ───────────────────────────────────────────────────────────── */

export interface AdvanceKpis { total: number; count: number; avg: number | null; without: number; outstandingOnReady: number; advanceRefunds: number; advanceRefundAmount: number; shareOfFinal: number | null }

export function advanceKpis(d: AnalyticsData, w: Window): AdvanceKpis {
  const inW = d.jobs.filter(j => j.status !== "Cancelled" && inWindow(j.createdAt, w));
  const intake = (j: typeof inW[number]) => Math.max(0, (j.advancePaid ?? 0) - (j.handover?.balanceSettled ?? 0));
  const withAdv = inW.filter(j => intake(j) > 0);
  const total = withAdv.reduce((t, j) => t + intake(j), 0);
  const priced = withAdv.filter(j => j.estimatedCost > 0);
  const refundsAdv = d.cashReturns.filter(c => c.kind === "Advance Refund" && inWindow(c.returnedOn, w));
  return {
    total, count: withAdv.length, avg: withAdv.length ? total / withAdv.length : null, without: inW.length - withAdv.length,
    outstandingOnReady: d.jobs.filter(j => j.status === "Completed").reduce((t, j) => t + Math.max(0, j.estimatedCost - j.advancePaid - (j.writtenOff ?? 0)), 0),
    advanceRefunds: refundsAdv.length, advanceRefundAmount: refundsAdv.reduce((t, c) => t + c.amount, 0),
    shareOfFinal: priced.length ? mean(priced.map(j => intake(j) / j.estimatedCost)) : null,
  };
}
