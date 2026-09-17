"use client";

import type { RepairJob, JobStatus } from "@/cashier/contexts/RepairContext";
import type { SaleTx, TxCategory } from "@/cashier/contexts/SalesContext";
import type { Supplier, PurchaseOrder } from "@/admin/contexts/AdminContext";
import type { StaffProfile } from "@/lib/staff/api";
import { bucketsFor, periodRange, type FigurePeriod } from "@/lib/repair/figures";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The arithmetic behind Staff Insights.
 *
 * Everything here is a pure function of the ledgers — sales, repair jobs,
 * credit payments, purchase orders — and the roster. The screen only chooses
 * a window and draws. Kept apart from the screen so a figure can be checked
 * by reading one function rather than a component.
 *
 * Attribution: a sale carries the name of who rang it up (sales.cashier), a
 * job the technician who did it, a credit payment the login that took it. A
 * name that matches nobody on the roster is kept as its own row rather than
 * dropped, so every table still adds up to the shop's totals.
 */

/* ── Window ─────────────────────────────────────────────────────────────── */

export type RangeChoice = FigurePeriod | "Custom";

export interface Window { from: Date; to: Date }

/** A bare date (a sale's sold_on) is a local day, not UTC midnight. */
export const parseWhen = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

export const inWindow = (iso: string | null | undefined, w: Window): boolean => {
  const d = parseWhen(iso);
  return !!d && d >= w.from && d < w.to;
};

export function windowFor(choice: RangeChoice, custom: { from: string; to: string }): Window {
  if (choice === "Custom") {
    const from = parseWhen(custom.from) ?? new Date(0);
    const toDay = parseWhen(custom.to);
    const to = toDay ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1) : new Date(8.64e15);
    return { from, to };
  }
  return periodRange(choice) ?? { from: new Date(0), to: new Date(8.64e15) };
}

/* ── Filters ────────────────────────────────────────────────────────────── */

export type RoleFilter = "All" | "Cashier" | "POS Cashier" | "Technician" | "Admin";
export type RepairStatusFilter = "All" | "Not started" | "In progress" | "Waiting" | "Ready" | "Delivered";
export type SalesTypeFilter = "All" | TxCategory;

export interface Filters {
  window: Window;
  role: RoleFilter;
  /** A staff member's full name, or "" for everyone. */
  staff: string;
  repairStatus: RepairStatusFilter;
  salesType: SalesTypeFilter;
}

const STATUS_OF: Record<Exclude<RepairStatusFilter, "All">, JobStatus> = {
  "Not started": "Non-Issued",
  "In progress": "Issued",
  "Waiting":     "Pending",
  "Ready":       "Completed",
  "Delivered":   "Delivered",
};

export const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Sales in the window, minus voids, narrowed by type and person. */
export function salesIn(sales: SaleTx[], f: Filters): SaleTx[] {
  return sales.filter(s =>
    s.status !== "Voided"
    && inWindow(s.date, f.window)
    && (f.salesType === "All" || s.category === f.salesType)
    && (!f.staff || norm(s.cashier) === norm(f.staff)),
  );
}

/**
 * Jobs that touched the window: taken in, started or finished inside it.
 * A job finished today but taken in last month belongs to today's figures.
 */
export function jobsIn(jobs: RepairJob[], f: Filters): RepairJob[] {
  return jobs.filter(j =>
    j.status !== "Cancelled"
    && (inWindow(j.createdAt, f.window) || inWindow(j.startedAt, f.window) || inWindow(j.completedAt, f.window))
    && (f.repairStatus === "All" || j.status === STATUS_OF[f.repairStatus])
    && (!f.staff || norm(j.technician) === norm(f.staff)),
  );
}

/* ── Credit payments ────────────────────────────────────────────────────── */

export interface CreditPayment {
  id: number;
  amount: number;
  occurredOn: string;
  createdBy: string | null;
  invoiceNo: string | null;
  note: string | null;
  createdAt: string;
}

