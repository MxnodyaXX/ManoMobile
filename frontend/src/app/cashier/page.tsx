"use client";

import { useState } from "react";
import Sidebar from "@/cashier/components/sidebar/Sidebar";
import Navbar from "@/cashier/components/navbar/Navbar";
import StatCard from "@/cashier/components/dashboard/StatCard";
import StatGroup from "@/cashier/components/dashboard/StatGroup";
import InfoCard from "@/cashier/components/dashboard/InfoCard";
import ChartCard from "@/cashier/components/dashboard/ChartCard";
import FilterBar from "@/cashier/components/dashboard/FilterBar";
import RepairManagement from "@/cashier/components/repair/RepairManagement";
import SalesManagement from "@/cashier/components/sales/SalesManagement";
import InventoryManagement from "@/cashier/components/inventory/InventoryManagement";
import AdminControl from "@/admin/components/AdminControl";
import CustomerManagement from "@/cashier/components/customer/CustomerManagement";
import ReportsManagement from "@/cashier/components/reports/ReportsManagement";
import CashRegister from "@/cashier/components/cashregister/CashRegister";
import InvoiceHistory from "@/cashier/components/invoicehistory/InvoiceHistory";
import { InventoryProvider } from "@/cashier/contexts/InventoryContext";
import { CashRegisterProvider } from "@/cashier/contexts/CashRegisterContext";
import { RepairProvider } from "@/cashier/contexts/RepairContext";
import { SalesProvider } from "@/cashier/contexts/SalesContext";
import { getDateLabel } from "@/cashier/utils/dataLabel";
import {
  DASHBOARD_STATS, REVENUE_CHART_DATA, SALES_CHART_DATA,
  fmtRs, type FilterPeriod,
} from "@/cashier/data/dashboardData";
import {
  DollarSign, ShoppingCart, Wrench,
  TrendingUp, Smartphone, Package, MoreHorizontal,
  Hammer, Box, ClipboardList,
  AlertTriangle, CheckCircle, Clock, ArrowRight,
} from "lucide-react";

export type ActivePage =
  | "Home"
  | "Repair Management"
  | "Sales Management"
  | "Inventory Management"
  | "Customer Management"
  | "Reports"
  | "Cash Register"
  | "Invoice History"
  | "Admin Control";

/* Pages where the main area should be overflow-hidden (have their own scroll) */
const MANAGED_PAGES: ActivePage[] = [
  "Repair Management", "Sales Management", "Inventory Management",
  "Admin Control", "Customer Management", "Reports",
  "Cash Register", "Invoice History",
];

/* ── Quick-action button on the dashboard ── */
function QuickAction({ label, sub, color, onClick }: { label: string; sub: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "14px 16px", cursor: "pointer",
        textAlign: "left", transition: "border-color 0.18s, background 0.18s",
        fontFamily: "'Plus Jakarta Sans', sans-serif", width: "100%",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-active)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card-hover)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)"; }}
    >
      <div>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginBottom: 8 }} />
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</p>
      </div>
      <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
    </button>
  );
}

/* ── Pending-jobs alert banner ── */
function AlertBanner({ pendingCount, onNavigate }: { pendingCount: number; onNavigate: () => void }) {
  if (pendingCount === 0) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.22)",
      borderRadius: 12, padding: "12px 16px",
    }}>
      <AlertTriangle size={16} color="#fbbf24" style={{ flexShrink: 0 }} />
      <p style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>
        <strong>{pendingCount} repair jobs</strong> are awaiting parts or technician assignment.
      </p>
      <button
        onClick={onNavigate}
        style={{
          fontSize: 12, fontWeight: 600, color: "#fbbf24",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        View Jobs <ArrowRight size={12} />
      </button>
    </div>
  );
}

/* ── Recent-activity feed ── */
const RECENT_ACTIVITY = [
  { icon: CheckCircle, color: "#4ade80", text: "Repair JOB-1041 marked Completed",     time: "2 min ago" },
  { icon: DollarSign,  color: "#60a5fa", text: "Sale INV-2401 — Rs. 1,850 collected",  time: "14 min ago" },
  { icon: Clock,       color: "#fbbf24", text: "JOB-1039 moved to Pending — awaiting parts", time: "1 hr ago" },
  { icon: CheckCircle, color: "#4ade80", text: "Customer Nalini Silva added",           time: "1 hr ago" },
  { icon: DollarSign,  color: "#a78bfa", text: "Cash payment logged — Rs. 12,000",     time: "2 hr ago" },
];

