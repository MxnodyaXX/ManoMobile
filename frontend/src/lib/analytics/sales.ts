"use client";

import type { SaleTx, TxCategory } from "@/cashier/contexts/SalesContext";
import type { AnalyticsData, SaleLine } from "./data";
import { live } from "./overview";
import { bucketsFor, delta, inWindow, parseWhen, type Delta, type Window } from "./window";

/**
 * Sales, products, and the customers behind them — sections 2, 3, 16, 17,
 * 30–33 and 39 of the brief. Pure functions of the loaded data.
 *
 * A customer is a phone number. Sales and jobs both record one; a name is
 * the fallback when they do not. Two people who share a phone are one
 * customer here, which is the shop's own convention at the counter.
 */

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* ── Sales ──────────────────────────────────────────────────────────────── */

export interface SalesKpis {
  transactions: Delta; value: Delta; avg: Delta; itemsPerInvoice: number | null;
  highest: { invoiceNo: string; total: number } | null; lowest: { invoiceNo: string; total: number } | null;
  voided: Delta; refunded: Delta; discounts: Delta; avgDiscount: number | null; discountPct: number | null;
  withDiscount: number; withoutDiscount: number;
  cash: number; card: number; bank: number; credit: number; other: number;
  repairInvoices: number; productInvoices: number; combined: number; creditInvoices: number;
  attachmentRate: number | null;
  distribution: { name: string; value: number }[];
}

export function salesKpis(d: AnalyticsData, w: Window, prev: Window | null): SalesKpis {
  const cur = live(d.sales, w), pre = prev ? live(d.sales, prev) : [];
  const sum = (xs: SaleTx[]) => xs.reduce((t, s) => t + s.total, 0);
  const disc = (xs: SaleTx[]) => xs.reduce((t, s) => t + (s.discountAmount ?? 0), 0);
  const voidedIn = (win: Window) => d.sales.filter(s => s.status === "Voided" && inWindow(s.date, win)).length;
  const refundedIn = (win: Window) => d.sales.filter(s => (s.returnedAmount ?? 0) > 0 && inWindow(s.returnDate ?? s.date, win)).length;
  const invoiceNos = new Set(cur.map(s => s.invoiceNo));
  const lines = d.saleLines.filter(l => invoiceNos.has(l.invoiceNo));
  const linesByInvoice = new Map<string, SaleLine[]>();
  lines.forEach(l => linesByInvoice.set(l.invoiceNo, [...(linesByInvoice.get(l.invoiceNo) ?? []), l]));
  const withLines = cur.filter(s => linesByInvoice.has(s.invoiceNo));
  const itemsPer = withLines.length ? withLines.reduce((t, s) => t + (linesByInvoice.get(s.invoiceNo) ?? []).reduce((q, l) => q + l.qty, 0), 0) / withLines.length : null;

  const byTotal = [...cur].sort((a, b) => a.total - b.total);
  let cash = 0, card = 0, bank = 0, credit = 0, other = 0;
  for (const s of cur) {
    const paid = s.paid ?? s.total;
    const due = Math.max(0, s.total - paid);
    credit += due;
    switch (s.paymentMethod) {
      case "Card": card += paid; break;
      case "Bank Transfer": bank += paid; break;
      case "Split": cash += s.cashAmount ?? 0; card += s.cardAmount ?? 0; break;
      case "Cash": case undefined: case "Credit": cash += paid; break;
      default: other += paid;
    }
  }
  const repairInvoices = cur.filter(s => s.category === "Repair");
  const combined = repairInvoices.filter(s => (linesByInvoice.get(s.invoiceNo) ?? []).some(l => l.kind === "accessory")).length;
  const bands: [string, number, number][] = [["< 1K", 0, 1000], ["1–5K", 1000, 5000], ["5–10K", 5000, 10000], ["10–25K", 10000, 25000], ["25K+", 25000, Infinity]];

  return {
    transactions: delta(cur.length, pre.length),
    value: delta(sum(cur), sum(pre)),
    avg: delta(cur.length ? sum(cur) / cur.length : 0, pre.length ? sum(pre) / pre.length : 0),
    itemsPerInvoice: itemsPer,
    highest: byTotal.length ? { invoiceNo: byTotal[byTotal.length - 1].invoiceNo, total: byTotal[byTotal.length - 1].total } : null,
    lowest: byTotal.length ? { invoiceNo: byTotal[0].invoiceNo, total: byTotal[0].total } : null,
    voided: delta(voidedIn(w), prev ? voidedIn(prev) : 0),
    refunded: delta(refundedIn(w), prev ? refundedIn(prev) : 0),
    discounts: delta(disc(cur), disc(pre)),
    avgDiscount: cur.length ? disc(cur) / cur.length : null,
    discountPct: sum(cur) > 0 ? disc(cur) / (sum(cur) + disc(cur)) : null,
    withDiscount: cur.filter(s => (s.discountAmount ?? 0) > 0).length,
    withoutDiscount: cur.filter(s => !((s.discountAmount ?? 0) > 0)).length,
    cash, card, bank, credit, other,
    repairInvoices: repairInvoices.length, productInvoices: cur.length - repairInvoices.length, combined,
    creditInvoices: cur.filter(s => (s.total - (s.paid ?? s.total)) > 0.005).length,
    attachmentRate: repairInvoices.length ? combined / repairInvoices.length : null,
    distribution: bands.map(([name, lo, hi]) => ({ name, value: cur.filter(s => s.total >= lo && s.total < hi).length })),
  };
}

