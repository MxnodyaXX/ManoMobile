"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Table2, BarChart3 } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * Charts for the technician's own performance.
 *
 * Colours come from the validated categorical palette — slot 1 blue, slot 2
 * orange — which clears the CVD, normal-vision and contrast gates in both
 * modes (checked with the palette validator, not by eye). They are picked in
 * JS from the resolved theme rather than from a stylesheet, because a chart
 * that silently loses its colours when a stylesheet goes stale is worse than
 * one with no colours at all.
 *
 * Every chart here is one measure over one dimension, so each is a single
 * series in a single hue: colouring bars darker-where-bigger would double-encode
 * length as hue and spend the only free channel on what the bar already says.
 * The one two-series chart plots two amounts in the same unit (rupees) on one
 * axis — never two scales.
 */

const PALETTE = {
  light: { s1: "#2a78d6", s2: "#eb6834", grid: "rgba(0,0,0,0.08)", axis: "rgba(0,0,0,0.28)" },
  dark:  { s1: "#3987e5", s2: "#d95926", grid: "rgba(255,255,255,0.10)", axis: "rgba(255,255,255,0.32)" },
};

export type Range = 7 | 30 | 90 | 0;

export const RANGES: { id: Range; label: string }[] = [
  { id: 7,  label: "7 days"  },
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" },
  { id: 0,  label: "All time" },
];

/**
 * The clock, read once when the module loads rather than during render.
 *
 * Reading it while rendering makes the output depend on when React happened to
 * re-render — day buckets could shift under a re-render that changed nothing
 * else — and both escape hatches are closed here: the purity rule rejects
 * Date.now() in render, and the set-state-in-effect rule rejects stashing it
 * from an effect. Module scope runs at import, so every render draws the same
 * window.
 *
 * The trade: a tab left open across midnight keeps yesterday's buckets until
 * it is reloaded. For a shop that closes at night, that is the cheaper problem.
 */
const LOADED_AT = Date.now();

