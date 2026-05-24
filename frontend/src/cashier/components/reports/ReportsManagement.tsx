"use client";

import { useState, useRef } from "react";
import {
  ShoppingCart, Wrench, Calendar,
  TrendingUp, TrendingDown, DollarSign,
  FileText, Package, ChevronDown, Smartphone, ShoppingBag, MoreHorizontal,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  ComposedChart, Line, LineChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import ExportButtons from "@/cashier/components/shared/ExportButtons";
import { exportToExcel, exportToPng, exportMultiSectionToExcel, exportReportToPdf } from "@/cashier/utils/exportUtils";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

type ReportTab = "Daily Report" | "Sales Report" | "Repair Report" | "P&L Report" | "Stock Valuation" | "Cashier Performance" | "Supplier Report" | "Credit Aging" | "Repair SLA";

const tabs: { id: ReportTab; icon: any; label: string }[] = [
  { id: "Daily Report",        icon: Calendar,     label: "Daily" },
  { id: "Sales Report",        icon: ShoppingCart, label: "Sales" },
  { id: "Repair Report",       icon: Wrench,       label: "Repair" },
  { id: "P&L Report",          icon: TrendingUp,   label: "P&L" },
  { id: "Stock Valuation",     icon: Package,      label: "Stock Value" },
  { id: "Cashier Performance", icon: DollarSign,   label: "Cashier" },
  { id: "Supplier Report",     icon: FileText,     label: "Supplier" },
  { id: "Credit Aging",        icon: TrendingDown, label: "Credit Aging" },
  { id: "Repair SLA",          icon: Smartphone,   label: "Repair SLA" },
];

const tabDescriptions: Record<ReportTab, string> = {
  "Daily Report":        "Full-day revenue, transaction count, and cash reconciliation",
  "Sales Report":        "Sales breakdown by category, product, and customer",
  "Repair Report":       "Repair job statistics, technician performance, and parts usage",
  "P&L Report":          "Profit & Loss — revenue vs COGS vs gross profit by category",
  "Stock Valuation":     "Current inventory value at cost and selling price",
  "Cashier Performance": "Sales and transaction count broken down by cashier",
  "Supplier Report":     "Purchases, delivery time, and spend per supplier",
  "Credit Aging":        "Outstanding credit balances aged by 30 / 60 / 90+ day buckets",
  "Repair SLA":          "Repair job turnaround time and SLA performance by technician",
};

function fmtRs(n: number) { return `Rs. ${n.toLocaleString()}`; }

const tooltipStyle: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)",
  borderRadius: 10, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif",
  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
};
const ff = "'Plus Jakarta Sans', sans-serif";

type FilterProps = {
  dateFrom: string; dateTo: string;
  setDateFrom: (v: string) => void; setDateTo: (v: string) => void;
};

/* ── Shared filter bar ── */
function ReportFilters({
  dateFrom, dateTo, setDateFrom, setDateTo, actions,
}: FilterProps & { actions?: React.ReactNode }) {
  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "nowrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Calendar size={13} style={{ color: "var(--text-muted)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>From</span>
      </div>
      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: 145 }} />
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
      <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ ...inputStyle, width: 145 }} />
      {actions && <div style={{ marginLeft: "auto" }}>{actions}</div>}
    </div>
  );
}

