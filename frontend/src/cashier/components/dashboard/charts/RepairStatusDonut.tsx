"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { StatusSlice } from "@/lib/repair/figures";
import { ChartFrame, TipBox, ff } from "./viz";

const COLOR: Record<StatusSlice["key"], string> = {
  waiting: "var(--viz-status-waiting)",
  active:  "var(--viz-status-active)",
  hold:    "var(--viz-status-hold)",
  ready:   "var(--viz-status-ready)",
};

/**
 * Where every open job stands.
 *
 * A donut, because the question is part-to-whole — how much of the bench is
 * waiting versus moving — and four wedges is inside the range a donut reads
 * at a glance. The open-job total sits in the hole, which is the one figure
 * a donut cannot otherwise show. Each wedge, and its legend row, opens the
 * Repair Management tab holding exactly those jobs.
 *
 * The legend carries every count in ink beside its swatch, so nothing here
 * depends on telling the colours apart — the relief the light-surface
 * contrast check asks for.
 */
export default function RepairStatusDonut({ slices, onPick }: {
  slices: StatusSlice[];
  onPick: (section: StatusSlice["section"]) => void;
}) {
  const total = slices.reduce((t, s) => t + s.count, 0);
  const shown = slices.filter(s => s.count > 0);

  const table = (
    <table className="viz-table">
      <thead><tr><th>Status</th><th className="num">Jobs</th><th className="num">Share</th></tr></thead>
      <tbody>{slices.map(s => (
        <tr key={s.key}><td>{s.label}{s.detail ? <span style={{ color: "var(--text-muted)" }}> · {s.detail}</span> : null}</td><td className="num">{s.count}</td><td className="num">{total ? `${Math.round((s.count / total) * 100)}%` : "—"}</td></tr>
      ))}</tbody>
    </table>
  );

  return (
    <ChartFrame title="Repair Status" subtitle="Every open job, right now" empty={total === 0} table={table}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 190, height: 190, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shown}
                dataKey="count"
                nameKey="label"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={2}
                stroke="var(--bg-card)"
                strokeWidth={2}
                isAnimationActive={false}
                onClick={(_, i) => onPick(shown[i].section)}
                style={{ cursor: "pointer" }}
              >
                {shown.map(s => <Cell key={s.key} fill={COLOR[s.key]} />)}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const s = payload[0].payload as StatusSlice;
                  return <TipBox title={s.label} rows={[{ label: "Jobs", value: String(s.count), strong: true }, { label: "Share", value: `${Math.round((s.count / total) * 100)}%` }]} />;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* The hole says the one thing the wedges cannot: how many in all. */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontFamily: ff }}>
            <span className="stat-number" style={{ fontSize: 26, color: "var(--text-primary)" }}>{total}</span>
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>open</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 170, display: "flex", flexDirection: "column", gap: 4 }}>
          {slices.map(s => (
            <button
              key={s.key}
              onClick={() => onPick(s.section)}
              title={`Open the ${s.label.toLowerCase()} jobs`}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: 8, border: "1px solid transparent", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: ff, width: "100%" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOR[s.key], flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{s.label}</span>
                {s.detail && <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>{s.detail}</span>}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{s.count}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{total ? `${Math.round((s.count / total) * 100)}%` : ""}</span>
            </button>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}
