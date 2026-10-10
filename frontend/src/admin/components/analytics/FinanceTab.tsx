"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/analytics/data";
import { pnl, streamRows, profitTrend, cashFlow, cashTrend, creditKpis, creditTrend, advanceKpis } from "@/lib/analytics/finance";
import { revenueTrend } from "@/lib/analytics/overview";
import { StreamTrend, GroupedBars, ShareDonut } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, TONES, type TabProps } from "./Analytics";

/**
 * Sections 18, 19, 36, 37 and 38: the P&L as far as the ledgers can take it,
 * the revenue streams, cash movement, credit and advances.
 */

const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(1)}%`);
const growth = (g: number | null) => (g === null ? "—" : `${g >= 0 ? "+" : "−"}${Math.abs(g * 100).toFixed(0)}%`);

type BreakdownKey = "gross" | "discounts" | "refunds" | "net" | "cogs" | "profit" | "margin";

interface BreakdownSpec {
  title: string;
  total: string;
  color: string;
  /** Pieces that add up to the total — drawn as one split bar plus chips. */
  parts?: { label: string; value: number; color: string }[];
  /** A sum written out line by line, ending in `result`. */
  steps?: { label: string; value: number; plain?: boolean }[];
  result?: string;
  resultText?: string;
  /** Figures that are not money, e.g. margins. */
  chips?: { label: string; text: string; color: string }[];
  note?: string;
}

/** Enough bar segments for the card with the most parts. */
const BAR_SLOTS = 6;

/** The panel under the P&L cards: what the selected card is made of. */
function Breakdown({ b }: { b: BreakdownSpec }) {
  const parts = b.parts ?? [];
  const sum = parts.reduce((t, x) => t + Math.max(0, x.value), 0);
  return (
    <div className="fade-up" style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-card)", border: `1px solid ${b.color}40`, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{b.title}</p>
        <p style={{ fontSize: 13, fontWeight: 800, color: b.color }}>{b.total}</p>
      </div>

      {b.steps && (
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 460, padding: "10px 14px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {b.steps.map((s, i) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 12.5 }}>
              <span style={{ color: "var(--text-secondary)" }}>{i > 0 && !s.plain ? (s.value < 0 ? "− " : "+ ") : ""}{s.label}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: s.value < 0 ? TONES.loss : "var(--text-primary)" }}>
                Rs. {Math.round(Math.abs(s.value)).toLocaleString("en-LK")}
              </span>
            </div>
          ))}
          {b.result && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 7, marginTop: 4, borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>= {b.result}</span>
              <span style={{ fontWeight: 800, color: b.color, fontVariantNumeric: "tabular-nums" }}>{b.resultText ?? b.total}</span>
            </div>
          )}
        </div>
      )}

      {/* The same segments stay mounted from card to card — keyed by position,
          not by label — so switching cards slides each one to its new width
          and colour instead of redrawing the bar. */}
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: "var(--bg-secondary)" }}>
        {Array.from({ length: BAR_SLOTS }, (_, i) => {
          const x = parts[i];
          const w = x && sum > 0 ? (Math.max(0, x.value) / sum) * 100 : 0;
          return (
            <div
              key={i}
              title={x && w > 0 ? `${x.label}: ${rs(x.value)}` : undefined}
              style={{
                width: `${w}%`, background: x?.color ?? "transparent",
                transition: "width 0.55s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.45s ease",
              }}
            />
          );
        })}
      </div>
      {(parts.length > 0 || b.chips) && (
        // Keyed by card so the figures fade in with the new bar.
        <div key={b.title} className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {parts.map(x => (
            <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: `${x.color}12`, border: `1px solid ${x.color}33` }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: x.color }} />
              <div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{x.label}{sum > 0 && x.value > 0 ? ` · ${((x.value / sum) * 100).toFixed(0)}%` : ""}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{rs(x.value)}</div>
              </div>
            </div>
          ))}
          {b.chips?.map(x => (
            <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: `${x.color}12`, border: `1px solid ${x.color}33` }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: x.color }} />
              <div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{x.label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{x.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {b.note && <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{b.note}</p>}
    </div>
  );
}

export default function FinanceTab({ window: w, previous }: TabProps) {
  const d = useAnalytics();
  const [open, setOpen] = useState<BreakdownKey>("cogs");
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
  const costParts = [
    { label: "Phones (buying price)", value: p.cogsDevices, color: TONES.revenue },
    { label: "Accessories (by tag)", value: p.cogsAccessories, color: TONES.credit },
    { label: "Repair parts (by tag)", value: p.cogsParts, color: TONES.stock },
    { label: "Agent repairs", value: p.cogsAgents, color: TONES.cost },
    { label: "Technician charges", value: p.cogsLabour, color: TONES.people },
    { label: `Entered repair costs (${p.estimatedJobs} job${p.estimatedJobs === 1 ? "" : "s"})`, value: p.cogsEstimated, color: TONES.time },
  ];
  const streamParts = [
    { label: "Mobile phones", value: p.byStream.phones.revenue, color: TONES.revenue },
    { label: "Accessories", value: p.byStream.accessories.revenue, color: TONES.credit },
    { label: "Repairs", value: p.byStream.repairs.revenue, color: TONES.stock },
    { label: "Other", value: p.byStream.other.revenue, color: "#94a3b8" },
  ];
  const fullMarginNote = [
    p.unknownPhoneShare ? `${(p.unknownPhoneShare * 100).toFixed(0)}% of phone sales are older sales not linked to a unit, so they have no buying price and count as full margin.` : "",
    p.unknownCostShare ? `${(p.unknownCostShare * 100).toFixed(0)}% of accessory sales had no product cost on record and count as full margin.` : "",
  ].filter(Boolean).join(" ");

  const breakdowns: Record<BreakdownKey, BreakdownSpec> = {
    gross: {
      title: "What gross revenue is made of", total: rs(p.gross), color: TONES.revenue,
      parts: streamParts,
      note: `${p.invoiceCount} invoice${p.invoiceCount === 1 ? "" : "s"}${p.invoiceCount ? `, Rs. ${Math.round(p.gross / p.invoiceCount).toLocaleString("en-LK")} on average` : ""}. Totals as billed — discounts are already taken off, refunds are not.`,
    },
    discounts: {
      title: "Where discounts were given", total: rs(p.discounts), color: TONES.cost,
      parts: [
        { label: "Mobile phones", value: p.discountsBy.Mobile, color: TONES.revenue },
        { label: "Accessories", value: p.discountsBy.Accessories, color: TONES.credit },
        { label: "Repairs", value: p.discountsBy.Repair, color: TONES.stock },
        { label: "Other", value: p.discountsBy.Others, color: "#94a3b8" },
      ],
      note: `Already taken off the invoice totals, so gross revenue is after discounts.${p.gross + p.discounts > 0 ? ` Discounts were ${pct(p.discounts / (p.gross + p.discounts))} of the full price.` : ""}`,
    },
    refunds: {
      title: "What was refunded", total: rs(p.refunds), color: TONES.loss,
      parts: [
        { label: "Returned sales", value: p.refundsOnSales, color: TONES.loss },
        { label: "Cash given back (e.g. repair advances)", value: p.refundsCashReturns, color: TONES.cost },
      ],
      note: p.refundCount ? `${p.refundCount} refund${p.refundCount === 1 ? "" : "s"} in this period.` : "No refunds in this period.",
    },
    net: {
      title: "How net revenue is worked out", total: rs(p.net), color: TONES.revenue,
      steps: [
        { label: "Gross revenue", value: p.gross },
        { label: "Refunds", value: -p.refunds },
      ],
      result: "Net revenue",
      parts: [
        { label: "Kept (net revenue)", value: Math.max(0, p.net), color: TONES.revenue },
        { label: "Refunded", value: p.refunds, color: TONES.loss },
      ],
      note: "What the shop kept from its sales. Discounts are already out of gross revenue.",
    },
    cogs: {
      title: "What the cost of sales is made of", total: rs(p.cogs), color: TONES.cost,
      parts: costParts,
      note: `${p.cogsEstimated > 0 ? `Rs. ${Math.round(p.cogsEstimated).toLocaleString("en-LK")} is repair cost entered by an Admin (Repair Costs page) in place of what was recorded. ` : ""}${fullMarginNote} Shop expenses are not recorded yet, so this is gross profit, not net profit.`.trim(),
    },
    profit: {
      title: "How gross profit is worked out", total: rs(p.grossProfit), color: TONES.profit,
      steps: [
        { label: "Net revenue", value: p.net },
        ...costParts.map(c => ({ label: c.label, value: -c.value })),
      ],
      result: "Gross profit",
      parts: [
        { label: "From phones", value: Math.max(0, p.byStream.phones.profit), color: TONES.revenue },
        { label: "From accessories", value: Math.max(0, p.byStream.accessories.profit), color: TONES.credit },
        { label: "From repairs", value: Math.max(0, p.byStream.repairs.profit), color: TONES.stock },
        { label: "From other", value: Math.max(0, p.byStream.other.profit), color: "#94a3b8" },
      ],
      note: `Before shop expenses.${p.refunds ? " Refunds come off the total, not off any one stream." : ""}`,
    },
    margin: {
      title: "How the gross margin is worked out", total: pct(p.grossMargin), color: TONES.profit,
      steps: [
        { label: "Gross profit", value: p.grossProfit },
        { label: "÷ Net revenue", value: p.net, plain: true },
      ],
      result: "Gross margin", resultText: pct(p.grossMargin),
      parts: [
        { label: "Left as profit", value: Math.max(0, p.grossProfit), color: TONES.profit },
        { label: "Went on cost of sales", value: p.cogs, color: TONES.cost },
      ],
      chips: [
        { label: "Phones", text: pct(p.byStream.phones.margin), color: TONES.revenue },
        { label: "Accessories", text: pct(p.byStream.accessories.margin), color: TONES.credit },
        { label: "Repairs", text: pct(p.byStream.repairs.margin), color: TONES.stock },
      ],
      note: "Out of every Rs. 100 taken, how much is left after what was sold cost. Per-stream margins are before refunds.",
    },
  };
  const dl = (cur: number, prev: number | undefined) => ({ current: cur, previous: prev ?? 0, diff: cur - (prev ?? 0), pct: prev ? (cur - prev) / Math.abs(prev) : null });

  return (
    <>
      {/* ── P&L ─────────────────────────────────────────────────────────── */}
      {/* Click a card to see what it is made of in the panel below it. */}
      <Grid>
        <Stat label="Gross revenue" value={rsK(p.gross)} amount={p.gross} delta={dl(p.gross, pPrev?.gross)} format="money" compareLabel={cmp} onClick={() => setOpen("gross")} active={open === "gross"} />
        <Stat label="Discounts" value={rsK(p.discounts)} amount={p.discounts} delta={dl(p.discounts, pPrev?.discounts)} format="money" invert compareLabel={cmp} onClick={() => setOpen("discounts")} active={open === "discounts"} />
        <Stat label="Refunds" value={rsK(p.refunds)} amount={p.refunds} delta={dl(p.refunds, pPrev?.refunds)} format="money" invert compareLabel={cmp} onClick={() => setOpen("refunds")} active={open === "refunds"} />
        <Stat label="Net revenue" value={rsK(p.net)} amount={p.net} delta={dl(p.net, pPrev?.net)} format="money" compareLabel={cmp} onClick={() => setOpen("net")} active={open === "net"} />
        <Stat label="Cost of sales" value={rsK(p.cogs)} amount={p.cogs} delta={dl(p.cogs, pPrev?.cogs)} format="money" invert compareLabel={cmp} onClick={() => setOpen("cogs")} active={open === "cogs"} />
        <Stat label="Gross profit" value={rsK(p.grossProfit)} amount={p.grossProfit} delta={dl(p.grossProfit, pPrev?.grossProfit)} format="money" compareLabel={cmp} onClick={() => setOpen("profit")} active={open === "profit"} />
        <Stat label="Gross margin" value={pct(p.grossMargin)} sub="of net revenue" onClick={() => setOpen("margin")} active={open === "margin"} />
      </Grid>

      <Breakdown b={breakdowns[open]} />

      <Panel title="Profit by stream" hint="What each kind of sale earned after what it cost. Before refunds.">
        <table style={tableSt}>
          <thead><tr><Th>Stream</Th><Th num>Revenue</Th><Th num>Cost</Th><Th num>Profit</Th><Th num>Margin</Th></tr></thead>
          <tbody>
            {([
              ["Mobile phones", p.byStream.phones, "Buying price of each unit sold", TONES.revenue],
              ["Accessories", p.byStream.accessories, "Buying price of each tag sold", TONES.credit],
              ["Repairs", p.byStream.repairs, p.cogsEstimated > 0 ? "Parts + agent + technician, with estimates for older jobs" : "Parts + agent + technician charges", TONES.stock],
              ["Other", p.byStream.other, "No cost recorded", "#94a3b8"],
            ] as const).filter(([, s]) => s.revenue > 0 || s.cost > 0).map(([label, s, how, color]) => (
              <tr key={label}>
                <Td strong>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />{label}
                  </span>
                  <div style={{ fontSize: 10.5, fontWeight: 400, color: "var(--text-muted)", paddingLeft: 18 }}>{how}</div>
                </Td>
                <Td num tone={TONES.revenue}>{rs(s.revenue)}</Td>
                <Td num tone={TONES.cost}>{rs(s.cost)}</Td>
                <Td num strong tone={s.profit >= 0 ? TONES.profit : TONES.loss}>{rs(s.profit)}</Td>
                <Td num>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                    <span style={{ width: 70, height: 6, borderRadius: 4, background: "var(--bg-secondary)", overflow: "hidden", display: "inline-block" }}>
                      <span style={{ display: "block", height: "100%", width: `${Math.max(0, Math.min(1, s.margin ?? 0)) * 100}%`, background: (s.margin ?? 0) >= 0.3 ? TONES.profit : (s.margin ?? 0) >= 0.1 ? TONES.time : TONES.loss }} />
                    </span>
                    <span style={{ fontWeight: 700, color: (s.margin ?? 0) >= 0.3 ? TONES.profit : (s.margin ?? 0) >= 0.1 ? TONES.time : TONES.loss }}>{pct(s.margin)}</span>
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

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
        <Stat label="Cash received" value={rsK(cash.cashIn)} amount={cash.cashIn} sub="cash at the counter" />
        <Stat label="Card payments" value={rsK(cash.cardIn)} amount={cash.cardIn} sub="" />
        <Stat label="Bank / cheque" value={rsK(cash.bankIn)} amount={cash.bankIn} sub="" />
        <Stat label="Credit collections" value={rsK(cash.creditCollections)} amount={cash.creditCollections} sub="paid on account" />
        <Stat label="Advances taken" value={rsK(cash.advances)} amount={cash.advances} sub="at repair intake" />
        <Stat label="Refunds paid out" value={rsK(cash.refundsOut)} amount={cash.refundsOut} sub="" />
        <Stat label="Net cash movement" value={rsK(cash.netMovement)} amount={cash.netMovement} sub={`in minus out · ${w.label.toLowerCase()}`} />
        <Stat label="Receivables" value={rsK(cash.receivables)} amount={cash.receivables} sub="owed by customers today" />
        <Stat label="Payables" value={rsK(cash.payables)} amount={cash.payables} sub="owed to suppliers today" />
        <Stat label="Expected incoming" value={rsK(cash.expectedIn)} amount={cash.expectedIn} sub="receivables + ready repairs" />
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
        <Stat label="Credit issued" value={rsK(credit.issued.current)} amount={credit.issued.current} delta={credit.issued} format="money" invert compareLabel={cmp} />
        <Stat label="Credit collected" value={rsK(credit.collected.current)} amount={credit.collected.current} delta={credit.collected} format="money" compareLabel={cmp} />
        <Stat label="Written off" value={rsK(credit.writtenOff.current)} amount={credit.writtenOff.current} delta={credit.writtenOff} format="money" invert compareLabel={cmp} />
        <Stat label="Collection rate" value={pct(credit.collectionRate)} sub="collected ÷ issued, in the window" />
        <Stat label="Outstanding" value={rsK(credit.outstanding)} amount={credit.outstanding} sub={`${credit.customers} account${credit.customers === 1 ? "" : "s"} owing`} />
        <Stat label="Overdue" value={rsK(credit.overdue)} amount={credit.overdue} sub={`${credit.overdueAccounts} past terms`} />
        <Stat label="Average charge" value={credit.avgCharge === null ? "—" : rsK(credit.avgCharge)} amount={credit.avgCharge ?? undefined} sub="per charge raised" />
        <Stat label="Average payment" value={credit.avgPayment === null ? "—" : rsK(credit.avgPayment)} amount={credit.avgPayment ?? undefined} sub="per payment taken" />
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
        <Stat label="Advances taken" value={rsK(adv.total)} amount={adv.total} sub={`${adv.count} jobs · ${w.label.toLowerCase()}`} />
        <Stat label="Average advance" value={adv.avg === null ? "—" : rsK(adv.avg)} amount={adv.avg ?? undefined} sub={adv.shareOfFinal === null ? "" : `${pct(adv.shareOfFinal)} of the final price`} />
        <Stat label="Jobs without advance" value={String(adv.without)} sub="taken in with nothing down" />
        <Stat label="Uncollected balances" value={rsK(adv.outstandingOnReady)} amount={adv.outstandingOnReady} sub="on finished repairs not yet collected" />
        <Stat label="Advances refunded" value={String(adv.advanceRefunds)} sub={rs(adv.advanceRefundAmount)} />
      </Grid>
    </>
  );
}