const rs = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString("en-LK")}`;
const isFinished = (j: RepairJob) =>
  j.status === "Completed" || j.status === "Delivered" || (!!j.completedAt && !!j.completionType);

function usePalette() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? PALETTE.dark : PALETTE.light;
}

/* ── Card shell, with the table-view twin every chart needs ───────────────── */

function ChartCard({ title, subtitle, table, children }: {
  title: string;
  subtitle: string;
  /** Column headers + rows, shown when the reader switches to the table. */
  table: { columns: string[]; rows: string[][] };
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "16px 18px 18px",
      display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{title}</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>{subtitle}</p>
        </div>
        {/* A tooltip must never be the only way to read a value. */}
        <button
          onClick={() => setAsTable(t => !t)}
          title={asTable ? "Show the chart" : "Show the numbers"}
          aria-label={asTable ? "Show the chart" : "Show the numbers"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 8, flexShrink: 0, cursor: "pointer",
            background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)",
          }}
        >
          {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        {asTable ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: ff }}>
              <thead>
                <tr>{table.columns.map((c, i) => (
                  <th key={c} style={{
                    textAlign: i === 0 ? "left" : "right", padding: "6px 8px",
                    fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                  }}>{c}</th>
                ))}</tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td key={ci} style={{
                        textAlign: ci === 0 ? "left" : "right", padding: "7px 8px",
                        fontSize: 12.5, color: "var(--text-primary)",
                        borderBottom: "1px solid var(--border)",
                        // Aligned columns are exactly where equal-width digits help.
                        fontVariantNumeric: ci === 0 ? undefined : "tabular-nums",
                        whiteSpace: "nowrap",
                      }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : children}
      </div>
    </div>
  );
}

/* ── Tooltip shared by every chart ────────────────────────────────────────── */

function Tip({ x, y, lines }: { x: string; y: number; lines: string[] }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, transform: "translate(-50%, -100%)",
      pointerEvents: "none", zIndex: 5, whiteSpace: "nowrap",
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "6px 9px", boxShadow: "0 8px 22px rgba(0,0,0,0.24)",
      fontFamily: ff, fontSize: 11.5, color: "var(--text-primary)", lineHeight: 1.5,
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)" }}>{l}</div>
      ))}
    </div>
  );
}

/* ── Vertical bars over time (1 or 2 series, same unit) ───────────────────── */

function TimeBars({ data, series, format }: {
  data: { label: string; short: string; values: number[] }[];
  series: { name: string; color: string }[];
  format: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 210, PADL = 44, PADR = 8, PADT = 12, PADB = 30;
  const plotW = W - PADL - PADR, plotH = H - PADT - PADB;

  const max = Math.max(1, ...data.flatMap(d => d.values));
  const slot = plotW / Math.max(1, data.length);
  // A 2px gap between adjacent fills, never a border drawn around them.
  const GAP = 2;
  const groupW = Math.max(4, slot * 0.62);
  const barW = (groupW - GAP * (series.length - 1)) / series.length;

  const ticks = [0, 0.5, 1].map(t => Math.round(max * t));

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img">
        {/* Hairline grid, solid — dashes read as a threshold that isn't there */}
        {ticks.map(t => {
          const y = PADT + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={PADL - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--text-muted)" fontFamily={ff}>
                {format(t)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const gx = PADL + slot * i + (slot - groupW) / 2;
          return (
            <g key={d.label}>
              {/* Hit target spans the whole slot, so a 4px bar is still easy to hit */}
              <rect
                x={PADL + slot * i} y={PADT} width={slot} height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {d.values.map((v, si) => {
                const h = max > 0 ? (v / max) * plotH : 0;
                return (
                  <rect
                    key={si}
                    x={gx + si * (barW + GAP)} y={PADT + plotH - h}
                    width={barW} height={Math.max(v > 0 ? 2 : 0, h)}
                    rx={2} fill={series[si].color}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                    style={{ transition: "opacity 0.12s" }}
                  />
                );
              })}
              {/* Every few labels only — a tick under every bar is unreadable */}
              {(data.length <= 10 || i % Math.ceil(data.length / 8) === 0) && (
                <text x={PADL + slot * i + slot / 2} y={H - 10} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)" fontFamily={ff}>
                  {d.short}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PADL} x2={W - PADR} y1={PADT + plotH} y2={PADT + plotH} stroke="var(--viz-axis)" strokeWidth={1} />
      </svg>

      {hover !== null && (
        <Tip
          x={`${((PADL + slot * hover + slot / 2) / W) * 100}%`}
          y={-4}
          lines={[data[hover].label, ...series.map((s, si) => `${s.name}: ${format(data[hover].values[si])}`)]}
        />
      )}
    </div>
  );
}

/* ── Horizontal bars for a ranking ────────────────────────────────────────── */

function RankBars({ data, color, format }: {
  data: { label: string; value: number }[];
  color: string;
  format: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));
  const ROW = 30;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2 }}>
      {data.map((d, i) => (
        <div
          key={d.label}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          style={{ display: "flex", alignItems: "center", gap: 10, minHeight: ROW, cursor: "default" }}
        >
          <span style={{
            width: 128, flexShrink: 0, fontSize: 11.5, color: "var(--text-secondary)",
            fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }} title={d.label}>
            {d.label}
          </span>
          <div style={{ flex: 1, minWidth: 0, height: 12, position: "relative" }}>
            <div style={{
              width: `${(d.value / max) * 100}%`, height: "100%",
              background: color, borderRadius: 3,
              opacity: hover === null || hover === i ? 1 : 0.45, transition: "opacity 0.12s",
            }} />
          </div>
          {/* Direct label on every row is fine here: one row per category, and
              a ranking is read by comparing the numbers as much as the bars. */}
          <span style={{
            width: 62, textAlign: "right", flexShrink: 0, fontSize: 12,
            fontWeight: 700, color: "var(--text-primary)", fontFamily: ff,
            fontVariantNumeric: "tabular-nums",
          }}>
            {format(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── The dashboard ────────────────────────────────────────────────────────── */

export default function PerformanceCharts({ jobs, range }: { jobs: RepairJob[]; range: Range }) {
  const pal = usePalette();


  const inRange = useMemo(() => {
    if (range === 0) return jobs;
    const from = LOADED_AT - range * 86_400_000;
    return jobs.filter(j => new Date(j.completedAt ?? j.createdAt).getTime() >= from);
  }, [jobs, range]);

  const done = inRange.filter(isFinished);

  /** Day buckets across the window, so quiet days show as gaps rather than
   *  being skipped — a week with three jobs should look like a quiet week. */
  const days = useMemo(() => {
    const span = range === 0 ? 30 : range;
    const out: { label: string; short: string; key: string }[] = [];
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(LOADED_AT - i * 86_400_000);
      out.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        short: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      });
    }
    return out;
  }, [range]);

  const perDay = days.map(d => {
    const onDay = done.filter(j => (j.completedAt ?? "").slice(0, 10) === d.key);
    return {
      label: d.label, short: d.short,
      count: onDay.length,
      value: onDay.reduce((t, j) => t + j.estimatedCost, 0),
      mine: onDay.reduce((t, j) => t + (j.labourCost ?? 0), 0),
    };
  });

  const rank = (pick: (j: RepairJob) => string) => {
    const counts = new Map<string, number>();
    for (const j of inRange) {
      const k = (pick(j) || "").trim().replace(/\s+/g, " ") || "Not recorded";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    // Past six the tail folds into Other rather than growing the colour count.
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6).reduce((t, [, n]) => t + n, 0);
    return [...top.map(([label, value]) => ({ label, value })), ...(rest ? [{ label: "Other", value: rest }] : [])];
  };

  const faults = rank(j => j.issue);
  const brands = rank(j => j.brand);

  const anyDone = done.length > 0;

  const empty = (what: string) => (
    <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, padding: "26px 8px", textAlign: "center" }}>
      {what}
    </p>
  );

  return (
    <div
      style={{
        // The palette lands as variables so the SVG can reference roles, and
        // flips with the resolved theme rather than with a stylesheet.
        ["--viz-grid" as string]: pal.grid,
        ["--viz-axis" as string]: pal.axis,
        display: "grid", gap: 14, alignItems: "start",
        gridTemplateColumns: "repeat(auto-fill, minmax(max(340px, 48%), 1fr))",
      }}
    >
      <ChartCard
        title="Repairs finished per day"
        subtitle={range === 0 ? "Last 30 days" : `Last ${range} days`}
        table={{
          columns: ["Day", "Finished"],
          rows: perDay.filter(d => d.count > 0).map(d => [d.label, String(d.count)]),
        }}
      >
        {anyDone
          ? <TimeBars
              data={perDay.map(d => ({ label: d.label, short: d.short, values: [d.count] }))}
              series={[{ name: "Finished", color: pal.s1 }]}
              format={n => String(Math.round(n))}
            />
          : empty("No repairs finished in this period.")}
      </ChartCard>

      <ChartCard
        title="What the shop billed, and what you charged"
        subtitle="Both in rupees, on one scale"
        table={{
          columns: ["Day", "Billed", "Your charge"],
          rows: perDay.filter(d => d.value > 0 || d.mine > 0).map(d => [d.label, rs(d.value), rs(d.mine)]),
        }}
      >
        {anyDone ? (
          <>
            {/* Two series, so a legend is always present */}
            <div style={{ display: "flex", gap: 14, marginBottom: 8 }}>
              {[{ n: "Billed by shop", c: pal.s1 }, { n: "Your charge", c: pal.s2 }].map(l => (
                <span key={l.n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: l.c }} /> {l.n}
                </span>
              ))}
            </div>
            <TimeBars
              data={perDay.map(d => ({ label: d.label, short: d.short, values: [d.value, d.mine] }))}
              series={[{ name: "Billed by shop", color: pal.s1 }, { name: "Your charge", color: pal.s2 }]}
              format={rs}
            />
          </>
        ) : empty("Nothing billed in this period.")}
      </ChartCard>

      <ChartCard
        title="Faults you work on most"
        subtitle="Across every job in this period"
        table={{ columns: ["Fault", "Jobs"], rows: faults.map(f => [f.label, String(f.value)]) }}
      >
        {faults.length ? <RankBars data={faults} color={pal.s1} format={n => String(n)} /> : empty("No jobs in this period.")}
      </ChartCard>

      <ChartCard
        title="Brands you handle"
        subtitle="Across every job in this period"
        table={{ columns: ["Brand", "Jobs"], rows: brands.map(b => [b.label, String(b.value)]) }}
      >
        {brands.length ? <RankBars data={brands} color={pal.s1} format={n => String(n)} /> : empty("No jobs in this period.")}
      </ChartCard>
    </div>
  );
}
