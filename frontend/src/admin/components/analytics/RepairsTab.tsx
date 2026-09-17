"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAnalytics } from "@/lib/analytics/data";
import {
  eventsByJob, repairKpis, turnaround, turnaroundBy, faultRows, faultsByBrand, deviceRows, repeatDevices, queue, collection, benchModes, byHour, byWeekday, faultCategory,
} from "@/lib/analytics/repairs";
import { repairFlow } from "@/lib/analytics/overview";
import { ChartFrame, Legend, Seg, TipBox, ff as vff } from "@/cashier/components/dashboard/charts/viz";
import { FlowBars, ShareDonut, Ranked } from "./charts";
import { Stat, Grid, Panel, Th, Td, Empty, tableSt, rs, rsK, type TabProps } from "./Analytics";

/**
 * The Repairs tab: sections 4–7 and 23–27 of the brief.
 *
 * Laid out as the shop thinks about it — how much came in and went out, how
 * long it took at each stage, what breaks and on which phones, what is
 * sitting in the queue, and what is waiting to be collected. The two ways a
 * job reaches a bench (claimed from the pool or assigned) get their own
 * block, because they fail in different ways.
 */

const dayStr = (n: number | null) => (n === null ? "—" : n < 0.05 ? "< 0.1 d" : n < 1 ? `${Math.round(n * 24)} h` : `${n.toFixed(1)} d`);
const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(0)}%`);
const STAGE_COLOR: Record<string, string> = { notStarted: "var(--viz-status-waiting)", inProgress: "var(--viz-status-active)", waiting: "var(--viz-status-hold)", ready: "var(--viz-status-ready)" };

export default function RepairsTab({ window: w, previous }: TabProps) {
  const d = useAnalytics();
  const cmp = previous?.label ?? null;
  const [groupBy, setGroupBy] = useState<"technician" | "brand" | "fault">("technician");
  const [deviceBy, setDeviceBy] = useState<"brand" | "model">("brand");
  const [clock, setClock] = useState<"hour" | "weekday">("hour");

  const v = useMemo(() => {
    const byJob = eventsByJob(d.events);
    return {
      k: repairKpis(d, w, previous, byJob),
      t: turnaround(d, w, byJob),
      flow: repairFlow(d.jobs, w),
      faults: faultRows(d, w),
      matrix: faultsByBrand(d, w),
      brands: deviceRows(d, w, j => (j.brand || "Unknown").trim()),
      models: deviceRows(d, w, j => `${j.brand} ${j.model}`.trim() || "Unknown"),
      repeats: repeatDevices(d),
      q: queue(d, w),
      c: collection(d, w, byJob),
      modes: benchModes(d, w, byJob),
      hours: byHour(d, w),
      weekdays: byWeekday(d, w),
      tByTech: turnaroundBy(d.jobs, w, j => j.technician?.trim() || "Unassigned"),
      tByBrand: turnaroundBy(d.jobs, w, j => (j.brand || "Unknown").trim()),
      tByFault: turnaroundBy(d.jobs, w, j => faultCategory(j.issue)),
    };
  }, [d, w, previous]);
  const { k, t, q, c, modes } = v;
  const tGroup = groupBy === "technician" ? v.tByTech : groupBy === "brand" ? v.tByBrand : v.tByFault;
  const devices = deviceBy === "brand" ? v.brands : v.models;

  return (
    <>
      {/* ── Volumes ─────────────────────────────────────────────────────── */}
      <Grid>
        <Stat label="Received" value={String(k.received.current)} delta={k.received} compareLabel={cmp} />
        <Stat label="Started" value={String(k.started.current)} delta={k.started} compareLabel={cmp} />
        <Stat label="Finished" value={String(k.finished.current)} delta={k.finished} compareLabel={cmp} />
        <Stat label="Delivered" value={String(k.delivered.current)} delta={k.delivered} compareLabel={cmp} />
        <Stat label="Returned unrepaired" value={String(k.returned.current)} delta={k.returned} invert compareLabel={cmp} />
        <Stat label="Cash returns" value={String(k.cashReturns.current)} delta={k.cashReturns} invert compareLabel={cmp} />
        <Stat label="Cancelled" value={String(k.cancelled.current)} delta={k.cancelled} invert compareLabel={cmp} />
      </Grid>
      <Grid>
        <Stat label="In the shop now" value={String(k.inShop)} sub={`${k.receivedToday} received · ${k.finishedToday} finished today`} />
        <Stat label="Unassigned" value={String(k.unassigned)} sub="waiting for a technician" />
        <Stat label="Assigned, not started" value={String(k.assignedNotStarted)} sub="on a bench, untouched" />
        <Stat label="In progress" value={String(k.inProgress)} sub="being worked on" />
        <Stat label="Waiting for parts" value={String(k.waiting)} sub="on hold" />
        <Stat label="Ready for collection" value={String(k.ready)} sub={`${rs(c.value)} to collect`} />
      </Grid>
      <Grid>
        <Stat label="Repair revenue" value={rsK(k.revenue.current)} delta={k.revenue} format="money" compareLabel={cmp} />
        <Stat label="Avg repair value" value={rsK(k.avgValue.current)} delta={k.avgValue} format="money" compareLabel={cmp} />
        <Stat label="Highest repair" value={rsK(k.highest)} sub={w.label.toLowerCase()} />
        <Stat label="Repair profit (est.)" value={rsK(k.profit.current)} delta={k.profit} format="money" compareLabel={cmp} />
        <Stat label="Repair margin" value={pct(k.margin)} sub="after parts and agent costs" />
      </Grid>

      {/* ── Turnaround ──────────────────────────────────────────────────── */}
      <Panel title="Turnaround, stage by stage" hint={`Averages over the ${t.finishedCount} repairs finished ${w.label.toLowerCase()}. Two problems hide in one number: the wait before work, and the work.`}>
        <div style={{ padding: "4px 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[
            ["Taken in → started", t.createdToStarted, "the wait in the queue"],
            ["Started → finished", t.startedToFinished, "the work itself"],
            ["Finished → collected", t.finishedToCollected, "waiting for the customer"],
            ["Taken in → collected", t.createdToCollected, "the whole stay"],
            ["Time on hold", t.waitingForParts, "per job that waited for parts"],
          ].map(([l, val, sub]) => (
            <div key={l as string} style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{l as string}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{dayStr(val as number | null)}</p>
              <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{sub as string}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: "0 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <Mini label="Same-day repairs" value={`${t.sameDay} · ${pct(t.sameDayPct)}`} />
          <Mini label="Within 24 hours" value={String(t.within24h)} />
          <Mini label="Within 48 hours" value={String(t.within48h)} />
          <Mini label="Took over 7 days" value={String(t.over7d)} tone={t.over7d ? "#f87171" : undefined} />
          <Mini label="Past promised date" value={String(t.delayed)} tone={t.delayed ? "#f87171" : undefined} />
          <Mini label="Due in 2 days" value={String(t.dueSoon)} tone={t.dueSoon ? "#fbbf24" : undefined} />
          <Mini label="Oldest unfinished" value={t.oldestUnfinished ? `${t.oldestUnfinished.id} · ${t.oldestUnfinished.days.toFixed(0)} d` : "—"} sub={t.oldestUnfinished?.device} tone={t.oldestUnfinished && t.oldestUnfinished.days > 7 ? "#f87171" : undefined} />
        </div>
      </Panel>

      <div className="fade-up resp-grid-2">
        <FlowBars data={v.flow} subtitle={`Taken in vs finished · ${w.label.toLowerCase()}`} />
        <Ranked
          title="Average Repair Time"
          subtitle={`Days on the bench, started → finished · by ${groupBy}`}
          data={tGroup.map(r => ({ ...r, value: Math.round(r.value * 10) / 10 }))}
          color="var(--viz-3)"
          money={false}
        />
      </div>
      <div className="fade-up" style={{ display: "flex", justifyContent: "flex-end", marginTop: -8 }}>
        <Seg value={groupBy} onChange={setGroupBy} options={[{ id: "technician", label: "By technician" }, { id: "brand", label: "By brand" }, { id: "fault", label: "By fault" }]} />
      </div>

      {/* ── Faults ──────────────────────────────────────────────────────── */}
      <Panel title="Faults" hint="What the devices came in for, read from the reported fault. Categories are matched on words, so a fault typed as 'display line' and one typed as 'screen' land together.">
        <table style={tableSt}>
          <thead><tr><Th>Fault</Th><Th num>Jobs</Th><Th num>Share</Th><Th num>Avg charge</Th><Th num>Avg days</Th><Th num>Revenue</Th><Th num>Profit (est.)</Th><Th num>Repeat jobs</Th></tr></thead>
          <tbody>
            {v.faults.length === 0 && <Empty cols={8} text="No repairs in this window." />}
            {v.faults.map(f => (
              <tr key={f.name}>
                <Td strong>{f.name}</Td>
                <Td num strong>{f.count}</Td>
                <Td num>{pct(f.share)}</Td>
                <Td num>{f.avgCost === null ? "—" : rs(f.avgCost)}</Td>
                <Td num>{dayStr(f.avgDays)}</Td>
                <Td num>{f.revenue ? rs(f.revenue) : "—"}</Td>
                <Td num tone={f.profit < 0 ? "#f87171" : undefined}>{f.revenue ? rs(f.profit) : "—"}</Td>
                <Td num tone={f.repeats ? "#f87171" : undefined}>{f.repeats || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {v.matrix.brands.length > 0 && (
        <Panel title="Faults by brand" hint="The most-repaired brands against the most common faults — where the volume actually is.">
          <table style={tableSt}>
            <thead><tr><Th>Brand</Th>{v.matrix.faults.map(f => <Th key={f} num>{f}</Th>)}</tr></thead>
            <tbody>
              {v.matrix.brands.map(b => (
                <tr key={b}>
                  <Td strong>{b}</Td>
                  {v.matrix.faults.map(f => { const n = v.matrix.cell(b, f); return <Td key={f} num tone={n === 0 ? "var(--text-muted)" : undefined}>{n || "·"}</Td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {/* ── Devices ─────────────────────────────────────────────────────── */}
      <Panel title="Devices" hint="Which phones come in, what they bring, and how long they take." right={<Seg value={deviceBy} onChange={setDeviceBy} options={[{ id: "brand", label: "By brand" }, { id: "model", label: "By model" }]} />}>
        <table style={tableSt}>
          <thead><tr><Th>{deviceBy === "brand" ? "Brand" : "Model"}</Th><Th num>Jobs</Th><Th num>Revenue</Th><Th num>Avg charge</Th><Th num>Avg days</Th><Th num>Repeat jobs</Th><Th num>Warranty returns</Th></tr></thead>
          <tbody>
            {devices.length === 0 && <Empty cols={7} text="No repairs in this window." />}
            {devices.map(r => (
              <tr key={r.name}>
                <Td strong>{r.name}</Td>
                <Td num strong>{r.jobs}</Td>
                <Td num>{r.revenue ? rs(r.revenue) : "—"}</Td>
                <Td num>{r.avgCost === null ? "—" : rs(r.avgCost)}</Td>
                <Td num>{dayStr(r.avgDays)}</Td>
                <Td num tone={r.repeats ? "#fbbf24" : undefined}>{r.repeats || "—"}</Td>
                <Td num tone={r.warranty ? "#f87171" : undefined}>{r.warranty || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Devices repaired more than once" hint="By IMEI, all time — the same handset coming back is the clearest signal a repair did not hold.">
        <table style={tableSt}>
          <thead><tr><Th>IMEI</Th><Th>Device</Th><Th>Customer</Th><Th num>Visits</Th><Th>Last visit</Th><Th>Jobs</Th></tr></thead>
          <tbody>
            {v.repeats.length === 0 && <Empty cols={6} text="No device has been in more than once." />}
            {v.repeats.map(r => (
              <tr key={r.imei}>
                <Td><span style={{ fontFamily: "monospace" }}>{r.imei}</span></Td>
                <Td strong>{r.device}</Td>
                <Td>{r.customer}</Td>
                <Td num strong tone={r.visits >= 3 ? "#f87171" : undefined}>{r.visits}</Td>
                <Td>{r.last}</Td>
                <Td><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{r.jobs.join(", ")}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* ── Queue and collection ────────────────────────────────────────── */}
      <div className="fade-up resp-grid-2">
        <ShareDonut title="Repair Queue" subtitle="Every job in the shop right now, by stage" money={false}
          slices={q.stages.map(s => ({ key: s.key, label: s.label, value: s.count, color: STAGE_COLOR[s.key] }))} />
        <Panel title="Queue health" hint={`Flow ${w.label.toLowerCase()}, and where the wait is.`}>
          <div style={{ padding: "4px 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <Mini label="In the shop" value={String(q.size)} sub="open + ready" />
            <Mini label="Average age" value={dayStr(q.avgAge)} sub="since intake" />
            <Mini label="Entering per day" value={q.enteringPerDay.toFixed(1)} />
            <Mini label="Leaving per day" value={q.leavingPerDay.toFixed(1)} />
            <Mini label="Backlog change" value={q.backlogChange > 0 ? `+${q.backlogChange}` : String(q.backlogChange)} tone={q.backlogChange > 0 ? "#f87171" : q.backlogChange < 0 ? "#34d399" : undefined} sub={q.backlogChange > 0 ? "growing" : q.backlogChange < 0 ? "shrinking" : "level"} />
            <Mini label="Bottleneck" value={q.bottleneck ?? "—"} sub="stage with the longest wait" tone={q.bottleneck ? "#fbbf24" : undefined} />
          </div>
          <table style={tableSt}>
            <thead><tr><Th>Stage</Th><Th num>Jobs</Th><Th num>Avg age</Th><Th num>Oldest</Th></tr></thead>
            <tbody>{q.stages.map(s => (
              <tr key={s.key}><Td strong>{s.label}</Td><Td num>{s.count || "—"}</Td><Td num>{dayStr(s.avgAge)}</Td><Td num tone={s.oldest > 7 ? "#f87171" : undefined}>{s.count ? `${s.oldest.toFixed(0)} d` : "—"}</Td></tr>
            ))}</tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Collection" hint="Finished repairs waiting for their owners, and whether the reminders bring them in.">
        <div style={{ padding: "4px 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <Mini label="Awaiting collection" value={String(c.awaiting)} sub={`${rs(c.value)} to collect`} />
          <Mini label="Avg time to collect" value={dayStr(c.avgDelay)} sub={`delivered ${w.label.toLowerCase()}`} />
          <Mini label="Waiting > 1 day" value={String(c.over1)} />
          <Mini label="Waiting > 3 days" value={String(c.over3)} tone={c.over3 ? "#fbbf24" : undefined} />
          <Mini label="Waiting > 7 days" value={String(c.over7)} tone={c.over7 ? "#f87171" : undefined} />
          <Mini label="Longest uncollected" value={c.longest ? `${c.longest.id} · ${c.longest.days.toFixed(0)} d` : "—"} sub={c.longest ? `${c.longest.device} · ${c.longest.customer}` : undefined} />
          <Mini label="Reminders sent" value={String(c.remindersSent)} sub={`${c.remindedJobs} jobs`} />
          <Mini label="Collected after a reminder" value={c.remindedJobs ? `${c.collectedAfterReminder} · ${pct(c.collectedAfterReminder / c.remindedJobs)}` : "—"} />
        </div>
      </Panel>

      {/* ── Claimed vs assigned ─────────────────────────────────────────── */}
      <div className="fade-up resp-grid-2">
        <Panel title="Hall-shop mode — claimed from the pool" hint="Jobs technicians took for themselves.">
          <div style={{ padding: "4px 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <Mini label="Available to claim now" value={String(modes.availableNow)} />
            <Mini label="Claimed" value={String(modes.claimed)} sub={w.label.toLowerCase()} />
            <Mini label="Until claimed" value={dayStr(modes.timeUntilClaimed)} sub="from intake" />
            <Mini label="Claim → start" value={dayStr(modes.claimToStart)} />
            <Mini label="Claim → finish" value={dayStr(modes.claimToFinish)} />
            <Mini label="Claimed, then left" value={String(modes.abandonedClaims)} sub="not started after 2 days" tone={modes.abandonedClaims ? "#f87171" : undefined} />
          </div>
          <table style={tableSt}>
            <thead><tr><Th>Technician</Th><Th num>Claims</Th></tr></thead>
            <tbody>{modes.claimsPer.length === 0 ? <Empty cols={2} text="No claims in this window." /> : modes.claimsPer.map(r => <tr key={r.name}><Td strong>{r.name}</Td><Td num>{r.value}</Td></tr>)}</tbody>
          </table>
        </Panel>
        <Panel title="Assigned mode — given to a technician" hint="Jobs the counter put on a bench.">
          <div style={{ padding: "4px 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <Mini label="Assigned" value={String(modes.assigned)} sub={w.label.toLowerCase()} />
            <Mini label="Assign → start" value={dayStr(modes.assignToStart)} />
            <Mini label="Assign → finish" value={dayStr(modes.assignToFinish)} />
            <Mini label="Reassigned" value={String(modes.reassignments)} sub="by an Admin" />
            <Mini label="Released to pool" value={String(modes.released)} />
            <Mini label="Waiting > 2 days after assignment" value={String(modes.waitingLongAfterAssign)} tone={modes.waitingLongAfterAssign ? "#f87171" : undefined} />
          </div>
          <table style={tableSt}>
            <thead><tr><Th>Technician</Th><Th num>Assigned</Th></tr></thead>
            <tbody>{modes.assignedPer.length === 0 ? <Empty cols={2} text="Nothing assigned in this window." /> : modes.assignedPer.map(r => <tr key={r.name}><Td strong>{r.name}</Td><Td num>{r.value}</Td></tr>)}</tbody>
          </table>
        </Panel>
      </div>

      {/* ── When ────────────────────────────────────────────────────────── */}
      <ClockChart data={clock === "hour" ? v.hours : v.weekdays} mode={clock} onMode={setClock} subtitle={w.label.toLowerCase()} />
    </>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
      <p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: tone ?? "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</p>}
    </div>
  );
}

/** Received and finished by hour of day or by weekday — when the shop is busy. */
function ClockChart({ data, mode, onMode, subtitle }: { data: { name: string; received: number; completed: number }[]; mode: "hour" | "weekday"; onMode: (m: "hour" | "weekday") => void; subtitle: string }) {
  const empty = data.every(x => x.received === 0 && x.completed === 0);
  const busiest = data.reduce((b, x) => (x.received + x.completed > b.received + b.completed ? x : b), data[0]);
  const table = (
    <table className="viz-table">
      <thead><tr><th>{mode === "hour" ? "Hour" : "Day"}</th><th className="num">Received</th><th className="num">Finished</th></tr></thead>
      <tbody>{data.map(x => <tr key={x.name}><td>{x.name}</td><td className="num">{x.received}</td><td className="num">{x.completed}</td></tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title={mode === "hour" ? "Repairs by Hour" : "Repairs by Weekday"} subtitle={`${subtitle}${!empty && busiest ? ` · busiest: ${busiest.name}` : ""}`} empty={empty} table={table}
      controls={<Seg value={mode} onChange={onMode} options={[{ id: "hour", label: "Hour" }, { id: "weekday", label: "Weekday" }]} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--viz-muted)", fontFamily: vff }} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--viz-muted)", fontFamily: vff }} axisLine={false} tickLine={false} width={40} />
            <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { received: number; completed: number };
              return <TipBox title={String(label)} rows={[{ swatch: "var(--viz-received)", label: "Received", value: String(p.received) }, { swatch: "var(--viz-completed)", label: "Finished", value: String(p.completed) }]} />;
            }} />
            <Bar dataKey="received" fill="var(--viz-received)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="completed" fill="var(--viz-completed)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <Legend items={[{ color: "var(--viz-received)", label: "Received" }, { color: "var(--viz-completed)", label: "Finished" }]} />
      </div>
    </ChartFrame>
  );
}

