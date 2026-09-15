"use client";

import { useState, type ReactNode } from "react";
import { Table2, BarChart3 } from "lucide-react";

/**
 * The dashboard's chart vocabulary — colours, chrome and the card every chart
 * sits in. Written once so the four charts read as one system.
 *
 * ── Colour ──────────────────────────────────────────────────────────────────
 * Categorical slots from the validated reference palette, stepped for each
 * surface and checked with the validator against this app's own card colours
 * (#ffffff light, #121212 dark), not the palette's defaults:
 *
 *   adjacent pairs (stacks, grouped bars, lines) — slots 1–5 pass both modes
 *   all pairs (a donut, where every wedge meets every other by legend) —
 *     only four colours from the eight clear the floor in both modes:
 *     blue · yellow · magenta · green. The status donut is therefore four
 *     wedges, and would have to fold further before it could be five.
 *
 * A colour is assigned to an entity, once, and follows it: repair income is
 * always --viz-repair whether it is the only series on screen or one of four.
 * Text never wears a series colour — the swatch beside it carries identity.
 *
 * The app is dark by default and puts .light on the root for light mode, so
 * the light values live under .light rather than a media query.
 */
export function VizStyle() {
  return (
    <style>{`
      :root {
        --viz-1: #3987e5; --viz-2: #d95926; --viz-3: #199e70; --viz-4: #c98500;
        --viz-5: #d55181; --viz-6: #008300;
        --viz-grid: #2c2c2a; --viz-axis: #383835; --viz-muted: #898781;
        --viz-tip-bg: #1a1a19;
      }
      .light {
        --viz-1: #2a78d6; --viz-2: #eb6834; --viz-3: #1baf7a; --viz-4: #eda100;
        --viz-5: #e87ba4; --viz-6: #008300;
        --viz-grid: #e1e0d9; --viz-axis: #c3c2b7; --viz-muted: #898781;
        --viz-tip-bg: #ffffff;
      }
      /* The entity → slot mapping, so a chart names what it draws. */
      :root, .light {
        --viz-repair: var(--viz-1);
        --viz-accessories: var(--viz-2);
        --viz-mobile: var(--viz-3);
        --viz-others: var(--viz-4);
        --viz-received: var(--viz-1);
        --viz-completed: var(--viz-3);
        --viz-status-waiting: var(--viz-1);
        --viz-status-active: var(--viz-4);
        --viz-status-hold: var(--viz-5);
        --viz-status-ready: var(--viz-6);
      }
      .viz-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      .viz-table th { text-align: left; font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
      .viz-table td { padding: 7px 8px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
      .viz-table td.num, .viz-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
    `}</style>
  );
}

export const ff = "'Plus Jakarta Sans', sans-serif";
export const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
/** Axis ticks: 120000 → 120K, 1500000 → 1.5M. */
export const short = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${Math.round(v / 1_000)}K` : `${v}`);

/** The tooltip box every chart uses. */
export function TipBox({ title, rows }: { title: string; rows: { swatch?: string; label: string; value: string; strong?: boolean }[] }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-active)", borderRadius: 10, padding: "9px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", fontFamily: ff, minWidth: 150 }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>{title}</p>
      {rows.map(r => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "2px 0", fontWeight: r.strong ? 700 : 500 }}>
          {r.swatch && <span style={{ width: 8, height: 8, borderRadius: 2, background: r.swatch, flexShrink: 0 }} />}
          <span style={{ color: "var(--text-secondary)", flex: 1 }}>{r.label}</span>
          <span style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** A legend swatch + name. Text in ink, colour on the swatch only. */
export function Legend({ items }: { items: { color: string; label: string; dim?: boolean }[] }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontFamily: ff }}>
      {items.map(i => (
        <span key={i.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-secondary)", opacity: i.dim ? 0.45 : 1 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** A small segmented control for a chart-local choice (which measure, which series). */
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{ padding: "4px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: on ? 700 : 500, fontFamily: ff, cursor: "pointer", border: "none", background: on ? "var(--bg-card)" : "transparent", color: on ? "var(--text-primary)" : "var(--text-muted)", boxShadow: on ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The card a chart sits in: title, what it spans, chart-local controls, and
 * the table view every chart has as its WCAG twin.
 */
export function ChartFrame({ title, subtitle, controls, table, children, empty }: {
  title: string;
  subtitle: string;
  controls?: ReactNode;
  /** The same numbers as rows. Always available — a tooltip is never the only way to read a value. */
  table: ReactNode;
  children: ReactNode;
  /** True when there is nothing to draw; the frame says so instead of drawing a flat line. */
  empty?: boolean;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px 16px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "var(--shadow-card)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 className="heading" style={{ fontSize: 14.5, color: "var(--text-primary)" }}>{title}</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontFamily: ff }}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {controls}
          <button
            onClick={() => setShowTable(v => !v)}
            title={showTable ? "Show the chart" : "Show as a table"}
            aria-pressed={showTable}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: showTable ? "var(--accent-dim)" : "transparent", color: showTable ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {showTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
          </button>
        </div>
      </div>
      {showTable ? (
        <div style={{ overflowX: "auto" }}>{table}</div>
      ) : empty ? (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff }}>
          Nothing recorded in this stretch yet.
        </div>
      ) : children}
    </div>
  );
}
