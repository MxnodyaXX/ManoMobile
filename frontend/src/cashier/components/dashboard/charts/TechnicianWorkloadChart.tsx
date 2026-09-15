"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { technicianWorkload, type WorkloadMode } from "@/lib/repair/figures";
import { ChartFrame, Seg, TipBox, ff } from "./viz";

const MODES: { id: WorkloadMode; label: string; subtitle: string }[] = [
  { id: "active", label: "Active jobs",     subtitle: "Open jobs on each bench right now" },
  { id: "today",  label: "Finished today",  subtitle: "Jobs completed since midnight" },
  { id: "month",  label: "This month",      subtitle: "Jobs completed since the 1st" },
];

/**
 * How the work is spread across the bench.
 *
 * Horizontal bars, one colour: the categories are names, which have no order
 * of their own, so the bars are sorted by length and the colour does no work.
 * Counts sit at the end of each bar — with a handful of technicians every
 * value can be labelled without the chart turning into a table, and a count
 * is the number the owner came for. The measure switch is the chart's own:
 * it changes what is counted, not which stretch of time the dashboard is on.
 */
export default function TechnicianWorkloadChart({ jobs }: { jobs: RepairJob[] }) {
  const [mode, setMode] = useState<WorkloadMode>("active");
  const rows = technicianWorkload(jobs, mode);
  const empty = rows.length === 0;

  const table = (
    <table className="viz-table">
      <thead><tr><th>Technician</th><th className="num">{MODES.find(m => m.id === mode)!.label}</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.name}><td>{r.name}</td><td className="num">{r.count}</td></tr>)}</tbody>
    </table>
  );

  return (
    <ChartFrame
      title="Technician Workload"
      subtitle={MODES.find(m => m.id === mode)!.subtitle}
      empty={empty}
      table={table}
      controls={<Seg<WorkloadMode> value={mode} onChange={setMode} options={MODES.map(m => ({ id: m.id, label: m.label }))} />}
    >
      {/* Height follows the row count so five technicians get five readable
          bars and one technician does not get one bar stretched to 200px. */}
      <ResponsiveContainer width="100%" height={Math.max(120, 36 * rows.length + 24)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, bottom: 0, left: 8 }} barCategoryGap="30%">
          <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--viz-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: "var(--text-secondary)", fontFamily: ff }} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--bg-secondary)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as { name: string; count: number };
              return <TipBox title={r.name} rows={[{ label: MODES.find(m => m.id === mode)!.label, value: String(r.count), strong: true }]} />;
            }}
          />
          <Bar dataKey="count" fill="var(--viz-1)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 700, fill: "var(--text-primary)", fontFamily: ff }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
