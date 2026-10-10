"use client";

import { useMemo, useState, type ReactNode } from "react";
import { RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight, Minus, Wallet, TrendingUp, Receipt, RotateCcw, CreditCard, Package, Clock, Users, type LucideIcon } from "lucide-react";
import { AnalyticsProvider, useAnalytics } from "@/lib/analytics/data";
import { PRESETS, windowFor, previousWindow, type Preset, type Window, type Delta } from "@/lib/analytics/window";
import { VizStyle } from "@/cashier/components/dashboard/charts/viz";
import OverviewTab from "./OverviewTab";
import RepairsTab from "./RepairsTab";
import SalesTab from "./SalesTab";
import ProductsTab from "./ProductsTab";
import CustomersTab from "./CustomersTab";
import QualityTab from "./QualityTab";
import InventoryTab from "./InventoryTab";
import SuppliersTab from "./SuppliersTab";
import FinanceTab from "./FinanceTab";
import StaffInsights from "@/admin/components/staff/StaffInsights";

export const ff = "'Plus Jakarta Sans', sans-serif";
export const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
export const rsK = (n: number) => (Math.abs(n) >= 1_000_000 ? `Rs. ${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 10_000 ? `Rs. ${Math.round(n / 1000)}K` : rs(n));

/**
 * Analytics — the owner's view of the shop, one tab per part of the business.
 *
 * One window picker on top serves every tab, and every figure that can be
 * compared is shown against the previous stretch of the same length. The
 * data is loaded once (AnalyticsProvider) and the tabs only choose and draw.
 *
 */

export type AnalyticsTab = "Overview" | "Sales" | "Repairs" | "Inventory" | "Products" | "Customers" | "Staff" | "Suppliers" | "Finance" | "Refunds & Warranty";
const TABS: AnalyticsTab[] = ["Overview", "Sales", "Repairs", "Inventory", "Products", "Customers", "Staff", "Suppliers", "Finance", "Refunds & Warranty"];

export interface TabProps { window: Window; previous: Window | null }

export default function Analytics() {
  return (
    <AnalyticsProvider>
      <AnalyticsInner />
    </AnalyticsProvider>
  );
}

function AnalyticsInner() {
  const d = useAnalytics();
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [tab, setTab] = useState<AnalyticsTab>("Overview");
  const [reloading, setReloading] = useState(false);

  const window = useMemo(() => windowFor(preset, custom), [preset, custom]);
  const previous = useMemo(() => previousWindow(window, preset), [window, preset]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: ff }}>
      <VizStyle />

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {window.label}{previous ? ` · compared with ${previous.label}` : ""}
            {d.loading ? " · loading…" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Pick label="Period" value={preset} onChange={v => setPreset(v as Preset)} options={PRESETS.map(p => ({ value: p.id, label: p.label }))} />
          {preset === "custom" && (
            <>
              <Pick label="From" type="date" value={custom.from} onChange={v => setCustom(c => ({ ...c, from: v }))} />
              <Pick label="To" type="date" value={custom.to} onChange={v => setCustom(c => ({ ...c, to: v }))} />
            </>
          )}
          <button
            onClick={() => { setReloading(true); void d.reload().finally(() => setReloading(false)); }}
            title="Read everything again"
            style={{ height: 36, width: 36, borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <RefreshCw size={14} className={reloading ? "spin-icon" : undefined} />
          </button>
        </div>
      </div>

      {(!d.configured || d.error) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {!d.configured ? "Connect Supabase to see the shop's figures — every number here comes from the ledgers." : `Some tables could not be read — ${d.error}. The figures that depend on them show as zero.`}
          </p>
        </div>
      )}

      <div className="fade-up" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", overflowX: "auto", maxWidth: "100%" }}>
        {TABS.map(t => {
          const on = tab === t;
          return <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: on ? 700 : 500, fontFamily: ff, cursor: "pointer", border: "none", background: on ? "var(--accent-dim)" : "transparent", color: on ? "var(--accent)" : "var(--text-secondary)", whiteSpace: "nowrap" }}>{t}</button>;
        })}
      </div>

      {tab === "Overview" && <OverviewTab window={window} previous={previous} />}
      {tab === "Repairs" && <RepairsTab window={window} previous={previous} />}
      {tab === "Sales" && <SalesTab window={window} previous={previous} />}
      {tab === "Products" && <ProductsTab window={window} previous={previous} />}
      {tab === "Customers" && <CustomersTab window={window} previous={previous} />}
      {tab === "Refunds & Warranty" && <QualityTab window={window} previous={previous} />}
      {tab === "Inventory" && <InventoryTab window={window} previous={previous} />}
      {tab === "Suppliers" && <SuppliersTab window={window} previous={previous} />}
      {tab === "Finance" && <FinanceTab window={window} previous={previous} />}
      {/* Staff Insights has its own filters (role, person, status) on top of
          the shared window, so it keeps its own controls. */}
      {tab === "Staff" && <StaffInsights staff={d.staff} />}
    </div>
  );
}

/* ── Shared pieces for every tab ────────────────────────────────────────── */

export function Pick({ label, value, onChange, options, type }: { label: string; value: string; onChange: (v: string) => void; options?: { value: string; label: string }[]; type?: "date" }) {
  const box: React.CSSProperties = { height: 36, padding: "0 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12.5, fontFamily: ff, outline: "none", minWidth: 150 };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      {type === "date"
        ? <input type="date" value={value} onChange={e => onChange(e.target.value)} style={box} />
        : <select value={value} onChange={e => onChange(e.target.value)} style={{ ...box, cursor: "pointer" }}>{options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
    </label>
  );
}

/**
 * A card's colour, from what it measures, so the same kind of figure is the
 * same colour on every tab: money coming in blue, profit green, costs orange,
 * losses and overdue red, credit and advances purple.
 */
// The same palette as the admin dashboard cards, so the two screens match.
export const TONES = {
  revenue: "#60a5fa",
  profit:  "#34d399",
  cost:    "#fb923c",
  loss:    "#f87171",
  credit:  "#a78bfa",
  stock:   "#22d3ee",
  time:    "#fbbf24",
  people:  "#f472b6",
} as const;

type ToneKey = keyof typeof TONES;
const TONE_ICON: Record<ToneKey, LucideIcon> = {
  revenue: Wallet, profit: TrendingUp, cost: Receipt, loss: RotateCcw,
  credit: CreditCard, stock: Package, time: Clock, people: Users,
};

function toneFor(label: string, invert: boolean): ToneKey {
  const l = label.toLowerCase();
  if (/profit|margin|net cash|potential/.test(l)) return "profit";
  if (/refund|overdue|loss|written|void|cancel|rework|rejob|uncollected|short/.test(l)) return "loss";
  if (/cost|expense|payable|discount|supplier|purchase/.test(l)) return "cost";
  if (/credit|advance|outstanding|receivable|owing/.test(l)) return "credit";
  if (/stock|inventory|units|parts|product/.test(l)) return "stock";
  if (/day|time|turnaround|hour|age/.test(l)) return "time";
  if (/customer|staff|technician|cashier|dealer/.test(l)) return "people";
  if (/revenue|sales|sold|received|collect|income|invoice|bill|cash|card|bank|spend|incoming|value/.test(l)) return "revenue";
  return invert ? "cost" : "revenue";
}

/** A figure with its change against the previous stretch. */
export function Stat({ label, value, amount, delta, format = "number", invert = false, sub, compareLabel, tone, onClick, active = false }: {
  /** Makes the card a button — e.g. to show how the figure is made up. */
  onClick?: () => void;
  /** The card whose breakdown is showing. */
  active?: boolean;
  label: string; value: string;
  /** The card's colour and icon. Worked out from the label when not given. */
  tone?: ToneKey;
  /** The exact rupee figure behind a shortened value ("Rs. 1.26M"), printed
   *  in full under it so nobody has to guess what was rounded away. */
  amount?: number;
  delta?: Delta; format?: "number" | "money" | "days" | "pct";
  /** True when going down is good (refunds, turnaround). */
  invert?: boolean; sub?: string; compareLabel?: string | null;
}) {
  const exact = amount != null && Number.isFinite(amount) ? rs(amount) : null;
  const showExact = exact !== null && exact !== value;
  const pct = delta?.pct ?? null;
  const good = delta ? (invert ? delta.diff <= 0 : delta.diff >= 0) : true;
  const flat = !delta || Math.abs(delta.diff) < 1e-9;
  const color = flat ? "var(--text-muted)" : good ? "#34d399" : "#f87171";
  const Arrow = flat ? Minus : delta!.diff > 0 ? ArrowUpRight : ArrowDownRight;
  const diffStr = !delta ? "" : format === "money" ? rsK(Math.abs(delta.diff)) : format === "days" ? `${Math.abs(delta.diff).toFixed(1)} d` : format === "pct" ? `${Math.abs(delta.diff * 100).toFixed(0)} pts` : String(Math.abs(Math.round(delta.diff)));
  const key = tone ?? toneFor(label, invert);
  const accent = TONES[key];
  const Icon = TONE_ICON[key];
  // A loss reads as a loss whatever the card is: a negative profit is red.
  const negative = amount != null && amount < 0;
  // Same card as the admin dashboard: plain card, label and icon tile on top,
  // the figure large, the note underneath.
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      title={onClick && !active ? "Show how this is made up" : undefined}
      style={{
        padding: "16px 18px", borderRadius: 14, display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
        border: `1px solid ${active ? accent + "80" : "var(--border)"}`,
        background: active ? `${accent}0d` : "var(--bg-card)",
        boxShadow: active ? `0 0 0 3px ${accent}1f` : undefined,
        cursor: onClick ? "pointer" : undefined,
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "capitalize" }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${accent}15`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={accent} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: negative ? TONES.loss : "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={exact ?? undefined}>{value}</p>
        {showExact && (
          <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>{exact}</p>
        )}
      </div>
      {delta && compareLabel ? (
        <p style={{ fontSize: 11, color, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }} title={`Previous: ${format === "money" ? rs(delta.previous) : delta.previous.toFixed(format === "days" ? 1 : 0)}`}>
          <Arrow size={12} />
          {flat ? "No change" : `${diffStr}${pct !== null ? ` (${pct >= 0 ? "+" : "−"}${Math.abs(pct * 100).toFixed(0)}%)` : ""}`}
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> vs {compareLabel}</span>
        </p>
      ) : sub ? <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{sub}</p> : null}
    </div>
  );
}

export function Grid({ children, min = 170 }: { children: ReactNode; min?: number }) {
  return <div className="fade-up" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 }}>{children}</div>;
}

export function Panel({ title, hint, children, right }: { title: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
          {hint && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{hint}</p>}
        </div>
        {right}
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

export const tableSt: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
export function Th({ children, num }: { children: ReactNode; num?: boolean }) {
  return <th style={{ textAlign: num ? "right" : "left", padding: "8px 14px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", background: "var(--bg-secondary)", whiteSpace: "nowrap" }}>{children}</th>;
}
export function Td({ children, num, strong, tone }: { children: ReactNode; num?: boolean; strong?: boolean; tone?: string }) {
  return <td style={{ textAlign: num ? "right" : "left", padding: "10px 14px", fontWeight: strong ? 700 : 500, color: tone ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", borderTop: "1px solid var(--border)" }}>{children}</td>;
}
export function Empty({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} style={{ padding: "22px 16px", textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>{text}</td></tr>;
}
