"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Users, ShoppingCart, Wrench, Clock, Timer, RotateCcw, AlertCircle, ChevronRight, X } from "lucide-react";
import type { StaffProfile } from "@/lib/staff/api";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useAdmin } from "@/admin/contexts/AdminContext";
import { fetchSales } from "@/lib/sales/api";
import type { SaleTx } from "@/cashier/contexts/SalesContext";
import type { FigurePeriod } from "@/lib/repair/figures";
import { repairStatusSlices } from "@/lib/repair/figures";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { VizStyle } from "@/cashier/components/dashboard/charts/viz";
import RepairStatusDonut from "@/cashier/components/dashboard/charts/RepairStatusDonut";
import {
  type Filters, type RangeChoice, type RoleFilter, type RepairStatusFilter, type SalesTypeFilter,
  type CashierRow, type TechnicianRow, type CreditPayment,
  windowFor, fetchCreditPayments, headline, cashierRows, technicianRows, supplierRows,
  salesByCashier, dailyStaffSales, workloadByTechnician, turnaroundByTechnician, purchasesBySupplier,
  recentActivity, activityTrend, norm, salesIn, jobsIn,
} from "@/lib/staff/insights";
import { RankedBars, DailyStaffSales, TechnicianWorkload, RepairTurnaround } from "./insightCharts";

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const rsK = (n: number) => (Math.abs(n) >= 1_000_000 ? `Rs. ${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 10_000 ? `Rs. ${Math.round(n / 1000)}K` : rs(n));
const dayStr = (d: number | null) => (d === null ? "—" : d < 0.05 ? "< 0.1 d" : `${d.toFixed(1)} d`);
const pct = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(1)}%`);

/**
 * Staff Insights.
 *
 * Filters on top; six figures that answer "how is the shop doing"; then the
 * detail, split the way the work is split — the counter, the bench, and the
 * partners the stock comes from — with an Overview that shows the charts
 * from each. Clicking a person opens their own page: their figures for the
 * window, six months of trend, and the last things they did.
 *
 * All arithmetic is in lib/staff/insights.ts; this file chooses and draws.
 */

const RANGES: { id: RangeChoice; label: string }[] = [
  { id: "Daily", label: "Today" }, { id: "Weekly", label: "7 days" }, { id: "Monthly", label: "This month" },
  { id: "Yearly", label: "This year" }, { id: "All", label: "All time" }, { id: "Custom", label: "Custom" },
];
const ROLES: RoleFilter[] = ["All", "Cashier", "POS Cashier", "Technician", "Admin"];
const REPAIR_STATUS: RepairStatusFilter[] = ["All", "Not started", "In progress", "Waiting", "Ready", "Delivered"];
const SALES_TYPES: SalesTypeFilter[] = ["All", "Repair", "Accessories", "Mobile", "Others"];
type SubTab = "overview" | "cashiers" | "technicians" | "suppliers";