export interface NamedValue { name: string; value: number; sub?: string }

export function salesByHour(sales: SaleTx[], w: Window): { name: string; value: number; count: number }[] {
  const v = new Array<number>(24).fill(0), c = new Array<number>(24).fill(0);
  live(sales, w).forEach(s => { const t = parseWhen(s.createdAt); if (t) { v[t.getHours()] += s.total; c[t.getHours()] += 1; } });
  return v.map((x, h) => ({ name: `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`, value: x, count: c[h] })).filter((_, h) => h >= 7 && h <= 21);
}

export function salesByWeekday(sales: SaleTx[], w: Window): { name: string; value: number; count: number }[] {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const v = new Array<number>(7).fill(0), c = new Array<number>(7).fill(0);
  live(sales, w).forEach(s => { const t = parseWhen(s.date); if (t) { const i = (t.getDay() + 6) % 7; v[i] += s.total; c[i] += 1; } });
  return names.map((name, i) => ({ name, value: v[i], count: c[i] }));
}

export function salesByCustomer(sales: SaleTx[], w: Window, limit = 10): NamedValue[] {
  const m = new Map<string, { name: string; value: number; n: number }>();
  for (const s of live(sales, w)) {
    const k = customerKey(s.customerPhone, s.customer);
    if (!k || k === "walk-in") continue;
    const r = m.get(k) ?? { name: s.customer, value: 0, n: 0 };
    r.value += s.total; r.n += 1; m.set(k, r);
  }
  return Array.from(m.values()).sort((a, b) => b.value - a.value).slice(0, limit).map(r => ({ name: r.name, value: r.value, sub: `${r.n} invoice${r.n === 1 ? "" : "s"}` }));
}

/* ── Products ───────────────────────────────────────────────────────────── */

export interface ProductRow {
  key: string; name: string; category: string; subcategory: string; brand: string;
  qty: number; revenue: number; cost: number | null; profit: number | null; margin: number | null;
  avgPrice: number; discount: number; stock: number | null;
  prevQty: number; trend: number | null;
  /** Units per week over the window, against stock on hand. */
  weeksOfStock: number | null;
  onRepairInvoices: number;
}