function ActivityFeed() {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Recent Activity</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {RECENT_ACTIVITY.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "9px 10px", borderRadius: 9,
              background: i % 2 === 1 ? "var(--bg-secondary)" : "transparent",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0, marginTop: 1,
                background: `${item.color}14`, border: `1px solid ${item.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center", color: item.color,
              }}>
                <Icon size={12} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{item.text}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Today snapshot strip ── */
function TodaySnapshot() {
  const snaps = [
    { label: "Revenue Today",     value: "Rs. 181,200", color: "#4ade80" },
    { label: "Jobs In Queue",     value: "4",           color: "#fbbf24" },
    { label: "Invoices Issued",   value: "27",          color: "#60a5fa" },
    { label: "Pending Pickups",   value: "3",           color: "#a78bfa" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      {snaps.map(s => (
        <div key={s.label} style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 14px",
        }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>{s.label}</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function CashierPage() {
  const [filter, setFilter] = useState<FilterPeriod>("Daily");
  const [activePage, setActivePage] = useState<ActivePage>("Home");
  const dateLabel = getDateLabel(filter);

  const s = DASHBOARD_STATS[filter];
  const isManaged = MANAGED_PAGES.includes(activePage);

  return (
    <CashRegisterProvider>
    <RepairProvider>
    <SalesProvider>
    <InventoryProvider>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>
        <Sidebar activePage={activePage} onNavigate={setActivePage as (p: string) => void} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <Navbar activePage={activePage} />

          <main style={{
            flex: 1, position: "relative",
            overflowY: isManaged ? "hidden" : "auto",
            padding: isManaged ? "28px 28px 0" : "28px 28px 40px",
            display: "flex", flexDirection: "column", gap: 20,
          }}>

            {activePage === "Repair Management"    && <RepairManagement />}
            {activePage === "Sales Management"     && <SalesManagement />}
            {activePage === "Inventory Management" && <InventoryManagement />}
            {activePage === "Admin Control"        && <AdminControl />}
            {activePage === "Customer Management"  && <CustomerManagement />}
            {activePage === "Reports"              && <ReportsManagement />}
            {activePage === "Cash Register"        && <CashRegister />}
            {activePage === "Invoice History"      && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>
                <div className="fade-up">
                  <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Invoice History</h1>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
                    Search, view, and reprint past invoices.
                  </p>
                </div>
                <div className="fade-up fade-up-2" style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>All sales, repair, and return invoices — filterable by type, status, and date.</p>
                </div>
                <div className="fade-up fade-up-3" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <InvoiceHistory />
                </div>
              </div>
            )}

            {activePage === "Home" && (
              <>
                {/* Greeting */}
                <div className="fade-up" style={{ marginBottom: 0 }}>
                  <h1 className="heading-xl" style={{ fontSize: 26, color: "var(--text-primary)" }}>
                    Good morning, Admin
                  </h1>
                  <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 6 }}>
                    Here&apos;s what&apos;s happening with Mano Mobile today.
                  </p>
                </div>

                {/* Alert banner */}
                <AlertBanner pendingCount={4} onNavigate={() => setActivePage("Repair Management")} />

                {/* Today snapshot */}
                <TodaySnapshot />

                {/* Filter bar */}
                <FilterBar active={filter} onChange={(f) => setFilter(f as FilterPeriod)} />

                {/* Stat groups */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <StatGroup index={0} title="Revenue" dateLabel={dateLabel}>
                    <StatCard title="Total Revenue"   value={fmtRs(s.totalRevenue.value)}   change={s.totalRevenue.change}   icon={DollarSign}  size="large" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <StatCard title="Sales"         value={fmtRs(s.salesRevenue.value)}   change={s.salesRevenue.change}   icon={TrendingUp}  size="small" />
                      <StatCard title="Repairs"       value={fmtRs(s.repairRevenue.value)}  change={s.repairRevenue.change}  icon={Wrench}      size="small" />
                    </div>
                  </StatGroup>

                  <StatGroup index={1} title="Sales" dateLabel={dateLabel}>
                    <StatCard title="Total Sales"     value={fmtRs(s.totalSales.value)}     change={s.totalSales.change}     icon={ShoppingCart}   size="large" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <StatCard title="Mobile"        value={fmtRs(s.mobileSales.value)}    change={s.mobileSales.change}    icon={Smartphone}     size="small" />
                      <StatCard title="Accessory"     value={fmtRs(s.accessorySales.value)} change={s.accessorySales.change} icon={Package}        size="small" />
                      <StatCard title="Other"         value={fmtRs(s.otherSales.value)}     change={s.otherSales.change}     icon={MoreHorizontal} size="small" />
                    </div>
                  </StatGroup>

                  <StatGroup index={2} title="Repairs" dateLabel={dateLabel}>
                    <StatCard title="Repair Income"   value={fmtRs(s.repairIncome.value)}  change={s.repairIncome.change}  icon={Wrench}        size="large" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <StatCard title="Labor Cost"    value={fmtRs(s.repairCost.value)}    change={s.repairCost.change}    icon={Hammer}        size="small" />
                      <StatCard title="Parts Cost"    value={fmtRs(s.partsCost.value)}     change={s.partsCost.change}     icon={Box}           size="small" />
                      <StatCard title="Total Jobs"    value={String(s.totalJobs.value)}    change={s.totalJobs.change}     icon={ClipboardList} size="small" isCount />
                    </div>
                  </StatGroup>
                </div>

                {/* Quick actions + Activity feed */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Actions</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <QuickAction label="New Repair Job"   sub="Register a device"       color="#34d399" onClick={() => setActivePage("Repair Management")} />
                      <QuickAction label="New Sale"         sub="Process a transaction"   color="#60a5fa" onClick={() => setActivePage("Sales Management")} />
                      <QuickAction label="Cash Register"    sub="Manage the drawer"       color="#fbbf24" onClick={() => setActivePage("Cash Register")} />
                      <QuickAction label="View Reports"     sub="Daily & sales reports"   color="#a78bfa" onClick={() => setActivePage("Reports")} />
                    </div>
                  </div>
                  <ActivityFeed />
                </div>

                {/* Charts */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <ChartCard title="Revenue Growth"  index={0} color="#e8e8e8" data={REVENUE_CHART_DATA} badge="+28%" />
                  <ChartCard title="Sales Overview"  index={1} color="#a8a8a8" data={SALES_CHART_DATA}   badge="+24%" />
                </div>

                {/* Info cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <InfoCard title="Built for Scale"  description="Manage repairs, sales, inventory and customers from one unified dashboard." tag="Platform"    index={0} />
                  <InfoCard title="Smart Workflows"  description="Automate your repair pipeline and reduce manual operations."                tag="Automation" accent index={1} />
                  <InfoCard title="Work Smart"       description="Build systems that scale without adding complexity."                        tag="Efficiency" index={2} />
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </InventoryProvider>
    </SalesProvider>
    </RepairProvider>
    </CashRegisterProvider>
  );
}