export default function StaffInsights({ staff }: { staff: StaffProfile[] }) {
  const { jobs } = useRepair();
  const { suppliers, purchaseOrders } = useAdmin();

  const [range, setRange] = useState<RangeChoice>("Monthly");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [role, setRole] = useState<RoleFilter>("All");
  const [staffName, setStaffName] = useState("");
  const [repairStatus, setRepairStatus] = useState<RepairStatusFilter>("All");
  const [salesType, setSalesType] = useState<SalesTypeFilter>("All");
  const [tab, setTab] = useState<SubTab>("overview");
  const [person, setPerson] = useState<StaffProfile | null>(null);

  // The ledgers this screen reads that no context on the admin shell holds.
  const [sales, setSales] = useState<SaleTx[] | null>(() => (isSupabaseConfigured() ? null : []));
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let live = true;
    fetchSales().then(r => { if (live) setSales(r); }).catch(e => { if (live) { setError(e instanceof Error ? e.message : String(e)); setSales([]); } });
    fetchCreditPayments().then(r => { if (live) setPayments(r); }).catch(() => { /* the column stays at zero */ });
    return () => { live = false; };
  }, []);

  const filters: Filters = useMemo(() => ({
    window: windowFor(range, custom), role, staff: staffName, repairStatus, salesType,
  }), [range, custom, role, staffName, repairStatus, salesType]);
  // The chart buckets follow the range; a custom window draws by day.
  const period: FigurePeriod = range === "Custom" ? "Daily" : range;
  const rangeLabel = RANGES.find(r => r.id === range)!.label;

  const view = useMemo(() => {
    const s = sales ?? [];
    const cashiers = cashierRows(staff, s, payments, filters);
    const techs = technicianRows(staff, jobs, filters);
    const sups = supplierRows(suppliers, purchaseOrders, filters.window);
    return {
      head: headline(staff, s, jobs, filters),
      cashiers, techs, sups,
      salesBars: salesByCashier(cashiers),
      daily: dailyStaffSales(s, filters, period),
      workload: workloadByTechnician(techs),
      turnaround: turnaroundByTechnician(techs),
      purchases: purchasesBySupplier(sups),
      status: repairStatusSlices(jobsIn(jobs, { ...filters, repairStatus: "All" })),
    };
  }, [staff, sales, payments, jobs, suppliers, purchaseOrders, filters, period]);

  const people = staff.filter(s => role === "All" || s.role === role).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const openPerson = (name: string) => {
    const p = staff.find(s => norm(s.fullName) === norm(name));
    if (p) setPerson(p);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: ff }}>
      <VizStyle />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <Pick label="Date range" value={range} onChange={v => setRange(v as RangeChoice)} options={RANGES.map(r => ({ value: r.id, label: r.label }))} />
        {range === "Custom" && (
          <>
            <Pick label="From" type="date" value={custom.from} onChange={v => setCustom(c => ({ ...c, from: v }))} />
            <Pick label="To" type="date" value={custom.to} onChange={v => setCustom(c => ({ ...c, to: v }))} />
          </>
        )}
        <Pick label="Role" value={role} onChange={v => { setRole(v as RoleFilter); setStaffName(""); }} options={ROLES.map(r => ({ value: r, label: r === "All" ? "All roles" : r }))} />
        <Pick label="Staff member" value={staffName} onChange={setStaffName} options={[{ value: "", label: "Everyone" }, ...people.map(p => ({ value: p.fullName, label: p.fullName }))]} />
        <Pick label="Repair status" value={repairStatus} onChange={v => setRepairStatus(v as RepairStatusFilter)} options={REPAIR_STATUS.map(r => ({ value: r, label: r === "All" ? "Any status" : r }))} />
        <Pick label="Sales type" value={salesType} onChange={v => setSalesType(v as SalesTypeFilter)} options={SALES_TYPES.map(r => ({ value: r, label: r === "All" ? "All sales" : r }))} />
        {sales === null && <span style={{ fontSize: 12, color: "var(--text-muted)", paddingBottom: 9 }}>Loading sales…</span>}
      </div>

      {error && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Sales could not be read: {error}. The bench figures still stand.</p>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Kpi icon={<Users size={14} />} color="#a78bfa" label="Active staff" value={String(view.head.activeStaff)} sub={role === "All" ? "on the roster" : role} />
        <Kpi icon={<ShoppingCart size={14} />} color="#6355ff" label="Sales handled" value={rsK(view.head.salesValue)} sub={`${view.head.invoices} invoices · ${rangeLabel.toLowerCase()}`} />
        <Kpi icon={<Wrench size={14} />} color="#34d399" label="Repairs completed" value={String(view.head.completed)} sub={rangeLabel.toLowerCase()} />
        <Kpi icon={<Clock size={14} />} color="#60a5fa" label="Jobs in progress" value={String(view.head.inProgress)} sub="on the bench now" />
        <Kpi icon={<Timer size={14} />} color="#fbbf24" label="Avg repair turnaround" value={dayStr(view.head.avgRepairDays)} sub="started → finished" />
        <Kpi icon={<RotateCcw size={14} />} color="#f87171" label="Refund / return cases" value={String(view.head.returns)} sub="refunds and returned repairs" />
      </div>

      {/* ── Sub-tabs ────────────────────────────────────────────────────── */}
      <div className="fade-up" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
        {([["overview", "Overview"], ["cashiers", "Cashiers"], ["technicians", "Technicians"], ["suppliers", "Suppliers"]] as const).map(([id, label]) => {
          const on = tab === id;
          return <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: on ? 700 : 500, fontFamily: ff, cursor: "pointer", border: "none", background: on ? "var(--accent-dim)" : "transparent", color: on ? "var(--accent)" : "var(--text-secondary)", whiteSpace: "nowrap" }}>{label}</button>;
        })}
      </div>

      {/* ── Overview ────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <>
          <div className="fade-up resp-grid-2">
            <RankedBars title="Sales by Cashier" subtitle={`Invoiced value · ${rangeLabel.toLowerCase()}`} data={view.salesBars} color="var(--viz-1)" />
            <TechnicianWorkload data={view.workload} />
          </div>
          <div className="fade-up resp-grid-2">
            <RepairStatusDonut slices={view.status} onPick={() => {}} />
            <RepairTurnaround data={view.turnaround} />
          </div>
          <div className="fade-up resp-grid-2">
            <DailyStaffSales points={view.daily.points} series={view.daily.series} subtitle={`Top ${Math.max(1, view.daily.series.length)} at the counter, per day`} />
            <RankedBars title="Supplier Purchase Value" subtitle={`Purchase orders placed · ${rangeLabel.toLowerCase()}`} data={view.purchases} color="var(--viz-2)" />
          </div>
          <Section title="Staff performance" hint="Everyone on the roster, with what they did in the window. Click a row for their page.">
            <table style={tableSt}>
              <thead><tr><Th>Name</Th><Th>Role</Th><Th>Activity</Th><Th num>Value</Th><Th> </Th></tr></thead>
              <tbody>
                {people.length === 0 && <Empty cols={5} text="Nobody on the roster." />}
                {people.map(p => {
                  const c = view.cashiers.find(r => norm(r.name) === norm(p.fullName));
                  const t = view.techs.find(r => norm(r.name) === norm(p.fullName));
                  const activity = p.role === "Technician"
                    ? `${t?.completed ?? 0} repairs finished · ${t?.outstanding ?? 0} open`
                    : `${c?.invoices ?? 0} sales · ${c?.refunds ?? 0} refunds`;
                  const value = p.role === "Technician" ? (t?.revenue ?? 0) : (c?.sales ?? 0);
                  return (
                    <tr key={p.id} onClick={() => setPerson(p)} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-secondary)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <Td><Person name={p.fullName} role={null} color={roleColor(p.role)} /></Td>
                      <Td><span style={{ fontSize: 11, fontWeight: 700, color: roleColor(p.role), background: `${roleColor(p.role)}14`, border: `1px solid ${roleColor(p.role)}30`, borderRadius: 999, padding: "2px 9px" }}>{p.role}</span></Td>
                      <Td>{activity}</Td>
                      <Td num strong>{value > 0 ? rs(value) : "—"}</Td>
                      <Td num><span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 3 }}>View <ChevronRight size={13} /></span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        </>
      )}

      {/* ── Cashiers ────────────────────────────────────────────────────── */}
      {tab === "cashiers" && (
        <>
          <div className="fade-up resp-grid-2">
            <RankedBars title="Sales by Cashier" subtitle={`Invoiced value · ${rangeLabel.toLowerCase()}`} data={view.salesBars} color="var(--viz-1)" />
            <DailyStaffSales points={view.daily.points} series={view.daily.series} subtitle={`Top ${Math.max(1, view.daily.series.length)} at the counter, per day`} />
          </div>
          <Section title="Cashiers" hint="From the sales ledger — who rang up each invoice — and the credit payments they took. Click a row for their page.">
            <table style={tableSt}>
              <thead><tr>
                <Th>Cashier</Th><Th num>Invoices</Th><Th num>Sales</Th><Th num>Avg bill</Th><Th num>Accessories</Th><Th num>Repair payments</Th>
                <Th num>Credit collected</Th><Th num>Discounts</Th><Th num>Refunds</Th><Th num>Voided</Th><Th>Cash / Card / Other</Th>
              </tr></thead>
              <tbody>
                {view.cashiers.length === 0 && <Empty cols={11} text="Nothing at the counter in this window." />}
                {view.cashiers.map(r => <CashierTr key={r.name} r={r} onOpen={() => openPerson(r.name)} />)}
              </tbody>
            </table>
          </Section>
        </>
      )}

      {/* ── Technicians ─────────────────────────────────────────────────── */}
      {tab === "technicians" && (
        <>
          <div className="fade-up resp-grid-2">
            <TechnicianWorkload data={view.workload} />
            <RepairTurnaround data={view.turnaround} />
          </div>
          <Section title="Technicians" hint="From the repair jobs. Snapshot columns (not started, in progress, waiting, urgent) show the bench as it is now; the rest are for the window. Click a row for their page.">
            <table style={tableSt}>
              <thead><tr>
                <Th>Technician</Th><Th num>Assigned</Th><Th num>Started</Th><Th num>Completed</Th><Th num>Not started</Th><Th num>In progress</Th><Th num>Waiting</Th>
                <Th num>Avg repair</Th><Th num>Avg wait to start</Th><Th num>Same-day</Th><Th num>Repeat / warranty</Th><Th num>Returned</Th><Th num>Repeat rate</Th>
                <Th num>Parts used</Th><Th num>Revenue</Th><Th num>Urgent</Th>
              </tr></thead>
              <tbody>
                {view.techs.length === 0 && <Empty cols={16} text="No technicians on the roster." />}
                {view.techs.map(r => <TechTr key={r.name} r={r} onOpen={() => openPerson(r.name)} />)}
              </tbody>
            </table>
          </Section>
          <RepeatRate rows={view.techs} />
        </>
      )}

      {/* ── Suppliers ───────────────────────────────────────────────────── */}
      {tab === "suppliers" && (
        <>
          <div className="fade-up resp-grid-2">
            <RankedBars title="Supplier Purchase Value" subtitle={`Purchase orders placed · ${rangeLabel.toLowerCase()}`} data={view.purchases} color="var(--viz-2)" />
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>About these figures</p>
              Suppliers are partners, not staff, so they sit on their own tab. Purchases come from purchase orders that are past Draft;
              items and received counts from their lines; outstanding is the supplier&rsquo;s current payables balance.
              Delivery time and returns to supplier are not shown because the system does not yet record delivery dates or supplier returns —
              the columns would be guesses.
            </div>
          </div>
          <Section title="Suppliers" hint="Purchase orders in the window; outstanding is today's balance.">
            <table style={tableSt}>
              <thead><tr><Th>Supplier</Th><Th>Supplies</Th><Th num>Purchases</Th><Th num>Orders</Th><Th num>Items</Th><Th num>Received</Th><Th num>Avg order</Th><Th num>Outstanding</Th><Th>Last order</Th></tr></thead>
              <tbody>
                {view.sups.length === 0 && <Empty cols={9} text="No suppliers yet." />}
                {view.sups.map(r => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td><Person name={r.name} role={null} color="#60a5fa" /></Td>
                    <Td>{r.categories || "—"}</Td>
                    <Td num strong>{r.purchases ? rs(r.purchases) : "—"}</Td>
                    <Td num>{r.orders || "—"}</Td>
                    <Td num>{r.items || "—"}</Td>
                    <Td num>{r.items ? `${r.received} / ${r.items}` : "—"}</Td>
                    <Td num>{r.orders ? rs(r.avgOrder) : "—"}</Td>
                    <Td num tone={r.outstanding > 0 ? "#fbbf24" : undefined}>{r.outstanding > 0 ? rs(r.outstanding) : "—"}</Td>
                    <Td>{r.lastOrder ? r.lastOrder.slice(0, 10) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}

      {person && (
        <PersonProfile
          person={person}
          filters={filters}
          rangeLabel={rangeLabel}
          sales={sales ?? []}
          payments={payments}
          cashier={view.cashiers.find(r => norm(r.name) === norm(person.fullName)) ?? null}
          tech={view.techs.find(r => norm(r.name) === norm(person.fullName)) ?? null}
          onClose={() => setPerson(null)}
        />
      )}
    </div>
  );
}

/* ── Rows ───────────────────────────────────────────────────────────────── */

function CashierTr({ r, onOpen }: { r: CashierRow; onOpen: () => void }) {
  const total = r.cash + r.card + r.other;
  const share = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");
  return (
    <tr onClick={onOpen} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-secondary)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      <Td><Person name={r.name} role={r.role} color="#6355ff" /></Td>
      <Td num strong>{r.invoices}</Td>
      <Td num strong>{rs(r.sales)}</Td>
      <Td num>{r.invoices ? rs(r.avgBill) : "—"}</Td>
      <Td num>{r.accessorySales ? rs(r.accessorySales) : "—"}</Td>
      <Td num>{r.repairCollected ? rs(r.repairCollected) : "—"}</Td>
      <Td num>{r.creditCollected ? rs(r.creditCollected) : "—"}</Td>
      <Td num tone={r.discounts > 0 ? "#fbbf24" : undefined}>{r.discounts > 0 ? rs(r.discounts) : "—"}</Td>
      <Td num tone={r.refunds > 0 ? "#f87171" : undefined}>{r.refunds ? `${r.refunds} · ${rs(r.refundValue)}` : "—"}</Td>
      <Td num tone={r.voided > 0 ? "#f87171" : undefined}>{r.voided || "—"}</Td>
      <Td>{total ? `${share(r.cash)} / ${share(r.card)} / ${share(r.other)}` : "—"}</Td>
    </tr>
  );
}

function TechTr({ r, onOpen }: { r: TechnicianRow; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-secondary)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      <Td><Person name={r.name} role={r.role} color="#34d399" /></Td>
      <Td num>{r.assigned || "—"}</Td>
      <Td num>{r.started || "—"}</Td>
      <Td num strong>{r.completed}</Td>
      <Td num tone={r.notStarted > 0 ? "#60a5fa" : undefined}>{r.notStarted || "—"}</Td>
      <Td num tone={r.inProgress > 0 ? "#fbbf24" : undefined}>{r.inProgress || "—"}</Td>
      <Td num tone={r.waiting > 0 ? "#f472b6" : undefined}>{r.waiting || "—"}</Td>
      <Td num>{dayStr(r.avgRepairDays)}</Td>
      <Td num>{dayStr(r.avgQueueDays)}</Td>
      <Td num>{r.sameDay || "—"}</Td>
      <Td num>{r.repeat || "—"}</Td>
      <Td num tone={r.returned > 0 ? "#f87171" : undefined}>{r.returned || "—"}</Td>
      <Td num tone={r.repeatRate !== null && r.repeatRate > 0.1 ? "#f87171" : undefined}>{pct(r.repeatRate)}</Td>
      <Td num>{r.partsUsed || "—"}</Td>
      <Td num strong>{r.revenue ? rs(r.revenue) : "—"}</Td>
      <Td num tone={r.urgent > 0 ? "#f87171" : undefined}>{r.urgent || "—"}</Td>
    </tr>
  );
}

