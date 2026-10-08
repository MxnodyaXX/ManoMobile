"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { SaleTx, TxCategory } from "@/cashier/contexts/SalesContext";

/**
 * Everything the Daily Report shows, for one day, from what is actually
 * stored — never the in-memory Cash Register log, which lives only in the tab
 * that opened it and is gone on refresh.
 *
 *   sales            the ledger: revenue, count, category, hour, payment split
 *   sale_items       the lines, for the top items sold
 *   credit_entries   payments received against credit accounts that day
 *   cash_returns     money given back that day (advance refunds, dealer cash
 *                    returns, sale refunds)
 *   device_warranty_claims  phone warranty refunds paid out that day
 *
 * The drawer is worked out, not counted: cash in (cash sales + cash credit
 * payments) less cash out (cash returns + cash refunds). Nothing records the
 * counted cash at close, so the report says "expected in drawer" rather than
 * inventing a variance.
 */

type Row = Record<string, unknown>;

export interface DailyReportData {
  loading: boolean;
  gross: number;
  returns: number;
  cashReturned: number;
  net: number;
  txCount: number;
  avgTicket: number;
  cashSales: number;
  creditPaymentsCash: number;
  creditPaymentsOther: number;
  cashOut: number;
  expectedCash: number;
  onCredit: number;
  byCategory: { name: TxCategory; revenue: number; transactions: number }[];
  payment: { method: string; amount: number; pct: number; color: string }[];
  hourly: { time: string; revenue: number; yesterday: number; txn: number }[];
  cashFlow: { label: string; cashIn: number; cashOut: number; running: number }[];
  topItems: { item: string; category: string; revenue: number; qty: number }[];
  customers: { type: string; count: number; pct: number; color: string }[];
  cashRows: { label: string; amount: number; type: "in" | "out" | "neutral" }[];
  yesterdayNet: number;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am – 9pm
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
const hourOf = (iso?: string | null) => (iso ? new Date(iso).getHours() : null);
const clampHour = (h: number | null) => (h == null ? null : Math.min(21, Math.max(7, h)));

const prevDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** How one sale's money arrived. Credit = the part still owed. */
function splitOf(s: SaleTx): Record<string, number> {
  const total = s.total;
  const paid = s.paid ?? (s.paymentMethod === "Credit" ? 0 : total);
  const out: Record<string, number> = {};
  const add = (k: string, v: number) => { if (v > 0.005) out[k] = (out[k] ?? 0) + v; };
  switch (s.paymentMethod) {
    case "Card": add("Card", s.cardAmount ?? paid); break;
    case "Bank Transfer": add("Bank Transfer", paid); break;
    case "Cheque": add("Cheque", paid); break;
    case "Split": add("Cash", s.cashAmount ?? 0); add("Card", s.cardAmount ?? Math.max(0, paid - (s.cashAmount ?? 0))); break;
    case "Credit":
      add("Cash", s.cashAmount ?? Math.max(0, paid - (s.cardAmount ?? 0)));
      add("Card", s.cardAmount ?? 0);
      break;
    default: add("Cash", s.cashAmount ?? paid); break;
  }
  add("On credit", Math.max(0, total - paid));
  return out;
}

const METHOD_COLOR: Record<string, string> = {
  Cash: "#4ade80", Card: "#60a5fa", "Bank Transfer": "#a78bfa", Cheque: "#f59e0b", "On credit": "#f87171",
};
const KIND_CATEGORY: Record<string, string> = {
  device: "Mobile", accessory: "Accessories", repair_service: "Repair", repair_part: "Repair", sim: "Others", reload: "Others", other: "Others",
};

export function useDailyReport(date: string, allSales: SaleTx[]): DailyReportData {
  const yesterday = prevDay(date);
  const day = useMemo(() => allSales.filter(s => s.date === date && s.status !== "Voided"), [allSales, date]);
  const prev = useMemo(() => allSales.filter(s => s.date === yesterday && s.status !== "Voided"), [allSales, yesterday]);

  const [extra, setExtra] = useState<{
    key: string; lines: Row[]; payments: Row[]; returns: Row[]; refunds: Row[];
  }>({ key: "", lines: [], payments: [], returns: [], refunds: [] });

  const invoiceKey = day.map(s => s.invoiceNo).sort().join(",");
  const fetchKey = `${date}|${invoiceKey}`;

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let live = true;
    const sb = getSupabaseBrowserClient();
    const nos = invoiceKey ? invoiceKey.split(",") : [];
    // Each source is optional — a table the role cannot read, or a migration
    // not yet run, leaves its part of the report empty rather than the page.
    const safe = <T,>(p: PromiseLike<{ data: T[] | null }>) => Promise.resolve(p).then(r => r.data ?? []).catch(() => [] as T[]);
    Promise.all([
      nos.length ? safe<Row>(sb.from("sale_items").select("invoice_no, kind, description, qty, line_total").in("invoice_no", nos)) : Promise.resolve([] as Row[]),
      safe<Row>(sb.from("credit_entries").select("amount, method, created_at").eq("kind", "Payment").eq("occurred_on", date)),
      safe<Row>(sb.from("cash_returns").select("ref, kind, amount, method, reason, created_at").eq("returned_on", date)),
      safe<Row>(sb.from("device_warranty_claims").select("id, refund_amount, refund_credit_amount, refund_method, resolved_at")
        .eq("resolution", "refund").gte("resolved_at", `${date}T00:00:00`).lte("resolved_at", `${date}T23:59:59.999`)),
    ]).then(([lines, payments, returns, refunds]) => {
      if (live) setExtra({ key: fetchKey, lines, payments, returns, refunds });
    });
    return () => { live = false; };
  }, [fetchKey, invoiceKey, date]);

  return useMemo<DailyReportData>(() => {
    const ready = extra.key === fetchKey || !isSupabaseConfigured();
    const lines = ready ? extra.lines : [];
    const payments = ready ? extra.payments : [];
    const returnsRows = ready ? extra.returns : [];
    const refundRows = ready ? extra.refunds : [];

    const gross = day.reduce((s, x) => s + x.total, 0);
    const returns = allSales.filter(s => s.returnDate === date).reduce((s, x) => s + (x.returnedAmount ?? 0), 0);
    const cashReturned = returnsRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const net = gross - returns - cashReturned;
    const prevNet = prev.reduce((s, x) => s + x.total, 0);

    // Payment split across the day's sales.
    const methodTotals: Record<string, number> = {};
    for (const s of day) for (const [k, v] of Object.entries(splitOf(s))) methodTotals[k] = (methodTotals[k] ?? 0) + v;
    const methodSum = Object.values(methodTotals).reduce((a, b) => a + b, 0);
    const payment = Object.entries(methodTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([method, amount]) => ({ method, amount, pct: methodSum ? Math.round((amount / methodSum) * 100) : 0, color: METHOD_COLOR[method] ?? "#94a3b8" }));

    const cashSales = methodTotals.Cash ?? 0;
    const isCash = (m: unknown) => !m || String(m).toLowerCase() === "cash";
    const creditPaymentsCash = payments.filter(p => isCash(p.method)).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const creditPaymentsOther = payments.filter(p => !isCash(p.method)).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const cashReturnsOut = returnsRows.filter(r => isCash(r.method)).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const refundCash = refundRows.filter(r => r.refund_method === "Cash")
      .reduce((s, r) => s + Math.max(0, Number(r.refund_amount ?? 0) - Number(r.refund_credit_amount ?? 0)), 0);
    const cashOut = cashReturnsOut + refundCash;
    const expectedCash = cashSales + creditPaymentsCash - cashOut;

    // By category.
    const cats: TxCategory[] = ["Mobile", "Accessories", "Repair", "Others"];
    const byCategory = cats.map(name => {
      const rows = day.filter(s => s.category === name);
      return { name, revenue: rows.reduce((s, x) => s + x.total, 0), transactions: rows.length };
    }).filter(c => c.transactions > 0);

    // By hour, with yesterday alongside.
    const bucket = (rows: SaleTx[]) => {
      const m = new Map<number, { rev: number; n: number }>();
      for (const s of rows) {
        const h = clampHour(hourOf(s.createdAt));
        if (h == null) continue;
        const b = m.get(h) ?? { rev: 0, n: 0 };
        b.rev += s.total; b.n += 1; m.set(h, b);
      }
      return m;
    };
    const todayH = bucket(day), prevH = bucket(prev);
    const hourly = HOURS.map(h => ({ time: hourLabel(h), revenue: todayH.get(h)?.rev ?? 0, yesterday: prevH.get(h)?.rev ?? 0, txn: todayH.get(h)?.n ?? 0 }));

    // Cash flow by hour: cash in from sales and credit payments, out from
    // returns and cash refunds, and the drawer as it would stand.
    const flowIn = new Map<number, number>(), flowOut = new Map<number, number>();
    const put = (m: Map<number, number>, iso: unknown, v: number) => {
      const h = clampHour(hourOf(iso as string)); if (h == null || v <= 0) return;
      m.set(h, (m.get(h) ?? 0) + v);
    };
    for (const s of day) put(flowIn, s.createdAt, splitOf(s).Cash ?? 0);
    for (const p of payments) if (isCash(p.method)) put(flowIn, p.created_at, Number(p.amount ?? 0));
    for (const r of returnsRows) if (isCash(r.method)) put(flowOut, r.created_at, Number(r.amount ?? 0));
    for (const r of refundRows) if (r.refund_method === "Cash") put(flowOut, r.resolved_at, Math.max(0, Number(r.refund_amount ?? 0) - Number(r.refund_credit_amount ?? 0)));
    const activeHours = HOURS.filter(h => flowIn.has(h) || flowOut.has(h));
    const cashFlow = activeHours.map((h, idx) => {
      const i = flowIn.get(h) ?? 0, o = flowOut.get(h) ?? 0;
      // The drawer as it stands after this hour: every hour so far, in less out.
      const running = activeHours.slice(0, idx + 1)
        .reduce((s, x) => s + (flowIn.get(x) ?? 0) - (flowOut.get(x) ?? 0), 0);
      return { label: hourLabel(h), cashIn: i, cashOut: -o, running };
    });

    // Top items — from the invoice lines; sales recorded before itemised lines
    // fall back to their one-line summary.
    const items = new Map<string, { item: string; category: string; revenue: number; qty: number }>();
    for (const l of lines) {
      const name = String(l.description ?? "Item");
      const it = items.get(name) ?? { item: name, category: KIND_CATEGORY[String(l.kind)] ?? "Others", revenue: 0, qty: 0 };
      it.revenue += Number(l.line_total ?? 0); it.qty += Number(l.qty ?? 1);
      items.set(name, it);
    }
    const lined = new Set(lines.map(l => String(l.invoice_no)));
    for (const s of day) {
      if (lined.has(s.invoiceNo)) continue;
      const name = s.items || s.category;
      const it = items.get(name) ?? { item: name, category: s.category, revenue: 0, qty: 0 };
      it.revenue += s.total; it.qty += 1; items.set(name, it);
    }
    const topItems = [...items.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8)
      .map(i => ({ ...i, item: i.item.length > 28 ? `${i.item.slice(0, 27)}…` : i.item }));

    // Customers: new, returning (bought before this day), or walk-in.
    const keyOf = (s: SaleTx) => (s.customerPhone || "").replace(/\D/g, "").slice(-9) || (s.customer || "").trim().toLowerCase();
    const seenBefore = new Set(allSales.filter(s => s.date < date && s.status !== "Voided").map(keyOf).filter(Boolean));
    const todayKeys = new Map<string, "New" | "Returning">();
    let walkIn = 0;
    for (const s of day) {
      const k = keyOf(s);
      if (!k || k === "walk-in") { walkIn += 1; continue; }
      if (!todayKeys.has(k)) todayKeys.set(k, seenBefore.has(k) ? "Returning" : "New");
    }
    const newCount = [...todayKeys.values()].filter(v => v === "New").length;
    const retCount = todayKeys.size - newCount;
    const custTotal = newCount + retCount + walkIn;
    const customers = [
      { type: "New", count: newCount, color: "#60a5fa" },
      { type: "Returning", count: retCount, color: "#4ade80" },
      { type: "Walk-in", count: walkIn, color: "#94a3b8" },
    ].filter(c => c.count > 0).map(c => ({ ...c, pct: custTotal ? Math.round((c.count / custTotal) * 100) : 0 }));

    // Cash reconciliation, line by line.
    const cashRows: DailyReportData["cashRows"] = [
      { label: "Cash sales", amount: cashSales, type: "in" },
      ...(creditPaymentsCash > 0 ? [{ label: "Credit payments received (cash)", amount: creditPaymentsCash, type: "in" as const }] : []),
      ...returnsRows.filter(r => isCash(r.method)).map(r => ({
        label: `${String(r.kind)} ${r.ref ? `· ${r.ref}` : ""} — ${String(r.reason ?? "").slice(0, 40)}`.trim(),
        amount: -Number(r.amount ?? 0), type: "out" as const,
      })),
      ...refundRows.filter(r => r.refund_method === "Cash").map(r => ({
        label: `Warranty refund · ${String(r.id)}`,
        amount: -Math.max(0, Number(r.refund_amount ?? 0) - Number(r.refund_credit_amount ?? 0)), type: "out" as const,
      })),
      { label: "Expected cash in drawer", amount: expectedCash, type: "neutral" },
    ];

    return {
      loading: !ready,
      gross, returns, cashReturned, net, txCount: day.length,
      avgTicket: day.length ? gross / day.length : 0,
      cashSales, creditPaymentsCash, creditPaymentsOther, cashOut, expectedCash,
      onCredit: methodTotals["On credit"] ?? 0,
      byCategory, payment, hourly, cashFlow, topItems, customers, cashRows,
      yesterdayNet: prevNet,
    };
  }, [day, prev, allSales, date, extra, fetchKey]);
}
