"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { RevenueByCategoryPoint } from "@/lib/repair/figures";
import { ChartFrame, Legend, Seg, TipBox, ff, rs, short } from "./viz";

type Focus = "all" | "repair" | "accessories" | "mobile" | "others";

const SERIES: { key: Exclude<Focus, "all">; label: string; color: string }[] = [
  { key: "repair",      label: "Repairs",     color: "var(--viz-repair)" },
  { key: "accessories", label: "Accessories", color: "var(--viz-accessories)" },
  { key: "mobile",      label: "Phones",      color: "var(--viz-mobile)" },
  { key: "others",      label: "Other",       color: "var(--viz-others)" },
];

/**
 * Revenue over time, stacked by where it came from.
 *
 * A stacked area rather than four lines, because the four add up to the
 * total and the total is the first thing the owner reads — the stack's top
 * edge is that line, and the bands under it are the split. The focus control
 * is emphasis, not a filter: picking "Repairs" greys the other bands and
 * keeps them in place, so the chosen one is read against the whole, and no
 * colour ever changes hands.
 */
export default function RevenueTrendChart({ data, subtitle }: { data: RevenueByCategoryPoint[]; subtitle: string }) {
  const [focus, setFocus] = useState<Focus>("all");
  const empty = data.every(d => d.total === 0);

  const table = (
    <table className="viz-table">
      <thead><tr><th>Period</th>{SERIES.map(s => <th key={s.key} className="num">{s.label}</th>)}<th className="num">Total</th></tr></thead>
      <tbody>{data.map(d => (
        <tr key={d.name}><td>{d.name}</td>{SERIES.map(s => <td key={s.key} className="num">{rs(d[s.key])}</td>)}<td className="num" style={{ fontWeight: 700 }}>{rs(d.total)}</td></tr>
      ))}</tbody>
    </table>
  );

  return (
    <ChartFrame
      title="Revenue Trend"
      subtitle={subtitle}
      empty={empty}
      table={table}
      controls={
        <Seg<Focus>
          value={focus}
          onChange={setFocus}
          options={[{ id: "all", label: "All" }, ...SERIES.map(s => ({ id: s.key, label: s.label }))]}
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--viz-muted)", fontFamily: ff }} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "var(--viz-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as RevenueByCategoryPoint;
                return (
                  <TipBox
                    title={String(label)}
                    rows={[
                      ...SERIES.map(s => ({ swatch: s.color, label: s.label, value: rs(p[s.key]) })),
                      { label: "Total", value: rs(p.total), strong: true },
                    ]}
                  />
                );
              }}
            />
            {/* Bottom of the stack first. Each band is 2px apart from the next
                by a surface-coloured stroke, so the split is readable without
                a border drawn around anything. */}
            {SERIES.map(s => {
              const dim = focus !== "all" && focus !== s.key;
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stackId="rev"
                  stroke="var(--bg-card)"
                  strokeWidth={2}
                  fill={s.color}
                  fillOpacity={dim ? 0.18 : 0.85}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: s.color, strokeWidth: 0 }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
        <Legend items={SERIES.map(s => ({ color: s.color, label: s.label, dim: focus !== "all" && focus !== s.key }))} />
      </div>
    </ChartFrame>
  );
}