/** The one figure worth calling out on its own: how much finished work comes back. */
function RepeatRate({ rows }: { rows: TechnicianRow[] }) {
  const completed = rows.reduce((t, r) => t + r.completed, 0);
  const back = rows.reduce((t, r) => t + r.returned + r.repeat, 0);
  const rate = completed ? back / completed : null;
  return (
    <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>Repeat repair rate</p>
        <p style={{ fontSize: 26, fontWeight: 800, color: rate !== null && rate > 0.1 ? "#f87171" : "var(--text-primary)", letterSpacing: "-0.02em" }}>{pct(rate)}</p>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 520 }}>
        <strong style={{ color: "var(--text-primary)" }}>{completed}</strong> repairs finished in the window; <strong style={{ color: "var(--text-primary)" }}>{back}</strong> of them came back —
        returned as unrepairable, or a re-job of an earlier repair on the same device. The rate is the second over the first.
      </p>
    </div>
  );
}

/* ── One person ─────────────────────────────────────────────────────────── */

function PersonProfile({ person, filters, rangeLabel, sales, payments, cashier, tech, onClose }: {
  person: StaffProfile; filters: Filters; rangeLabel: string; sales: SaleTx[]; payments: CreditPayment[];
  cashier: CashierRow | null; tech: TechnicianRow | null; onClose: () => void;
}) {
  const { jobs } = useRepair();
  const color = roleColor(person.role);
  const isTech = person.role === "Technician";
  const trend = activityTrend(person, sales, jobs);
  const recent = recentActivity(person, sales, jobs, payments);
  const max = Math.max(1, ...trend.map(t => t.value));
  // Their own figures, for the window in force — the row on the table.
  const facts: [string, string][] = isTech
    ? [
        ["Jobs completed", String(tech?.completed ?? 0)], ["Jobs in progress", String(tech?.inProgress ?? 0)], ["Waiting", String(tech?.waiting ?? 0)],
        ["Avg repair time", dayStr(tech?.avgRepairDays ?? null)], ["Warranty / repeat", String(tech?.repeat ?? 0)], ["Returned", String(tech?.returned ?? 0)],
        ["Parts used", String(tech?.partsUsed ?? 0)], ["Repair revenue", rs(tech?.revenue ?? 0)],
      ]
    : [
        ["Sales handled", rs(cashier?.sales ?? 0)], ["Invoices", String(cashier?.invoices ?? 0)], ["Average invoice", cashier?.invoices ? rs(cashier.avgBill) : "—"],
        ["Accessory sales", rs(cashier?.accessorySales ?? 0)], ["Discounts", rs(cashier?.discounts ?? 0)], ["Refunds", String(cashier?.refunds ?? 0)],
        ["Credit collected", rs(cashier?.creditCollected ?? 0)], ["Voided bills", String(cashier?.voided ?? 0)],
      ];
  // What the window actually holds for them — so a quiet person is honest.
  const inWindowCount = isTech ? jobsIn(jobs, { ...filters, staff: person.fullName }).length : salesIn(sales, { ...filters, staff: person.fullName }).length;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: ff }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 760, maxHeight: "calc(100vh - 40px)", overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}14`, border: `1px solid ${color}30`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800 }}>{(person.fullName[0] ?? "?").toUpperCase()}</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{person.fullName}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{person.role}{person.speciality ? ` · ${person.speciality}` : ""} · {rangeLabel}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={16} /></button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {facts.map(([k, v]) => (
              <div key={k} style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k}</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{v}</p>
              </div>
            ))}
          </div>
          {inWindowCount === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Nothing recorded for {person.fullName.split(" ")[0]} in this window — the trend and activity below cover all time.</p>
          )}

          {/* Six months, as bars: the shape of somebody's output, not a precise
              reading — the exact figures are in the tiles above. */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
              Activity trend · {isTech ? "repairs finished" : "sales value"} · last 6 months
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
              {trend.map(t => (
                <div key={t.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }} title={`${t.name}: ${isTech ? t.value : rs(t.value)}`}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{isTech ? t.value : rsK(t.value)}</span>
                  <div style={{ width: "100%", maxWidth: 48, height: `${Math.max(3, (t.value / max) * 70)}%`, background: color, borderRadius: "4px 4px 0 0", opacity: t.value ? 1 : 0.25 }} />
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Recent activity</p>
            {recent.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nothing recorded yet.</p>
            ) : recent.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 }}>
                <span style={{ color: "var(--text-muted)", width: 96, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtWhen(a.when)}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600, minWidth: 0, flex: 1 }}>{a.label}{a.detail ? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {a.detail}</span> : null}</span>
                {a.amount !== null && <span style={{ fontWeight: 700, color: a.amount < 0 ? "#f87171" : "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{a.amount < 0 ? `− ${rs(-a.amount)}` : rs(a.amount)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const roleColor = (role: string) =>
  role === "Technician" ? "#34d399" : role === "Admin" ? "#a78bfa" : role === "POS Cashier" ? "#8b5cf6" : role === "Accounts" ? "#f59e0b" : "#6355ff";

const fmtWhen = (iso: string) => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return dateOnly
    ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

function Pick({ label, value, onChange, options, type }: { label: string; value: string; onChange: (v: string) => void; options?: { value: string; label: string }[]; type?: "date" }) {
  const box: React.CSSProperties = { height: 36, padding: "0 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12.5, fontFamily: ff, outline: "none", minWidth: 140 };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      {type === "date"
        ? <input type="date" value={value} onChange={e => onChange(e.target.value)} style={box} />
        : <select value={value} onChange={e => onChange(e.target.value)} style={{ ...box, cursor: "pointer" }}>{options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
    </label>
  );
}

function Kpi({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-muted)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        <span style={{ color }}>{icon}</span>{label}
      </div>
      <p style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{sub}</p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px 10px" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{hint}</p>
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

function Person({ name, role, color }: { name: string; role: string | null; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${color}14`, border: `1px solid ${color}30`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
        {(name[0] ?? "?").toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
        {role !== null && <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{role || "Not on the roster"}</p>}
      </div>
    </div>
  );
}

const tableSt: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
function Th({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return <th style={{ textAlign: num ? "right" : "left", padding: "8px 14px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", background: "var(--bg-secondary)", whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, num, strong, tone }: { children: React.ReactNode; num?: boolean; strong?: boolean; tone?: string }) {
  return <td style={{ textAlign: num ? "right" : "left", padding: "10px 14px", fontWeight: strong ? 700 : 500, color: tone ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{children}</td>;
}
function Empty({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} style={{ padding: "22px 16px", textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>{text}</td></tr>;
}
