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
import { getDateLabel } from "@/utils/dataLabel";
import {
  DollarSign, ShoppingCart, Wrench,
  TrendingUp, Smartphone, Package, MoreHorizontal,
  Hammer, Box, ClipboardList,
} from "lucide-react";

export type ActivePage = "Home" | "Repair Management" | "Sales Management" | "Inventory Management" | "Customer Management" | "Admin Control";

export default function Home() {
  const [filter, setFilter] = useState("Daily");
  const [activePage, setActivePage] = useState<ActivePage>("Home");
  const dateLabel = getDateLabel(filter);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <Navbar activePage={activePage} />

        <main style={{
          flex: 1,
          overflowY: activePage === "Repair Management" ? "hidden" : "auto",
          padding: activePage === "Repair Management" ? "28px 28px 0" : "28px 28px 40px",
          display: "flex", flexDirection: "column", gap: 20,
        }}>

          {activePage === "Repair Management" ? (
            <RepairManagement />
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

              <FilterBar active={filter} onChange={setFilter} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <StatGroup index={0} title="Revenue" dateLabel={dateLabel}>
                  <StatCard title="Today Revenue"       value="Rs. 50,000" change="+5%" icon={DollarSign} size="large" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <StatCard title="Total Sales"         value="Rs. 50,000" change="+5%" icon={TrendingUp} size="small" />
                    <StatCard title="Repair Income"       value="Rs. 50,000" change="+5%" icon={Wrench}     size="small" />
                  </div>
                </StatGroup>

                <StatGroup index={1} title="Sales" dateLabel={dateLabel}>
                  <StatCard title="Today Sales"           value="Rs. 50,000" change="+5%" icon={ShoppingCart}    size="large" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <StatCard title="Mobile Sales"        value="Rs. 50,000" change="+5%" icon={Smartphone}      size="small" />
                    <StatCard title="Accessory Sales"     value="Rs. 50,000" change="+5%" icon={Package}         size="small" />
                    <StatCard title="Other Sales"         value="Rs. 50,000" change="+5%" icon={MoreHorizontal}  size="small" />
                  </div>
                </StatGroup>

                <StatGroup index={2} title="Repairs" dateLabel={dateLabel}>
                  <StatCard title="Repair Income"         value="Rs. 50,000" change="+5%" icon={Wrench}        size="large" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <StatCard title="Repair Cost"         value="Rs. 50,000" change="+5%" icon={Hammer}        size="small" />
                    <StatCard title="Parts Cost"          value="Rs. 50,000" change="+5%" icon={Box}           size="small" />
                    <StatCard title="Total Jobs"          value="30"         change="+5%" icon={ClipboardList}  size="small" isCount />
                  </div>
                </StatGroup>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <InfoCard title="Built for Scale"  description="Manage repairs, sales, inventory and customers from one unified dashboard." tag="Platform"    index={0} />
                <InfoCard title="Smart Workflows"  description="Automate your repair pipeline and reduce manual operations."                tag="Automation" accent index={1} />
                <InfoCard title="Work Smart"       description="Build systems that scale without adding complexity."                        tag="Efficiency" index={2} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ChartCard title="Users Growth"   index={0} color="#6366f1" />
                <ChartCard title="Sales Overview" index={1} color="#06b6d4" />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}