"use client";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import { ChartFrame, Legend, TipBox, ff, rs, short } from "@/cashier/components/dashboard/charts/viz";
import type { NamedValue, WorkloadPoint, TurnaroundPoint } from "@/lib/staff/insights";

/**
 * The six charts on Staff Insights, drawn with the dashboard's own chart
 * vocabulary (viz.tsx) so the two screens read as one system: same palette
 * slots, same frame, same table twin behind the toggle.
 *
 * Colour follows the entity. A cashier's sales are always --viz-1; the three
 * bench states wear the status colours the Repair Status donut already
 * assigned them; time in the queue and time on the bench are two things and
 * get two adjacent slots. Nothing here is coloured by rank.
 */

const tick = { fontSize: 11, fill: "var(--viz-muted)", fontFamily: ff };
const cat  = { fontSize: 12, fill: "var(--text-secondary)", fontFamily: ff };
const rowH = (n: number) => Math.max(120, 36 * n + 24);

/** One value per name, horizontal, sorted by the caller, labelled at the end. */
export function RankedBars({ title, subtitle, data, color, money = true, unit }: {
  title: string; subtitle: string; data: NamedValue[]; color: string; money?: boolean; unit?: string;
}) {
  const fmt = (v: number) => (money ? rs(v) : `${v.toFixed(1)} ${unit ?? ""}`.trim());
  const table = (
    <table className="viz-table">
      <thead><tr><th>Name</th><th className="num">{money ? "Value" : unit ?? "Value"}</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.name}><td>{d.name}</td><td className="num">{fmt(d.value)}</td></tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={data.length === 0} table={table}>
      <ResponsiveContainer width="100%" height={rowH(data.length)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 0, left: 8 }} barCategoryGap="30%">
          <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
          <XAxis type="number" tickFormatter={money ? short : undefined} tick={tick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={cat} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as NamedValue;
            return <TipBox title={d.name} rows={[{ label: money ? "Value" : unit ?? "Value", value: fmt(d.value), strong: true }]} />;
          }} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => (money ? short(Number(v)) : Number(v).toFixed(1))} style={{ fontSize: 11, fontWeight: 700, fill: "var(--text-primary)", fontFamily: ff }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

const SLOTS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)"];

/** Sales per bucket, one line per cashier. */
export function DailyStaffSales({ points, series, subtitle }: { points: Record<string, number | string>[]; series: string[]; subtitle: string }) {
  const empty = series.length === 0;
  const table = (
    <table className="viz-table">
      <thead><tr><th>Period</th>{series.map(s => <th key={s} className="num">{s}</th>)}</tr></thead>
      <tbody>{points.map(p => <tr key={String(p.name)}><td>{String(p.name)}</td>{series.map(s => <td key={s} className="num">{rs(Number(p[s] ?? 0))}</td>)}</tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title="Daily Staff Sales" subtitle={subtitle} empty={empty} table={table}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="name" tick={tick} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={short} tick={tick} axisLine={false} tickLine={false} width={48} />
            <Tooltip cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Record<string, number | string>;
              return <TipBox title={String(label)} rows={series.map((s, i) => ({ swatch: SLOTS[i], label: s, value: rs(Number(p[s] ?? 0)) }))} />;
            }} />
            {series.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} stroke={SLOTS[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <Legend items={series.map((s, i) => ({ color: SLOTS[i], label: s }))} />
      </div>
    </ChartFrame>
  );
}

const WORK = [
  { key: "notStarted" as const, label: "Not started", color: "var(--viz-status-waiting)" },
  { key: "inProgress" as const, label: "In progress", color: "var(--viz-status-active)" },
  { key: "waiting" as const,    label: "Waiting",     color: "var(--viz-status-hold)" },
];

/** What each technician is carrying right now, split by state. */
export function TechnicianWorkload({ data }: { data: WorkloadPoint[] }) {
  const table = (
    <table className="viz-table">
      <thead><tr><th>Technician</th>{WORK.map(w => <th key={w.key} className="num">{w.label}</th>)}<th className="num">Total</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.name}><td>{d.name}</td>{WORK.map(w => <td key={w.key} className="num">{d[w.key]}</td>)}<td className="num" style={{ fontWeight: 700 }}>{d.notStarted + d.inProgress + d.waiting}</td></tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title="Technician Workload" subtitle="Open jobs on each bench right now, by state" empty={data.length === 0} table={table}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={rowH(data.length)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 0, left: 8 }} barCategoryGap="30%">
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} tick={cat} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as WorkloadPoint;
              return <TipBox title={d.name} rows={[...WORK.map(w => ({ swatch: w.color, label: w.label, value: String(d[w.key]) })), { label: "Total", value: String(d.notStarted + d.inProgress + d.waiting), strong: true }]} />;
            }} />
            {WORK.map((w, i) => (
              <Bar key={w.key} dataKey={w.key} stackId="load" fill={w.color} stroke="var(--bg-card)" strokeWidth={2} radius={i === WORK.length - 1 ? [0, 4, 4, 0] : undefined} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legend items={WORK.map(w => ({ color: w.color, label: w.label }))} />
      </div>
    </ChartFrame>
  );
}

const TIME = [
  { key: "queue" as const, label: "Waiting to start (taken in → started)", short: "In queue", color: "var(--viz-2)" },
  { key: "bench" as const, label: "On the bench (started → finished)",     short: "On bench", color: "var(--viz-3)" },
];

/** Two averages per technician, side by side, because they are two problems. */
export function RepairTurnaround({ data }: { data: TurnaroundPoint[] }) {
  const table = (
    <table className="viz-table">
      <thead><tr><th>Technician</th><th className="num">In queue (days)</th><th className="num">On bench (days)</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.name}><td>{d.name}</td><td className="num">{d.queue.toFixed(1)}</td><td className="num">{d.bench.toFixed(1)}</td></tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title="Average Repair Turnaround" subtitle="Days, per technician — the wait before work, and the work itself" empty={data.length === 0} table={table}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={rowH(data.length) + 12}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={v => `${v}d`} />
            <YAxis type="category" dataKey="name" width={110} tick={cat} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as TurnaroundPoint;
              return <TipBox title={d.name} rows={TIME.map(t => ({ swatch: t.color, label: t.short, value: `${d[t.key].toFixed(1)} days` }))} />;
            }} />
            {TIME.map(t => (
              <Bar key={t.key} dataKey={t.key} fill={t.color} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey={t.key} position="right" formatter={(v: unknown) => `${Number(v).toFixed(1)}d`} style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--text-primary)", fontFamily: ff }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legend items={TIME.map(t => ({ color: t.color, label: t.label }))} />
      </div>
    </ChartFrame>
  );
}