export function productRows(d: AnalyticsData, w: Window, prev: Window | null): ProductRow[] {
  const cur = live(d.sales, w), pre = prev ? live(d.sales, prev) : [];
  const curNos = new Set(cur.map(s => s.invoiceNo)), preNos = new Set(pre.map(s => s.invoiceNo));
  const repairNos = new Set(cur.filter(s => s.category === "Repair").map(s => s.invoiceNo));
  const products = new Map(d.products.map(p => [String(p.id), p]));
  const rows = new Map<string, ProductRow & { discounts: number; gross: number }>();
  const weeks = Math.max(1 / 7, (w.to.getTime() - Math.max(w.from.getTime(), 0)) / (7 * 86_400_000));
  for (const l of d.saleLines) {
    if (l.kind !== "accessory") continue;
    const inCur = curNos.has(l.invoiceNo), inPre = preNos.has(l.invoiceNo);
    if (!inCur && !inPre) continue;
    const key = l.referenceId ?? `desc:${l.description}`;
    const p = l.referenceId ? products.get(l.referenceId) : undefined;
    let r = rows.get(key);
    if (!r) {
      r = { key, name: p?.name ?? l.description, category: p?.category ?? "—", subcategory: p?.subcategory ?? "—", brand: p?.brand ?? "—",
        qty: 0, revenue: 0, cost: p ? 0 : null, profit: null, margin: null, avgPrice: 0, discount: 0, stock: p?.stock ?? null,
        prevQty: 0, trend: null, weeksOfStock: null, onRepairInvoices: 0, discounts: 0, gross: 0 };
      rows.set(key, r);
    }
    if (inPre) r.prevQty += l.qty;
    if (!inCur) continue;
    r.qty += l.qty; r.revenue += l.lineTotal; r.gross += l.unitPrice * l.qty; r.discounts += l.discount;
    if (p && r.cost !== null) r.cost += p.buyingPrice * l.qty;
    if (repairNos.has(l.invoiceNo)) r.onRepairInvoices += l.qty;
  }
  return Array.from(rows.values()).map(r => {
    const profit = r.cost === null ? null : r.revenue - r.cost;
    const perWeek = r.qty / weeks;
    return {
      ...r,
      profit,
      margin: profit !== null && r.revenue > 0 ? profit / r.revenue : null,
      avgPrice: r.qty ? r.revenue / r.qty : 0,
      discount: r.gross > 0 ? r.discounts / r.gross : 0,
      trend: prev ? (r.prevQty === 0 ? (r.qty > 0 ? null : 0) : (r.qty - r.prevQty) / r.prevQty) : null,
      weeksOfStock: r.stock !== null && perWeek > 0 ? r.stock / perWeek : null,
    };
  }).filter(r => r.qty > 0 || r.prevQty > 0).sort((a, b) => b.revenue - a.revenue);
}

export function groupProducts(rows: ProductRow[], keyOf: (r: ProductRow) => string): { name: string; qty: number; revenue: number; profit: number | null; share: number }[] {
  const total = rows.reduce((t, r) => t + r.revenue, 0) || 1;
  const m = new Map<string, { qty: number; revenue: number; profit: number | null }>();
  for (const r of rows) {
    const k = keyOf(r) || "—";
    const g = m.get(k) ?? { qty: 0, revenue: 0, profit: 0 };
    g.qty += r.qty; g.revenue += r.revenue;
    g.profit = g.profit === null || r.profit === null ? null : g.profit + r.profit;
    m.set(k, g);
  }
  return Array.from(m.entries()).map(([name, g]) => ({ name, ...g, share: g.revenue / total })).sort((a, b) => b.revenue - a.revenue);
}

/** Pairs of products on the same invoice, most frequent first. */
export function boughtTogether(d: AnalyticsData, w: Window, limit = 10): { a: string; b: string; times: number }[] {
  const nos = new Set(live(d.sales, w).map(s => s.invoiceNo));
  const by = new Map<string, Set<string>>();
  d.saleLines.forEach(l => { if (l.kind === "accessory" && nos.has(l.invoiceNo)) by.set(l.invoiceNo, new Set([...(by.get(l.invoiceNo) ?? []), l.description])); });
  const pairs = new Map<string, number>();
  by.forEach(set => {
    const items = Array.from(set).sort();
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const k = `${items[i]} ${items[j]}`; pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  });
  return Array.from(pairs.entries()).map(([k, times]) => { const [a, b] = k.split(" "); return { a, b, times }; }).sort((x, y) => y.times - x.times).slice(0, limit);
}

