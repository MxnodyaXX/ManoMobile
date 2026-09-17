"use client";

import type { AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import type { PurchaseOrder } from "@/admin/contexts/AdminContext";
import type { AnalyticsData } from "./data";
import { live } from "./overview";
import { bucketsFor, inWindow, parseWhen, type Window } from "./window";

/**
 * Stock, what it is worth, how fast it moves, and where it came from —
 * sections 11 to 15 of the brief.
 *
 * The system keeps stock levels, not stock movements: there is no log of
 * goods received, adjusted, damaged or lost. So everything about movement
 * here is read from the one movement that is recorded — sales — and the
 * figures that need the rest (turnover, stock age) are estimates from
 * sales pace against stock on hand, and say so on the screen.
 */

const DAY = 86_400_000;

export interface StockKpis {
  products: number; units: number; costValue: number; retailValue: number; potentialProfit: number;
  low: number; out: number; over: number; dead: number;
  turnover: number | null; daysOutstanding: number | null; sellThrough: number | null; stockToSales: number | null;
  partsCount: number; partsUnits: number; partsValue: number; partsLow: number;
}

/** Units sold per product in a window, from the invoice lines. */
export function unitsSold(d: AnalyticsData, w: Window): Map<string, number> {
  const nos = new Set(live(d.sales, w).map(s => s.invoiceNo));
  const m = new Map<string, number>();
  d.saleLines.forEach(l => { if (l.kind === "accessory" && l.referenceId && nos.has(l.invoiceNo)) m.set(l.referenceId, (m.get(l.referenceId) ?? 0) + l.qty); });
  return m;
}

/** When each product last sold, all time. */
export function lastSold(d: AnalyticsData): Map<string, string> {
  const dateOf = new Map(d.sales.filter(s => s.status !== "Voided").map(s => [s.invoiceNo, s.date]));
  const m = new Map<string, string>();
  d.saleLines.forEach(l => {
    if (l.kind !== "accessory" || !l.referenceId) return;
    const dt = dateOf.get(l.invoiceNo); if (!dt) return;
    if (!m.has(l.referenceId) || (m.get(l.referenceId) ?? "") < dt) m.set(l.referenceId, dt);
  });
  return m;
}

export function stockKpis(d: AnalyticsData, w: Window, now = new Date()): StockKpis {
  const sold = unitsSold(d, w);
  const last = lastSold(d);
  const costValue = d.products.reduce((t, p) => t + p.stock * p.buyingPrice, 0);
  const retailValue = d.products.reduce((t, p) => t + p.stock * p.sellingPrice, 0);
  const soldUnits = Array.from(sold.values()).reduce((a, b) => a + b, 0);
  const soldCost = d.products.reduce((t, p) => t + (sold.get(String(p.id)) ?? 0) * p.buyingPrice, 0);
  const spanDays = Math.max(1, (Math.min(w.to.getTime(), now.getTime()) - Math.max(w.from.getTime(), 0)) / DAY);
  const turnover = costValue > 0 ? (soldCost / costValue) * (365 / spanDays) : null;
  const units = d.products.reduce((t, p) => t + Math.max(0, p.stock), 0);
  const dead = d.products.filter(p => p.stock > 0 && (!last.has(String(p.id)) || ((now.getTime() - (parseWhen(last.get(String(p.id)))?.getTime() ?? 0)) / DAY) > 90)).length;
  return {
    products: d.products.length, units, costValue, retailValue, potentialProfit: retailValue - costValue,
    low: d.products.filter(p => p.stock > 0 && p.stock <= p.minStock).length,
    out: d.products.filter(p => p.stock <= 0).length,
    over: d.products.filter(p => p.minStock > 0 && p.stock > p.minStock * 5).length,
    dead,
    turnover,
    daysOutstanding: turnover && turnover > 0 ? 365 / turnover : null,
    sellThrough: soldUnits + units > 0 ? soldUnits / (soldUnits + units) : null,
    stockToSales: soldUnits > 0 ? units / soldUnits : null,
    partsCount: d.parts.length,
    partsUnits: d.parts.reduce((t, p) => t + Math.max(0, p.stock), 0),
    partsValue: d.parts.reduce((t, p) => t + Math.max(0, p.stock) * p.costPrice, 0),
    partsLow: d.parts.filter(p => p.stock <= p.reorderLevel).length,
  };
}

export interface StockGroup { name: string; products: number; units: number; costValue: number; retailValue: number; soldUnits: number }

export function stockBy(d: AnalyticsData, w: Window, keyOf: (p: AccessoryProduct) => string): StockGroup[] {
  const sold = unitsSold(d, w);
  const m = new Map<string, StockGroup>();
  for (const p of d.products) {
    const k = keyOf(p) || "—";
    const g = m.get(k) ?? { name: k, products: 0, units: 0, costValue: 0, retailValue: 0, soldUnits: 0 };
    g.products += 1; g.units += Math.max(0, p.stock); g.costValue += Math.max(0, p.stock) * p.buyingPrice; g.retailValue += Math.max(0, p.stock) * p.sellingPrice;
    g.soldUnits += sold.get(String(p.id)) ?? 0;
    m.set(k, g);
  }
  return Array.from(m.values()).sort((a, b) => b.costValue - a.costValue);
}

export interface ReorderRow {
  id: number; name: string; category: string; supplier: string; stock: number; minStock: number;
  dailyPace: number; daysLeft: number | null; suggested: number; urgency: "now" | "soon" | "watch";
  lastSold: string | null; stockouts: boolean;
}

/**
 * What to order. Pace is the last 30 days of sales; the suggestion is enough
 * to cover 30 more days at that pace, less what is on the shelf, never below
 * the product's own minimum.
 */
export function reorderRows(d: AnalyticsData, now = new Date()): ReorderRow[] {
  const last30: Window = { from: new Date(now.getTime() - 30 * DAY), to: new Date(8.64e15), label: "", compareLabel: null };
  const sold = unitsSold(d, last30);
  const last = lastSold(d);
  const rows: ReorderRow[] = [];
  for (const p of d.products) {
    const pace = (sold.get(String(p.id)) ?? 0) / 30;
    const daysLeft = pace > 0 ? p.stock / pace : null;
    const belowMin = p.stock <= p.minStock;
    const runningOut = daysLeft !== null && daysLeft < 14;
    if (!belowMin && !runningOut) continue;
    const suggested = Math.max(p.minStock - p.stock, Math.ceil(pace * 30) - p.stock, p.stock <= 0 ? Math.max(1, p.minStock) : 0);
    rows.push({
      id: p.id, name: p.name, category: p.category, supplier: p.supplier, stock: p.stock, minStock: p.minStock,
      dailyPace: pace, daysLeft, suggested: Math.max(0, suggested),
      urgency: p.stock <= 0 || (daysLeft !== null && daysLeft < 3) ? "now" : belowMin || (daysLeft !== null && daysLeft < 7) ? "soon" : "watch",
      lastSold: last.get(String(p.id)) ?? null,
      stockouts: p.stock <= 0 && (sold.get(String(p.id)) ?? 0) > 0,
    });
  }
  const rank = { now: 0, soon: 1, watch: 2 };
  return rows.sort((a, b) => rank[a.urgency] - rank[b.urgency] || (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
}

export interface MovementRow { id: number; name: string; stock: number; soldUnits: number; weeksOfStock: number | null; lastSold: string | null; value: number }

export function movement(d: AnalyticsData, w: Window, now = new Date()): { fast: MovementRow[]; slow: MovementRow[]; dead: MovementRow[] } {
  const sold = unitsSold(d, w);
  const last = lastSold(d);
  const weeks = Math.max(1 / 7, (Math.min(w.to.getTime(), now.getTime()) - Math.max(w.from.getTime(), 0)) / (7 * DAY));
  const rows: MovementRow[] = d.products.map(p => {
    const s = sold.get(String(p.id)) ?? 0;
    const perWeek = s / weeks;
    return { id: p.id, name: p.name, stock: p.stock, soldUnits: s, weeksOfStock: perWeek > 0 ? p.stock / perWeek : null, lastSold: last.get(String(p.id)) ?? null, value: Math.max(0, p.stock) * p.buyingPrice };
  });
  return {
    fast: rows.filter(r => r.soldUnits >= 3).sort((a, b) => b.soldUnits - a.soldUnits).slice(0, 10),
    slow: rows.filter(r => r.stock > 0 && r.soldUnits > 0 && (r.weeksOfStock ?? 0) > 12).sort((a, b) => (b.weeksOfStock ?? 0) - (a.weeksOfStock ?? 0)).slice(0, 10),
    dead: rows.filter(r => r.stock > 0 && (!r.lastSold || (now.getTime() - (parseWhen(r.lastSold)?.getTime() ?? 0)) / DAY > 90)).sort((a, b) => b.value - a.value).slice(0, 10),
  };
}

/* ── Suppliers and purchasing ───────────────────────────────────────────── */

export interface SupplierRow {
  id: string; name: string; category: string; status: string;
  purchases: number; orders: number; items: number; received: number; avgOrder: number; avgItemCost: number | null;
  outstanding: number; lastOrder: string | null; frequencyDays: number | null;
  stockProducts: number; stockValue: number; salesFromStock: number; profitFromStock: number;
}

const usable = (o: PurchaseOrder) => o.status !== "Cancelled" && o.status !== "Draft";

export function supplierRows(d: AnalyticsData, w: Window): SupplierRow[] {
  const sold = unitsSold(d, w);
  const rows = new Map<string, SupplierRow>();
  const blank = (id: string, name: string, category = "", status = ""): SupplierRow => ({
    id, name, category, status, purchases: 0, orders: 0, items: 0, received: 0, avgOrder: 0, avgItemCost: null, outstanding: 0, lastOrder: null, frequencyDays: null,
    stockProducts: 0, stockValue: 0, salesFromStock: 0, profitFromStock: 0,
  });
  d.suppliers.forEach(s => rows.set(s.id, { ...blank(s.id, s.name, s.category, s.status), outstanding: s.balance }));
  const orderDates = new Map<string, string[]>();
  for (const o of d.purchaseOrders) {
    if (!usable(o)) continue;
    let r = rows.get(o.supplierId);
    if (!r) { r = blank(o.supplierId, o.supplierName); rows.set(o.supplierId, r); }
    orderDates.set(o.supplierId, [...(orderDates.get(o.supplierId) ?? []), o.createdAt]);
    if (!r.lastOrder || o.createdAt > r.lastOrder) r.lastOrder = o.createdAt;
    if (!inWindow(o.createdAt, w)) continue;
    r.orders += 1; r.purchases += o.total;
    r.items += o.items.reduce((t, i) => t + i.quantity, 0);
    r.received += o.items.reduce((t, i) => t + i.receivedQty, 0);
  }
  // Products on the shelf that name this supplier, and what they earned.
  const byName = new Map(Array.from(rows.values()).map(r => [r.name.trim().toLowerCase(), r]));
  for (const p of d.products) {
    const r = byName.get((p.supplier ?? "").trim().toLowerCase());
    if (!r) continue;
    r.stockProducts += 1; r.stockValue += Math.max(0, p.stock) * p.buyingPrice;
    const units = sold.get(String(p.id)) ?? 0;
    r.salesFromStock += units * p.sellingPrice; r.profitFromStock += units * (p.sellingPrice - p.buyingPrice);
  }
  return Array.from(rows.values()).map(r => {
    const dates = (orderDates.get(r.id) ?? []).sort();
    const gaps = dates.slice(1).map((dt, i) => ((parseWhen(dt)?.getTime() ?? 0) - (parseWhen(dates[i])?.getTime() ?? 0)) / DAY);
    return { ...r, avgOrder: r.orders ? r.purchases / r.orders : 0, avgItemCost: r.items ? r.purchases / r.items : null, frequencyDays: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null };
  }).sort((a, b) => b.purchases - a.purchases || b.stockValue - a.stockValue);
}

export interface PurchaseKpis { total: number; orders: number; avgOrder: number | null; items: number; received: number; pending: number; outstanding: number; suppliers: number; activeSuppliers: number }

export function purchaseKpis(d: AnalyticsData, w: Window): PurchaseKpis {
  const inW = d.purchaseOrders.filter(o => usable(o) && inWindow(o.createdAt, w));
  const total = inW.reduce((t, o) => t + o.total, 0);
  return {
    total, orders: inW.length, avgOrder: inW.length ? total / inW.length : null,
    items: inW.reduce((t, o) => t + o.items.reduce((q, i) => q + i.quantity, 0), 0),
    received: inW.reduce((t, o) => t + o.items.reduce((q, i) => q + i.receivedQty, 0), 0),
    pending: d.purchaseOrders.filter(o => o.status === "Approved" || o.status === "Sent" || o.status === "Partially Received").length,
    outstanding: d.suppliers.reduce((t, s) => t + Math.max(0, s.balance), 0),
    suppliers: d.suppliers.length, activeSuppliers: d.suppliers.filter(s => s.status === "Active").length,
  };
}

export function purchaseTrend(d: AnalyticsData, w: Window): { name: string; purchases: number; sales: number }[] {
  return bucketsFor(w).map(b => ({
    name: b.name,
    purchases: d.purchaseOrders.filter(o => usable(o) && inWindow(o.createdAt, b)).reduce((t, o) => t + o.total, 0),
    sales: live(d.sales, { ...b, label: "", compareLabel: null }).filter(s => s.category === "Accessories").reduce((t, s) => t + s.total, 0),
  }));
}

export function purchasesByItem(d: AnalyticsData, w: Window, limit = 12): { name: string; value: number; qty: number; orders: number }[] {
  const m = new Map<string, { value: number; qty: number; orders: number }>();
  d.purchaseOrders.filter(o => usable(o) && inWindow(o.createdAt, w)).forEach(o => o.items.forEach(i => {
    const k = i.description.trim() || i.sku || "—";
    const r = m.get(k) ?? { value: 0, qty: 0, orders: 0 };
    r.value += i.unitPrice * i.quantity; r.qty += i.quantity; r.orders += 1; m.set(k, r);
  }));
  return Array.from(m.entries()).map(([name, r]) => ({ name, ...r })).sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Items whose unit cost differs between their first and last order. */
export function priceChanges(d: AnalyticsData, limit = 10): { name: string; first: number; last: number; change: number; supplier: string }[] {
  const seen = new Map<string, { first: number; last: number; firstAt: string; lastAt: string; supplier: string }>();
  [...d.purchaseOrders].filter(usable).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach(o => o.items.forEach(i => {
    const k = i.description.trim().toLowerCase();
    const r = seen.get(k);
    if (!r) seen.set(k, { first: i.unitPrice, last: i.unitPrice, firstAt: o.createdAt, lastAt: o.createdAt, supplier: o.supplierName });
    else { r.last = i.unitPrice; r.lastAt = o.createdAt; r.supplier = o.supplierName; }
  }));
  return Array.from(seen.entries()).filter(([, r]) => r.first > 0 && r.last !== r.first)
    .map(([name, r]) => ({ name, first: r.first, last: r.last, change: (r.last - r.first) / r.first, supplier: r.supplier }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, limit);
}
