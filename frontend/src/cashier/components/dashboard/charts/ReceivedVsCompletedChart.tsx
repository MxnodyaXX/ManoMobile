"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { FlowPoint } from "@/lib/repair/figures";
import { ChartFrame, Legend, TipBox, ff } from "./viz";

/**
 * Jobs taken in against jobs finished, per bucket.
 *
 * Two bars side by side rather than two lines, because these are counts of
 * discrete things per stretch, not a quantity that moves between readings —
 * and because the question is the gap between the pair, which two adjacent
 * bars make plain in a way two crossing lines do not. Received consistently
 * taller than Completed is a backlog growing; that is the whole chart.
 */
export default function ReceivedVsCompletedChart({ data, subtitle }: { data: FlowPoint[]; subtitle: string }) {
  const empty = data.every(d => d.received === 0 && d.completed === 0);
  const received = data.reduce((t, d) => t + d.received, 0);
  const completed = data.reduce((t, d) => t + d.completed, 0);

  const table = (
    <table className="viz-table">
      <thead><tr><th>Period</th><th className="num">Received</th><th className="num">Completed</th><th className="num">Net</th></tr></thead>
      <tbody>{data.map(d => (
        <tr key={d.name}><td>{d.name}</td><td className="num">{d.received}</td><td className="num">{d.completed}</td><td className="num" style={{ color: d.received > d.completed ? "var(--danger)" : "var(--text-primary)" }}>{d.received - d.completed > 0 ? `+${d.received - d.completed}` : d.received - d.completed}</td></tr>
      ))}</tbody>
    </table>
  );

  return (
    <ChartFrame
      title="Received vs Completed"
      subtitle={subtitle}
      empty={empty}
      table={table}
      controls={
        <span style={{ fontSize: 11.5, color: received > completed ? "var(--danger)" : "var(--text-muted)", fontFamily: ff, fontWeight: 600 }}>
          {received > completed ? `Backlog +${received - completed}` : received < completed ? `Cleared ${completed - received}` : "Level"}
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--viz-muted)", fontFamily: ff }} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--viz-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              cursor={{ fill: "var(--bg-secondary)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as FlowPoint;
                return <TipBox title={String(label)} rows={[
                  { swatch: "var(--viz-received)", label: "Received", value: String(p.received) },
                  { swatch: "var(--viz-completed)", label: "Completed", value: String(p.completed) },
                ]} />;
              }}
            />
            <Bar dataKey="received"  fill="var(--viz-received)"  radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="completed" fill="var(--viz-completed)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <Legend items={[{ color: "var(--viz-received)", label: "Received" }, { color: "var(--viz-completed)", label: "Completed" }]} />
      </div>
    </ChartFrame>
  );
}