/** What repair customers add to the bill — by product category — and how often. */
export function crossSell(d: AnalyticsData, w: Window): { repairInvoices: number; withProducts: number; rate: number | null; extraPerRepair: number | null; extraValue: number; byCategory: NamedValue[] } {
  const repairs = live(d.sales, w).filter(s => s.category === "Repair");
  const nos = new Set(repairs.map(s => s.invoiceNo));
  const products = new Map(d.products.map(p => [String(p.id), p]));
  const withP = new Set<string>();
  const cat = new Map<string, number>();
  let extra = 0;
  for (const l of d.saleLines) {
    if (l.kind !== "accessory" || !nos.has(l.invoiceNo)) continue;
    withP.add(l.invoiceNo); extra += l.lineTotal;
    const c = (l.referenceId ? products.get(l.referenceId)?.category : undefined) ?? "Other";
    cat.set(c, (cat.get(c) ?? 0) + 1);
  }
  return {
    repairInvoices: repairs.length, withProducts: withP.size,
    rate: repairs.length ? withP.size / repairs.length : null,
    extraPerRepair: withP.size ? extra / withP.size : null, extraValue: extra,
    byCategory: Array.from(cat.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}

/* ── Customers ──────────────────────────────────────────────────────────── */

export const customerKey = (phone: string | null | undefined, name: string | null | undefined): string => {
  const p = (phone ?? "").replace(/\D/g, "");
  if (p.length >= 9) return p.slice(-9);
  return (name ?? "").trim().toLowerCase();
};

export interface CustomerRecord {
  key: string; name: string; phone: string;
  firstSeen: string; lastSeen: string;
  visits: number; sales: number; repairs: number;
  revenue: number; repairRevenue: number; accessoryRevenue: number;
  outstanding: number;
  visitDates: string[];
}

/** Every customer the shop has ever seen, with their whole history. */
export function customerBook(d: AnalyticsData): Map<string, CustomerRecord> {
  const book = new Map<string, CustomerRecord>();
  const touch = (key: string, name: string, phone: string, when: string) => {
    let c = book.get(key);
    if (!c) { c = { key, name, phone, firstSeen: when, lastSeen: when, visits: 0, sales: 0, repairs: 0, revenue: 0, repairRevenue: 0, accessoryRevenue: 0, outstanding: 0, visitDates: [] }; book.set(key, c); }
    if (when < c.firstSeen) c.firstSeen = when;
    if (when > c.lastSeen) { c.lastSeen = when; if (name) c.name = name; if (phone) c.phone = phone; }
    c.visits += 1; c.visitDates.push(when);
    return c;
  };
  for (const j of d.jobs) {
    if (j.status === "Cancelled") continue;
    const k = customerKey(j.phone, j.customerName); if (!k) continue;
    const c = touch(k, j.customerName, j.phone ?? "", j.createdAt.slice(0, 10));
    c.repairs += 1;
    if (j.status === "Delivered" && j.completionType !== "Return" && j.completionType !== "Cash Return") { c.repairRevenue += j.estimatedCost; c.revenue += j.estimatedCost; }
  }
  for (const s of d.sales) {
    if (s.status === "Voided") continue;
    const k = customerKey(s.customerPhone, s.customer); if (!k || k === "walk-in") continue;
    const c = touch(k, s.customer, s.customerPhone ?? "", s.date);
    c.sales += 1;
    // Repair invoices are the same money the job already counted.
    if (s.category !== "Repair") { c.revenue += s.total; if (s.category === "Accessories") c.accessoryRevenue += s.total; }
  }
  for (const a of d.accounts) {
    const k = customerKey(a.phone, a.name);
    const c = book.get(k);
    if (c && a.balance > 0) c.outstanding += a.balance;
  }
  return book;
}

export interface CustomerKpis {
  total: number; newIn: Delta; returningIn: Delta; activeIn: Delta; inactive90: number; today: number;
  retention: number | null; repeatRate: number | null;
  avgSpend: number | null; avgVisits: number | null; avgDaysBetween: number | null;
  withCredit: number; repeatRepairers: number;
  repairOnly: number; salesOnly: number; both: number;
  accessoriesAfterRepair: number;
}

export function customerKpis(d: AnalyticsData, book: Map<string, CustomerRecord>, w: Window, prev: Window | null, now = new Date()): CustomerKpis {
  const all = Array.from(book.values());
  const seenIn = (c: CustomerRecord, win: Window) => c.visitDates.some(v => inWindow(v, win));
  const newIn = (win: Window) => all.filter(c => inWindow(c.firstSeen, win)).length;
  const activeIn = (win: Window) => all.filter(c => seenIn(c, win)).length;
  const returningIn = (win: Window) => all.filter(c => seenIn(c, win) && c.firstSeen < win.from.toISOString().slice(0, 10)).length;
  const prevActive = prev ? all.filter(c => seenIn(c, prev)) : [];
  const retained = prevActive.filter(c => seenIn(c, w)).length;
  const todayStr = now.toISOString().slice(0, 10);
  const gaps: number[] = [];
  all.forEach(c => {
    const ds = Array.from(new Set(c.visitDates)).sort();
    for (let i = 1; i < ds.length; i++) { const a = parseWhen(ds[i - 1]), b = parseWhen(ds[i]); if (a && b) gaps.push((b.getTime() - a.getTime()) / 86_400_000); }
  });
  // Accessories after a repair: an accessory sale by the same customer within 30 days of a repair being handed over.
  let after = 0;
  for (const c of all) {
    const deliveries = d.jobs.filter(j => j.status === "Delivered" && customerKey(j.phone, j.customerName) === c.key).map(j => j.handover?.handedOverAt ?? j.completedAt ?? j.createdAt);
    const accessorySales = d.sales.filter(s => s.status !== "Voided" && s.category === "Accessories" && customerKey(s.customerPhone, s.customer) === c.key && inWindow(s.date, w));
    if (accessorySales.some(s => deliveries.some(dv => { const a = parseWhen(dv), b = parseWhen(s.date); return a && b && b >= a && b.getTime() - a.getTime() <= 30 * 86_400_000; }))) after += 1;
  }
  return {
    total: all.length,
    newIn: delta(newIn(w), prev ? newIn(prev) : 0),
    returningIn: delta(returningIn(w), prev ? returningIn(prev) : 0),
    activeIn: delta(activeIn(w), prev ? activeIn(prev) : 0),
    inactive90: all.filter(c => { const l = parseWhen(c.lastSeen); return l && (now.getTime() - l.getTime()) / 86_400_000 > 90; }).length,
    today: all.filter(c => c.visitDates.includes(todayStr)).length,
    retention: prevActive.length ? retained / prevActive.length : null,
    repeatRate: all.length ? all.filter(c => c.visits > 1).length / all.length : null,
    avgSpend: mean(all.filter(c => c.revenue > 0).map(c => c.revenue)),
    avgVisits: mean(all.map(c => c.visits)),
    avgDaysBetween: mean(gaps),
    withCredit: all.filter(c => c.outstanding > 0).length,
    repeatRepairers: all.filter(c => c.repairs > 1).length,
    repairOnly: all.filter(c => c.repairs > 0 && c.sales === 0).length,
    salesOnly: all.filter(c => c.sales > 0 && c.repairs === 0).length,
    both: all.filter(c => c.sales > 0 && c.repairs > 0).length,
    accessoriesAfterRepair: after,
  };
}

export function customerTrend(book: Map<string, CustomerRecord>, w: Window): { name: string; newCustomers: number; returning: number }[] {
  const all = Array.from(book.values());
  return bucketsFor(w).map(b => {
    const seen = all.filter(c => c.visitDates.some(v => inWindow(v, b)));
    const fresh = seen.filter(c => inWindow(c.firstSeen, b)).length;
    return { name: b.name, newCustomers: fresh, returning: seen.length - fresh };
  });
}

export const categoryOf = (s: SaleTx): TxCategory => s.category;
