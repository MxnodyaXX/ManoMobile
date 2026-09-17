"use client";

import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartFrame, Legend, TipBox, ff, rs, short } from "@/cashier/components/dashboard/charts/viz";
import type { StreamPoint, FlowPoint, NamedValue } from "@/lib/analytics/overview";
import { STREAMS } from "@/lib/analytics/overview";

/**
 * Analytics' shared charts, in the dashboard's chart vocabulary (viz.tsx).
 * Same palette slots, same frame, same table twin — so a figure looks the
 * same wherever it appears.
 */

const tick = { fontSize: 11, fill: "var(--viz-muted)", fontFamily: ff };

const STREAM_COLOR: Record<string, string> = {
  Repair: "var(--viz-repair)", Accessories: "var(--viz-accessories)", Mobile: "var(--viz-mobile)", Others: "var(--viz-others)",
};

/** Revenue over the window, stacked by where it came from. */
export function StreamTrend({ data, title = "Revenue Trend", subtitle }: { data: StreamPoint[]; title?: string; subtitle: string }) {
  const empty = data.every(d => d.total === 0);
  const table = (
    <table className="viz-table">
      <thead><tr><th>Period</th>{STREAMS.map(s => <th key={s.key} className="num">{s.label}</th>)}<th className="num">Total</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.name}><td>{d.name}</td>{STREAMS.map(s => <td key={s.key} className="num">{rs(d[s.key])}</td>)}<td className="num" style={{ fontWeight: 700 }}>{rs(d.total)}</td></tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={empty} table={table}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="name" tick={tick} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={short} tick={tick} axisLine={false} tickLine={false} width={48} />
            <Tooltip cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as StreamPoint;
              return <TipBox title={String(label)} rows={[...STREAMS.map(s => ({ swatch: STREAM_COLOR[s.key], label: s.label, value: rs(p[s.key]) })), { label: "Total", value: rs(p.total), strong: true }]} />;
            }} />
            {STREAMS.map(s => (
              <Area key={s.key} type="monotone" dataKey={s.key} stackId="rev" stroke="var(--bg-card)" strokeWidth={2} fill={STREAM_COLOR[s.key]} fillOpacity={0.85} isAnimationActive={false} activeDot={{ r: 4, fill: STREAM_COLOR[s.key], strokeWidth: 0 }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        <Legend items={STREAMS.map(s => ({ color: STREAM_COLOR[s.key], label: s.label }))} />
      </div>
    </ChartFrame>
  );
}

/** Jobs taken in against jobs finished, per bucket. */
export function FlowBars({ data, subtitle }: { data: FlowPoint[]; subtitle: string }) {
  const empty = data.every(d => d.received === 0 && d.completed === 0);
  const rec = data.reduce((t, d) => t + d.received, 0), done = data.reduce((t, d) => t + d.completed, 0);
  const table = (
    <table className="viz-table">
      <thead><tr><th>Period</th><th className="num">Received</th><th className="num">Completed</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.name}><td>{d.name}</td><td className="num">{d.received}</td><td className="num">{d.completed}</td></tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title="Repair Trend" subtitle={subtitle} empty={empty} table={table}
      controls={<span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: ff, color: rec > done ? "var(--danger)" : "var(--text-muted)" }}>{rec > done ? `Backlog +${rec - done}` : rec < done ? `Cleared ${done - rec}` : "Level"}</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="name" tick={tick} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={40} />
            <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as FlowPoint;
              return <TipBox title={String(label)} rows={[{ swatch: "var(--viz-received)", label: "Received", value: String(p.received) }, { swatch: "var(--viz-completed)", label: "Completed", value: String(p.completed) }]} />;
            }} />
            <Bar dataKey="received" fill="var(--viz-received)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="completed" fill="var(--viz-completed)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <Legend items={[{ color: "var(--viz-received)", label: "Received" }, { color: "var(--viz-completed)", label: "Completed" }]} />
      </div>
    </ChartFrame>
  );
}

/**
 * Part-to-whole in at most four wedges — the number the palette clears for
 * every-pair contrast. Every count is in ink beside its swatch.
 */
