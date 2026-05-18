"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import StatCard from "@/components/dashboard/StatCard";
import StatGroup from "@/components/dashboard/StatGroup";
import InfoCard from "@/components/dashboard/InfoCard";
import ChartCard from "@/components/dashboard/ChartCard";
import FilterBar from "@/components/dashboard/FilterBar";
import RepairManagement from "@/components/repair/RepairManagement";
import SalesManagement from "@/components/sales/SalesManagement";
import InventoryManagement from "@/components/inventory/InventoryManagement";
import AdminControl from "@/components/admin/AdminControl";
import CustomerManagement from "@/components/customer/CustomerManagement";
import { InventoryProvider } from "@/contexts/InventoryContext";
import { getDateLabel } from "@/utils/dataLabel";
import {
  DASHBOARD_STATS, REVENUE_CHART_DATA, SALES_CHART_DATA,
  fmtRs, type FilterPeriod,
} from "@/data/dashboardData";
import {
  DollarSign, ShoppingCart, Wrench,
  TrendingUp, Smartphone, Package, MoreHorizontal,
  Hammer, Box, ClipboardList,
} from "lucide-react";

export type ActivePage = "Home" | "Repair Management" | "Sales Management" | "Inventory Management" | "Customer Management" | "Admin Control";

export default function Home() {
  const [filter, setFilter] = useState<FilterPeriod>("Daily");
  const [activePage, setActivePage] = useState<ActivePage>("Home");
  const dateLabel = getDateLabel(filter);

  const s = DASHBOARD_STATS[filter];

  return (
    <InventoryProvider>
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <Navbar activePage={activePage} />

        <main style={{
          flex: 1, position: "relative",
          overflowY: activePage === "Repair Management" || activePage === "Sales Management" || activePage === "Inventory Management" || activePage === "Admin Control" || activePage === "Customer Management" ? "hidden" : "auto",
          padding: activePage === "Repair Management" || activePage === "Sales Management" || activePage === "Inventory Management" || activePage === "Admin Control" || activePage === "Customer Management" ? "28px 28px 0" : "28px 28px 40px",
          display: "flex", flexDirection: "column", gap: 20,
        }}>

          {activePage === "Repair Management" ? (
            <RepairManagement />
          ) : activePage === "Sales Management" ? (
            <SalesManagement />
          ) : activePage === "Inventory Management" ? (
            <InventoryManagement />
          ) : activePage === "Admin Control" ? (
            <AdminControl />
          ) : activePage === "Customer Management" ? (
            <CustomerManagement />
          ) : (
            <>
              <div className="fade-up" style={{ marginBottom: 4 }}>
                <h1 className="heading-xl" style={{ fontSize: 26, color: "var(--text-primary)" }}>
                  Good morning, Admin
                </h1>
                <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 6 }}>
                  Here&apos;s what&apos;s happening with Mano Mobile today.
                </p>
              </div>

              <FilterBar active={filter} onChange={(f) => setFilter(f as FilterPeriod)} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <StatGroup index={0} title="Revenue" dateLabel={dateLabel}>
                  <StatCard title="Total Revenue"   value={fmtRs(s.totalRevenue.value)}   change={s.totalRevenue.change}   icon={DollarSign}  size="large" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <StatCard title="Sales"          value={fmtRs(s.salesRevenue.value)}   change={s.salesRevenue.change}   icon={TrendingUp}  size="small" />
                    <StatCard title="Repairs"        value={fmtRs(s.repairRevenue.value)}  change={s.repairRevenue.change}  icon={Wrench}      size="small" />
                  </div>
                </StatGroup>

                <StatGroup index={1} title="Sales" dateLabel={dateLabel}>
                  <StatCard title="Total Sales"        value={fmtRs(s.totalSales.value)}     change={s.totalSales.change}     icon={ShoppingCart}   size="large" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <StatCard title="Mobile"           value={fmtRs(s.mobileSales.value)}    change={s.mobileSales.change}    icon={Smartphone}     size="small" />
                    <StatCard title="Accessory"        value={fmtRs(s.accessorySales.value)} change={s.accessorySales.change} icon={Package}        size="small" />
                    <StatCard title="Other"            value={fmtRs(s.otherSales.value)}     change={s.otherSales.change}     icon={MoreHorizontal} size="small" />
                  </div>
                </StatGroup>

                <StatGroup index={2} title="Repairs" dateLabel={dateLabel}>
                  <StatCard title="Repair Income"  value={fmtRs(s.repairIncome.value)}  change={s.repairIncome.change}  icon={Wrench}        size="large" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <StatCard title="Labor Cost"   value={fmtRs(s.repairCost.value)}    change={s.repairCost.change}    icon={Hammer}        size="small" />
                    <StatCard title="Parts Cost"   value={fmtRs(s.partsCost.value)}     change={s.partsCost.change}     icon={Box}           size="small" />
                    <StatCard title="Total Jobs"   value={String(s.totalJobs.value)}    change={s.totalJobs.change}     icon={ClipboardList} size="small" isCount />
                  </div>
                </StatGroup>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <InfoCard title="Built for Scale"  description="Manage repairs, sales, inventory and customers from one unified dashboard." tag="Platform"    index={0} />
                <InfoCard title="Smart Workflows"  description="Automate your repair pipeline and reduce manual operations."                tag="Automation" accent index={1} />
                <InfoCard title="Work Smart"       description="Build systems that scale without adding complexity."                        tag="Efficiency" index={2} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ChartCard title="Revenue Growth"  index={0} color="#e8e8e8" data={REVENUE_CHART_DATA} badge="+28%" />
                <ChartCard title="Sales Overview"  index={1} color="#a8a8a8" data={SALES_CHART_DATA}   badge="+24%" />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
    </InventoryProvider>
  );
}
