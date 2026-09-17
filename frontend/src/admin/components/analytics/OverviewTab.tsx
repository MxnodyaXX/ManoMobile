"use client";

import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { useAnalytics } from "@/lib/analytics/data";
import {
  overviewKpis, alerts, insights, revenueTrend, repairFlow, topProducts, salesByCashier, workloadNow, streams, STREAMS,
} from "@/lib/analytics/overview";
import { StreamTrend, FlowBars, ShareDonut, Ranked } from "./charts";
import { TechnicianWorkload } from "@/admin/components/staff/insightCharts";
import { Stat, Grid, rs, rsK, ff, type TabProps } from "./Analytics";

/**
 * The owner's first screen: the figures from section 45 of the brief, the
 * alert counters, the sentences the numbers add up to, and the six charts
 * that show the shape of the window.
 */

const STREAM_COLOR: Record<string, string> = {
  Repair: "var(--viz-repair)", Accessories: "var(--viz-accessories)", Mobile: "var(--viz-mobile)", Others: "var(--viz-others)",
};
const TONE = { red: "#f87171", amber: "#fbbf24", blue: "#60a5fa" } as const;

export default function OverviewTab({ window: w, previous }: TabProps) {
  const d = useAnalytics();
  const cmp = previous?.label ?? null;

  const v = useMemo(() => {
    const k = overviewKpis(d, w, previous);
    const al = alerts(d, w);
    const s = streams(d.sales, w);
    return {
      k, al,
      notes: insights(d, w, previous, k, al),
      trend: revenueTrend(d.sales, w),
      flow: repairFlow(d.jobs, w),
      shares: STREAMS.map(st => ({ key: st.key, label: st.label, value: s[st.key], color: STREAM_COLOR[st.key] })),
      products: topProducts(d, w, 8),
      cashiers: salesByCashier(d.sales, w),
      workload: workloadNow(d.jobs),
    };
  }, [d, w, previous]);
  const { k } = v;
  const dayStr = (n: number) => (n === 0 ? "—" : n < 0.05 ? "< 0.1 d" : `${n.toFixed(1)} d`);
  const firing = v.al.filter(a => a.count > 0);

  return (
    <>
      {/* ── Money ───────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Total revenue" value={rsK(k.revenue.current)} delta={k.revenue} format="money" compareLabel={cmp} />
        <Stat label="Net revenue" value={rsK(k.netRevenue.current)} delta={k.netRevenue} format="money" compareLabel={cmp} />
        <Stat label="Gross profit (est.)" value={rsK(k.grossProfit.current)} delta={k.grossProfit} format="money" compareLabel={cmp} />
        <Stat label="Repair revenue" value={rsK(k.repairRevenue.current)} delta={k.repairRevenue} format="money" compareLabel={cmp} />
        <Stat label="Accessory revenue" value={rsK(k.accessoryRevenue.current)} delta={k.accessoryRevenue} format="money" compareLabel={cmp} />
        <Stat label="Avg invoice" value={rsK(k.avgInvoice.current)} delta={k.avgInvoice} format="money" compareLabel={cmp} />
      </Grid>

      {/* ── Work ────────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Repairs received" value={String(k.repairsReceived.current)} delta={k.repairsReceived} compareLabel={cmp} />
        <Stat label="Repairs completed" value={String(k.repairsCompleted.current)} delta={k.repairsCompleted} compareLabel={cmp} />
        <Stat label="Avg turnaround" value={dayStr(k.avgTurnaround.current)} delta={k.avgTurnaround} format="days" invert compareLabel={cmp} />
        <Stat label="Open repairs" value={String(k.openJobs)} sub={`${k.waitingForParts} waiting for parts`} />
        <Stat label="Ready for collection" value={String(k.readyForCollection)} sub={`${rs(k.readyValue)} to collect`} />
        <Stat label="Customers served" value={String(k.customersServed.current)} delta={k.customersServed} compareLabel={cmp} />
      </Grid>

      {/* ── Balances ────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Credit collected" value={rsK(k.creditCollected.current)} delta={k.creditCollected} format="money" compareLabel={cmp} />
        <Stat label="Refunds" value={rsK(k.refunds.current)} delta={k.refunds} format="money" invert compareLabel={cmp} />
        <Stat label="Outstanding customer credit" value={rsK(k.outstandingCredit)} sub="on account today" />
        <Stat label="Supplier payments due" value={rsK(k.supplierPayables)} sub="owed to suppliers" />
        <Stat label="Inventory value" value={rsK(k.inventoryCost)} sub={`${rsK(k.inventoryRetail)} at retail`} />
        <Stat label="Returning customers" value={k.returningRate === null ? "—" : `${(k.returningRate * 100).toFixed(0)}%`} sub="seen before this window" />
      </Grid>

      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Needs attention</h3>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{firing.length ? `${firing.length} of ${v.al.length} checks firing` : "Nothing firing — all clear"}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {v.al.map(a => {
            const on = a.count > 0;
            const c = TONE[a.tone];
            return (
              <div key={a.id} title={a.hint} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 9, border: `1px solid ${on ? c + "55" : "var(--border)"}`, background: on ? c + "12" : "transparent", opacity: on ? 1 : 0.55 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? c : "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: on ? c : "var(--text-muted)", fontVariantNumeric: "tabular-nums", minWidth: 18, textAlign: "right" }}>{a.count}</span>
                <span style={{ fontSize: 12, color: on ? "var(--text-primary)" : "var(--text-muted)", fontWeight: on ? 600 : 500 }}>{a.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sentences ───────────────────────────────────────────────────── */}
      {v.notes.length > 0 && (
        <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Lightbulb size={14} color="#fbbf24" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>What the numbers say</h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {v.notes.map((n, i) => <li key={i} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: ff }}>{n}</li>)}
          </ul>
        </div>
      )}

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <div className="fade-up resp-grid-2">
        <StreamTrend data={v.trend} subtitle={`By stream · ${w.label.toLowerCase()}`} />
        <FlowBars data={v.flow} subtitle={`Taken in vs finished · ${w.label.toLowerCase()}`} />
      </div>
      <div className="fade-up resp-grid-2">
        <ShareDonut title="Revenue Breakdown" subtitle={`Share by stream · ${w.label.toLowerCase()}`} slices={v.shares} />
        <Ranked title="Top-selling Products" subtitle={`Accessory lines by value · ${w.label.toLowerCase()}`} data={v.products} color="var(--viz-accessories)" />
      </div>
      <div className="fade-up resp-grid-2">
        <Ranked title="Cashier Activity" subtitle={`Sales rung up · ${w.label.toLowerCase()}`} data={v.cashiers} color="var(--viz-1)" />
        <TechnicianWorkload data={v.workload} />
      </div>
    </>
  );
}
