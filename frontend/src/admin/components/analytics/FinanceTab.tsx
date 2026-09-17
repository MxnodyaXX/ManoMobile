"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/lib/analytics/data";
import { pnl, streamRows, profitTrend, cashFlow, cashTrend, creditKpis, creditTrend, advanceKpis } from "@/lib/analytics/finance";
import { revenueTrend } from "@/lib/analytics/overview";
import { StreamTrend, GroupedBars, ShareDonut } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, type TabProps } from "./Analytics";

/**
 * Sections 18, 19, 36, 37 and 38: the P&L as far as the ledgers can take it,
 * the revenue streams, cash movement, credit and advances.
 */

const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(1)}%`);
const growth = (g: number | null) => (g === null ? "—" : `${g >= 0 ? "+" : "−"}${Math.abs(g * 100).toFixed(0)}%`);

export default function FinanceTab({ window: w, previous }: TabProps) {
  const d = useAnalytics();
  const cmp = previous?.label ?? null;
  const v = useMemo(() => ({
    p: pnl(d, w), pPrev: previous ? pnl(d, previous) : null,
    streams: streamRows(d, w, previous),
    revTrend: revenueTrend(d.sales, w),
    profit: profitTrend(d, w),
    cash: cashFlow(d, w),
    cashT: cashTrend(d, w),
    credit: creditKpis(d, w, previous),
    creditT: creditTrend(d, w),
    adv: advanceKpis(d, w),
  }), [d, w, previous]);
  const { p, pPrev, cash, credit, adv } = v;
  const dl = (cur: number, prev: number | undefined) => ({ current: cur, previous: prev ?? 0, diff: cur - (prev ?? 0), pct: prev ? (cur - prev) / Math.abs(prev) : null });

  return (
    <>
      {/* ── P&L ─────────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Gross revenue" value={rsK(p.gross)} delta={dl(p.gross, pPrev?.gross)} format="money" compareLabel={cmp} />
        <Stat label="Discounts" value={rsK(p.discounts)} delta={dl(p.discounts, pPrev?.discounts)} format="money" invert compareLabel={cmp} />
        <Stat label="Refunds" value={rsK(p.refunds)} delta={dl(p.refunds, pPrev?.refunds)} format="money" invert compareLabel={cmp} />
        <Stat label="Net revenue" value={rsK(p.net)} delta={dl(p.net, pPrev?.net)} format="money" compareLabel={cmp} />
        <Stat label="Cost of goods (est.)" value={rsK(p.cogs)} delta={dl(p.cogs, pPrev?.cogs)} format="money" invert compareLabel={cmp} />
        <Stat label="Gross profit (est.)" value={rsK(p.grossProfit)} delta={dl(p.grossProfit, pPrev?.grossProfit)} format="money" compareLabel={cmp} />
        <Stat label="Gross margin" value={pct(p.grossMargin)} sub="of net revenue" />
      </Grid>

      <div className="fade-up" style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-card)", border: "1px dashed var(--border)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>
        Cost of goods is accessory buying prices on sold lines ({rs(p.cogsAccessories)}), parts on finished repairs ({rs(p.cogsParts)}) and repair-agent fees ({rs(p.cogsAgents)}).
        {p.unknownCostShare ? ` ${(p.unknownCostShare * 100).toFixed(0)}% of accessory sales had no product cost on record and count as full margin.` : ""}
        {" "}Phones and other sales carry no cost. Expenses and payments to suppliers are not recorded by the system, so net profit is not shown.
      </div>

      <div className="fade-up resp-grid-2">
        <StreamTrend data={v.revTrend} subtitle={`By stream · ${w.label.toLowerCase()}`} />
        <GroupedBars title="Profit Trend" subtitle={`Net revenue, cost and gross profit · ${w.label.toLowerCase()}`} data={v.profit} money
          series={[{ key: "revenue", label: "Net revenue", color: "var(--viz-1)" }, { key: "cost", label: "Cost of goods", color: "var(--viz-2)" }, { key: "profit", label: "Gross profit", color: "var(--viz-3)" }]} />
      </div>

      <Panel title="Revenue streams" hint="Where the money came from, its share, and how each stream moved.">
        <table style={tableSt}>
          <thead><tr><Th>Stream</Th><Th num>Revenue</Th><Th num>Share</Th><Th num>{previous ? previous.label : "Previous"}</Th><Th num>Growth</Th></tr></thead>
          <tbody>
            {v.streams.map(s => (
              <tr key={s.key}>
                <Td strong>{s.label}</Td>
                <Td num strong>{rs(s.revenue)}</Td>
                <Td num>{s.key === "credit" ? "—" : pct(s.share)}</Td>
                <Td num>{previous ? rs(s.previous) : "—"}</Td>
                <Td num tone={s.growth === null ? undefined : s.growth >= 0 ? "#34d399" : "#f87171"}>{growth(s.growth)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* ── Cash flow ───────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Cash received" value={rsK(cash.cashIn)} sub="cash at the counter" />
        <Stat label="Card payments" value={rsK(cash.cardIn)} sub="" />
        <Stat label="Bank / cheque" value={rsK(cash.bankIn)} sub="" />
        <Stat label="Credit collections" value={rsK(cash.creditCollections)} sub="paid on account" />
        <Stat label="Advances taken" value={rsK(cash.advances)} sub="at repair intake" />
        <Stat label="Refunds paid out" value={rsK(cash.refundsOut)} sub="" />
        <Stat label="Net cash movement" value={rsK(cash.netMovement)} sub={`in minus out · ${w.label.toLowerCase()}`} />
        <Stat label="Receivables" value={rsK(cash.receivables)} sub="owed by customers today" />
        <Stat label="Payables" value={rsK(cash.payables)} sub="owed to suppliers today" />
        <Stat label="Expected incoming" value={rsK(cash.expectedIn)} sub="receivables + ready repairs" />
      </Grid>
      <div className="fade-up resp-grid-2">
        <GroupedBars title="Cash Movement" subtitle={`Received against refunded · ${w.label.toLowerCase()}`} data={v.cashT} money
          series={[{ key: "received", label: "Received", color: "var(--viz-1)" }, { key: "refunded", label: "Refunded", color: "var(--viz-2)" }]} />
        <ShareDonut title="How Money Arrived" subtitle={`Inflow by channel · ${w.label.toLowerCase()}`}
          slices={[
            { key: "cash", label: "Cash", value: cash.cashIn, color: "var(--viz-1)" },
            { key: "card", label: "Card", value: cash.cardIn, color: "var(--viz-4)" },
            { key: "bank", label: "Bank / cheque", value: cash.bankIn, color: "var(--viz-3)" },
            { key: "credit", label: "Credit collections", value: cash.creditCollections, color: "var(--viz-5)" },
          ]} />
      </div>

      {/* ── Credit ──────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Credit issued" value={rsK(credit.issued.current)} delta={credit.issued} format="money" invert compareLabel={cmp} />
        <Stat label="Credit collected" value={rsK(credit.collected.current)} delta={credit.collected} format="money" compareLabel={cmp} />
        <Stat label="Written off" value={rsK(credit.writtenOff.current)} delta={credit.writtenOff} format="money" invert compareLabel={cmp} />
        <Stat label="Collection rate" value={pct(credit.collectionRate)} sub="collected ÷ issued, in the window" />
        <Stat label="Outstanding" value={rsK(credit.outstanding)} sub={`${credit.customers} account${credit.customers === 1 ? "" : "s"} owing`} />
        <Stat label="Overdue" value={rsK(credit.overdue)} sub={`${credit.overdueAccounts} past terms`} />
        <Stat label="Average charge" value={credit.avgCharge === null ? "—" : rsK(credit.avgCharge)} sub="per charge raised" />
        <Stat label="Average payment" value={credit.avgPayment === null ? "—" : rsK(credit.avgPayment)} sub="per payment taken" />
        <Stat label="Oldest debt" value={credit.oldest ? `${credit.oldest.days.toFixed(0)} d` : "—"} sub={credit.oldest ? `${credit.oldest.name} · ${rs(credit.oldest.balance)}` : "nothing owed"} />
      </Grid>
      <div className="fade-up resp-grid-2">
        <GroupedBars title="Credit Issued vs Collected" subtitle={`Charges against payments · ${w.label.toLowerCase()}`} data={v.creditT} money
          series={[{ key: "issued", label: "Issued", color: "var(--viz-2)" }, { key: "collected", label: "Collected", color: "var(--viz-3)" }]} />
        <Panel title="Credit aging" hint="Outstanding balances by how long the oldest unpaid charge has stood.">
          <table style={tableSt}>
            <thead><tr><Th>Age</Th><Th num>Accounts</Th><Th num>Outstanding</Th><Th num>Share</Th></tr></thead>
            <tbody>
              {credit.aging.every(a => a.value === 0) && <Empty cols={4} text="Nothing outstanding." />}
              {credit.aging.map(a => <tr key={a.name}><Td strong>{a.name}</Td><Td num>{a.accounts || "—"}</Td><Td num strong tone={a.name === "90+ days" && a.value > 0 ? "#f87171" : undefined}>{a.value ? rs(a.value) : "—"}</Td><Td num>{credit.outstanding ? pct(a.value / credit.outstanding) : "—"}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* ── Advances ────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Advances taken" value={rsK(adv.total)} sub={`${adv.count} jobs · ${w.label.toLowerCase()}`} />
        <Stat label="Average advance" value={adv.avg === null ? "—" : rsK(adv.avg)} sub={adv.shareOfFinal === null ? "" : `${pct(adv.shareOfFinal)} of the final price`} />
        <Stat label="Jobs without advance" value={String(adv.without)} sub="taken in with nothing down" />
        <Stat label="Uncollected balances" value={rsK(adv.outstandingOnReady)} sub="on finished repairs not yet collected" />
        <Stat label="Advances refunded" value={String(adv.advanceRefunds)} sub={rs(adv.advanceRefundAmount)} />
      </Grid>
    </>
  );
}
