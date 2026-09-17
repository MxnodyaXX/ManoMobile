"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/analytics/data";
import { revenueTrend, salesByCashier, streams, STREAMS } from "@/lib/analytics/overview";
import { salesKpis, salesByHour, salesByWeekday, salesByCustomer } from "@/lib/analytics/sales";
import { Seg } from "@/cashier/components/dashboard/charts/viz";
import { StreamTrend, ShareDonut, Ranked, GroupedBars } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, type TabProps } from "./Analytics";

/** Sections 2 and 30 of the brief: the sales ledger, every way it can be cut. */

const STREAM_COLOR: Record<string, string> = { Repair: "var(--viz-repair)", Accessories: "var(--viz-accessories)", Mobile: "var(--viz-mobile)", Others: "var(--viz-others)" };
const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(1)}%`);

export default function SalesTab({ window: w, previous }: TabProps) {
  const d = useAnalytics();
  const cmp = previous?.label ?? null;
  const [clock, setClock] = useState<"hour" | "weekday">("hour");
  const [clockMeasure, setClockMeasure] = useState<"value" | "count">("value");

  const v = useMemo(() => {
    const s = streams(d.sales, w);
    return {
      k: salesKpis(d, w, previous),
      trend: revenueTrend(d.sales, w),
      shares: STREAMS.map(st => ({ key: st.key, label: st.label, value: s[st.key], color: STREAM_COLOR[st.key] })),
      cashiers: salesByCashier(d.sales, w),
      customers: salesByCustomer(d.sales, w),
      hours: salesByHour(d.sales, w),
      weekdays: salesByWeekday(d.sales, w),
    };
  }, [d, w, previous]);
  const { k } = v;
  const clockData = clock === "hour" ? v.hours : v.weekdays;
  const peak = clockData.reduce((b, x) => (x.value > b.value ? x : b), clockData[0]);
  const quiet = clockData.filter(x => x.count > 0).reduce((b, x) => (x.value < b.value ? x : b), clockData.find(x => x.count > 0) ?? clockData[0]);
  const payTotal = k.cash + k.card + k.bank + k.credit + k.other;

  return (
    <>
      <Grid>
        <Stat label="Transactions" value={String(k.transactions.current)} delta={k.transactions} compareLabel={cmp} />
        <Stat label="Sales value" value={rsK(k.value.current)} delta={k.value} format="money" compareLabel={cmp} />
        <Stat label="Average transaction" value={rsK(k.avg.current)} delta={k.avg} format="money" compareLabel={cmp} />
        <Stat label="Items per invoice" value={k.itemsPerInvoice === null ? "—" : k.itemsPerInvoice.toFixed(1)} sub="where lines were recorded" />
        <Stat label="Highest invoice" value={k.highest ? rsK(k.highest.total) : "—"} sub={k.highest?.invoiceNo ?? ""} />
        <Stat label="Lowest invoice" value={k.lowest ? rsK(k.lowest.total) : "—"} sub={k.lowest?.invoiceNo ?? ""} />
      </Grid>
      <Grid>
        <Stat label="Discounts given" value={rsK(k.discounts.current)} delta={k.discounts} format="money" invert compareLabel={cmp} />
        <Stat label="Avg discount per sale" value={k.avgDiscount === null ? "—" : rs(k.avgDiscount)} sub={`${pct(k.discountPct)} of gross`} />
        <Stat label="With / without discount" value={`${k.withDiscount} / ${k.withoutDiscount}`} sub="invoices" />
        <Stat label="Voided" value={String(k.voided.current)} delta={k.voided} invert compareLabel={cmp} />
        <Stat label="Refunded" value={String(k.refunded.current)} delta={k.refunded} invert compareLabel={cmp} />
        <Stat label="Left on credit" value={rsK(k.credit)} sub={`${k.creditInvoices} invoice${k.creditInvoices === 1 ? "" : "s"} part-paid`} />
      </Grid>

      <div className="fade-up resp-grid-2">
        <StreamTrend title="Sales Trend" data={v.trend} subtitle={`By category · ${w.label.toLowerCase()}`} />
        <ShareDonut title="Payment Methods" subtitle={`How the money arrived · ${w.label.toLowerCase()}`}
          slices={[
            { key: "cash", label: "Cash", value: k.cash, color: "var(--viz-1)" },
            { key: "card", label: "Card", value: k.card, color: "var(--viz-4)" },
            { key: "credit", label: "On credit", value: k.credit, color: "var(--viz-5)" },
            { key: "other", label: "Bank / other", value: k.bank + k.other, color: "var(--viz-3)" },
          ]} />
      </div>
      <div className="fade-up resp-grid-2">
        <ShareDonut title="Sales by Category" subtitle={`Share of value · ${w.label.toLowerCase()}`} slices={v.shares} />
        <GroupedBars
          title={clock === "hour" ? "Sales by Hour" : "Sales by Weekday"}
          subtitle={`${w.label.toLowerCase()}${peak && peak.count ? ` · peak ${peak.name}` : ""}${quiet && quiet.count && quiet !== peak ? ` · quietest ${quiet.name}` : ""}`}
          data={clockData}
          series={[clockMeasure === "value" ? { key: "value", label: "Sales value", color: "var(--viz-1)" } : { key: "count", label: "Transactions", color: "var(--viz-1)" }]}
          money={clockMeasure === "value"}
          controls={<div style={{ display: "flex", gap: 6 }}><Seg value={clockMeasure} onChange={setClockMeasure} options={[{ id: "value", label: "Value" }, { id: "count", label: "Count" }]} /><Seg value={clock} onChange={setClock} options={[{ id: "hour", label: "Hour" }, { id: "weekday", label: "Weekday" }]} /></div>}
        />
      </div>
      <div className="fade-up resp-grid-2">
        <Ranked title="Sales by Cashier" subtitle={`Value rung up · ${w.label.toLowerCase()}`} data={v.cashiers} color="var(--viz-1)" />
        <GroupedBars title="Invoice Value Distribution" subtitle={`How many invoices fall in each band · ${w.label.toLowerCase()}`} data={k.distribution} series={[{ key: "value", label: "Invoices", color: "var(--viz-1)" }]} />
      </div>

      <div className="fade-up resp-grid-2">
        <Panel title="Invoices" hint="What kind of bills were written.">
          <table style={tableSt}>
            <tbody>
              {[
                ["Total invoices", String(k.transactions.current)],
                ["Repair invoices", String(k.repairInvoices)],
                ["Product invoices (accessories, phones, other)", String(k.productInvoices)],
                ["Combined repair + accessory invoices", String(k.combined)],
                ["Repair invoices that also sold a product", pct(k.attachmentRate)],
                ["Invoices with a balance on credit", String(k.creditInvoices)],
                ["Voided", String(k.voided.current)],
                ["Refunded", String(k.refunded.current)],
              ].map(([l, val]) => <tr key={l}><Td>{l}</Td><Td num strong>{val}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
        <Panel title="Top customers" hint={`By value bought · ${w.label.toLowerCase()}. Walk-ins without a name are not listed.`}>
          <table style={tableSt}>
            <thead><tr><Th>Customer</Th><Th num>Invoices</Th><Th num>Value</Th><Th num>Share</Th></tr></thead>
            <tbody>
              {v.customers.length === 0 && <Empty cols={4} text="No named customers in this window." />}
              {v.customers.map(c => (
                <tr key={c.name}><Td strong>{c.name}</Td><Td num>{c.sub?.split(" ")[0]}</Td><Td num strong>{rs(c.value)}</Td><Td num>{k.value.current ? `${((c.value / k.value.current) * 100).toFixed(1)}%` : "—"}</Td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Payment split" hint="Where the money came from, as amounts.">
        <table style={tableSt}>
          <thead><tr><Th>Method</Th><Th num>Amount</Th><Th num>Share</Th></tr></thead>
          <tbody>
            {[["Cash", k.cash], ["Card", k.card], ["Bank transfer", k.bank], ["Left on credit", k.credit], ["Other (cheque)", k.other]].map(([l, val]) => (
              <tr key={l as string}><Td strong>{l as string}</Td><Td num>{rs(val as number)}</Td><Td num>{payTotal ? `${(((val as number) / payTotal) * 100).toFixed(0)}%` : "—"}</Td></tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