export function ShareDonut({ title, subtitle, slices, money = true }: {
  title: string; subtitle: string; slices: { key: string; label: string; value: number; color: string }[]; money?: boolean;
}) {
  const total = slices.reduce((t, s) => t + s.value, 0);
  const shown = slices.filter(s => s.value > 0);
  const fmt = (v: number) => (money ? rs(v) : String(v));
  const table = (
    <table className="viz-table">
      <thead><tr><th>Stream</th><th className="num">Value</th><th className="num">Share</th></tr></thead>
      <tbody>{slices.map(s => <tr key={s.key}><td>{s.label}</td><td className="num">{fmt(s.value)}</td><td className="num">{total ? `${Math.round((s.value / total) * 100)}%` : "—"}</td></tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={total === 0} table={table}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 190, height: 190, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={shown} dataKey="value" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="var(--bg-card)" strokeWidth={2} isAnimationActive={false}>
                {shown.map(s => <Cell key={s.key} fill={s.color} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const s = payload[0].payload as { label: string; value: number };
                return <TipBox title={s.label} rows={[{ label: "Value", value: fmt(s.value), strong: true }, { label: "Share", value: `${Math.round((s.value / total) * 100)}%` }]} />;
              }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontFamily: ff }}>
            <span style={{ fontSize: money ? 15 : 26, fontWeight: 800, color: "var(--text-primary)" }}>{money ? short(total) : total}</span>
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>total</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 170, display: "flex", flexDirection: "column", gap: 6 }}>
          {slices.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 9px", fontFamily: ff }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(s.value)}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{total ? `${Math.round((s.value / total) * 100)}%` : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}

/** Values by name, longest first; the caller sorts. */
export function Ranked({ title, subtitle, data, color, money = true }: { title: string; subtitle: string; data: NamedValue[]; color: string; money?: boolean }) {
  const fmt = (v: number) => (money ? rs(v) : String(v));
  const table = (
    <table className="viz-table">
      <thead><tr><th>Name</th><th className="num">Value</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.name}><td>{d.name}{d.sub ? <span style={{ color: "var(--text-muted)" }}> · {d.sub}</span> : null}</td><td className="num">{fmt(d.value)}</td></tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={data.length === 0} table={table}>
      <ResponsiveContainer width="100%" height={Math.max(120, 34 * data.length + 24)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 70, bottom: 0, left: 8 }} barCategoryGap="30%">
          <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
          <XAxis type="number" tickFormatter={money ? short : undefined} tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11.5, fill: "var(--text-secondary)", fontFamily: ff }} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as NamedValue;
            return <TipBox title={d.name} rows={[{ label: d.sub ?? "Value", value: fmt(d.value), strong: true }]} />;
          }} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", formatter: (v: unknown) => (money ? short(Number(v)) : String(v)), fontSize: 11, fontWeight: 700, fill: "var(--text-primary)", fontFamily: ff }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** One or two series over categories, as vertical bars — hours, weekdays, buckets. */
export function GroupedBars({ title, subtitle, data, series, money = false, controls, height = 200 }: {
  title: string; subtitle: string; data: Record<string, number | string>[];
  series: { key: string; label: string; color: string }[]; money?: boolean; controls?: React.ReactNode; height?: number;
}) {
  const fmt = (v: number) => (money ? rs(v) : String(v));
  const empty = data.every(d => series.every(s => Number(d[s.key] ?? 0) === 0));
  const table = (
    <table className="viz-table">
      <thead><tr><th>Period</th>{series.map(s => <th key={s.key} className="num">{s.label}</th>)}</tr></thead>
      <tbody>{data.map(d => <tr key={String(d.name)}><td>{String(d.name)}</td>{series.map(s => <td key={s.key} className="num">{fmt(Number(d[s.key] ?? 0))}</td>)}</tr>)}</tbody>
    </table>
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={empty} table={table} controls={controls}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: money ? -14 : -22 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="name" tick={tick} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={money ? short : undefined} allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={money ? 48 : 40} />
            <Tooltip cursor={{ fill: "var(--bg-secondary)" }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Record<string, number | string>;
              return <TipBox title={String(label)} rows={series.map(s => ({ swatch: s.color, label: s.label, value: fmt(Number(p[s.key] ?? 0)) }))} />;
            }} />
            {series.map(s => <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
        {series.length > 1 && <Legend items={series.map(s => ({ color: s.color, label: s.label }))} />}
      </div>
    </ChartFrame>
  );
}