/** Every payment taken on account, with the login that took it. */
export async function fetchCreditPayments(): Promise<CreditPayment[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("credit_entries")
    .select("id, amount, occurred_on, created_by, invoice_no, note, created_at")
    .eq("kind", "Payment")
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    id: Number(r.id),
    amount: Number(r.amount ?? 0),
    occurredOn: r.occurred_on as string,
    createdBy: (r.created_by as string | null) ?? null,
    invoiceNo: (r.invoice_no as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/* ── Rows ───────────────────────────────────────────────────────────────── */

export interface CashierRow {
  name: string;
  role: string | null;
  invoices: number;
  sales: number;
  avgBill: number;
  accessorySales: number;
  repairCollected: number;
  creditCollected: number;
  discounts: number;
  refunds: number;
  refundValue: number;
  voided: number;
  cash: number;
  card: number;
  other: number;
}

export interface TechnicianRow {
  name: string;
  role: string | null;
  assigned: number;
  started: number;
  completed: number;
  waiting: number;
  notStarted: number;
  inProgress: number;
  /** Mean days, started → finished. */
  avgRepairDays: number | null;
  /** Mean days, taken in → started. */
  avgQueueDays: number | null;
  sameDay: number;
  repeat: number;
  returned: number;
  partsUsed: number;
  revenue: number;
  outstanding: number;
  urgent: number;
  /** Returned or repeated, over completed. */
  repeatRate: number | null;
}

export interface SupplierRow {
  id: string;
  name: string;
  purchases: number;
  orders: number;
  items: number;
  received: number;
  avgOrder: number;
  outstanding: number;
  lastOrder: string | null;
  categories: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const days = (a: string | null | undefined, b: string | null | undefined): number | null => {
  const s = parseWhen(a), e = parseWhen(b);
  if (!s || !e || e < s) return null;
  return (e.getTime() - s.getTime()) / 86_400_000;
};
const sameLocalDay = (a: string | null | undefined, b: string | null | undefined) => {
  const s = parseWhen(a), e = parseWhen(b);
  return !!s && !!e && s.toDateString() === e.toDateString();
};

export function cashierRows(staff: StaffProfile[], sales: SaleTx[], payments: CreditPayment[], f: Filters): CashierRow[] {
  const byName = new Map(staff.map(s => [norm(s.fullName), s]));
  const byId = new Map(staff.map(s => [s.id, s]));
  const rows = new Map<string, CashierRow>();
  const blank = (name: string, role: string | null): CashierRow => ({
    name, role, invoices: 0, sales: 0, avgBill: 0, accessorySales: 0, repairCollected: 0, creditCollected: 0,
    discounts: 0, refunds: 0, refundValue: 0, voided: 0, cash: 0, card: 0, other: 0,
  });
  const rowFor = (key: string, fallback: string) => {
    let r = rows.get(key);
    if (!r) {
      const who = byName.get(key);
      r = blank(who?.fullName ?? fallback, who?.role ?? null);
      rows.set(key, r);
    }
    return r;
  };

  const counterRoles = new Set(["Cashier", "POS Cashier", "Admin"]);
  staff
    .filter(s => counterRoles.has(s.role) && (f.role === "All" || s.role === f.role) && (!f.staff || norm(s.fullName) === norm(f.staff)))
    .forEach(s => rows.set(norm(s.fullName), blank(s.fullName, s.role)));

  // Voids are counted, not summed: the bill was cancelled, its money never came.
  const inRange = sales.filter(s => inWindow(s.date, f.window) && (f.salesType === "All" || s.category === f.salesType) && (!f.staff || norm(s.cashier) === norm(f.staff)));
  for (const s of inRange) {
    const r = rowFor(norm(s.cashier) || "__none", s.cashier?.trim() || "Not recorded");
    if (s.status === "Voided") { r.voided += 1; continue; }
    r.invoices += 1;
    r.sales += s.total;
    r.discounts += s.discountAmount ?? 0;
    if (s.category === "Accessories") r.accessorySales += s.total;
    if (s.category === "Repair") r.repairCollected += s.paid ?? s.total;
    if (s.status === "Returned" || (s.returnedAmount ?? 0) > 0) { r.refunds += 1; r.refundValue += s.returnedAmount ?? 0; }
    const paid = s.paid ?? s.total;
    switch (s.paymentMethod) {
      case "Card": r.card += paid; break;
      case "Cash": case undefined: r.cash += paid; break;
      case "Split": r.cash += s.cashAmount ?? 0; r.card += s.cardAmount ?? 0; break;
      default: r.other += paid;
    }
  }
  for (const p of payments) {
    if (!inWindow(p.occurredOn, f.window)) continue;
    const who = p.createdBy ? byId.get(p.createdBy) : undefined;
    if (!who) continue;
    if (f.staff && norm(who.fullName) !== norm(f.staff)) continue;
    const r = rowFor(norm(who.fullName), who.fullName);
    r.creditCollected += p.amount;
  }

  return Array.from(rows.values())
    .map(r => ({ ...r, avgBill: r.invoices ? r.sales / r.invoices : 0 }))
    .filter(r => r.role !== null ? (f.role === "All" || r.role === f.role) : r.invoices > 0 || r.voided > 0)
    .sort((a, b) => b.sales - a.sales || b.invoices - a.invoices || a.name.localeCompare(b.name));
}

export function technicianRows(staff: StaffProfile[], jobs: RepairJob[], f: Filters): TechnicianRow[] {
  const byName = new Map(staff.map(s => [norm(s.fullName), s]));
  type Acc = TechnicianRow & { repairDays: number[]; queueDays: number[] };
  const rows = new Map<string, Acc>();
  const blank = (name: string, role: string | null): Acc => ({
    name, role, assigned: 0, started: 0, completed: 0, waiting: 0, notStarted: 0, inProgress: 0,
    avgRepairDays: null, avgQueueDays: null, sameDay: 0, repeat: 0, returned: 0, partsUsed: 0, revenue: 0,
    outstanding: 0, urgent: 0, repeatRate: null, repairDays: [], queueDays: [],
  });
  const rowFor = (j: RepairJob) => {
    const key = norm(j.technician) || "__none";
    let r = rows.get(key);
    if (!r) {
      const who = byName.get(key);
      r = blank(who?.fullName ?? (j.technician?.trim() || "Unassigned"), who?.role ?? null);
      rows.set(key, r);
    }
    return r;
  };
  staff
    .filter(s => s.role === "Technician" && (f.role === "All" || f.role === "Technician") && (!f.staff || norm(s.fullName) === norm(f.staff)))
    .forEach(s => rows.set(norm(s.fullName), blank(s.fullName, s.role)));

  for (const j of jobsIn(jobs, f)) {
    const r = rowFor(j);
    if (inWindow(j.createdAt, f.window) && j.technician) r.assigned += 1;
    if (inWindow(j.startedAt, f.window)) r.started += 1;
    const finished = (j.status === "Completed" || j.status === "Delivered") && inWindow(j.completedAt, f.window);
    if (finished) {
      r.completed += 1;
      const isReturn = j.completionType === "Return" || j.completionType === "Cash Return";
      if (isReturn) r.returned += 1; else r.revenue += j.estimatedCost;
      if (j.rejobOf) r.repeat += 1;
      if (sameLocalDay(j.createdAt, j.completedAt)) r.sameDay += 1;
      r.partsUsed += j.partsUsed?.length ?? 0;
      const rd = days(j.startedAt ?? j.createdAt, j.completedAt);
      if (rd !== null) r.repairDays.push(rd);
      const qd = days(j.createdAt, j.startedAt);
      if (qd !== null) r.queueDays.push(qd);
    }
    // The bench as it stands — a snapshot, whatever the window.
    if (j.technician) {
      if (j.status === "Non-Issued") { r.notStarted += 1; r.outstanding += 1; }
      if (j.status === "Issued")     { r.inProgress += 1; r.outstanding += 1; }
      if (j.status === "Pending")    { r.waiting += 1;    r.outstanding += 1; }
      if (j.priority === "Urgent" && (j.status === "Non-Issued" || j.status === "Issued" || j.status === "Pending")) r.urgent += 1;
    }
  }

  return Array.from(rows.values())
    .map(({ repairDays, queueDays, ...r }) => ({
      ...r,
      avgRepairDays: mean(repairDays),
      avgQueueDays: mean(queueDays),
      repeatRate: r.completed ? (r.returned + r.repeat) / r.completed : null,
    }))
    .filter(r => r.role === "Technician" || r.completed > 0 || r.outstanding > 0)
    .sort((a, b) => b.completed - a.completed || b.revenue - a.revenue || a.name.localeCompare(b.name));
}

export function supplierRows(suppliers: Supplier[], orders: PurchaseOrder[], w: Window): SupplierRow[] {
  const rows = new Map<string, SupplierRow>();
  suppliers.forEach(s => rows.set(s.id, {
    id: s.id, name: s.name, purchases: 0, orders: 0, items: 0, received: 0, avgOrder: 0,
    outstanding: s.balance, lastOrder: null, categories: s.category,
  }));
  for (const o of orders) {
    if (o.status === "Cancelled" || o.status === "Draft" || !inWindow(o.createdAt, w)) continue;
    let r = rows.get(o.supplierId);
    if (!r) {
      r = { id: o.supplierId, name: o.supplierName, purchases: 0, orders: 0, items: 0, received: 0, avgOrder: 0, outstanding: 0, lastOrder: null, categories: "" };
      rows.set(o.supplierId, r);
    }
    r.orders += 1;
    r.purchases += o.total;
    r.items += o.items.reduce((t, i) => t + i.quantity, 0);
    r.received += o.items.reduce((t, i) => t + i.receivedQty, 0);
    if (!r.lastOrder || o.createdAt > r.lastOrder) r.lastOrder = o.createdAt;
  }
  return Array.from(rows.values())
    .map(r => ({ ...r, avgOrder: r.orders ? r.purchases / r.orders : 0 }))
    .sort((a, b) => b.purchases - a.purchases || a.name.localeCompare(b.name));
}

/* ── Headline ───────────────────────────────────────────────────────────── */

export interface Headline {
  activeStaff: number;
  salesValue: number;
  invoices: number;
  completed: number;
  inProgress: number;
  avgRepairDays: number | null;
  returns: number;
}

export function headline(staff: StaffProfile[], sales: SaleTx[], jobs: RepairJob[], f: Filters): Headline {
  const s = salesIn(sales, f);
  const j = jobsIn(jobs, f);
  const finished = j.filter(x => (x.status === "Completed" || x.status === "Delivered") && inWindow(x.completedAt, f.window));
  const repairDays = finished.map(x => days(x.startedAt ?? x.createdAt, x.completedAt)).filter((d): d is number => d !== null);
  return {
    activeStaff: staff.filter(x => x.status === "Active" && (f.role === "All" || x.role === f.role)).length,
    salesValue: s.reduce((t, x) => t + x.total, 0),
    invoices: s.length,
    completed: finished.length,
    inProgress: jobs.filter(x => x.status === "Issued" && (!f.staff || norm(x.technician) === norm(f.staff))).length,
    avgRepairDays: mean(repairDays),
    returns:
      s.filter(x => x.status === "Returned" || (x.returnedAmount ?? 0) > 0).length
      + finished.filter(x => x.completionType === "Return" || x.completionType === "Cash Return").length,
  };
}

/* ── Series for the charts ──────────────────────────────────────────────── */

export interface NamedValue { name: string; value: number }

/** Sales value per cashier, largest first. */
export const salesByCashier = (rows: CashierRow[]): NamedValue[] =>
  rows.filter(r => r.sales > 0).map(r => ({ name: r.name, value: r.sales }));

/** One line per cashier, per bucket. Capped at five — past that a line chart is a tangle. */
export function dailyStaffSales(sales: SaleTx[], f: Filters, period: FigurePeriod): { points: Record<string, number | string>[]; series: string[] } {
  const inRange = salesIn(sales, f);
  const totals = new Map<string, number>();
  inRange.forEach(s => { const k = s.cashier?.trim() || "Not recorded"; totals.set(k, (totals.get(k) ?? 0) + s.total); });
  const series = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  const points = bucketsFor(period).map(b => {
    const p: Record<string, number | string> = { name: b.name };
    series.forEach(k => { p[k] = 0; });
    inRange.forEach(s => {
      const k = s.cashier?.trim() || "Not recorded";
      if (series.includes(k) && inWindow(s.date, b)) p[k] = (p[k] as number) + s.total;
    });
    return p;
  });
  return { points, series };
}

export interface WorkloadPoint { name: string; notStarted: number; inProgress: number; waiting: number }
export const workloadByTechnician = (rows: TechnicianRow[]): WorkloadPoint[] =>
  rows.filter(r => r.outstanding > 0).map(r => ({ name: r.name, notStarted: r.notStarted, inProgress: r.inProgress, waiting: r.waiting }));

export interface TurnaroundPoint { name: string; queue: number; bench: number }
export const turnaroundByTechnician = (rows: TechnicianRow[]): TurnaroundPoint[] =>
  rows.filter(r => r.avgRepairDays !== null).map(r => ({ name: r.name, queue: r.avgQueueDays ?? 0, bench: r.avgRepairDays ?? 0 }));

export const purchasesBySupplier = (rows: SupplierRow[]): NamedValue[] =>
  rows.filter(r => r.purchases > 0).map(r => ({ name: r.name, value: r.purchases }));

/* ── One person ─────────────────────────────────────────────────────────── */

export interface ActivityItem { when: string; label: string; detail: string; amount: number | null }

/** The last few things this person did, newest first. */
export function recentActivity(person: StaffProfile, sales: SaleTx[], jobs: RepairJob[], payments: CreditPayment[], limit = 12): ActivityItem[] {
  const items: ActivityItem[] = [];
  const me = norm(person.fullName);
  if (person.role === "Technician") {
    jobs.filter(j => norm(j.technician) === me).forEach(j => {
      if (j.completedAt) items.push({ when: j.completedAt, label: `Finished ${j.id}`, detail: `${j.brand} ${j.model}`.trim(), amount: j.completionType === "Return" || j.completionType === "Cash Return" ? null : j.estimatedCost });
      else if (j.startedAt) items.push({ when: j.startedAt, label: `Started ${j.id}`, detail: `${j.brand} ${j.model}`.trim(), amount: null });
    });
  } else {
    sales.filter(s => norm(s.cashier) === me).forEach(s => {
      items.push({ when: s.date, label: `${s.status === "Voided" ? "Voided " : ""}Invoice ${s.invoiceNo}`, detail: `${s.category} · ${s.customer}`, amount: s.status === "Voided" ? null : s.total });
      if ((s.returnedAmount ?? 0) > 0) items.push({ when: s.returnDate ?? s.date, label: `Refund on ${s.invoiceNo}`, detail: s.returnReason ?? "", amount: -(s.returnedAmount ?? 0) });
    });
    payments.filter(p => p.createdBy === person.id).forEach(p => {
      items.push({ when: p.createdAt, label: "Credit payment", detail: p.invoiceNo ? `On ${p.invoiceNo}` : (p.note ?? ""), amount: p.amount });
    });
  }
  return items
    .sort((a, b) => (parseWhen(b.when)?.getTime() ?? 0) - (parseWhen(a.when)?.getTime() ?? 0))
    .slice(0, limit);
}

/** Six months of this person's main figure — sales value, or repairs finished. */
export function activityTrend(person: StaffProfile, sales: SaleTx[], jobs: RepairJob[]): NamedValue[] {
  const me = norm(person.fullName);
  return bucketsFor("Monthly").slice(-6).map(b => ({
    name: b.name,
    value: person.role === "Technician"
      ? jobs.filter(j => norm(j.technician) === me && j.completedAt && inWindow(j.completedAt, b) && j.status !== "Cancelled").length
      : sales.filter(s => norm(s.cashier) === me && s.status !== "Voided" && inWindow(s.date, b)).reduce((t, s) => t + s.total, 0),
  }));
}