/* ── Daily Report ── */
function DailyReport({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const categoryData = [
    { name: "Mobile",      revenue: 85000, transactions: 3  },
    { name: "Accessories", revenue: 16400, transactions: 9  },
    { name: "Repair",      revenue: 43800, transactions: 11 },
    { name: "Others",      revenue: 5400,  transactions: 4  },
  ];

  const hourlyData = [
    { time: "9 AM",  revenue: 8200  },
    { time: "10 AM", revenue: 14500 },
    { time: "11 AM", revenue: 22800 },
    { time: "12 PM", revenue: 18900 },
    { time: "1 PM",  revenue: 31200 },
    { time: "2 PM",  revenue: 28400 },
    { time: "3 PM",  revenue: 19600 },
    { time: "4 PM",  revenue: 24100 },
    { time: "5 PM",  revenue: 13500 },
  ];

  const comparisonData = [
    { time: "9 AM",  today: 8200,  yesterday: 6400  },
    { time: "10 AM", today: 14500, yesterday: 11200 },
    { time: "11 AM", today: 22800, yesterday: 19500 },
    { time: "12 PM", today: 18900, yesterday: 16200 },
    { time: "1 PM",  today: 31200, yesterday: 24800 },
    { time: "2 PM",  today: 28400, yesterday: 22100 },
    { time: "3 PM",  today: 19600, yesterday: 17300 },
    { time: "4 PM",  today: 24100, yesterday: 19600 },
    { time: "5 PM",  today: 13500, yesterday: 11800 },
  ];

  const cashFlowData = [
    { label: "Opening", cashIn: 5000,  cashOut: 0,    running: 5000   },
    { label: "Sales",   cashIn: 58200, cashOut: 0,    running: 63200  },
    { label: "Repairs", cashIn: 43800, cashOut: 0,    running: 107000 },
    { label: "Refunds", cashIn: 0,     cashOut: 2100, running: 104900 },
    { label: "Petty",   cashIn: 0,     cashOut: 1500, running: 103400 },
  ];

  const cashRows = [
    { label: "Opening Float",        amount: 5000,   type: "neutral" as const },
    { label: "Cash Sales",           amount: 58200,  type: "in" as const },
    { label: "Cash Repair Payments", amount: 43800,  type: "in" as const },
    { label: "Cash Refunds Issued",  amount: -2100,  type: "out" as const },
    { label: "Petty Cash Withdrawn", amount: -1500,  type: "out" as const },
    { label: "Expected Closing",     amount: 103400, type: "neutral" as const },
    { label: "Actual Closing",       amount: 103200, type: "neutral" as const },
  ];

  const variance: number = -200;
  const totalRevenue = 181200;
  const paymentMethods = [
    { method: "Cash",          amount: 102000, pct: 56, color: "#4ade80" },
    { method: "Card",          amount: 54600,  pct: 30, color: "#60a5fa" },
    { method: "Bank Transfer", amount: 24600,  pct: 14, color: "#a78bfa" },
  ];
  const drFilename = `daily-report-${dateFrom}`;

  const buildSections = () => [
    {
      title: "Summary",
      headers: ["Metric", "Value", "Note"],
      rows: [
        ["Total Revenue",  "Rs. 181,200", "All payment methods"],
        ["Transactions",   "27",          "Paid & collected"],
        ["Cash Collected", "Rs. 102,000", "Physical cash in drawer"],
        ["Cash Variance",  "Rs. -200",    variance < 0 ? "⚠ Shortfall — investigate" : "✓ Balanced"],
        ["Period",         dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`, "Report date range"],
      ],
    },
    {
      title: "Revenue by Category",
      headers: ["Category", "Revenue (Rs.)", "Transactions"],
      rows: categoryData.map(c => [c.name, c.revenue.toLocaleString(), c.transactions]),
    },
    {
      title: "Cash Reconciliation",
      headers: ["Description", "Amount (Rs.)", "Flow"],
      rows: cashRows.map(r => [
        r.label,
        r.amount < 0 ? `-${Math.abs(r.amount).toLocaleString()}` : r.amount.toLocaleString(),
        r.type === "in" ? "Cash In" : r.type === "out" ? "Cash Out" : "—",
      ]),
    },
    {
      title: "Payment Method Breakdown",
      headers: ["Payment Method", "Amount (Rs.)", "% of Total"],
      rows: paymentMethods.map(p => [p.method, p.amount.toLocaleString(), `${p.pct}%`]),
    },
  ];

  const statCards = [
    { label: "Total Revenue",  value: fmtRs(totalRevenue), change: "+12.4%", sub: "vs yesterday", pos: true  },
    { label: "Transactions",   value: "27",                change: "+4",      sub: "vs yesterday", pos: true  },
    { label: "Cash Collected", value: fmtRs(102000),       change: "56%",     sub: "of total",     pos: true  },
    { label: "Cash Variance",  value: fmtRs(Math.abs(variance)), change: variance < 0 ? "Shortfall" : "Balanced", sub: "expected vs actual", pos: variance >= 0 },
  ];
  const statIcons  = [DollarSign, FileText, DollarSign, variance < 0 ? TrendingDown : TrendingUp];
  const statColors = ["#4ade80", "#60a5fa", "#fbbf24", variance < 0 ? "#f87171" : "#4ade80"];

  const topItemsToday = [
    { item: "Samsung A15",    category: "Mobile",      revenue: 62500 },
    { item: "Redmi Note 13",  category: "Mobile",      revenue: 38000 },
    { item: "iPhone Screen",  category: "Repair",      revenue: 9500  },
    { item: "Type-C Charger", category: "Accessories", revenue: 5200  },
    { item: "Screen Prot.",   category: "Accessories", revenue: 4200  },
  ];
  const itemCatColors: Record<string, string> = {
    Mobile: "#a78bfa", Repair: "#34d399", Accessories: "#60a5fa", Others: "#94a3b8",
  };

  const customerData = [
    { type: "Returning",   count: 18, pct: 67, color: "#6355ff" },
    { type: "New Walk-in", count: 9,  pct: 33, color: "#60a5fa" },
  ];

  const txnVolumeData = [
    { time: "9 AM",  txn: 2 }, { time: "10 AM", txn: 4 },
    { time: "11 AM", txn: 6 }, { time: "12 PM", txn: 3 },
    { time: "1 PM",  txn: 8 }, { time: "2 PM",  txn: 5 },
    { time: "3 PM",  txn: 3 }, { time: "4 PM",  txn: 6 },
    { time: "5 PM",  txn: 2 },
  ];

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Single-date selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Calendar size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setDateTo(e.target.value); }}
          style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "7px 11px", fontSize: 12.5,
            color: "var(--text-primary)", fontFamily: ff, outline: "none",
            colorScheme: "dark", width: 145,
          }}
        />
        <div style={{ marginLeft: "auto" }}>
          <ExportButtons
            onPdf={() => {
              if (!containerRef.current) return;
              const charts = Array.from(containerRef.current.querySelectorAll("[data-pdf-chart]"))
                .filter(el => (el as HTMLElement).getBoundingClientRect().height > 0)
                .map(el => ({ title: el.getAttribute("data-pdf-chart") as string, element: el as HTMLElement }));
              return exportReportToPdf(`Daily Report — ${dateFrom}`, buildSections(), charts, drFilename);
            }}
            onExcel={() => exportMultiSectionToExcel(drFilename, buildSections())}
onPng={() => {
  if (!containerRef.current) return;
  return exportToPng(containerRef.current, drFilename);
}}          />
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {statCards.map((c, i) => {
          const Icon = statIcons[i];
          const color = statColors[i];
          return (
            <div key={c.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: ff }}>{c.label}</p>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}14`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                  <Icon size={14} />
                </div>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 8, fontFamily: ff }}>{c.value}</p>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: c.pos ? "#4ade80" : "#f87171", fontFamily: ff }}>
                {c.change} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{c.sub}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Revenue by Category BarChart + Payment Split Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
        <div data-pdf-chart="Revenue by Category" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18, fontFamily: ff }}>Revenue by Category</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="txn" orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(99,91,255,0.06)" }}
                formatter={(val, name) => name === "revenue" ? [`Rs. ${(val as number).toLocaleString()}`, "Revenue"] : [val, "Transactions"]}
              />
              <Legend wrapperStyle={{ fontSize: 11.5, fontFamily: ff, paddingTop: 10 }} formatter={v => v === "revenue" ? "Revenue" : "Transactions"} />
              <Bar yAxisId="rev" dataKey="revenue"      fill="#6355ff" radius={[5, 5, 0, 0]} />
              <Bar yAxisId="txn" dataKey="transactions" fill="#60a5fa" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Split Donut */}
        <div data-pdf-chart="Payment Split" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Payment Split</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontFamily: ff }}>Revenue by payment method</p>
          <ResponsiveContainer width="100%" height={155}>
            <PieChart>
              <Pie data={paymentMethods} dataKey="amount" nameKey="method" cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3}>
                {paymentMethods.map((pm, i) => <Cell key={i} fill={pm.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`Rs. ${(val as number).toLocaleString()}`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 6 }}>
            {paymentMethods.map(pm => (
              <div key={pm.method} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: pm.color, display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{pm.method}</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{pm.pct}%</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{fmtRs(pm.amount)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Total</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", fontFamily: ff }}>{fmtRs(totalRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Today vs Yesterday LineChart + Cash Flow ComposedChart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Today vs Yesterday */}
        <div data-pdf-chart="Today vs Yesterday" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Today vs Yesterday</p>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 16, height: 2.5, background: "#6355ff", display: "inline-block", borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Today</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 16, height: 2, background: "#94a3b8", display: "inline-block", borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Yesterday</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={comparisonData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={54} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(val, name) => [`Rs. ${(val as number).toLocaleString()}`, name === "today" ? "Today" : "Yesterday"]}
              />
              <Line dataKey="today"     stroke="#6355ff" strokeWidth={2.5} dot={{ r: 3, fill: "#6355ff", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              <Line dataKey="yesterday" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="5 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cash Flow ComposedChart */}
        <div data-pdf-chart="Cash Flow" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Cash Flow</p>
            <div style={{ display: "flex", gap: 12 }}>
              {[["#4ade80", "In"], ["#f87171", "Out"], ["#60a5fa", "Running"]].map(([color, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: label === "Running" ? 16 : 10, height: label === "Running" ? 2 : 10, borderRadius: label === "Running" ? 2 : 2, background: color, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={cashFlowData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="cash" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={54} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="run"  orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={54} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(val, name) => [`Rs. ${(val as number).toLocaleString()}`, name === "cashIn" ? "Cash In" : name === "cashOut" ? "Cash Out" : "Running Total"]}
              />
              <Bar yAxisId="cash" dataKey="cashIn"  fill="#4ade80" stackId="flow" radius={[0, 0, 0, 0]} />
              <Bar yAxisId="cash" dataKey="cashOut" fill="#f87171" stackId="flow" radius={[4, 4, 0, 0]} />
              <Line yAxisId="run" dataKey="running" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hourly Revenue Trend */}
      <div data-pdf-chart="Hourly Revenue Trend" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Hourly Revenue Trend</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>Revenue</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={hourlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="drRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`Rs. ${(val as number).toLocaleString()}`, "Revenue"]} />
            <Area type="monotone" dataKey="revenue" stroke="#4ade80" strokeWidth={2.5} fill="url(#drRevGrad)" dot={false} activeDot={{ r: 5, fill: "#4ade80", strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top Items Sold Today + Customer Type */}
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>

        <div data-pdf-chart="Top Items Sold Today" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18, fontFamily: ff }}>Top Items Sold Today</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={topItemsToday} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="item" width={112} tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`Rs. ${(val as number).toLocaleString()}`, "Revenue"]} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={20}>
                {topItemsToday.map((item, i) => <Cell key={i} fill={itemCatColors[item.category] ?? "#94a3b8"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div data-pdf-chart="Customer Type" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Customer Type</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontFamily: ff }}>Returning vs new walk-ins</p>
          <ResponsiveContainer width="100%" height={145}>
            <PieChart>
              <Pie data={customerData} dataKey="pct" nameKey="type" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={4}>
                {customerData.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`${val}%`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {customerData.map(c => (
              <div key={c.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{c.type}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{c.count} customers</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{c.pct}%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Total Today</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>27 customers</span>
          </div>
        </div>
      </div>

      {/* Transaction Volume by Hour */}
      <div data-pdf-chart="Transaction Volume by Hour" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Transaction Volume by Hour</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontFamily: ff }}>Number of transactions per hour today</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#fbbf24", display: "inline-block" }} />
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>Transactions</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={txnVolumeData} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(val) => [val, "Transactions"]} />
            <Bar dataKey="txn" fill="#fbbf24" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cash Reconciliation Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Cash Reconciliation</p>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
          {cashRows.map((row, i) => {
            const color = row.type === "in" ? "#4ade80" : row.type === "out" ? "#f87171" : "var(--text-primary)";
            const isLast = i === cashRows.length - 1;
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: 9, marginTop: isLast ? 6 : 0,
                background: isLast ? "var(--accent-dim)" : i % 2 === 0 ? "transparent" : "var(--bg-secondary)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {row.type !== "neutral" && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, color, background: `${color}18`, border: `1px solid ${color}35`, fontFamily: ff }}>
                      {row.type === "in" ? "IN" : "OUT"}
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: isLast ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isLast ? 700 : 400, fontFamily: ff }}>{row.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: isLast ? 800 : 600, color, fontFamily: ff }}>
                  {row.amount < 0 ? `-${fmtRs(Math.abs(row.amount))}` : fmtRs(row.amount)}
                </span>
              </div>
            );
          })}
        </div>
        {variance !== 0 && (
          <div style={{ margin: "0 14px 14px", padding: "10px 14px", borderRadius: 9, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
            <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600, fontFamily: ff }}>
              Variance of {fmtRs(Math.abs(variance))} — investigate before closing shift.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

/* ── Sales Report ── */
function SalesReport({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const products = [
    { name: "Samsung A15",    category: "Mobile",      qty: 2,  revenue: 85000 },
    { name: "Redmi Note 13",  category: "Mobile",      qty: 1,  revenue: 38000 },
    { name: "Type-C Charger", category: "Accessories", qty: 8,  revenue: 5200  },
    { name: "Screen Prot.",   category: "Accessories", qty: 12, revenue: 4200  },
    { name: "Memory Card",    category: "Others",      qty: 3,  revenue: 4800  },
    { name: "Photocopy",      category: "Others",      qty: 40, revenue: 600   },
  ];

  const categoryData = [
    { name: "Mobile",      revenue: 123000, transactions: 3  },
    { name: "Accessories", revenue: 9400,   transactions: 20 },
    { name: "Repair",      revenue: 43800,  transactions: 11 },
    { name: "Others",      revenue: 5400,   transactions: 5  },
  ];

  const trendData = [
    { day: "Mon", revenue: 18200 },
    { day: "Tue", revenue: 34500 },
    { day: "Wed", revenue: 28900 },
    { day: "Thu", revenue: 45200 },
    { day: "Fri", revenue: 52100 },
    { day: "Sat", revenue: 67800 },
    { day: "Sun", revenue: 23400 },
  ];

  const catColors: Record<string, string> = {
    Mobile: "#a78bfa", Accessories: "#60a5fa", Repair: "#34d399", Others: "#94a3b8",
  };

  const statCards = [
    { label: "Total Revenue",    value: "Rs. 181,600", change: "+12.4%", sub: "vs yesterday", pos: true },
    { label: "Transactions",     value: "39",           change: "+8.2%",  sub: "vs yesterday", pos: true },
    { label: "Avg. Order Value", value: "Rs. 4,656",   change: "+3.8%",  sub: "vs yesterday", pos: true },
  ];

  const SR_HEADERS = ["Product", "Category", "Qty Sold", "Revenue (Rs.)"];
  const srRows     = () => products.map(r => [r.name, r.category, r.qty, r.revenue]);
  const srFilename = `sales-report-${new Date().toISOString().slice(0, 10)}`;
  const totalRevSR = categoryData.reduce((a, c) => a + c.revenue, 0);

  const brandData = [
    { brand: "Samsung", revenue: 95000, units: 8  },
    { brand: "Apple",   revenue: 72000, units: 3  },
    { brand: "Oppo",    revenue: 38000, units: 5  },
    { brand: "Redmi",   revenue: 21000, units: 4  },
    { brand: "Others",  revenue: 9000,  units: 6  },
  ];
  const brandColors = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#94a3b8"];

  const supplierData = [
    { name: "TechBridge PVT", revenue: 87000, items: 12, pct: 48, color: "#6355ff" },
    { name: "Mobile Hub LK",  revenue: 54000, items: 8,  pct: 30, color: "#60a5fa" },
    { name: "Lanka Dist.",    revenue: 28000, items: 6,  pct: 15, color: "#34d399" },
    { name: "Direct Import",  revenue: 12600, items: 3,  pct: 7,  color: "#fbbf24" },
  ];

  const [openAccs, setOpenAccs] = useState<Set<string>>(new Set(["Mobile"]));
  const toggleAcc = (id: string) =>
    setOpenAccs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const mobileItems = [
    { model: "Samsung A15",   brand: "Samsung", units: 5, unitPrice: 12500, revenue: 62500 },
    { model: "iPhone 14",     brand: "Apple",   units: 2, unitPrice: 18750, revenue: 37500 },
    { model: "Redmi Note 13", brand: "Redmi",   units: 1, unitPrice: 15000, revenue: 15000 },
    { model: "Oppo A57",      brand: "Oppo",    units: 1, unitPrice: 8000,  revenue: 8000  },
  ];
  const mobileTotal = mobileItems.reduce((a, b) => a + b.revenue, 0);

  const accessoryItems = [
    { item: "Type-C Charger", units: 8,  unitPrice: 450, revenue: 3600 },
    { item: "Screen Prot.",   units: 12, unitPrice: 200, revenue: 2400 },
    { item: "Earphones",      units: 5,  unitPrice: 600, revenue: 3000 },
    { item: "Phone Case",     units: 5,  unitPrice: 80,  revenue: 400  },
  ];
  const accessoryTotal = accessoryItems.reduce((a, b) => a + b.revenue, 0);

  const repairItems = [
    { type: "Screen Replacement",  jobs: 5, avgCharge: 5000, parts: 11000, labor: 14000, revenue: 25000 },
    { type: "Battery Replacement", jobs: 3, avgCharge: 3800, parts: 4500,  labor: 6900,  revenue: 11400 },
    { type: "Charging Port",       jobs: 2, avgCharge: 3600, parts: 1600,  labor: 5600,  revenue: 7200  },
    { type: "Water Damage",        jobs: 1, avgCharge: 200,  parts: 100,   labor: 100,   revenue: 200   },
  ];
  const repairTotal = repairItems.reduce((a, b) => a + b.revenue, 0);

  const otherItems = [
    { service: "Memory Card",     units: 3,  unitPrice: 1200, revenue: 3600 },
    { service: "SIM Replacement", units: 2,  unitPrice: 700,  revenue: 1400 },
    { service: "Photocopy",       units: 40, unitPrice: 10,   revenue: 400  },
  ];
  const otherTotal = otherItems.reduce((a, b) => a + b.revenue, 0);

  const brandBarData = [
    { brand: "Samsung", revenue: 62500, profit: 18750 },
    { brand: "Apple",   revenue: 37500, profit: 11250 },
    { brand: "Redmi",   revenue: 15000, profit: 4200  },
    { brand: "Oppo",    revenue: 8000,  profit: 2080  },
  ];
  const mobileTotalProfit = brandBarData.reduce((a, b) => a + b.profit, 0);
  const mobileBrandColors = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24"];
  const brandTooltipData: Record<string, { topItem: string; topItemUnits: number; topItemRevenue: number; topItemProfit: number }> = {
    Samsung: { topItem: "Samsung A15",   topItemUnits: 5, topItemRevenue: 62500, topItemProfit: 18750 },
    Apple:   { topItem: "iPhone 14",     topItemUnits: 2, topItemRevenue: 37500, topItemProfit: 11250 },
    Redmi:   { topItem: "Redmi Note 13", topItemUnits: 1, topItemRevenue: 15000, topItemProfit: 4200  },
    Oppo:    { topItem: "Oppo A57",      topItemUnits: 1, topItemRevenue: 8000,  topItemProfit: 2080  },
  };
  const BrandTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = brandTooltipData[label as string];
    return (
      <div style={{ ...tooltipStyle, padding: "14px 16px", minWidth: 230 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, fontFamily: ff }}>{label}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Brand Revenue</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", fontFamily: ff }}>Rs. {(payload[0].value as number).toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Profit Est.</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", fontFamily: ff }}>Rs. {payload[0].payload.profit.toLocaleString()}</span>
          </div>
        </div>
        {d && (
          <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 7, fontFamily: ff }}>Top Selling Model</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, fontFamily: ff }}>{d.topItem}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[["Units Sold", String(d.topItemUnits) + " units", "var(--text-secondary)"], ["Revenue", "Rs. " + d.topItemRevenue.toLocaleString(), "#a78bfa"], ["Profit Est.", "Rs. " + d.topItemProfit.toLocaleString(), "#4ade80"]].map(([k, v, c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{k}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: c, fontFamily: ff }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const accItemLabels: Record<string, string> = { TypeC: "Type-C Charger", ScreenProt: "Screen Prot.", Earphones: "Earphones", PhoneCase: "Phone Case" };
  const accTrendData = [
    { day: "Mon", TypeC: 900,  ScreenProt: 400, Earphones: 600,  PhoneCase: 80  },
    { day: "Tue", TypeC: 450,  ScreenProt: 600, Earphones: 1200, PhoneCase: 160 },
    { day: "Wed", TypeC: 900,  ScreenProt: 400, Earphones: 600,  PhoneCase: 0   },
    { day: "Thu", TypeC: 450,  ScreenProt: 400, Earphones: 600,  PhoneCase: 80  },
    { day: "Fri", TypeC: 450,  ScreenProt: 200, Earphones: 0,    PhoneCase: 80  },
    { day: "Sat", TypeC: 450,  ScreenProt: 200, Earphones: 0,    PhoneCase: 0   },
    { day: "Sun", TypeC: 0,    ScreenProt: 200, Earphones: 0,    PhoneCase: 0   },
  ];
  const accSupplierData = [
    { supplier: "Lanka Accessories", pct: 55, color: "#60a5fa" },
    { supplier: "TechBridge PVT",    pct: 30, color: "#a78bfa" },
    { supplier: "Direct Import",     pct: 15, color: "#34d399" },
  ];

  const repairFaultData = repairItems.map(r => ({ fault: r.type, count: r.jobs }));
  const repairFaultColors = ["#6355ff", "#60a5fa", "#34d399", "#fbbf24"];
  const repairBrandFreqData = [
    { brand: "Samsung", count: 5 },
    { brand: "Apple",   count: 3 },
    { brand: "Oppo",    count: 2 },
    { brand: "Redmi",   count: 1 },
  ];
  const repairBrandColors2 = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24"];
  const repairBrandModels: Record<string, Array<{ model: string; parts: number; labor: number; revenue: number; profit: number }>> = {
    Samsung: [
      { model: "Galaxy A32", parts: 3800, labor: 5200, revenue: 9000,  profit: 5200 },
      { model: "Galaxy M14", parts: 2200, labor: 3100, revenue: 5300,  profit: 3100 },
      { model: "Galaxy A15", parts: 1800, labor: 2400, revenue: 4200,  profit: 2400 },
      { model: "Galaxy S21", parts: 5500, labor: 4500, revenue: 10000, profit: 4500 },
      { model: "Galaxy A13", parts: 900,  labor: 1500, revenue: 2400,  profit: 1500 },
    ],
    Apple: [
      { model: "iPhone 13",  parts: 9500, labor: 8000, revenue: 17500, profit: 8000 },
      { model: "iPhone SE",  parts: 6000, labor: 6000, revenue: 12000, profit: 6000 },
      { model: "iPhone 12",  parts: 7500, labor: 6500, revenue: 14000, profit: 6500 },
    ],
    Oppo:  [
      { model: "Oppo A57",   parts: 2800, labor: 3200, revenue: 6000,  profit: 3200 },
      { model: "Oppo A17",   parts: 1800, labor: 2200, revenue: 4000,  profit: 2200 },
    ],
    Redmi: [
      { model: "Redmi 9C",   parts: 3200, labor: 3300, revenue: 6500,  profit: 3300 },
    ],
  };
  const RepairBrandTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const models = repairBrandModels[label as string] || [];
    return (
      <div style={{ ...tooltipStyle, padding: "14px 16px", minWidth: 310 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3, fontFamily: ff }}>{label}</p>
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 10, fontFamily: ff }}>Top models — parts · labor · profit · revenue</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {models.slice(0, 5).map((m, i) => (
            <div key={i} style={{ paddingBottom: i < Math.min(models.length, 5) - 1 ? 8 : 0, borderBottom: i < Math.min(models.length, 5) - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{m.model}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#34d399", fontFamily: ff }}>Rs. {m.revenue.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 10, color: "#f87171", fontFamily: ff }}>Parts Rs. {m.parts.toLocaleString()}</span>
                <span style={{ fontSize: 10, color: "#60a5fa", fontFamily: ff }}>Labor Rs. {m.labor.toLocaleString()}</span>
                <span style={{ fontSize: 10, color: "#4ade80", fontFamily: ff }}>Profit Rs. {m.profit.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "7px 11px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: ff, outline: "none",
    colorScheme: "dark",
  };

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Sticky date bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--bg-primary)",
        paddingBottom: 12,
        borderBottom: "1px solid var(--border)",
        marginBottom: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Calendar size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ ...inputStyle, width: 145 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ ...inputStyle, width: 145 }}
          />
          <span style={{
            fontSize: 11.5, color: "var(--text-muted)",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 20, padding: "5px 12px", fontFamily: ff,
            whiteSpace: "nowrap",
          }}>
            {dateFrom === dateTo ? fmtDate(dateFrom) : `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`}
          </span>
          <div style={{ marginLeft: "auto" }}>
            <ExportButtons
              onPdf={() => {
                if (!containerRef.current) return;
                const sections = [
                  { title: "Sales Summary", headers: SR_HEADERS, rows: srRows() },
                  ...(openAccs.has("Mobile") ? [{ title: "Mobile Devices", headers: ["Model", "Brand", "Units", "Unit Price (Rs.)", "Revenue (Rs.)"], rows: mobileItems.map(i => [i.model, i.brand, i.units, i.unitPrice, i.revenue]) as (string|number)[][] }] : []),
                  ...(openAccs.has("Accessories") ? [{ title: "Accessories", headers: ["Item", "Units", "Unit Price (Rs.)", "Revenue (Rs.)"], rows: accessoryItems.map(i => [i.item, i.units, i.unitPrice, i.revenue]) as (string|number)[][] }] : []),
                  ...(openAccs.has("Repairs") ? [{ title: "Repair Services", headers: ["Type", "Jobs", "Avg Charge (Rs.)", "Parts (Rs.)", "Labor (Rs.)", "Revenue (Rs.)"], rows: repairItems.map(r => [r.type, r.jobs, r.avgCharge, r.parts, r.labor, r.revenue]) as (string|number)[][] }] : []),
                  ...(openAccs.has("Others") ? [{ title: "Others", headers: ["Service", "Units", "Unit Price (Rs.)", "Revenue (Rs.)"], rows: otherItems.map(o => [o.service, o.units, o.unitPrice, o.revenue]) as (string|number)[][] }] : []),
                ];
                const charts = Array.from(containerRef.current.querySelectorAll("[data-pdf-chart]"))
                  .filter(el => (el as HTMLElement).getBoundingClientRect().height > 0)
                  .map(el => ({ title: el.getAttribute("data-pdf-chart") as string, element: el as HTMLElement }));
                return exportReportToPdf("Sales Report", sections, charts, srFilename);
              }}
              onExcel={() => exportToExcel(srFilename, "Sales Report", SR_HEADERS, srRows())}
              onPng={() => { if (containerRef.current) exportToPng(containerRef.current, srFilename); }}
            />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 24px" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, fontFamily: ff }}>{c.label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 8, fontFamily: ff }}>{c.value}</p>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: c.pos ? "#4ade80" : "#f87171", fontFamily: ff }}>
              {c.change} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{c.sub}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Sales BarChart + Revenue Share Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
        <div data-pdf-chart="Sales by Category" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18, fontFamily: ff }}>Sales by Category</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="txn" orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(99,91,255,0.06)" }}
                formatter={(val, name) => name === "revenue" ? [`Rs. ${(val as number).toLocaleString()}`, "Revenue"] : [val, "Transactions"]}
              />
              <Legend wrapperStyle={{ fontSize: 11.5, fontFamily: ff, paddingTop: 10 }} formatter={v => v === "revenue" ? "Revenue" : "Transactions"} />
              <Bar yAxisId="rev" dataKey="revenue"      fill="#6355ff" radius={[5, 5, 0, 0]} />
              <Bar yAxisId="txn" dataKey="transactions" fill="#60a5fa" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Share Donut */}
        <div data-pdf-chart="Revenue Share" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Revenue Share</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontFamily: ff }}>Category contribution to total</p>
          <ResponsiveContainer width="100%" height={155}>
            <PieChart>
              <Pie data={categoryData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3}>
                {categoryData.map((c, i) => <Cell key={i} fill={catColors[c.name]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`Rs. ${(val as number).toLocaleString()}`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {categoryData.map(c => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: catColors[c.name], display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{c.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                  {Math.round((c.revenue / totalRevSR) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category Report Accordions ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

        {/* Mobile Devices */}
        {(() => {
          const id = "Mobile"; const isOpen = openAccs.has(id);
          const color = "#a78bfa"; const total = mobileTotal;
          const totalUnits = mobileItems.reduce((a, b) => a + b.units, 0);
          return (
            <div key={id} style={{ background: "var(--bg-card)", borderRadius: 14, overflow: "hidden", border: `1px solid ${isOpen ? color + "55" : "var(--border)"}`, transition: "border-color 0.2s" }}>
              <button onClick={() => toggleAcc(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: ff }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}><Smartphone size={16} /></div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Mobile Devices</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: `${color}12`, color, border: `1px solid ${color}30`, fontFamily: ff }}>{totalUnits} units sold</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Smartphones & handsets — full device sales report</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color, fontFamily: ff, margin: 0 }}>{fmtRs(total)}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, margin: 0 }}>{Math.round((total / totalRevSR) * 100)}% of total revenue</p>
                  </div>
                  <ChevronDown size={16} style={{ color: "var(--text-muted)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${color}25` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "16px 0 18px" }}>
                    {[
                      { label: "Total Revenue",    value: fmtRs(total),    c: color },
                      { label: "Units Sold",        value: String(totalUnits), c: "#60a5fa" },
                      { label: "Total Profit",   value: fmtRs(mobileTotalProfit),                c: "#4ade80" },
                      { label: "Top Brand",         value: "Samsung",       c: "#fbbf24" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>{s.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: ff, margin: 0 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 14, marginBottom: 18 }}>
                    <div data-pdf-chart="Mobile — Sales by Brand" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px 8px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Sales by Brand</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 10, fontFamily: ff }}>Hover a bar — top model & profit</p>
                      <ResponsiveContainer width="100%" height={155}>
                        <BarChart data={brandBarData} layout="vertical" margin={{ top: 0, right: 52, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 9.5, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="brand" width={56} tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: ff }} axisLine={false} tickLine={false} />
                          <Tooltip content={<BrandTooltip />} cursor={{ fill: "rgba(167,139,250,0.06)" }} />
                          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={18}>
                            {brandBarData.map((_, i) => <Cell key={i} fill={mobileBrandColors[i % mobileBrandColors.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div data-pdf-chart="Mobile — Supplier Contribution" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px 8px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Supplier Contribution</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4, fontFamily: ff }}>Who supplies our mobile stock</p>
                      <ResponsiveContainer width="100%" height={110}>
                        <PieChart>
                          <Pie data={supplierData} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={3}>
                            {supplierData.map((s, i) => <Cell key={i} fill={s.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`${val}%`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 2 }}>
                        {supplierData.map(s => (
                          <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                              <span style={{ fontSize: 10.5, color: "var(--text-secondary)", fontFamily: ff }}>{s.name}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{s.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)" }}>
                        {["Model", "Brand", "Units", "Unit Price (Rs.)", "Revenue (Rs.)", "% of Mobile"].map(h => (
                          <th key={h} style={{ padding: "9px 14px", textAlign: ["Units","Unit Price (Rs.)","Revenue (Rs.)","% of Mobile"].includes(h) ? "right" : "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mobileItems.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)", transition: "background 0.12s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.model}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{r.brand}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff, textAlign: "right" }}>{r.units}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff, textAlign: "right" }}>{r.unitPrice.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>{r.revenue.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}><span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: ff }}>{Math.round((r.revenue / total) * 100)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg-secondary)" }}>
                        <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Total</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>{totalUnits}</td>
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontFamily: ff, textAlign: "right" }}>—</td>
                        <td style={{ padding: "10px 14px", fontWeight: 800, color, fontFamily: ff, textAlign: "right" }}>{total.toLocaleString()}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-muted)", fontFamily: ff, textAlign: "right" }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* Accessories */}
        {(() => {
          const id = "Accessories"; const isOpen = openAccs.has(id);
          const color = "#60a5fa"; const total = accessoryTotal;
          const totalUnits = accessoryItems.reduce((a, b) => a + b.units, 0);
          return (
            <div key={id} style={{ background: "var(--bg-card)", borderRadius: 14, overflow: "hidden", border: `1px solid ${isOpen ? color + "55" : "var(--border)"}`, transition: "border-color 0.2s" }}>
              <button onClick={() => toggleAcc(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: ff }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}><ShoppingBag size={16} /></div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Accessories</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: `${color}12`, color, border: `1px solid ${color}30`, fontFamily: ff }}>{totalUnits} items sold</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Phone accessories & add-ons — itemised sales breakdown</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color, fontFamily: ff, margin: 0 }}>{fmtRs(total)}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, margin: 0 }}>{Math.round((total / totalRevSR) * 100)}% of total revenue</p>
                  </div>
                  <ChevronDown size={16} style={{ color: "var(--text-muted)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${color}25` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "16px 0 18px" }}>
                    {[
                      { label: "Total Revenue",  value: fmtRs(total),    c: color },
                      { label: "Items Sold",      value: String(totalUnits), c: "#a78bfa" },
                      { label: "Avg Item Value",  value: fmtRs(Math.round(total / totalUnits)), c: "#4ade80" },
                      { label: "Best Seller",     value: "Type-C Charger", c: "#fbbf24" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>{s.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: ff, margin: 0 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 14, marginBottom: 18 }}>
                    <div data-pdf-chart="Accessories — Selling Trends" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px 8px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Selling Trends by Item</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 10, fontFamily: ff }}>Daily revenue — stacked by accessory type</p>
                      <ResponsiveContainer width="100%" height={155}>
                        <AreaChart data={accTrendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9.5, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={42} tickFormatter={v => `Rs.${(v / 1000).toFixed(1)}k`} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`Rs. ${(val as number).toLocaleString()}`, accItemLabels[name as string] ?? name]} />
                          <Legend wrapperStyle={{ fontSize: 10.5, fontFamily: ff }} formatter={n => accItemLabels[n] ?? n} />
                          <Area type="monotone" dataKey="TypeC"      stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.55} strokeWidth={1.5} dot={false} />
                          <Area type="monotone" dataKey="ScreenProt" stackId="1" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.55} strokeWidth={1.5} dot={false} />
                          <Area type="monotone" dataKey="Earphones"  stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.55} strokeWidth={1.5} dot={false} />
                          <Area type="monotone" dataKey="PhoneCase"  stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.55} strokeWidth={1.5} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div data-pdf-chart="Accessories — Supplier Contribution" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px 8px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Supplier Contribution</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 10, fontFamily: ff }}>Who stocks our accessories</p>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={accSupplierData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 9.5, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 60]} />
                          <YAxis type="category" dataKey="supplier" width={115} tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: ff }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, "Share"]} />
                          <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={18}>
                            {accSupplierData.map((s, i) => <Cell key={i} fill={s.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                        {accSupplierData.map(s => (
                          <div key={s.supplier} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                              <span style={{ fontSize: 10.5, color: "var(--text-secondary)", fontFamily: ff }}>{s.supplier}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{s.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)" }}>
                        {["Item", "Units Sold", "Unit Price (Rs.)", "Revenue (Rs.)", "% of Accessories"].map(h => (
                          <th key={h} style={{ padding: "9px 14px", textAlign: h === "Item" ? "left" : "right", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {accessoryItems.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)", transition: "background 0.12s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.item}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff, textAlign: "right" }}>{r.units}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff, textAlign: "right" }}>{r.unitPrice.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>{r.revenue.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}><span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: ff }}>{Math.round((r.revenue / total) * 100)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg-secondary)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Total</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>{totalUnits}</td>
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontFamily: ff, textAlign: "right" }}>—</td>
                        <td style={{ padding: "10px 14px", fontWeight: 800, color, fontFamily: ff, textAlign: "right" }}>{total.toLocaleString()}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-muted)", fontFamily: ff, textAlign: "right" }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* Repair Services */}
        {(() => {
          const id = "Repairs"; const isOpen = openAccs.has(id);
          const color = "#34d399"; const total = repairTotal;
          const totalJobs  = repairItems.reduce((a, b) => a + b.jobs, 0);
          const totalParts = repairItems.reduce((a, b) => a + b.parts, 0);
          const totalLabor = repairItems.reduce((a, b) => a + b.labor, 0);
          return (
            <div key={id} style={{ background: "var(--bg-card)", borderRadius: 14, overflow: "hidden", border: `1px solid ${isOpen ? color + "55" : "var(--border)"}`, transition: "border-color 0.2s" }}>
              <button onClick={() => toggleAcc(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: ff }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}><Wrench size={16} /></div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Repair Services</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: `${color}12`, color, border: `1px solid ${color}30`, fontFamily: ff }}>{totalJobs} jobs</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Device repair revenue — job type breakdown with parts & labor cost</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color, fontFamily: ff, margin: 0 }}>{fmtRs(total)}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, margin: 0 }}>{Math.round((total / totalRevSR) * 100)}% of total revenue</p>
                  </div>
                  <ChevronDown size={16} style={{ color: "var(--text-muted)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${color}25` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "16px 0 18px" }}>
                    {[
                      { label: "Total Revenue", value: fmtRs(total),    c: color },
                      { label: "Total Jobs",     value: String(totalJobs), c: "#60a5fa" },
                      { label: "Avg Job Value",  value: fmtRs(Math.round(total / totalJobs)), c: "#fbbf24" },
                      { label: "Parts Cost",     value: fmtRs(totalParts), c: "#f87171" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>{s.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: ff, margin: 0 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Fault frequency + Brand frequency charts */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    {/* Most Received Fault */}
                    <div data-pdf-chart="Repairs — Most Received Fault" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14, fontFamily: ff }}>Most Received Fault</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={repairFaultData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="fault" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={110} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Jobs"]} labelStyle={{ fontFamily: ff, fontWeight: 700 }} />
                          <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={18}>
                            {repairFaultData.map((_: any, i: number) => (
                              <Cell key={i} fill={repairFaultColors[i % repairFaultColors.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Most Coming Brand */}
                    <div data-pdf-chart="Repairs — Most Coming Brand" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14, fontFamily: ff }}>Most Coming Brand</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={repairBrandFreqData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="brand" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={60} />
                          <Tooltip content={<RepairBrandTooltip />} />
                          <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={18}>
                            {repairBrandFreqData.map((_: any, i: number) => (
                              <Cell key={i} fill={repairBrandColors2[i % repairBrandColors2.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)" }}>
                        {["Repair Type", "Jobs", "Avg Charge (Rs.)", "Parts Cost (Rs.)", "Labor (Rs.)", "Revenue (Rs.)", "% of Repairs"].map(h => (
                          <th key={h} style={{ padding: "9px 14px", textAlign: h === "Repair Type" ? "left" : "right", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {repairItems.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)", transition: "background 0.12s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.type}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff, textAlign: "right" }}>{r.jobs}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff, textAlign: "right" }}>{r.avgCharge.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", color: "#f87171", fontFamily: ff, textAlign: "right" }}>{r.parts.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", color: "#4ade80", fontFamily: ff, textAlign: "right" }}>{r.labor.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>{r.revenue.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}><span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: ff }}>{Math.round((r.revenue / total) * 100)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg-secondary)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Total</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>{totalJobs}</td>
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontFamily: ff, textAlign: "right" }}>—</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#f87171", fontFamily: ff, textAlign: "right" }}>{totalParts.toLocaleString()}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#4ade80", fontFamily: ff, textAlign: "right" }}>{totalLabor.toLocaleString()}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 800, color, fontFamily: ff, textAlign: "right" }}>{total.toLocaleString()}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-muted)", fontFamily: ff, textAlign: "right" }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                    <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>Total Parts Cost</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#f87171", fontFamily: ff }}>{fmtRs(totalParts)}</span>
                    </div>
                    <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>Total Labor Revenue</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#4ade80", fontFamily: ff }}>{fmtRs(totalLabor)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Others */}
        {(() => {
          const id = "Others"; const isOpen = openAccs.has(id);
          const color = "#94a3b8"; const total = otherTotal;
          const totalTxns = otherItems.reduce((a, b) => a + b.units, 0);
          return (
            <div key={id} style={{ background: "var(--bg-card)", borderRadius: 14, overflow: "hidden", border: `1px solid ${isOpen ? color + "55" : "var(--border)"}`, transition: "border-color 0.2s" }}>
              <button onClick={() => toggleAcc(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: ff }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}><MoreHorizontal size={16} /></div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Others</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: `${color}12`, color, border: `1px solid ${color}30`, fontFamily: ff }}>{totalTxns} transactions</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Miscellaneous services & products — all other sales</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color, fontFamily: ff, margin: 0 }}>{fmtRs(total)}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, margin: 0 }}>{Math.round((total / totalRevSR) * 100)}% of total revenue</p>
                  </div>
                  <ChevronDown size={16} style={{ color: "var(--text-muted)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${color}25` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "16px 0 18px" }}>
                    {[
                      { label: "Total Revenue",  value: fmtRs(total),    c: color },
                      { label: "Transactions",   value: String(totalTxns), c: "#60a5fa" },
                      { label: "Avg Value",       value: fmtRs(Math.round(total / totalTxns)), c: "#fbbf24" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>{s.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: ff, margin: 0 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)" }}>
                        {["Service / Item", "Qty", "Unit Price (Rs.)", "Revenue (Rs.)", "% of Others"].map(h => (
                          <th key={h} style={{ padding: "9px 14px", textAlign: h === "Service / Item" ? "left" : "right", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {otherItems.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)", transition: "background 0.12s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.service}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff, textAlign: "right" }}>{r.units}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff, textAlign: "right" }}>{r.unitPrice.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>{r.revenue.toLocaleString()}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}><span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: ff }}>{Math.round((r.revenue / total) * 100)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg-secondary)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Total</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>{totalTxns}</td>
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontFamily: ff, textAlign: "right" }}>—</td>
                        <td style={{ padding: "10px 14px", fontWeight: 800, color, fontFamily: ff, textAlign: "right" }}>{total.toLocaleString()}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-muted)", fontFamily: ff, textAlign: "right" }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

      </div>

      {/* Revenue Trend AreaChart */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Revenue Trend</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6355ff", display: "inline-block" }} />
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>Revenue</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="srRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6355ff" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#6355ff" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`Rs. ${(val as number).toLocaleString()}`, "Revenue"]} />
            <Area type="monotone" dataKey="revenue" stroke="#6355ff" strokeWidth={2.5} fill="url(#srRevGrad)" dot={false} activeDot={{ r: 5, fill: "#6355ff", strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Brand Performance + Supplier Contribution */}
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18, fontFamily: ff }}>Sales by Brand</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={brandData} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="brand" width={60} tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => name === "revenue" ? [`Rs. ${(val as number).toLocaleString()}`, "Revenue"] : [val, "Units"]} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={22}>
                {brandData.map((_, i) => <Cell key={i} fill={brandColors[i % brandColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Supplier Contribution</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontFamily: ff }}>Who supplies most of our sales</p>
          <ResponsiveContainer width="100%" height={145}>
            <PieChart>
              <Pie data={supplierData} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3}>
                {supplierData.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`${val}%`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 6 }}>
            {supplierData.map(s => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                  <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>{s.name}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{s.items} items</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{s.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


    </div>
  );
}

/* ── Repair Report ── */
function RepairReport({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const jobs = [
    { id: "JOB-1041", device: "iPhone 13",   type: "Screen Replacement",  tech: "Ashan",   status: "Completed", charge: 9500,  parts: 4500, labor: 5000 },
    { id: "JOB-1040", device: "Oppo A57",    type: "Battery Replacement", tech: "Nilufar", status: "Completed", charge: 4200,  parts: 1800, labor: 2400 },
    { id: "JOB-1039", device: "Samsung A32", type: "Charging Port",       tech: "Ashan",   status: "Pending",   charge: 2800,  parts: 800,  labor: 2000 },
    { id: "JOB-1038", device: "Redmi 9C",    type: "Screen Replacement",  tech: "Nilufar", status: "Issued",    charge: 6500,  parts: 3200, labor: 3300 },
    { id: "JOB-1037", device: "iPhone SE",   type: "Water Damage",        tech: "Ashan",   status: "Completed", charge: 12000, parts: 6000, labor: 6000 },
  ];

  const techData = [
    { name: "Ashan",   jobs: 3, revenue: 24300, parts: 11300, labor: 13000 },
    { name: "Nilufar", jobs: 2, revenue: 10700, parts: 5000,  labor: 5700  },
  ];

  const radarData = [
    { metric: "Jobs",       Ashan: 60,  Nilufar: 40  },
    { metric: "Revenue",    Ashan: 80,  Nilufar: 45  },
    { metric: "Completion", Ashan: 100, Nilufar: 100 },
    { metric: "Speed",      Ashan: 75,  Nilufar: 88  },
    { metric: "Parts Eff.", Ashan: 68,  Nilufar: 74  },
  ];

  const repairTypes = [
    { type: "Screen Replacement",  count: 2 },
    { type: "Water Damage",        count: 1 },
    { type: "Battery Replacement", count: 1 },
    { type: "Charging Port",       count: 1 },
  ];

  const statusGroups = [
    { label: "Completed", count: 3, color: "#4ade80", pct: 60 },
    { label: "Issued",    count: 1, color: "#60a5fa", pct: 20 },
    { label: "Pending",   count: 1, color: "#fbbf24", pct: 20 },
    { label: "Cancelled", count: 0, color: "#f87171", pct: 0  },
  ];

  const trendData = [
    { day: "Mon", revenue: 9500  },
    { day: "Tue", revenue: 4200  },
    { day: "Wed", revenue: 2800  },
    { day: "Thu", revenue: 6500  },
    { day: "Fri", revenue: 12000 },
    { day: "Sat", revenue: 7200  },
    { day: "Sun", revenue: 0     },
  ];

  const statusCfg: Record<string, { color: string; bg: string }> = {
    Completed: { color: "#4ade80", bg: "rgba(74,222,128,0.08)"  },
    Pending:   { color: "#fbbf24", bg: "rgba(251,191,36,0.08)"  },
    Issued:    { color: "#60a5fa", bg: "rgba(96,165,250,0.08)"  },
    Cancelled: { color: "#f87171", bg: "rgba(248,113,113,0.08)" },
  };

  const completed   = jobs.filter(j => j.status === "Completed");
  const totalCharge = jobs.reduce((a, b) => a + b.charge, 0);
  const totalParts  = jobs.reduce((a, b) => a + b.parts, 0);
  const totalLabor  = jobs.reduce((a, b) => a + b.labor, 0);

  const RR_HEADERS = ["Job ID", "Device", "Type", "Technician", "Status", "Parts (Rs.)", "Labor (Rs.)", "Total (Rs.)"];
  const rrRows     = () => jobs.map(j => [j.id, j.device, j.type, j.tech, j.status, j.parts, j.labor, j.charge]);
  const rrFilename = `repair-report-${new Date().toISOString().slice(0, 10)}`;

  const statCards = [
    { label: "Total Jobs",     value: String(jobs.length),      change: "+2",     sub: "vs last week", pos: true  },
    { label: "Completed",      value: String(completed.length), change: "60%",    sub: "completion",   pos: true  },
    { label: "Repair Revenue", value: fmtRs(totalCharge),       change: "+18.3%", sub: "vs last week", pos: true  },
    { label: "Parts Cost",     value: fmtRs(totalParts),        change: `${Math.round((totalParts / totalCharge) * 100)}%`, sub: "of revenue", pos: false },
  ];
  const statIcons  = [Wrench, FileText, DollarSign, Package];
  const statColors = ["#34d399", "#4ade80", "#fbbf24", "#f87171"];

  const deviceBrandData = [
    { brand: "Samsung", repairs: 8 },
    { brand: "Apple",   repairs: 5 },
    { brand: "Oppo",    repairs: 4 },
    { brand: "Redmi",   repairs: 3 },
    { brand: "Huawei",  repairs: 2 },
  ];
  const deviceBrandColors = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#94a3b8"];

  const partsSupplierData = [
    { name: "Parts Hub LK",  cost: 18000, pct: 45, color: "#6355ff" },
    { name: "Fix It All",    cost: 12000, pct: 30, color: "#60a5fa" },
    { name: "TechSpare.lk",  cost: 6400,  pct: 16, color: "#34d399" },
    { name: "Direct Order",  cost: 3600,  pct: 9,  color: "#fbbf24" },
  ];

  const profitTrendData = [
    { month: "Jan", revenue: 52000, cost: 34000, profit: 18000 },
    { month: "Feb", revenue: 48000, cost: 29000, profit: 19000 },
    { month: "Mar", revenue: 63000, cost: 38000, profit: 25000 },
    { month: "Apr", revenue: 71000, cost: 42000, profit: 29000 },
    { month: "May", revenue: 58000, cost: 36000, profit: 22000 },
  ];

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <ReportFilters
        dateFrom={dateFrom} dateTo={dateTo}
        setDateFrom={setDateFrom} setDateTo={setDateTo}
        actions={
          <ExportButtons
            onPdf={() => {
              if (!containerRef.current) return;
              const sections = [{ title: "Repair Job Summary", headers: RR_HEADERS, rows: rrRows() }];
              const charts = Array.from(containerRef.current.querySelectorAll("[data-pdf-chart]"))
                .filter(el => (el as HTMLElement).getBoundingClientRect().height > 0)
                .map(el => ({ title: el.getAttribute("data-pdf-chart") as string, element: el as HTMLElement }));
              return exportReportToPdf("Repair Report", sections, charts, rrFilename);
            }}
            onExcel={() => exportToExcel(rrFilename, "Repair Report", RR_HEADERS, rrRows())}
            onPng={() => { if (containerRef.current) exportToPng(containerRef.current, rrFilename); }}
          />
        }
      />

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {statCards.map((c, i) => {
          const Icon = statIcons[i];
          const color = statColors[i];
          return (
            <div key={c.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: ff }}>{c.label}</p>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}14`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                  <Icon size={14} />
                </div>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 8, fontFamily: ff }}>{c.value}</p>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: c.pos ? "#4ade80" : "#f87171", fontFamily: ff }}>
                {c.change} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{c.sub}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Cost vs Revenue ComposedChart + Radar */}
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>

        {/* ComposedChart: stacked Parts+Labor bars + Revenue line */}
        <div data-pdf-chart="Cost vs Revenue by Tech" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Cost vs Revenue by Tech</p>
            <div style={{ display: "flex", gap: 12 }}>
              {[["#f87171","Parts"],["#fbbf24","Labor"],["#4ade80","Revenue"]].map(([color, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: label === "Revenue" ? 16 : 10, height: label === "Revenue" ? 2 : 10, borderRadius: 2, background: color, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={techData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="cost" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="rev"  orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(val, name) => [`Rs. ${(val as number).toLocaleString()}`, name === "parts" ? "Parts Cost" : name === "labor" ? "Labor Cost" : "Revenue"]}
              />
              <Bar yAxisId="cost" dataKey="parts"   fill="#f87171" stackId="cost" radius={[0, 0, 0, 0]} barSize={50} />
              <Bar yAxisId="cost" dataKey="labor"   fill="#fbbf24" stackId="cost" radius={[5, 5, 0, 0]} barSize={50} />
              <Line yAxisId="rev" dataKey="revenue" stroke="#4ade80" strokeWidth={2.5} dot={{ r: 6, fill: "#4ade80", strokeWidth: 0 }} activeDot={{ r: 7 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* RadarChart: technician multi-metric */}
        <div data-pdf-chart="Technician Comparison" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Technician Comparison</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontFamily: ff }}>Multi-metric radar analysis</p>
          <ResponsiveContainer width="100%" height={245}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Ashan"   dataKey="Ashan"   stroke="#6355ff" fill="#6355ff" fillOpacity={0.18} strokeWidth={2} />
              <Radar name="Nilufar" dataKey="Nilufar" stroke="#34d399" fill="#34d399" fillOpacity={0.18} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: 11.5, fontFamily: ff, paddingTop: 4 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`${val}/100`, name]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Repair Type Frequency + Job Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Horizontal BarChart: repair type frequency */}
        <div data-pdf-chart="Repair Type Frequency" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18, fontFamily: ff }}>Repair Type Frequency</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={repairTypes} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="type" width={145} tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [val, "Jobs"]} />
              <Bar dataKey="count" fill="#6355ff" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Job Status Distribution */}
        <div data-pdf-chart="Job Status Distribution" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 22, fontFamily: ff }}>Job Status</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            {statusGroups.map(s => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: ff }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{s.count} jobs</span>
                </div>
                <div style={{ height: 7, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.pct}%`, background: s.color, borderRadius: 4, transition: "width 0.5s ease" }} />
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: ff }}>{s.pct}% of all jobs</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Parts Cost</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171", fontFamily: ff }}>{fmtRs(totalParts)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Labor Cost</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#34d399", fontFamily: ff }}>{fmtRs(totalLabor)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Device Brand Frequency + Parts Supplier */}
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>

        <div data-pdf-chart="Repairs by Device Brand" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18, fontFamily: ff }}>Repairs by Device Brand</p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={deviceBrandData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="brand" width={68} tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: ff }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [val, "Repairs"]} />
              <Bar dataKey="repairs" radius={[0, 6, 6, 0]} barSize={22}>
                {deviceBrandData.map((_, i) => <Cell key={i} fill={deviceBrandColors[i % deviceBrandColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div data-pdf-chart="Parts Suppliers" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, fontFamily: ff }}>Parts Suppliers</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontFamily: ff }}>Who supplies most of our repair parts</p>
          <ResponsiveContainer width="100%" height={145}>
            <PieChart>
              <Pie data={partsSupplierData} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3}>
                {partsSupplierData.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`${val}%`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 6 }}>
            {partsSupplierData.map(s => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                  <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>{s.name}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{fmtRs(s.cost)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{s.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Profit Trend */}
      <div data-pdf-chart="Monthly Profit Trend" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Monthly Profit Trend</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontFamily: ff }}>Revenue vs cost vs profit over months</p>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {[["#34d399", "Revenue"], ["#f87171", "Cost"], ["#fbbf24", "Profit"]].map(([color, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={profitTrendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rrProfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltipStyle}
              formatter={(val, name) => [`Rs. ${(val as number).toLocaleString()}`, name === "revenue" ? "Revenue" : name === "cost" ? "Cost" : "Profit"]}
            />
            <Bar dataKey="revenue" fill="#34d399" fillOpacity={0.25} radius={[4, 4, 0, 0]} barSize={22} />
            <Bar dataKey="cost"    fill="#f87171" fillOpacity={0.25} radius={[4, 4, 0, 0]} barSize={22} />
            <Area type="monotone" dataKey="profit" stroke="#fbbf24" strokeWidth={2.5} fill="url(#rrProfGrad)" dot={false} activeDot={{ r: 5, fill: "#fbbf24", strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Repair Revenue Trend */}
      <div data-pdf-chart="Repair Revenue Trend" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Repair Revenue Trend</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>Repair Revenue</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rrRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={58} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`Rs. ${(val as number).toLocaleString()}`, "Revenue"]} />
            <Area type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2.5} fill="url(#rrRevGrad)" dot={false} activeDot={{ r: 5, fill: "#34d399", strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Job Breakdown Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Job Breakdown</p>
          <div style={{ display: "flex", gap: 20 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Parts: <strong style={{ color: "var(--text-primary)" }}>{fmtRs(totalParts)}</strong></span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Labor: <strong style={{ color: "var(--text-primary)" }}>{fmtRs(totalLabor)}</strong></span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Total: <strong style={{ color: "var(--text-primary)" }}>{fmtRs(totalCharge)}</strong></span>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)" }}>
              {["Job ID", "Device", "Type", "Technician", "Status", "Parts", "Labor", "Total"].map(h => (
                <th key={h} style={{
                  padding: "10px 16px", textAlign: "left", fontSize: 11,
                  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j, i) => {
              const cfg = statusCfg[j.status] || { color: "#94a3b8", bg: "rgba(148,163,184,0.08)" };
              return (
                <tr key={i} style={{ borderTop: "1px solid var(--border)", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "11px 16px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{j.id}</td>
                  <td style={{ padding: "11px 16px", color: "var(--text-primary)", fontFamily: ff }}>{j.device}</td>
                  <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontFamily: ff }}>{j.type}</td>
                  <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontFamily: ff }}>{j.tech}</td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontFamily: ff,
                    }}>{j.status}</span>
                  </td>
                  <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontFamily: ff }}>{fmtRs(j.parts)}</td>
                  <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontFamily: ff }}>{fmtRs(j.labor)}</td>
                  <td style={{ padding: "11px 16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{fmtRs(j.charge)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}

/* ── P&L Report ── */
function PLReport({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const monthlyData = [
    { month: "Jan", revenue: 580000, cogs: 310000, gross: 270000, expenses: 95000, net: 175000 },
    { month: "Feb", revenue: 620000, cogs: 330000, gross: 290000, expenses: 98000, net: 192000 },
    { month: "Mar", revenue: 710000, cogs: 370000, gross: 340000, expenses: 102000, net: 238000 },
    { month: "Apr", revenue: 690000, cogs: 355000, gross: 335000, expenses: 105000, net: 230000 },
    { month: "May", revenue: 755000, cogs: 390000, gross: 365000, expenses: 108000, net: 257000 },
  ];
  const categoryPL = [
    { category: "Mobile Sales",  revenue: 320000, cogs: 245000, gross: 75000,  margin: 23.4 },
    { category: "Accessories",   revenue: 85000,  cogs: 42000,  gross: 43000,  margin: 50.6 },
    { category: "Repair Services",revenue: 290000, cogs: 88000,  gross: 202000, margin: 69.7 },
    { category: "Other Services", revenue: 60000,  cogs: 15000,  gross: 45000,  margin: 75.0 },
  ];
  const totalRevenue = 755000; const totalCOGS = 390000; const grossProfit = 365000;
  const expenses = 108000; const netProfit = 257000; const grossMargin = 48.3; const netMargin = 34.0;
  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}
        actions={<ExportButtons onPdf={() => {}} onExcel={() => {}} onPng={() => { if (containerRef.current) exportToPng(containerRef.current, "pl-report"); }} />}
      />
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {[
          { label: "Total Revenue",  value: fmtRs(totalRevenue), color: "#34d399" },
          { label: "Total COGS",     value: fmtRs(totalCOGS),   color: "#f87171" },
          { label: "Gross Profit",   value: fmtRs(grossProfit), color: "#60a5fa" },
          { label: "Gross Margin",   value: `${grossMargin}%`,  color: "#a78bfa" },
          { label: "Net Profit",     value: fmtRs(netProfit),   color: "#fbbf24" },
        ].map(k => (
          <div key={k.label} style={{ padding: "14px 16px", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: ff }}>{k.value}</p>
          </div>
        ))}
      </div>
      {/* Monthly trend */}
      <div style={{ padding: "18px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 14 }}>Monthly P&L Trend</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtRs(v)} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: ff }} />
            <Bar dataKey="revenue" name="Revenue" fill="#34d39940" radius={[4,4,0,0]} />
            <Bar dataKey="cogs"    name="COGS"    fill="#f8717140" radius={[4,4,0,0]} />
            <Line dataKey="net"    name="Net Profit" stroke="#fbbf24" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Category breakdown */}
      <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>P&L by Category</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
            {["Category","Revenue","COGS","Gross Profit","Gross Margin"].map(h => (
              <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, fontFamily: ff }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {categoryPL.map((r, i) => (
              <tr key={r.category} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.category}</td>
                <td style={{ padding: "10px 14px", color: "#34d399", fontWeight: 700, fontFamily: ff }}>{fmtRs(r.revenue)}</td>
                <td style={{ padding: "10px 14px", color: "#f87171", fontFamily: ff }}>{fmtRs(r.cogs)}</td>
                <td style={{ padding: "10px 14px", color: "#60a5fa", fontWeight: 700, fontFamily: ff }}>{fmtRs(r.gross)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${r.margin}%`, height: "100%", background: r.margin > 60 ? "#34d399" : r.margin > 40 ? "#60a5fa" : "#fbbf24", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, minWidth: 40 }}>{r.margin}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Stock Valuation ── */
function StockValuation({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const categories = [
    { name: "Smartphones",  items: 24, units: 18, costValue: 1240000, sellValue: 1620000, potentialProfit: 380000 },
    { name: "Accessories",  items: 87, units: 342, costValue: 185000, sellValue: 298000, potentialProfit: 113000 },
    { name: "Repair Parts", items: 56, units: 218, costValue: 320000, sellValue: 495000, potentialProfit: 175000 },
    { name: "Equipment",    items: 8,  units: 12,  costValue: 95000,  sellValue: 130000, potentialProfit: 35000  },
  ];
  const stockItems = [
    { sku: "SAM-A55-128-BLK", name: "Samsung Galaxy A55 128GB",  category: "Smartphones",  units: 3,  cost: 65000, sell: 89900, totalCost: 195000, status: "Normal" },
    { sku: "IPH-14-256-MID",  name: "iPhone 14 256GB Midnight",  category: "Smartphones",  units: 2,  cost: 145000,sell: 198000,totalCost: 290000, status: "Normal" },
    { sku: "SCR-IP14-OLED",   name: "iPhone 14 Screen Assembly", category: "Repair Parts", units: 3,  cost: 14500, sell: 21000, totalCost: 43500,  status: "Low"    },
    { sku: "BAT-A54",         name: "Samsung A54 Battery",       category: "Repair Parts", units: 10, cost: 1800,  sell: 3500,  totalCost: 18000,  status: "Normal" },
    { sku: "CASE-ASST-50",    name: "Phone Cases Assorted (50)", category: "Accessories",  units: 4,  cost: 4500,  sell: 8500,  totalCost: 18000,  status: "Normal" },
    { sku: "CHRG-65W-10",     name: "Fast Chargers 65W (10pcs)", category: "Accessories",  units: 2,  cost: 6500,  sell: 11000, totalCost: 13000,  status: "Low"    },
    { sku: "SCR-IP12-OLED",   name: "iPhone 12 Screen (OLED)",   category: "Repair Parts", units: 0,  cost: 8500,  sell: 13500, totalCost: 0,      status: "Out"    },
  ];
  const totalCost = categories.reduce((s, c) => s + c.costValue, 0);
  const totalSell = categories.reduce((s, c) => s + c.sellValue, 0);
  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}
        actions={<ExportButtons onPdf={() => {}} onExcel={() => {}} onPng={() => { if (containerRef.current) exportToPng(containerRef.current, "stock-valuation"); }} />}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Total Cost Value",       value: fmtRs(totalCost), color: "#f59e0b" },
          { label: "Total Selling Value",    value: fmtRs(totalSell), color: "#34d399" },
          { label: "Potential Gross Profit", value: fmtRs(totalSell - totalCost), color: "#a78bfa" },
        ].map(k => (
          <div key={k.label} style={{ padding: "16px 18px", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: ff }}>{k.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ padding: "18px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 14 }}>Value by Category</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={categories} dataKey="costValue" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: any) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {categories.map((_, i) => <Cell key={i} fill={["#6355ff","#34d399","#f59e0b","#60a5fa"][i]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtRs(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Category","SKUs","Units","Cost Value","Sell Value"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{c.name}</td>
                  <td style={{ padding: "9px 12px", color: "var(--text-secondary)", fontFamily: ff }}>{c.items}</td>
                  <td style={{ padding: "9px 12px", color: "var(--text-secondary)", fontFamily: ff }}>{c.units}</td>
                  <td style={{ padding: "9px 12px", color: "#f59e0b", fontWeight: 700, fontFamily: ff }}>{fmtRs(c.costValue)}</td>
                  <td style={{ padding: "9px 12px", color: "#34d399", fontWeight: 700, fontFamily: ff }}>{fmtRs(c.sellValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Stock Items Detail</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
            {["SKU","Item","Category","Units","Unit Cost","Unit Price","Total Cost","Stock"].map(h => (
              <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {stockItems.map((s, i) => {
              const sc = s.status === "Out" ? "#f87171" : s.status === "Low" ? "#fbbf24" : "#34d399";
              return (
                <tr key={s.sku} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{s.sku}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{s.name}</td>
                  <td style={{ padding: "9px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{s.category}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: s.units === 0 ? "#f87171" : "var(--text-primary)", fontFamily: ff }}>{s.units}</td>
                  <td style={{ padding: "9px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{fmtRs(s.cost)}</td>
                  <td style={{ padding: "9px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{fmtRs(s.sell)}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{fmtRs(s.totalCost)}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${sc}15`, color: sc, border: `1px solid ${sc}30`, fontFamily: ff }}>{s.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Cashier Performance ── */
function CashierPerformance({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cashiers = [
    { name: "Ruwan Perera",    transactions: 48, revenue: 385000, avgTicket: 8021, discountsGiven: 3, refunds: 1, cashHandled: 215000 },
    { name: "Niluka Fernando", transactions: 41, revenue: 312000, avgTicket: 7610, discountsGiven: 5, refunds: 2, cashHandled: 178000 },
  ];
  const dailyData = [
    { day: "Mon", ruwan: 78000, niluka: 65000 },
    { day: "Tue", ruwan: 92000, niluka: 58000 },
    { day: "Wed", ruwan: 65000, niluka: 82000 },
    { day: "Thu", ruwan: 88000, niluka: 71000 },
    { day: "Fri", ruwan: 62000, niluka: 36000 },
  ];
  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}
        actions={<ExportButtons onPdf={() => {}} onExcel={() => {}} onPng={() => { if (containerRef.current) exportToPng(containerRef.current, "cashier-performance"); }} />}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {cashiers.map(c => (
          <div key={c.name} style={{ padding: "18px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(99,85,255,0.12)", border: "1px solid rgba(99,85,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#6355ff", fontFamily: ff }}>
                {c.name[0]}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{c.name}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Cashier</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "Transactions", value: c.transactions, color: "#6355ff" },
                { label: "Revenue",      value: fmtRs(c.revenue), color: "#34d399" },
                { label: "Avg Ticket",   value: fmtRs(c.avgTicket), color: "#60a5fa" },
                { label: "Discounts",    value: c.discountsGiven, color: "#fbbf24" },
                { label: "Refunds",      value: c.refunds, color: "#f87171" },
                { label: "Cash Handled", value: fmtRs(c.cashHandled), color: "#a78bfa" },
              ].map(m => (
                <div key={m.label} style={{ padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 9, border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, marginBottom: 4 }}>{m.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: m.color, fontFamily: ff }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "18px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 14 }}>Daily Revenue Comparison</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtRs(v)} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: ff }} />
            <Bar dataKey="ruwan"  name="Ruwan Perera"    fill="#6355ff" radius={[4,4,0,0]} />
            <Bar dataKey="niluka" name="Niluka Fernando" fill="#34d399" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Supplier Report ── */
function SupplierReport({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const suppliers = [
    { name: "TechParts Lanka",     category: "Parts",       orders: 8,  totalSpend: 420000, avgLeadDays: 5,  onTimeRate: 95, lastOrder: "2026-05-05" },
    { name: "Samsung Distributors",category: "Phones",      orders: 4,  totalSpend: 890000, avgLeadDays: 8,  onTimeRate: 88, lastOrder: "2026-05-15" },
    { name: "Accessory World",     category: "Accessories", orders: 12, totalSpend: 185000, avgLeadDays: 3,  onTimeRate: 100,lastOrder: "2026-05-18" },
    { name: "Fix-It Tools",        category: "Equipment",   orders: 2,  totalSpend: 48000,  avgLeadDays: 10, onTimeRate: 100,lastOrder: "2026-04-20" },
    { name: "Oppo/Huawei Partners",category: "Phones",      orders: 3,  totalSpend: 620000, avgLeadDays: 7,  onTimeRate: 90, lastOrder: "2026-05-10" },
  ];
  const spendData = suppliers.map(s => ({ name: s.name.split(" ")[0], spend: s.totalSpend }));
  const totalSpend = suppliers.reduce((a, s) => a + s.totalSpend, 0);
  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}
        actions={<ExportButtons onPdf={() => {}} onExcel={() => {}} onPng={() => { if (containerRef.current) exportToPng(containerRef.current, "supplier-report"); }} />}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Total Suppliers", value: suppliers.length, color: "#a78bfa" },
          { label: "Total Spend",     value: fmtRs(totalSpend), color: "#f59e0b" },
          { label: "Total Orders",    value: suppliers.reduce((a,s)=>a+s.orders,0), color: "#60a5fa" },
        ].map(k => (
          <div key={k.label} style={{ padding: "16px 18px", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: ff }}>{k.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ padding: "18px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 14 }}>Spend by Supplier</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={spendData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: ff }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <YAxis dataKey="name" type="category" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtRs(v)} />
              <Bar dataKey="spend" fill="#f59e0b" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Supplier","Orders","Spend","Lead Days","On-Time"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {suppliers.map((s, i) => (
                <tr key={s.name} style={{ borderBottom: "1px solid var(--border)", background: i%2===0?"transparent":"var(--bg-secondary)" }}>
                  <td style={{ padding: "9px 12px" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{s.name}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff }}>{s.category}</p>
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--text-secondary)", fontFamily: ff }}>{s.orders}</td>
                  <td style={{ padding: "9px 12px", color: "#f59e0b", fontWeight: 700, fontFamily: ff }}>{fmtRs(s.totalSpend)}</td>
                  <td style={{ padding: "9px 12px", color: "var(--text-secondary)", fontFamily: ff }}>{s.avgLeadDays}d</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.onTimeRate >= 95 ? "#34d399" : s.onTimeRate >= 85 ? "#fbbf24" : "#f87171", fontFamily: ff }}>{s.onTimeRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Credit Aging ── */
function CreditAging({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const customers = [
    { name: "Telecom Hub (Pvt) Ltd",   total: 120000, current: 45000, d30: 35000, d60: 25000, d90: 15000, overdue: 75000 },
    { name: "City Mobile Repair",       total: 85000,  current: 30000, d30: 28000, d60: 15000, d90: 12000, overdue: 55000 },
    { name: "Lanka Electronics",        total: 62000,  current: 20000, d30: 22000, d60: 12000, d90: 8000,  overdue: 42000 },
    { name: "QuickFix Services",        total: 38000,  current: 18000, d30: 12000, d60: 5000,  d90: 3000,  overdue: 20000 },
    { name: "Colombo Mobile Center",    total: 25000,  current: 25000, d30: 0,     d60: 0,     d90: 0,     overdue: 0     },
  ];
  const buckets = [
    { label: "Current (0–30d)", value: customers.reduce((s,c)=>s+c.current,0), color: "#34d399" },
    { label: "31–60 days",      value: customers.reduce((s,c)=>s+c.d30,0),     color: "#fbbf24" },
    { label: "61–90 days",      value: customers.reduce((s,c)=>s+c.d60,0),     color: "#f97316" },
    { label: "90+ days",        value: customers.reduce((s,c)=>s+c.d90,0),     color: "#f87171" },
  ];
  const totalOutstanding = customers.reduce((s,c)=>s+c.total,0);
  const totalOverdue     = customers.reduce((s,c)=>s+c.overdue,0);
  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}
        actions={<ExportButtons onPdf={() => {}} onExcel={() => {}} onPng={() => { if (containerRef.current) exportToPng(containerRef.current, "credit-aging"); }} />}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Total Outstanding", value: fmtRs(totalOutstanding), color: "#a78bfa" },
          { label: "Total Overdue",     value: fmtRs(totalOverdue),     color: "#f87171" },
          { label: "Credit Customers",  value: customers.length,         color: "#60a5fa" },
          { label: "Overdue Rate",      value: `${((totalOverdue/totalOutstanding)*100).toFixed(1)}%`, color: "#fbbf24" },
        ].map(k => (
          <div key={k.label} style={{ padding: "14px 16px", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: ff }}>{k.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ padding: "18px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 14 }}>Aging Buckets</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {buckets.map(b => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{b.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: b.color, fontFamily: ff }}>{fmtRs(b.value)}</span>
                </div>
                <div style={{ height: 7, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(b.value/totalOutstanding)*100}%`, height: "100%", background: b.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Customer","Total","Current","31–60d","61–90d","90+d"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: "1px solid var(--border)", background: i%2===0?"transparent":"var(--bg-secondary)" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, fontSize: 11.5 }}>{c.name}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 700, color: "#a78bfa", fontFamily: ff }}>{fmtRs(c.total)}</td>
                  <td style={{ padding: "9px 12px", color: "#34d399", fontFamily: ff }}>{c.current > 0 ? fmtRs(c.current) : "—"}</td>
                  <td style={{ padding: "9px 12px", color: c.d30 > 0 ? "#fbbf24" : "var(--text-muted)", fontFamily: ff }}>{c.d30 > 0 ? fmtRs(c.d30) : "—"}</td>
                  <td style={{ padding: "9px 12px", color: c.d60 > 0 ? "#f97316" : "var(--text-muted)", fontFamily: ff }}>{c.d60 > 0 ? fmtRs(c.d60) : "—"}</td>
                  <td style={{ padding: "9px 12px", color: c.d90 > 0 ? "#f87171" : "var(--text-muted)", fontFamily: ff }}>{c.d90 > 0 ? fmtRs(c.d90) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Repair SLA ── */
function RepairSLA({ dateFrom, dateTo, setDateFrom, setDateTo }: FilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const technicians = [
    { name: "Kamal",  jobs: 18, completed: 16, withinSLA: 14, avgDays: 2.1, breach: 2, slaRate: 87.5 },
    { name: "Nimal",  jobs: 15, completed: 13, withinSLA: 12, avgDays: 2.8, breach: 1, slaRate: 92.3 },
    { name: "Suresh", jobs: 11, completed: 9,  withinSLA: 7,  avgDays: 3.4, breach: 2, slaRate: 77.8 },
  ];
  const slaData = technicians.map(t => ({ name: t.name, "Within SLA": t.withinSLA, Breach: t.breach }));
  const trendData = [
    { week: "W1", slaRate: 88 }, { week: "W2", slaRate: 91 }, { week: "W3", slaRate: 85 },
    { week: "W4", slaRate: 93 }, { week: "W5", slaRate: 90 },
  ];
  const totalJobs    = technicians.reduce((s,t)=>s+t.jobs,0);
  const totalBreaches= technicians.reduce((s,t)=>s+t.breach,0);
  const avgSLA       = (technicians.reduce((s,t)=>s+t.slaRate,0)/technicians.length).toFixed(1);
  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}
        actions={<ExportButtons onPdf={() => {}} onExcel={() => {}} onPng={() => { if (containerRef.current) exportToPng(containerRef.current, "repair-sla"); }} />}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Total Jobs",    value: totalJobs,             color: "#60a5fa" },
          { label: "SLA Breaches",  value: totalBreaches,         color: "#f87171" },
          { label: "Avg SLA Rate",  value: `${avgSLA}%`,          color: "#34d399" },
          { label: "SLA Target",    value: "90%",                 color: "#a78bfa" },
        ].map(k => (
          <div key={k.label} style={{ padding: "14px 16px", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: ff }}>{k.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ padding: "18px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 14 }}>SLA Performance by Technician</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={slaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: ff }} />
              <Bar dataKey="Within SLA" fill="#34d399" stackId="a" radius={[0,0,0,0]} />
              <Bar dataKey="Breach"     fill="#f87171" stackId="a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ padding: "18px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 14 }}>Weekly SLA Rate Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} />
              <YAxis domain={[70,100]} tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: ff }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
              <Line dataKey="slaRate" name="SLA Rate" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Technician SLA Summary</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
            {["Technician","Total Jobs","Completed","Within SLA","Avg Days","Breaches","SLA Rate"].map(h => (
              <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {technicians.map((t, i) => (
              <tr key={t.name} style={{ borderBottom: "1px solid var(--border)", background: i%2===0?"transparent":"var(--bg-secondary)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{t.name}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{t.jobs}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{t.completed}</td>
                <td style={{ padding: "10px 14px", color: "#34d399", fontWeight: 700, fontFamily: ff }}>{t.withinSLA}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{t.avgDays}d</td>
                <td style={{ padding: "10px 14px", color: t.breach > 0 ? "#f87171" : "var(--text-muted)", fontWeight: t.breach > 0 ? 700 : 400, fontFamily: ff }}>{t.breach}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${t.slaRate}%`, height: "100%", background: t.slaRate >= 90 ? "#34d399" : t.slaRate >= 80 ? "#fbbf24" : "#f87171", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.slaRate >= 90 ? "#34d399" : t.slaRate >= 80 ? "#fbbf24" : "#f87171", fontFamily: ff, minWidth: 40 }}>{t.slaRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function ReportsManagement() {
  const [active, setActive] = useState<ReportTab>("Daily Report");
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo,   setDateTo]   = useState(() => new Date().toISOString().slice(0, 10));
  const isMobile = useIsMobile();

  const ActiveIcon = tabs.find(t => t.id === active)!.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>

      {/* Header + sub-nav */}
      <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Reports</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
            Generate and export daily, sales, and repair reports.
          </p>
        </div>

        <div className={isMobile ? "tabs-scroll" : undefined}>
        <div style={{
          display: "flex", gap: 4,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 5, width: "fit-content",
        }}>
          {tabs.map(({ id, icon: Icon, label }) => {
            const isActive = active === id;
            return (
              <button key={id} onClick={() => setActive(id)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8, fontSize: 12.5,
                border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent",
                background: isActive ? "var(--accent-dim)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer", transition: "all 0.18s",
                fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap",
              }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}}
              >
                <Icon size={13} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Section header */}
      <div className="fade-up fade-up-2" style={{
        display: "flex", alignItems: "center", gap: 10,
        paddingBottom: 16, borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: "var(--accent-dim)",
          border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center",
          justifyContent: "center", color: "var(--accent)",
        }}>
          <ActiveIcon size={15} strokeWidth={2.2} />
        </div>
        <div>
          <h2 className="heading" style={{ fontSize: 15, color: "var(--text-primary)" }}>{active}</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{tabDescriptions[active]}</p>
        </div>
      </div>

      {/* Content */}
      <div className="fade-up fade-up-3" style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
        {active === "Daily Report"  && <DailyReport  dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />}
        {active === "Sales Report"  && <SalesReport  dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />}
        {active === "Repair Report" && <RepairReport dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />}
      </div>
    </div>
  );
}
