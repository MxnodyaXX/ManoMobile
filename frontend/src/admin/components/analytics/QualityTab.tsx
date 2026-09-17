"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/analytics/data";
import {
  refundItems, refundKpis, groupReasons, groupBy, refundTrend, repeatRefundCustomers, returnRateByFault,
  warrantyCases, warrantyKpis, warrantyBy, reworkByTechnician, partsKpis, partsUsage, partsTrend,
} from "@/lib/analytics/quality";
import { faultCategory } from "@/lib/analytics/repairs";
import { Seg } from "@/cashier/components/dashboard/charts/viz";
import { GroupedBars, Ranked } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, type TabProps } from "./Analytics";

/** Sections 20, 21 and 22: refunds and returns, warranty re-jobs, and parts. */

const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(1)}%`);
const dayStr = (n: number | null) => (n === null ? "—" : `${n.toFixed(0)} d`);

export default function QualityTab({ window: w, previous }: TabProps) {
  const d = useAnalytics();
  const cmp = previous?.label ?? null;
  const [refundsBy, setRefundsBy] = useState<"kind" | "staff" | "customer" | "type">("kind");
  const [warrantyByKey, setWarrantyByKey] = useState<"technician" | "brand" | "model" | "fault">("technician");
  const [partsBy, setPartsBy] = useState<"part" | "technician" | "brand" | "fault">("part");

  const v = useMemo(() => {
    const items = refundItems(d, w);
    const cases = warrantyCases(d, w);
    return {
      items,
      rk: refundKpis(d, w, previous, items),
      reasons: groupReasons(items),
      byKind: groupBy(items, i => i.kind),
      byStaff: groupBy(items, i => i.who || "Not recorded"),
      byCustomer: groupBy(items, i => i.customer),
      byType: groupBy(items, i => i.category),
      trend: refundTrend(d, w),
      repeatCustomers: repeatRefundCustomers(items),
      returnByFault: returnRateByFault(d, w),
      cases,
      wk: warrantyKpis(d, w, previous, cases),
      wTech: warrantyBy(cases, c => c.original?.technician?.trim() || "Unknown"),
      wBrand: warrantyBy(cases, c => c.rejob.brand || "Unknown"),
      wModel: warrantyBy(cases, c => `${c.rejob.brand} ${c.rejob.model}`.trim() || "Unknown"),
      wFault: warrantyBy(cases, c => faultCategory(c.original?.issue ?? c.rejob.issue)),
      rework: reworkByTechnician(d, w, cases),
      pk: partsKpis(d, w),
      pPart: partsUsage(d, w, (_, p) => p),
      pTech: partsUsage(d, w, j => j.technician?.trim() || "Unassigned"),
      pBrand: partsUsage(d, w, j => j.brand || "Unknown"),
      pFault: partsUsage(d, w, j => faultCategory(j.issue)),
      pTrend: partsTrend(d, w),
    };
  }, [d, w, previous]);
  const { rk, wk, pk } = v;
  const refundGroup = refundsBy === "kind" ? v.byKind : refundsBy === "staff" ? v.byStaff : refundsBy === "customer" ? v.byCustomer : v.byType;
  const warrantyGroup = warrantyByKey === "technician" ? v.wTech : warrantyByKey === "brand" ? v.wBrand : warrantyByKey === "model" ? v.wModel : v.wFault;
  const partsGroup = partsBy === "part" ? v.pPart : partsBy === "technician" ? v.pTech : partsBy === "brand" ? v.pBrand : v.pFault;

  return (
    <>
      {/* ── Refunds ─────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Refunds" value={String(rk.count.current)} delta={rk.count} invert compareLabel={cmp} />
        <Stat label="Refund amount" value={rsK(rk.amount.current)} delta={rk.amount} format="money" invert compareLabel={cmp} />
        <Stat label="Of revenue" value={pct(rk.pctOfRevenue)} sub="refunded back out" />
        <Stat label="Average refund" value={rk.avg === null ? "—" : rsK(rk.avg)} sub={w.label.toLowerCase()} />
        <Stat label="Cash returns" value={String(rk.cashReturns)} sub="advance refunds + dealer cash returns" />
        <Stat label="Sale refunds" value={String(rk.saleRefunds)} sub={`${rk.accessoryReturns} accessory returns`} />
        <Stat label="Repairs returned" value={String(rk.repairReturns)} sub="handed back unrepaired" />
        <Stat label="Partial / full" value={`${rk.partial} / ${rk.full}`} sub="sale refunds" />
        <Stat label="Most common reason" value={rk.topReason ?? "—"} sub="as written on the refund" />
      </Grid>

      <div className="fade-up resp-grid-2">
        <GroupedBars title="Refund Trend" subtitle={`Refunded against revenue · ${w.label.toLowerCase()}`} data={v.trend} money
          series={[{ key: "revenue", label: "Revenue", color: "var(--viz-1)" }, { key: "refunds", label: "Refunds", color: "var(--viz-2)" }]} />
        <Panel title={`Refunds by ${refundsBy}`} hint="Count and amount." right={<Seg value={refundsBy} onChange={setRefundsBy} options={[{ id: "kind", label: "Kind" }, { id: "staff", label: "Staff" }, { id: "customer", label: "Customer" }, { id: "type", label: "Type" }]} />}>
          <table style={tableSt}>
            <thead><tr><Th>{refundsBy[0].toUpperCase() + refundsBy.slice(1)}</Th><Th num>Refunds</Th><Th num>Amount</Th></tr></thead>
            <tbody>
              {refundGroup.length === 0 && <Empty cols={3} text="No refunds in this window." />}
              {refundGroup.map(r => <tr key={r.name}><Td strong>{r.name}</Td><Td num>{r.value}</Td><Td num strong>{rs(r.amount)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="fade-up resp-grid-2">
        <Panel title="Refund reasons" hint="Folded by their opening words.">
          <table style={tableSt}>
            <thead><tr><Th>Reason</Th><Th num>Times</Th><Th num>Amount</Th></tr></thead>
            <tbody>
              {v.reasons.length === 0 && <Empty cols={3} text="No reasons recorded." />}
              {v.reasons.slice(0, 10).map(r => <tr key={r.name}><Td>{r.name}</Td><Td num strong>{r.value}</Td><Td num>{rs(r.amount)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
        <Panel title="Repairs returned, by fault" hint="Share of finished repairs handed back unrepaired.">
          <table style={tableSt}>
            <thead><tr><Th>Fault</Th><Th num>Finished</Th><Th num>Returned</Th><Th num>Rate</Th></tr></thead>
            <tbody>
              {v.returnByFault.length === 0 && <Empty cols={4} text="No repairs were returned in this window." />}
              {v.returnByFault.map(r => <tr key={r.name}><Td strong>{r.name}</Td><Td num>{r.finished}</Td><Td num>{r.returned}</Td><Td num tone={r.rate > 0.2 ? "#f87171" : undefined}>{pct(r.rate)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="fade-up resp-grid-2">
        <Panel title="Refund log" hint={`Every refund and cash return · ${w.label.toLowerCase()}`}>
          <table style={tableSt}>
            <thead><tr><Th>Date</Th><Th>Ref</Th><Th>Kind</Th><Th>Customer</Th><Th>Reason</Th><Th num>Amount</Th></tr></thead>
            <tbody>
              {v.items.length === 0 && <Empty cols={6} text="No refunds in this window." />}
              {v.items.slice(0, 40).map(i => <tr key={`${i.ref}-${i.when}`}><Td>{i.when.slice(0, 10)}</Td><Td strong>{i.ref}</Td><Td>{i.kind}{i.partial ? " · partial" : ""}</Td><Td>{i.customer || "—"}</Td><Td>{i.reason || "—"}</Td><Td num strong>{rs(i.amount)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
        <Panel title="Customers refunded more than once" hint="Worth a look, whichever way the fault lies.">
          <table style={tableSt}>
            <thead><tr><Th>Customer</Th><Th num>Refunds</Th><Th num>Amount</Th></tr></thead>
            <tbody>
              {v.repeatCustomers.length === 0 && <Empty cols={3} text="Nobody, in this window." />}
              {v.repeatCustomers.map(r => <tr key={r.name}><Td strong>{r.name}</Td><Td num>{r.value}</Td><Td num>{rs(r.amount)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* ── Warranty ────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Warranty returns" value={String(wk.cases.current)} delta={wk.cases} invert compareLabel={cmp} />
        <Stat label="Warranty return rate" value={pct(wk.rate)} sub="re-jobs over repairs finished" />
        <Stat label="Avg days before return" value={dayStr(wk.avgDaysBefore)} sub="after handover" />
        <Stat label="Repeat warranty cases" value={String(wk.repeatCases)} sub="same device, more than once" />
        <Stat label="Warranty parts + agent cost" value={rsK(wk.partsCost)} sub="spent on re-jobs" />
        <Stat label="Revenue given up" value={rsK(wk.revenueGivenUp)} sub="re-jobs done free of charge" />
      </Grid>
      <div className="fade-up resp-grid-2">
        <Panel title={`Warranty returns by ${warrantyByKey}`} hint="Charged to the original job's technician, brand and fault." right={<Seg value={warrantyByKey} onChange={setWarrantyByKey} options={[{ id: "technician", label: "Technician" }, { id: "brand", label: "Brand" }, { id: "model", label: "Model" }, { id: "fault", label: "Fault" }]} />}>
          <table style={tableSt}>
            <thead><tr><Th>{warrantyByKey[0].toUpperCase() + warrantyByKey.slice(1)}</Th><Th num>Returns</Th></tr></thead>
            <tbody>
              {warrantyGroup.length === 0 && <Empty cols={2} text="No warranty returns in this window." />}
              {warrantyGroup.map(r => <tr key={r.name}><Td strong>{r.name}</Td><Td num strong>{r.value}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
        <Panel title="Technician rework rate" hint="Re-jobs raised against each technician's finished work.">
          <table style={tableSt}>
            <thead><tr><Th>Technician</Th><Th num>Finished</Th><Th num>Came back</Th><Th num>Rate</Th></tr></thead>
            <tbody>
              {v.rework.length === 0 && <Empty cols={4} text="Nothing finished in this window." />}
              {v.rework.map(r => <tr key={r.name}><Td strong>{r.name}</Td><Td num>{r.completed}</Td><Td num tone={r.rework ? "#f87171" : undefined}>{r.rework || "—"}</Td><Td num tone={r.rate !== null && r.rate > 0.1 ? "#f87171" : undefined}>{pct(r.rate)}</Td></tr>)}
            </tbody>
          </table>
        </Panel>
      </div>
      <Panel title="Warranty cases" hint="Each re-job with the job it came back from.">
        <table style={tableSt}>
          <thead><tr><Th>Re-job</Th><Th>Original</Th><Th>Device</Th><Th>Customer</Th><Th>Original fault</Th><Th num>Days after handover</Th><Th>Original technician</Th><Th>Outcome</Th></tr></thead>
          <tbody>
            {v.cases.length === 0 && <Empty cols={8} text="No warranty returns in this window." />}
            {v.cases.map(c => (
              <tr key={c.rejob.id}>
                <Td strong>{c.rejob.id}</Td><Td>{c.rejob.rejobOf}</Td><Td>{`${c.rejob.brand} ${c.rejob.model}`.trim()}</Td><Td>{c.rejob.customerName}</Td>
                <Td>{c.original?.issue ?? "—"}</Td><Td num>{c.daysAfter === null ? "—" : c.daysAfter.toFixed(0)}</Td><Td>{c.original?.technician || "—"}</Td>
                <Td>{c.rejob.status === "Delivered" || c.rejob.status === "Completed" ? (c.rejob.completionType ?? "Normal") : c.rejob.status}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* ── Parts ───────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Parts used" value={String(pk.used)} sub={`${pk.jobsWithParts} jobs used parts`} />
        <Stat label="Parts cost" value={rsK(pk.cost)} sub="from the parts catalogue's cost prices" />
        <Stat label="Parts per job" value={pk.perJob === null ? "—" : pk.perJob.toFixed(1)} sub="over repairs finished" />
        <Stat label="Parts cost vs revenue" value={pct(pk.costVsRevenue)} sub="of repair revenue" />
        <Stat label="Profit after parts" value={rsK(pk.profitAfterParts)} sub="repair revenue minus parts" />
        <Stat label="Parts on warranty re-jobs" value={String(pk.onRejobs)} sub="replaced under warranty" />
      </Grid>
      <div className="fade-up resp-grid-2">
        <Ranked title="Most-used Parts" subtitle={`Times fitted · ${w.label.toLowerCase()}`} data={v.pPart.slice(0, 10).map(p => ({ name: p.name, value: p.value, sub: rs(p.cost) }))} color="var(--viz-2)" money={false} />
        <GroupedBars title="Parts Usage Trend" subtitle={`Parts fitted per period · ${w.label.toLowerCase()}`} data={v.pTrend} series={[{ key: "parts", label: "Parts", color: "var(--viz-2)" }]} />
      </div>
      <Panel title={`Parts by ${partsBy}`} hint="Count fitted and their cost." right={<Seg value={partsBy} onChange={setPartsBy} options={[{ id: "part", label: "Part" }, { id: "technician", label: "Technician" }, { id: "brand", label: "Brand" }, { id: "fault", label: "Fault" }]} />}>
        <table style={tableSt}>
          <thead><tr><Th>{partsBy[0].toUpperCase() + partsBy.slice(1)}</Th><Th num>Fitted</Th><Th num>Cost</Th></tr></thead>
          <tbody>
            {partsGroup.length === 0 && <Empty cols={3} text="No parts recorded on jobs finished in this window." />}
            {partsGroup.map(r => <tr key={r.name}><Td strong>{r.name}</Td><Td num strong>{r.value}</Td><Td num>{r.cost ? rs(r.cost) : "—"}</Td></tr>)}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
