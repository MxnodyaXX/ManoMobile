"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  DollarSign, Wrench, TrendingUp, Package, AlertTriangle,
  Award, Users, Inbox, PiggyBank, X, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import FilterBar from "@/cashier/components/dashboard/FilterBar";
import { useRepair, type RepairJob } from "@/cashier/contexts/RepairContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import { periodStart, issuedOn, type FigurePeriod } from "@/lib/repair/figures";

const ff = "'Plus Jakarta Sans', sans-serif";
// Reused from the rest of the app (ROLE_COLORS in AdminDashboard, VIEW_META in
// RepairContext) rather than a new palette — one consistent set of meanings
// across every screen: green = money/good, red = cost/owed, blue = in-progress,
// purple = admin/people, amber = attention.
const REVENUE   = "#34d399";
const PARTS     = "#f87171";
const OUTSTAND  = "#f97316";
const PEOPLE    = "#a78bfa";
const WARN      = "#fbbf24";
const MUTED     = "#94a3b8";

const money = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;

/** A job's money is realized once collected — same definition figures.ts uses
 *  for the Cashier dashboard, so the two screens never disagree. */
const isRealized = (j: RepairJob, from: Date) => j.status === "Delivered" && new Date(issuedOn(j)) >= from;

function KPI({ label, value, sub, icon: Icon, color, highlight, onClick }: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string; highlight?: boolean; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "18px 20px", borderRadius: 14,
        border: `1px solid ${hov ? color + "55" : highlight ? color + "35" : "var(--border)"}`,
        background: highlight ? `${color}08` : "var(--bg-card)",
        display: "flex", flexDirection: "column", gap: 12,
        cursor: onClick ? "pointer" : "default", textAlign: "left", width: "100%",
        transition: "border-color 0.15s, transform 0.15s", fontFamily: ff,
        transform: hov && onClick ? "translateY(-1px)" : "none",
        boxShadow: hov && onClick ? "0 6px 20px rgba(0,0,0,0.12)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, fontWeight: 600 }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: highlight ? color : "var(--text-primary)", fontFamily: ff, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{sub}</p>
        {onClick && <ChevronRight size={13} color={hov ? color : "var(--text-muted)"} style={{ flexShrink: 0, transition: "color 0.15s" }} />}
      </div>
    </button>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>{sub}</p>}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "26px 12px", color: "var(--text-muted)" }}>
      <Inbox size={18} />
      <p style={{ fontSize: 12, fontFamily: ff, textAlign: "center", lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

const fmtDate = (d?: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

type KpiKind = "revenue" | "collected" | "outstanding" | "partsCost" | "grossProfit" | "jobsDelivered";

/**
 * The drill-down behind every KPI card — the same rows the number above was
 * summed from, so "why is this Rs. X" always has an answer one click away.
 */
function KpiDetailModal({ kind, insights, onClose }: {
  kind: KpiKind;
  insights: {
    revenue: number; collected: number; outstanding: number; partsCost: number; grossProfit: number;
    realizedJobs: RepairJob[]; outstandingJobs: RepairJob[];
    partsCostRows: { jobId: string; jobDevice: string; partName: string; partSku: string; quantity: number; unitCost: number; lineCost: number }[];
  };
  onClose: () => void;
}) {
  const META: Record<KpiKind, { title: string; color: string }> = {
    revenue:      { title: "Revenue — jobs behind this figure", color: REVENUE },
    collected:    { title: "Collected — advance & settlement", color: REVENUE },
    outstanding:  { title: "Outstanding — jobs still owed", color: OUTSTAND },
    partsCost:    { title: "Parts Cost — line items", color: PARTS },
    grossProfit:  { title: "Gross Profit — how it's derived", color: REVENUE },
    jobsDelivered:{ title: "Jobs Delivered", color: PEOPLE },
  };
  const { title, color } = META[kind];

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1010, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(620px, calc(100vw - 24px))", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{title}</p>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>

          {kind === "grossProfit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
              {[
                ["Revenue", insights.revenue, "var(--text-primary)"],
                ["− Parts Cost", -insights.partsCost, PARTS],
              ].map(([label, val, c]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)", fontFamily: ff }}>{label as string}</span>
                  <span style={{ fontWeight: 600, color: c as string, fontFamily: ff }}>{money(val as number)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>= Gross Profit</span>
                <span style={{ fontWeight: 800, color: REVENUE, fontFamily: ff }}>{money(insights.grossProfit)}</span>
              </div>
            </div>
          )}

          {(kind === "revenue" || kind === "collected" || kind === "jobsDelivered" || kind === "grossProfit") && (
            insights.realizedJobs.length === 0 ? (
              <Empty text="No delivered jobs in this period." />
            ) : (
              <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      {["Job", "Customer", "Issued On", "Est. Cost", "Advance"].map(h => (
                        <th key={h} style={{ textAlign: h === "Job" || h === "Customer" ? "left" : "right", padding: "7px 10px", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: ff }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.realizedJobs.map(j => (
                      <tr key={j.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 10px", fontWeight: 600, color: "var(--accent)", fontFamily: ff }}>{j.id}</td>
                        <td style={{ padding: "7px 10px", color: "var(--text-primary)" }}>{j.customerName}<div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{[j.brand, j.model].filter(Boolean).join(" ")}</div></td>
                        <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{fmtDate(j.handover?.handedOverAt ?? j.completedAt ?? j.createdAt)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, color: "var(--text-primary)" }}>{money(j.estimatedCost)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", color: REVENUE }}>{money(j.advancePaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                      <td colSpan={3} style={{ padding: "7px 10px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Total ({insights.realizedJobs.length} job{insights.realizedJobs.length !== 1 ? "s" : ""})</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{money(insights.revenue)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: REVENUE, fontFamily: ff }}>{money(insights.collected)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}

          {kind === "outstanding" && (
            insights.outstandingJobs.length === 0 ? (
              <Empty text="Nothing outstanding — every job is fully paid." />
            ) : (
              <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      {["Job", "Customer", "Status", "Est. Cost", "Advance", "Balance"].map(h => (
                        <th key={h} style={{ textAlign: h === "Job" || h === "Customer" || h === "Status" ? "left" : "right", padding: "7px 10px", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: ff }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.outstandingJobs.map(j => {
                      const balance = j.estimatedCost - j.advancePaid;
                      return (
                        <tr key={j.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "7px 10px", fontWeight: 600, color: "var(--accent)", fontFamily: ff }}>{j.id}</td>
                          <td style={{ padding: "7px 10px", color: "var(--text-primary)" }}>{j.customerName}</td>
                          <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>{j.status}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-primary)" }}>{money(j.estimatedCost)}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{money(j.advancePaid)}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: OUTSTAND }}>{money(balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                      <td colSpan={5} style={{ padding: "7px 10px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Total ({insights.outstandingJobs.length} job{insights.outstandingJobs.length !== 1 ? "s" : ""})</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: OUTSTAND, fontFamily: ff }}>{money(insights.outstanding)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}

          {kind === "partsCost" && (
            insights.partsCostRows.length === 0 ? (
              <Empty text="No approved/issued part requests tied to a delivered job in this period." />
            ) : (
              <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      {["Job", "Part", "Qty", "Unit Cost", "Line Cost"].map(h => (
                        <th key={h} style={{ textAlign: h === "Job" || h === "Part" ? "left" : "right", padding: "7px 10px", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: ff }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.partsCostRows.map((r, i) => (
                      <tr key={`${r.jobId}-${r.partSku}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 10px", fontWeight: 600, color: "var(--accent)", fontFamily: ff }}>{r.jobId}<div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 400 }}>{r.jobDevice}</div></td>
                        <td style={{ padding: "7px 10px", color: "var(--text-primary)" }}>{r.partName}<div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{r.partSku}</div></td>
                        <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{r.quantity}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{money(r.unitCost)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: PARTS }}>{money(r.lineCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                      <td colSpan={4} style={{ padding: "7px 10px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Total ({insights.partsCostRows.length} line{insights.partsCostRows.length !== 1 ? "s" : ""})</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: PARTS, fontFamily: ff }}>{money(insights.partsCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Last 6 calendar months, oldest first, for the trend chart — independent of
 *  the KPI period filter so there's always a stable longer view underneath it. */
function last6Months(jobs: RepairJob[]) {
  const now = new Date();
  const months: { key: string; label: string; from: Date; to: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({ key: `${from.getFullYear()}-${from.getMonth()}`, label: from.toLocaleDateString("en-GB", { month: "short" }), from, to });
  }
  return months.map(m => ({
    month: m.label,
    revenue: jobs
      .filter(j => j.status === "Delivered" && new Date(issuedOn(j)) >= m.from && new Date(issuedOn(j)) < m.to)
      .reduce((s, j) => s + j.estimatedCost, 0),
  }));
}

const PERIOD_LABEL: Record<FigurePeriod, string> = {
  Daily: "today", Weekly: "this week", Monthly: "this month", Yearly: "this year", All: "all time",
};

export default function BusinessInsights() {
  const { jobs } = useRepair();
  const { parts, partRequests } = useParts();
  const [period, setPeriod] = useState<FigurePeriod>("Monthly");
  const [openKpi, setOpenKpi] = useState<KpiKind | null>(null);

  const insights = useMemo(() => {
    const from = periodStart(period);
    const realized = jobs.filter(j => isRealized(j, from));
    const realizedIds = new Set(realized.map(j => j.id));

    const revenue = realized.reduce((s, j) => s + j.estimatedCost, 0);
    const collected = realized.reduce((s, j) => s + j.advancePaid, 0);
    // Money owed to the shop, full stop — including a job that's already been
    // handed to the customer with a balance left on it. Delivery isn't the
    // same event as getting paid, so it can't be what drops a job out of
    // Outstanding; only Cancelled (no service rendered, nothing owed) does.
    const outstandingJobs = jobs
      .filter(j => j.status !== "Cancelled" && j.estimatedCost - j.advancePaid > 0)
      .sort((a, b) => (b.estimatedCost - b.advancePaid) - (a.estimatedCost - a.advancePaid));
    const outstanding = outstandingJobs.reduce((s, j) => s + Math.max(0, j.estimatedCost - j.advancePaid), 0);

    const fulfilledRequests = partRequests.filter(r => r.status === "Approved" || r.status === "Issued");
    const costOf = (r: typeof fulfilledRequests[number]) => (parts.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity;
    const partsCostRequests = fulfilledRequests.filter(r => realizedIds.has(r.jobId));
    const partsCostRows = partsCostRequests
      .map(r => {
        const job = jobs.find(j => j.id === r.jobId);
        return {
          jobId: r.jobId,
          jobDevice: job ? [job.brand, job.model].filter(Boolean).join(" ") : r.jobDevice,
          partName: r.partName, partSku: r.partSku, quantity: r.quantity,
          unitCost: parts.find(p => p.sku === r.partSku)?.costPrice ?? 0,
          lineCost: costOf(r),
        };
      })
      .sort((a, b) => b.lineCost - a.lineCost);
    const partsCost = partsCostRows.reduce((s, r) => s + r.lineCost, 0);
    const grossProfit = revenue - partsCost;

    // Technician performance — all-time per technician (not period-filtered,
    // so a slow week doesn't erase someone's whole track record).
    const byTech = new Map<string, { jobs: number; revenue: number; partsCost: number }>();
    const delivered = jobs.filter(j => j.status === "Delivered");
    for (const j of delivered) {
      const name = (j.technician || "").trim() || "Unassigned";
      const row = byTech.get(name) ?? { jobs: 0, revenue: 0, partsCost: 0 };
      row.jobs += 1;
      row.revenue += j.estimatedCost;
      byTech.set(name, row);
    }
    for (const r of fulfilledRequests) {
      const job = jobs.find(j => j.id === r.jobId);
      if (!job || job.status !== "Delivered") continue;
      const name = (job.technician || "").trim() || "Unassigned";
      const row = byTech.get(name);
      if (row) row.partsCost += costOf(r);
    }
    const technicians = [...byTech.entries()]
      .map(([name, v]) => ({ name, ...v, margin: v.revenue - v.partsCost }))
      .sort((a, b) => b.revenue - a.revenue);

    // Top parts by cost — all-time, across every fulfilled request.
    const bySku = new Map<string, { name: string; sku: string; qty: number; cost: number }>();
    for (const r of fulfilledRequests) {
      const row = bySku.get(r.partSku) ?? { name: r.partName, sku: r.partSku, qty: 0, cost: 0 };
      row.qty += r.quantity;
      row.cost += costOf(r);
      bySku.set(r.partSku, row);
    }
    const topParts = [...bySku.values()].sort((a, b) => b.cost - a.cost).slice(0, 5);

    const lowStock = parts.filter(p => p.stock <= p.reorderLevel).sort((a, b) => a.stock - b.stock);
    const inventoryValue = parts.reduce((s, p) => s + p.costPrice * p.stock, 0);

    // Top customers by spend — delivered jobs only, keyed by name+phone so two
    // different Kamals with different numbers don't get merged.
    const byCustomer = new Map<string, { name: string; phone: string; jobs: number; spend: number }>();
    for (const j of delivered) {
      const key = `${j.customerName}|${j.phone}`;
      const row = byCustomer.get(key) ?? { name: j.customerName || "Walk-in", phone: j.phone, jobs: 0, spend: 0 };
      row.jobs += 1;
      row.spend += j.estimatedCost;
      byCustomer.set(key, row);
    }
    const topCustomers = [...byCustomer.values()].sort((a, b) => b.spend - a.spend).slice(0, 5);
    const uniqueCustomers = byCustomer.size;

    return {
      revenue, collected, outstanding, partsCost, grossProfit, totalJobs: realized.length,
      technicians, topParts, lowStock, inventoryValue, topCustomers, uniqueCustomers,
      realizedJobs: realized, outstandingJobs, partsCostRows,
    };
  }, [jobs, parts, partRequests, period]);

  const trend = useMemo(() => last6Months(jobs), [jobs]);
  const trendMax = Math.max(1, ...trend.map(t => t.revenue));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Business Insights</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Revenue, parts cost, technician and customer performance across the shop.</p>
        </div>
        <FilterBar active={period} onChange={v => setPeriod(v as FigurePeriod)} />
      </div>

      {/* KPIs — click any card to see exactly which jobs/lines it was summed from */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
        <KPI icon={DollarSign} color={REVENUE} highlight label="Revenue" value={money(insights.revenue)} sub={`Delivered jobs, ${PERIOD_LABEL[period]}`} onClick={() => setOpenKpi("revenue")} />
        <KPI icon={PiggyBank}  color={REVENUE} label="Collected" value={money(insights.collected)} sub={`Advance + settlement, ${PERIOD_LABEL[period]}`} onClick={() => setOpenKpi("collected")} />
        <KPI icon={TrendingUp} color={OUTSTAND} label="Outstanding" value={money(insights.outstanding)} sub="Owed across every job, delivered or not (all time)" onClick={() => setOpenKpi("outstanding")} />
        <KPI icon={Package}    color={PARTS}   label="Parts Cost" value={money(insights.partsCost)} sub={`Approved/issued requests, ${PERIOD_LABEL[period]}`} onClick={() => setOpenKpi("partsCost")} />
        <KPI icon={Award}      color={REVENUE} label="Gross Profit" value={money(insights.grossProfit)} sub="Revenue minus parts cost" onClick={() => setOpenKpi("grossProfit")} />
        <KPI icon={Wrench}     color={PEOPLE}  label="Jobs Delivered" value={String(insights.totalJobs)} sub={PERIOD_LABEL[period]} onClick={() => setOpenKpi("jobsDelivered")} />
      </div>

      {/* Revenue trend */}
      <div className="fade-up">
        <Panel title="Revenue Trend" sub="Delivered jobs by month, last 6 months">
          {trend.every(t => t.revenue === 0) ? (
            <Empty text="No delivered jobs in the last 6 months yet." />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: ff }} axisLine={false} tickLine={false} width={64} tickFormatter={v => `Rs.${Math.round(v / 1000)}k`} />
                <Tooltip
                  cursor={{ fill: "var(--bg-secondary)" }}
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: ff, fontSize: 12 }}
                  formatter={(v) => [money(v as number), "Revenue"]}
                  labelStyle={{ color: "var(--text-primary)", fontWeight: 700 }}
                />
                <Bar dataKey="revenue" fill={REVENUE} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="fade-up resp-grid-2" style={{ gap: 16 }}>

        {/* Technician performance */}
        <Panel title="Technician Performance" sub="All-time, delivered jobs">
          {insights.technicians.length === 0 ? (
            <Empty text="No delivered jobs yet — this fills in as work gets completed and handed over." />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Technician", "Jobs", "Revenue", "Parts", "Margin"].map(h => (
                      <th key={h} style={{ textAlign: h === "Technician" ? "left" : "right", padding: "6px 8px", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: ff }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {insights.technicians.map(t => (
                    <tr key={t.name} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 8px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{t.name}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", color: "var(--text-secondary)" }}>{t.jobs}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", color: "var(--text-primary)", fontWeight: 600 }}>{money(t.revenue)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", color: PARTS }}>{money(t.partsCost)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", color: REVENUE, fontWeight: 700 }}>{money(t.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Top customers */}
        <Panel title="Top Customers" sub="By total spend, delivered jobs, all-time">
          {insights.topCustomers.length === 0 ? (
            <Empty text="No delivered jobs yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {insights.topCustomers.map((c, i) => (
                <div key={`${c.name}-${c.phone}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `${PEOPLE}14`, border: `1px solid ${PEOPLE}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: PEOPLE, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{c.phone || "—"} · {c.jobs} job{c.jobs !== 1 ? "s" : ""}</p>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: REVENUE, fontFamily: ff, flexShrink: 0 }}>{money(c.spend)}</span>
                </div>
              ))}
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>{insights.uniqueCustomers} unique customer{insights.uniqueCustomers !== 1 ? "s" : ""} served, all-time</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="fade-up resp-grid-2" style={{ gap: 16 }}>

        {/* Top parts by cost */}
        <Panel title="Top Parts by Cost" sub="Approved/issued requests, all-time">
          {insights.topParts.length === 0 ? (
            <Empty text="No part requests approved yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {insights.topParts.map(p => (
                <div key={p.sku} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{p.sku} · {p.qty} used</p>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: PARTS, fontFamily: ff, flexShrink: 0 }}>{money(p.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Low stock */}
        <Panel title="Low Stock Parts" sub={`Inventory value: ${money(insights.inventoryValue)}`}>
          {insights.lowStock.length === 0 ? (
            <Empty text={parts.length === 0 ? "No repair parts in the catalog yet — add them in Admin Control → Repair Parts." : "Everything is above its reorder level."} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {insights.lowStock.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: p.stock === 0 ? "rgba(220,38,38,0.06)" : "rgba(251,191,36,0.06)", borderRadius: 8, border: `1px solid ${p.stock === 0 ? "rgba(220,38,38,0.25)" : "rgba(251,191,36,0.25)"}` }}>
                  <AlertTriangle size={13} color={p.stock === 0 ? "#dc2626" : WARN} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{p.category} · reorder at {p.reorderLevel}</p>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: p.stock === 0 ? "#dc2626" : WARN, fontFamily: ff, flexShrink: 0 }}>{p.stock} left</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, textAlign: "center", padding: "4px 0 8px" }}>
        <Users size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
        Figures are computed live from repair jobs and the parts catalog — no separate reporting database.
      </p>

      {openKpi && <KpiDetailModal kind={openKpi} insights={insights} onClose={() => setOpenKpi(null)} />}
    </div>
  );
}
