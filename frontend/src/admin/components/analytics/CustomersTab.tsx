"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/analytics/data";
import { customerBook, customerKpis, customerTrend, type CustomerRecord } from "@/lib/analytics/sales";
import { salesByHour } from "@/lib/analytics/sales";
import { Seg } from "@/cashier/components/dashboard/charts/viz";
import { ShareDonut, GroupedBars } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, type TabProps } from "./Analytics";
import { daysSince } from "@/lib/analytics/window";

/**
 * Sections 16 and 17 of the brief: who the customers are, how often they
 * come back, what they spend, and how repair customers and shop customers
 * overlap. A customer is a phone number — see customerBook.
 */

const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(0)}%`);

export default function CustomersTab({ window: w, previous }: TabProps) {
  const d = useAnalytics();
  const cmp = previous?.label ?? null;
  const [list, setList] = useState<"top" | "frequent" | "credit" | "repeat" | "inactive">("top");

  const v = useMemo(() => {
    const book = customerBook(d);
    const all = Array.from(book.values());
    return {
      book, all,
      k: customerKpis(d, book, w, previous),
      trend: customerTrend(book, w),
      hours: salesByHour(d.sales, w),
      top: [...all].sort((a, b) => b.revenue - a.revenue).slice(0, 15),
      frequent: [...all].sort((a, b) => b.visits - a.visits).slice(0, 15),
      credit: all.filter(c => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 15),
      repeat: all.filter(c => c.repairs > 1).sort((a, b) => b.repairs - a.repairs).slice(0, 15),
      inactive: all.filter(c => (daysSince(c.lastSeen) ?? 0) > 90 && c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 15),
    };
  }, [d, w, previous]);
  const { k } = v;
  const rows = v[list];

  return (
    <>
      <Grid>
        <Stat label="Customers, all time" value={String(k.total)} sub="distinct phone numbers" />
        <Stat label="Served" value={String(k.activeIn.current)} delta={k.activeIn} compareLabel={cmp} />
        <Stat label="New" value={String(k.newIn.current)} delta={k.newIn} compareLabel={cmp} />
        <Stat label="Returning" value={String(k.returningIn.current)} delta={k.returningIn} compareLabel={cmp} />
        <Stat label="Today" value={String(k.today)} sub="customers seen today" />
        <Stat label="Inactive 90+ days" value={String(k.inactive90)} sub="not seen in three months" />
      </Grid>
      <Grid>
        <Stat label="Retention" value={pct(k.retention)} sub={previous ? `of ${previous.label}'s customers came back` : "needs a comparison period"} />
        <Stat label="Repeat customer rate" value={pct(k.repeatRate)} sub="visited more than once, all time" />
        <Stat label="Avg spend per customer" value={k.avgSpend === null ? "—" : rsK(k.avgSpend)} sub="lifetime, customers who spent" />
        <Stat label="Avg visits" value={k.avgVisits === null ? "—" : k.avgVisits.toFixed(1)} sub="per customer, all time" />
        <Stat label="Avg days between visits" value={k.avgDaysBetween === null ? "—" : k.avgDaysBetween.toFixed(0)} sub="for customers who returned" />
        <Stat label="With outstanding credit" value={String(k.withCredit)} sub="customers owing money" />
      </Grid>

      <div className="fade-up resp-grid-2">
        <GroupedBars title="New vs Returning" subtitle={`Customers seen per period · ${w.label.toLowerCase()}`} data={v.trend}
          series={[{ key: "newCustomers", label: "New", color: "var(--viz-1)" }, { key: "returning", label: "Returning", color: "var(--viz-3)" }]} />
        <ShareDonut title="Customer Mix" subtitle="What each customer has come for, all time" money={false}
          slices={[
            { key: "repair", label: "Repairs only", value: k.repairOnly, color: "var(--viz-repair)" },
            { key: "sales", label: "Shop purchases only", value: k.salesOnly, color: "var(--viz-accessories)" },
            { key: "both", label: "Both", value: k.both, color: "var(--viz-3)" },
          ]} />
      </div>
      <div className="fade-up resp-grid-2">
        <GroupedBars title="Visits by Hour" subtitle={`When customers come to the counter · ${w.label.toLowerCase()}`} data={v.hours} series={[{ key: "count", label: "Transactions", color: "var(--viz-1)" }]} />
        <Panel title="Behaviour" hint="How repair customers and shop customers overlap.">
          <table style={tableSt}>
            <tbody>
              {[
                ["Repair-only customers", String(k.repairOnly)],
                ["Shop-only customers", String(k.salesOnly)],
                ["Repair + shop customers", String(k.both)],
                ["Cross-over rate", pct(k.total ? k.both / k.total : null)],
                [`Bought accessories within 30 days of a repair (${w.label.toLowerCase()})`, String(k.accessoriesAfterRepair)],
                ["Customers with repeat repair visits", String(k.repeatRepairers)],
              ].map(([l, val]) => <tr key={l}><Td>{l}</Td><Td num strong>{val}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Customers" hint="All time. Revenue counts delivered repairs and shop purchases; a repair invoice is not counted twice."
        right={<Seg value={list} onChange={setList} options={[{ id: "top", label: "Top spenders" }, { id: "frequent", label: "Most visits" }, { id: "credit", label: "Owing" }, { id: "repeat", label: "Repeat repairs" }, { id: "inactive", label: "Inactive" }]} />}>
        <table style={tableSt}>
          <thead><tr><Th>Customer</Th><Th>Phone</Th><Th num>Visits</Th><Th num>Repairs</Th><Th num>Purchases</Th><Th num>Revenue</Th><Th num>Repair revenue</Th><Th num>Accessories</Th><Th num>Owing</Th><Th>First seen</Th><Th>Last seen</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <Empty cols={11} text="Nobody in this list." />}
            {rows.map(c => <CustomerTr key={c.key} c={c} />)}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function CustomerTr({ c }: { c: CustomerRecord }) {
  const stale = (daysSince(c.lastSeen) ?? 0) > 90;
  return (
    <tr>
      <Td strong>{c.name || "—"}</Td>
      <Td><span style={{ fontFamily: "monospace" }}>{c.phone || "—"}</span></Td>
      <Td num strong>{c.visits}</Td>
      <Td num>{c.repairs || "—"}</Td>
      <Td num>{c.sales || "—"}</Td>
      <Td num strong>{c.revenue ? rs(c.revenue) : "—"}</Td>
      <Td num>{c.repairRevenue ? rs(c.repairRevenue) : "—"}</Td>
      <Td num>{c.accessoryRevenue ? rs(c.accessoryRevenue) : "—"}</Td>
      <Td num tone={c.outstanding > 0 ? "#f87171" : undefined}>{c.outstanding > 0 ? rs(c.outstanding) : "—"}</Td>
      <Td>{c.firstSeen}</Td>
      <Td tone={stale ? "var(--text-muted)" : undefined}>{c.lastSeen}</Td>
    </tr>
  );
}
