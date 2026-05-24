"use client";

import { useMemo, useRef } from "react";
import { ShoppingBag, Smartphone, Wrench, MoreHorizontal, TrendingUp, DollarSign, ShoppingCart } from "lucide-react";
import { useSales } from "@/cashier/contexts/SalesContext";
import ExportButtons from "@/cashier/components/shared/ExportButtons";
import { exportToPdf, exportToExcel, exportToPng } from "@/cashier/utils/exportUtils";

const TODAY_LABEL = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const TODAY_ISO   = new Date().toISOString().slice(0, 10);

const CAT_META: Record<string, { icon: any; color: string }> = {
  Accessories: { icon: ShoppingBag,    color: "#60a5fa" },
  Mobile:      { icon: Smartphone,     color: "#a78bfa" },
  Repair:      { icon: Wrench,         color: "#34d399" },
  Others:      { icon: MoreHorizontal, color: "#94a3b8" },
};

function fmtRs(n: number) { return `Rs. ${n.toLocaleString()}`; }

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.round((value / max) * 100)}%`,
        background: color, borderRadius: 3, transition: "width 0.4s ease",
      }} />
    </div>
  );
}

export default function DailySummary() {
  const { sales } = useSales();
  const containerRef = useRef<HTMLDivElement>(null);

  const { CATEGORIES, totals, recent } = useMemo(() => {
    const todaySales = sales.filter(s => s.date === TODAY_ISO && s.status === "Paid");

    const byCategory: Record<string, { transactions: number; revenue: number }> = {
      Accessories: { transactions: 0, revenue: 0 },
      Mobile:      { transactions: 0, revenue: 0 },
      Repair:      { transactions: 0, revenue: 0 },
      Others:      { transactions: 0, revenue: 0 },
    };
    for (const s of todaySales) {
      byCategory[s.category].transactions += 1;
      byCategory[s.category].revenue      += s.total;
    }

    const CATEGORIES = Object.entries(byCategory).map(([name, d]) => ({
      name,
      icon:         CAT_META[name].icon,
      color:        CAT_META[name].color,
      transactions: d.transactions,
      revenue:      d.revenue,
      avgValue:     d.transactions ? Math.round(d.revenue / d.transactions) : 0,
    }));

    const totals = {
      transactions: todaySales.length,
      revenue:      todaySales.reduce((a, s) => a + s.total, 0),
    };

    const recent = [...todaySales].slice(0, 5);

    return { CATEGORIES, totals, recent };
  }, [sales]);

  const avgTx   = totals.transactions ? Math.round(totals.revenue / totals.transactions) : 0;
  const topCat  = [...CATEGORIES].sort((a, b) => b.revenue - a.revenue)[0];
  const maxRev  = Math.max(...CATEGORIES.map(c => c.revenue), 1);

  const summaryCards = [
    { label: "Total Revenue",    value: fmtRs(totals.revenue), icon: DollarSign,   color: "#4ade80", change: "+12%" },
    { label: "Transactions",     value: totals.transactions,   icon: ShoppingCart, color: "#60a5fa", change: "+4" },
    { label: "Avg. Transaction", value: fmtRs(avgTx),         icon: TrendingUp,   color: "#fbbf24", change: "+8%" },
    { label: "Top Category",     value: topCat.name,          icon: topCat.icon,  color: topCat.color, change: fmtRs(topCat.revenue) },
  ];

  const DS_HEADERS = ["Category", "Transactions", "Revenue (Rs.)", "Avg. Value (Rs.)"];
  const dsRows     = () => CATEGORIES.map(c => [c.name, c.transactions, c.revenue, c.avgValue]);
  const dsFilename = `daily-summary-${TODAY_ISO}`;

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Date header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "14px 18px",
      }}>
        <div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Daily Sales Summary</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{TODAY_LABEL}</p>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 20,
          background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80",
        }}>
          Live
        </div>
        <ExportButtons
          onPdf={()   => exportToPdf(`Daily Summary — ${TODAY_ISO}`, DS_HEADERS, dsRows(), dsFilename, "portrait")}
          onExcel={()  => exportToExcel(dsFilename, "Daily Summary", DS_HEADERS, dsRows())}
          onPng={() => { if (containerRef.current) exportToPng(containerRef.current, dsFilename); }}
        />
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "16px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</p>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${card.color}14`, border: `1px solid ${card.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: card.color,
                }}>
                  <Icon size={13} />
                </div>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>{card.value}</p>
              <p style={{ fontSize: 11, color: card.color }}>{card.change} vs yesterday</p>
            </div>
          );
        })}
      </div>

      {/* Category breakdown + Recent transactions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Category breakdown */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Revenue by Category</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const pct  = Math.round((cat.revenue / totals.revenue) * 100);
              return (
                <div key={cat.name}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: `${cat.color}14`, border: `1px solid ${cat.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center", color: cat.color, flexShrink: 0,
                    }}>
                      <Icon size={13} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{cat.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cat.color }}>{fmtRs(cat.revenue)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <MiniBar value={cat.revenue} max={maxRev} color={cat.color} />
                        <span style={{ fontSize: 10.5, color: "var(--text-muted)", minWidth: 30, textAlign: "right" }}>{pct}%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, paddingLeft: 38 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{cat.transactions} txns</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Avg {fmtRs(cat.avgValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent transactions */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Recent Transactions</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recent.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No sales recorded today yet.</p>
            )}
            {recent.map((tx, i) => {
              const catColor = CAT_META[tx.category]?.color ?? "#94a3b8";
              return (
                <div key={tx.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 9,
                  background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)",
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%", background: catColor, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{tx.customer}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{fmtRs(tx.total)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{tx.invoiceNo}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{tx.category}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals row */}
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{totals.transactions} transactions today</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{fmtRs(totals.revenue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
