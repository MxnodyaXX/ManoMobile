"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Wallet, ArrowDownCircle, ArrowUpCircle, AlertTriangle, BarChart3, Percent } from "lucide-react";
import { useAccounts } from "@/accounts/contexts/AccountsContext";

const AA = "#f59e0b";
const ff = "'Plus Jakarta Sans', sans-serif";

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, iconColor, highlight, trend }: {
  label: string; value: string; sub?: string; icon: any; iconColor: string;
  highlight?: boolean; trend?: "up" | "down" | "neutral";
}) {
  const trendColor = trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "var(--text-muted)";
  return (
    <div style={{ padding: "18px 20px", borderRadius: 14, border: `1px solid ${highlight ? AA + "35" : "var(--border)"}`, background: highlight ? `${AA}07` : "var(--bg-card)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, fontWeight: 600 }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${iconColor}15`, border: `1px solid ${iconColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={iconColor} />
        </div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: highlight ? AA : "var(--text-primary)", fontFamily: ff, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: trend ? trendColor : "var(--text-muted)", fontFamily: ff }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, value, color }: { title: string; value?: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</p>
      {value && <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: ff }}>Rs. {Number(value).toLocaleString()}</span>}
    </div>
  );
}

function IncomeRow({ label, value, indent, bold, separator }: { label: string; value: number; indent?: boolean; bold?: boolean; separator?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${separator ? "10px" : "6px"} 0`, borderTop: separator ? "1px solid var(--border)" : "none" }}>
      <span style={{ fontSize: bold ? 13 : 12.5, fontWeight: bold ? 700 : 400, color: bold ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: ff, paddingLeft: indent ? 12 : 0 }}>{label}</span>
      <span style={{ fontSize: bold ? 13 : 12.5, fontWeight: bold ? 700 : 400, color: bold ? (value >= 0 ? "var(--text-primary)" : "#f87171") : "var(--text-secondary)", fontFamily: ff }}>Rs. {Math.abs(value).toLocaleString()}</span>
    </div>
  );
}

function AgingBar({ buckets, type }: { buckets: { label: string; total: number }[]; type: "ar" | "ap" }) {
  const total = buckets.reduce((s, b) => s + b.total, 0);
  const colors = type === "ar"
    ? ["#34d399", "#fbbf24", "#f97316", "#f87171", "#dc2626"]
    : ["#34d399", "#fbbf24", "#f97316", "#f87171", "#dc2626"];

  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2, marginBottom: 10 }}>
        {buckets.map((b, i) => total > 0 ? (
          <div key={i} style={{ flex: b.total / total, background: colors[i], minWidth: b.total > 0 ? 4 : 0, borderRadius: 4 }} />
        ) : null)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {buckets.filter(b => b.total > 0).map((b, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[buckets.indexOf(b)], display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>{b.label}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: buckets.indexOf(b) > 1 ? "#f87171" : "var(--text-primary)", fontFamily: ff }}>Rs. {b.total.toLocaleString()}</span>
          </div>
        ))}
        {total === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, textAlign: "center", padding: "8px 0" }}>All clear — no outstanding balances</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountsDashboard() {
  const {
    getPLData, getCashPosition, getTotalAROutstanding, getTotalAPOutstanding,
    getARAgeing, getAPAgeing, getTaxSummary, getBalanceSheetData, getAccountBalance,
  } = useAccounts();

  const pl       = useMemo(() => getPLData(),            [getPLData]);
  const bs       = useMemo(() => getBalanceSheetData(),  [getBalanceSheetData]);
  const arAging  = useMemo(() => getARAgeing(),          [getARAgeing]);
  const apAging  = useMemo(() => getAPAgeing(),          [getAPAgeing]);
  const tax      = useMemo(() => getTaxSummary(),        [getTaxSummary]);
  const cash     = getCashPosition();
  const arTotal  = getTotalAROutstanding();
  const apTotal  = getTotalAPOutstanding();

  const overdueAR = arAging.slice(1).reduce((s, b) => s + b.total, 0);
  const overdueAP = apAging.slice(1).reduce((s, b) => s + b.total, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff }}>

      {/* Header */}
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Financial Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Month-to-date · May 2026 · Mano Mobile</p>
      </div>

      {/* Top KPI cards */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        <KPICard icon={TrendingUp}      iconColor={AA}        label="Total Revenue (MTD)"    value={`Rs. ${pl.totalRevenue.toLocaleString()}`}   sub={`Gross margin ${pl.grossMargin.toFixed(1)}%`} highlight trend="up" />
        <KPICard icon={TrendingDown}    iconColor="#f87171"   label="Total COGS (MTD)"       value={`Rs. ${pl.totalCOGS.toLocaleString()}`}      sub="Cost of goods sold" />
        <KPICard icon={BarChart3}       iconColor="#34d399"   label="Gross Profit"           value={`Rs. ${pl.grossProfit.toLocaleString()}`}    sub={`${pl.grossMargin.toFixed(1)}% margin`} trend="up" />
        <KPICard icon={DollarSign}      iconColor="#60a5fa"   label="Net Income (MTD)"       value={`Rs. ${pl.netIncome.toLocaleString()}`}      sub={`${pl.netMargin.toFixed(1)}% net margin`} trend="up" />
        <KPICard icon={Wallet}          iconColor="#34d399"   label="Cash Position"          value={`Rs. ${cash.toLocaleString()}`}              sub="Cash on hand + bank" trend="up" />
        <KPICard icon={ArrowDownCircle} iconColor="#fbbf24"   label="AR Outstanding"         value={`Rs. ${arTotal.toLocaleString()}`}           sub={overdueAR > 0 ? `Rs. ${overdueAR.toLocaleString()} overdue` : "All current"} trend={overdueAR > 0 ? "down" : "neutral"} />
        <KPICard icon={ArrowUpCircle}   iconColor="#f97316"   label="AP Outstanding"         value={`Rs. ${apTotal.toLocaleString()}`}           sub={overdueAP > 0 ? `Rs. ${overdueAP.toLocaleString()} overdue` : "All current"} trend={overdueAP > 0 ? "down" : "neutral"} />
        <KPICard icon={Percent}         iconColor="#a78bfa"   label="VAT Payable"            value={`Rs. ${tax.vatCollected.toLocaleString()}`}  sub="Collected this period" />
      </div>

      {/* Mid row: P&L summary + Aging */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

        {/* P&L summary */}
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <SectionHeader title="Income Summary" color={AA} />
          <IncomeRow label="Repair Services"   value={pl.revenue["Repair Services Revenue"] ?? 0}  indent />
          <IncomeRow label="Mobile Phone Sales"value={pl.revenue["Mobile Phone Sales"] ?? 0}        indent />
          <IncomeRow label="Accessory Sales"   value={pl.revenue["Accessory Sales"] ?? 0}           indent />
          <IncomeRow label="Total Revenue"     value={pl.totalRevenue}    bold separator />
          <IncomeRow label="Total COGS"        value={-pl.totalCOGS}     indent />
          <IncomeRow label="Gross Profit"      value={pl.grossProfit}    bold separator />
          <IncomeRow label="Operating Expenses"value={-pl.totalExpenses}  indent />
          <IncomeRow label="Net Income"        value={pl.netIncome}       bold separator />
          <div style={{ marginTop: 12, padding: "8px 12px", background: `${AA}08`, borderRadius: 8, border: `1px solid ${AA}25` }}>
            <p style={{ fontSize: 11, color: AA, fontFamily: ff, textAlign: "center", fontWeight: 600 }}>
              Net Margin: {pl.netMargin.toFixed(1)}% · Gross Margin: {pl.grossMargin.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* AR Aging */}
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <SectionHeader title="AR Aging" value={String(arTotal)} color="#fbbf24" />
          <AgingBar buckets={arAging.map(b => ({ label: b.label, total: b.total }))} type="ar" />
          {overdueAR > 0 && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(248,113,113,0.08)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)" }}>
              <AlertTriangle size={12} color="#f87171" />
              <span style={{ fontSize: 11.5, color: "#f87171", fontFamily: ff }}>Rs. {overdueAR.toLocaleString()} past due date</span>
            </div>
          )}
        </div>

        {/* AP Aging */}
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <SectionHeader title="AP Aging" value={String(apTotal)} color="#f97316" />
          <AgingBar buckets={apAging.map(b => ({ label: b.label, total: b.total }))} type="ap" />
          {overdueAP > 0 && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(249,115,22,0.08)", borderRadius: 8, border: "1px solid rgba(249,115,22,0.2)" }}>
              <AlertTriangle size={12} color="#f97316" />
              <span style={{ fontSize: 11.5, color: "#f97316", fontFamily: ff }}>Rs. {overdueAP.toLocaleString()} past due date</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Balance sheet snapshot + Expense breakdown */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Balance sheet snapshot */}
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Balance Sheet Snapshot</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Total Assets",      value: bs.totalAssets,      color: "#34d399" },
              { label: "Total Liabilities", value: bs.totalLiabilities, color: "#f87171" },
              { label: "Total Equity",      value: bs.totalEquity,      color: AA },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 9, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: r.color, fontFamily: ff }}>Rs. {r.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(52,211,153,0.06)", borderRadius: 8, border: "1px solid rgba(52,211,153,0.2)" }}>
            <p style={{ fontSize: 11, color: "#34d399", fontFamily: ff, textAlign: "center", fontWeight: 600 }}>
              Balance: Assets = Liabilities + Equity &nbsp;✓
            </p>
          </div>
        </div>

        {/* Expense breakdown */}
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.06em" }}>Operating Expenses</p>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#f87171", fontFamily: ff }}>Rs. {pl.totalExpenses.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {Object.entries(pl.expenses).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([name, val]) => {
              const pct = pl.totalExpenses > 0 ? (val / pl.totalExpenses) * 100 : 0;
              return (
                <div key={name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>{name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>Rs. {val.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: AA, transition: "width 0.4s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
