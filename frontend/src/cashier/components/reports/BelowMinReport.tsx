"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Download } from "lucide-react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { exportToExcel } from "@/cashier/utils/exportUtils";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

/**
 * Reports → Below Min — the "Below-Minimum Sales" account.
 *
 * Every phone sold under its minimum selling price is booked here by
 * sell_mobile_sale() (migration 20261001000064) with the shortfall, the reason
 * and the cashier. Voided invoices are already excluded by v_below_min_sales.
 */

interface Line {
  id: number;
  invoice_no: string;
  imei: string;
  device_name: string;
  brand: string;
  buying_price: number;
  min_price: number;
  sold_price: number;
  shortfall: number;
  reason: string;
  cashier: string | null;
  created_at: string;
  sold_on: string;
  customer: string;
}

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

const card: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 };
const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 700, textAlign: "left", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 12.5, color: "var(--text-primary)", borderBottom: "1px solid var(--border)", verticalAlign: "top" };
const input: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12.5, fontFamily: ff };

/** Sum the shortfall per key, biggest first. */
function groupBy(lines: Line[], key: (l: Line) => string) {
  const m = new Map<string, { name: string; count: number; shortfall: number }>();
  for (const l of lines) {
    const k = key(l) || "—";
    const g = m.get(k) ?? { name: k, count: 0, shortfall: 0 };
    g.count += 1; g.shortfall += l.shortfall;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.shortfall - a.shortfall);
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, fontFamily: ff }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: warn ? "#dc2626" : "var(--text-primary)", fontFamily: ff }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, fontFamily: ff }}>{sub}</div>}
    </div>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: { name: string; count: number; shortfall: number }[]; total: number }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, fontFamily: ff, color: "var(--text-primary)" }}>{title}</div>
      {rows.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff }}>Nothing in this period.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.slice(0, 8).map(r => (
            <div key={r.name}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, fontFamily: ff }}>
                <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{r.count} · <b style={{ color: "var(--text-primary)" }}>{rs(r.shortfall)}</b></span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "var(--border)", marginTop: 4 }}>
                <div style={{ height: 5, borderRadius: 3, background: "#f59e0b", width: `${total ? (r.shortfall / total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BelowMinReport() {
  const isMobile = useIsMobile();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = !isSupabaseConfigured()
      ? Promise.resolve<Line[]>([])
      : Promise.resolve(
          getSupabaseBrowserClient()
            .from("v_below_min_sales")
            .select("*")
            .gte("sold_on", from)
            .lte("sold_on", to)
            .order("created_at", { ascending: false }),
        ).then(({ data, error: err }) => {
          if (err) throw new Error(/v_below_min_sales|PGRST205|Could not find/.test(err.message)
            ? "The Below-Minimum Sales account is not set up yet — run migration 20261001000064_below_minimum_sales.sql."
            : err.message);
          return ((data ?? []) as Record<string, unknown>[]).map(r => ({
            ...(r as unknown as Line),
            buying_price: Number(r.buying_price ?? 0),
            min_price: Number(r.min_price ?? 0),
            sold_price: Number(r.sold_price ?? 0),
            shortfall: Number(r.shortfall ?? 0),
          }));
        });
    load
      .then(rows => { if (live) { setLines(rows); setError(null); } })
      .catch(e => { if (live) { setLines([]); setError(e instanceof Error ? e.message : String(e)); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [from, to]);

  const stats = useMemo(() => {
    const total = lines.reduce((s, l) => s + l.shortfall, 0);
    const minTotal = lines.reduce((s, l) => s + l.min_price, 0);
    const belowCost = lines.filter(l => l.buying_price > 0 && l.sold_price < l.buying_price);
    return {
      count: lines.length,
      total,
      avg: lines.length ? total / lines.length : 0,
      pct: minTotal > 0 ? (total / minTotal) * 100 : 0,
      belowCostCount: belowCost.length,
      belowCostLoss: belowCost.reduce((s, l) => s + (l.buying_price - l.sold_price), 0),
    };
  }, [lines]);

  // By day for a short range, by month for a long one.
  const timeline = useMemo(() => {
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    const byMonth = days > 62;
    const m = new Map<string, number>();
    for (const l of lines) {
      const k = byMonth ? l.sold_on.slice(0, 7) : l.sold_on;
      m.set(k, (m.get(k) ?? 0) + l.shortfall);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, shortfall]) => ({ period, shortfall }));
  }, [lines, from, to]);

  const byModel = useMemo(() => groupBy(lines, l => l.device_name), [lines]);
  const byCashier = useMemo(() => groupBy(lines, l => l.cashier ?? ""), [lines]);
  const byReason = useMemo(() => groupBy(lines, l => l.reason.trim()), [lines]);

  const exportExcel = () => exportToExcel(
    `below-minimum-sales_${from}_${to}`,
    "Below-Minimum Sales",
    ["Date", "Invoice", "Device", "Brand", "IMEI", "Cost (Rs.)", "Minimum (Rs.)", "Sold for (Rs.)", "Shortfall (Rs.)", "Reason", "Cashier", "Customer"],
    lines.map(l => [l.sold_on, l.invoice_no, l.device_name, l.brand, l.imei, l.buying_price, l.min_price, l.sold_price, l.shortfall, l.reason, l.cashier ?? "", l.customer]),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>From</label>
        <input type="date" value={from} max={to} onChange={e => { setLoading(true); setFrom(e.target.value); }} style={input} />
        <label style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>To</label>
        <input type="date" value={to} min={from} onChange={e => { setLoading(true); setTo(e.target.value); }} style={input} />
        <button
          onClick={exportExcel}
          disabled={lines.length === 0}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, cursor: lines.length ? "pointer" : "not-allowed", opacity: lines.length ? 1 : 0.5, fontFamily: ff }}
        >
          <Download size={13} /> Excel
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", fontSize: 12.5, color: "#dc2626", fontFamily: ff }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14 }}>
        <Kpi label="Total shortfall" value={rs(stats.total)} sub={`${stats.pct.toFixed(1)}% below the minimum prices`} warn={stats.total > 0} />
        <Kpi label="Devices sold below minimum" value={String(stats.count)} />
        <Kpi label="Average shortfall" value={rs(stats.avg)} sub="per device" />
        <Kpi label="Sold below cost" value={String(stats.belowCostCount)} sub={stats.belowCostCount ? `${rs(stats.belowCostLoss)} under buying price` : "none — every sale covered cost"} warn={stats.belowCostCount > 0} />
      </div>

      {/* Trend */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, fontFamily: ff, color: "var(--text-primary)" }}>Shortfall over time</div>
        {timeline.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "24px 0", textAlign: "center", fontFamily: ff }}>
            {loading ? "Loading…" : "No devices sold below minimum in this period."}
          </div>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={60} />
                <Tooltip formatter={(v) => rs(Number(v))} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="shortfall" name="Shortfall" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14 }}>
        <Breakdown title="By device model" rows={byModel} total={stats.total} />
        <Breakdown title="By cashier" rows={byCashier} total={stats.total} />
        <Breakdown title="By reason" rows={byReason} total={stats.total} />
      </div>

      {/* The account itself */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700, fontFamily: ff, color: "var(--text-primary)" }}>
          Below-Minimum Sales account <span style={{ fontWeight: 500, color: "var(--text-muted)", fontSize: 12 }}>· {lines.length} line{lines.length === 1 ? "" : "s"}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: ff }}>
            <thead>
              <tr>
                <th style={th}>Date</th><th style={th}>Invoice</th><th style={th}>Device</th>
                <th style={{ ...th, textAlign: "right" }}>Minimum</th><th style={{ ...th, textAlign: "right" }}>Sold for</th>
                <th style={{ ...th, textAlign: "right" }}>Shortfall</th><th style={th}>Reason</th><th style={th}>Cashier</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={8} style={{ ...td, textAlign: "center", padding: 32, color: "var(--text-muted)" }}>{loading ? "Loading…" : "Nothing booked to this account in this period."}</td></tr>
              ) : lines.map(l => (
                <tr key={l.id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{l.sold_on}</td>
                  <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{l.invoice_no}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{l.device_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{l.imei}</div>
                    {l.buying_price > 0 && l.sold_price < l.buying_price && (
                      <div style={{ fontSize: 10.5, color: "#dc2626", fontWeight: 700 }}>Below cost ({rs(l.buying_price)})</div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{rs(l.min_price)}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{rs(l.sold_price)}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: "#d97706" }}>{rs(l.shortfall)}</td>
                  <td style={{ ...td, maxWidth: 260 }}>{l.reason}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{l.cashier ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ ...td, fontWeight: 700, borderBottom: "none" }}>Total</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#d97706", borderBottom: "none", whiteSpace: "nowrap" }}>{rs(stats.total)}</td>
                  <td colSpan={2} style={{ ...td, borderBottom: "none" }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
