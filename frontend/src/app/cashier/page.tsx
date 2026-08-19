"use client";

import { useState } from "react";
import Sidebar from "@/cashier/components/sidebar/Sidebar";
import Navbar from "@/cashier/components/navbar/Navbar";
import StatCard from "@/cashier/components/dashboard/StatCard";
import InsightModal from "@/cashier/components/dashboard/InsightModal";
import {
  repairIncomeInsight, totalJobsInsight, partsCostInsight, labourInsight,
  profitInsight, salesInsight, snapshotInsight, type InsightSpec,
} from "@/cashier/components/dashboard/insightBuilders";
import { useTechnicianRates } from "@/lib/settings/staffRules";
import { labourForJob } from "@/lib/repair/labour";
import StatGroup from "@/cashier/components/dashboard/StatGroup";
import InfoCard from "@/cashier/components/dashboard/InfoCard";
import ChartCard from "@/cashier/components/dashboard/ChartCard";
import FilterBar from "@/cashier/components/dashboard/FilterBar";
import RepairManagement, { type RepairSection } from "@/cashier/components/repair/RepairManagement";
import WarrantyCenter from "@/cashier/components/warranty/WarrantyCenter";
import { useRepair, jobLabel, type RepairJob } from "@/cashier/contexts/RepairContext";
import SalesManagement from "@/cashier/components/sales/SalesManagement";
import InventoryManagement from "@/cashier/components/inventory/InventoryManagement";
import AdminControl from "@/admin/components/AdminControl";
import CustomerManagement from "@/cashier/components/customer/CustomerManagement";
import ReportsManagement from "@/cashier/components/reports/ReportsManagement";
import CashRegister from "@/cashier/components/cashregister/CashRegister";
import InvoiceHistory from "@/cashier/components/invoicehistory/InvoiceHistory";
import AuditLog from "@/cashier/components/audit/AuditLog";
import JobScanFab from "@/cashier/components/shared/JobScanFab";
import { InventoryProvider } from "@/cashier/contexts/InventoryContext";
import { PartsProvider, useParts } from "@/cashier/contexts/PartsContext";
import { CashRegisterProvider } from "@/cashier/contexts/CashRegisterContext";
import { RepairProvider } from "@/cashier/contexts/RepairContext";
import { WarrantyProvider } from "@/cashier/contexts/WarrantyContext";
import { SalesProvider } from "@/cashier/contexts/SalesContext";
import { ShiftProvider } from "@/cashier/contexts/ShiftContext";
import { HeldSalesProvider } from "@/cashier/contexts/HeldSalesContext";
import { AuditProvider } from "@/cashier/contexts/AuditContext";
import { getDateLabel } from "@/cashier/utils/dataLabel";
import {
  REVENUE_CHART_DATA, SALES_CHART_DATA,
  fmtRs, type FilterPeriod,
} from "@/cashier/data/dashboardData";
import {
  DollarSign, ShoppingCart, Wrench,
  TrendingUp, Smartphone, Package, MoreHorizontal,
  Hammer, Box, ClipboardList,
  AlertTriangle, CheckCircle, Clock, ArrowRight,
} from "lucide-react";
import { useIssuedFigures, type IssuedFigures } from "@/lib/repair/figures";

export type ActivePage =
  | "Home"
  | "Repair Management"
  | "Warranty Center"
  | "Sales Management"
  | "Inventory Management"
  | "Customer Management"
  | "Reports"
  | "Cash Register"
  | "Invoice History"
  | "Audit Trail"
  | "Admin Control";

/* Pages where the main area should be overflow-hidden (have their own scroll) */
const MANAGED_PAGES: ActivePage[] = [
  "Repair Management", "Warranty Center", "Sales Management", "Inventory Management",
  "Admin Control", "Customer Management", "Reports",
  "Cash Register", "Invoice History", "Audit Trail",
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

/* ── Pending-jobs alert banner (started jobs that are paused, with reasons) ── */
function PendingAlert({ onView }: { onView: () => void }) {
  const { jobs } = useRepair();
  const paused = jobs.filter(j => jobLabel(j) === "Pending");
  if (paused.length === 0) return null;
  return (
    <button
      onClick={onView}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left",
        background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: 12, padding: "12px 16px", cursor: "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
          <strong>{paused.length} started {paused.length === 1 ? "job is" : "jobs are"} paused</strong> — waiting on the reasons below.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
          {paused.slice(0, 3).map(j => (
            <p key={j.id} style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{j.id}</span> {j.brand} {j.model}
              {j.pauseReason ? <> — ⏸ {j.pauseReason}</> : <> — no reason recorded</>}
            </p>
          ))}
          {paused.length > 3 && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>+{paused.length - 3} more…</p>}
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        View <ArrowRight size={12} />
      </span>
    </button>
  );
}

/* ── Recent-activity feed ── */
const RECENT_ACTIVITY: { icon: React.ComponentType<{ size?: number; color?: string }>; color: string; text: string; time: string }[] = [];

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
              <div style={{ flex: 1, minWidth: 0 }}>
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
function TodaySnapshot({ onNavigate }: { onNavigate: (section?: RepairSection) => void }) {
  // Counted from live repair jobs. Sales figures are absent rather than zero:
  // there is no sales backend yet, and an invented "Revenue Today" is the most
  // misleading number a shop dashboard could show.
  const { jobs } = useRepair();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState<{ spec: InsightSpec; section?: RepairSection } | null>(null);

  // Each tile knows the jobs behind it and where those jobs live, so the count
  // is never a dead end — you can always get from the number to the rows.
  const snaps: {
    label: string; color: string; section: RepairSection;
    jobs: RepairJob[]; subtitle: string; empty: string;
  }[] = [
    {
      label: "Taken In Today", color: "#4ade80", section: "New",
      jobs: jobs.filter(j => (j.createdAt ?? "").slice(0, 10) === today),
      subtitle: "Devices booked in at the counter today",
      empty: "Nothing has been booked in today yet.",
    },
    {
      label: "Jobs In Queue", color: "#fbbf24", section: "Not Started",
      jobs: jobs.filter(j => j.status === "Non-Issued"),
      subtitle: "Accepted but not started by a technician",
      empty: "Nothing is waiting — every job has been started.",
    },
    {
      label: "In Progress", color: "#60a5fa", section: "Started",
      jobs: jobs.filter(j => j.status === "Issued"),
      subtitle: "Currently being worked on",
      empty: "No repairs are in progress right now.",
    },
    {
      label: "Pending Pickups", color: "#a78bfa", section: "Non-Issued",
      jobs: jobs.filter(j => j.status === "Completed"),
      subtitle: "Repaired and waiting for the customer to collect",
      empty: "Nothing is waiting to be collected.",
    },
  ];

  return (
    <>
      <div className="resp-grid-4">
        {snaps.map(s => (
          <button
            key={s.label}
            onClick={() => setOpen({
              spec: snapshotInsight(s.label, s.subtitle, s.jobs, s.empty),
              section: s.section,
            })}
            title={`See the ${s.jobs.length} job${s.jobs.length === 1 ? "" : "s"} behind this`}
            className="stat-card-clickable"
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 14px", textAlign: "left",
              cursor: "pointer", font: "inherit", width: "100%",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>{s.label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.jobs.length}</p>
          </button>
        ))}
      </div>
      {open && (
        <InsightModal
          {...open.spec}
          onAction={() => onNavigate(open.section)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/* ── Repairs stat group ──
   A separate component (not inline in CashierPage) because it needs
   useParts() — that only works inside <PartsProvider>'s children, and
   CashierPage's own body runs before that provider exists. Parts Cost used
   to read fig.collected (money paid on issued jobs) by mistake; it's the
   same number as Repair Income whenever a job is fully paid, which is what
   made it look like "parts cost = revenue" on the dashboard. Real parts
   cost is what it actually costs the shop: quantity × catalog cost price,
   summed over each issued job's approved part requests. */
function RepairsStatGroup({ fig, dateLabel, onNavigate }: {
  fig: IssuedFigures; dateLabel: string; onNavigate: (section?: RepairSection) => void;
}) {
  const { partRequests, parts } = useParts();
  const rateFor = useTechnicianRates();
  const [open, setOpen] = useState<InsightSpec | null>(null);

  const partsCost = partRequests
    .filter(r => fig.issuedJobIds.includes(r.jobId) && (r.status === "Approved" || r.status === "Issued"))
    .reduce((sum, r) => sum + (parts.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0);

  // Real labour cost, from each technician's rate — recorded on the job when
  // it was completed. This used to be charge-minus-parts, which is revenue,
  // not cost, and made profit unknowable.
  const labourCost = fig.issuedJobs.reduce(
    (sum, j) => sum + labourForJob(j, rateFor(j.technician || "")).amount, 0,
  );
  const profit = fig.repairIncome - partsCost - labourCost;

  return (
    <>
      <StatGroup index={2} title="Repairs" dateLabel={dateLabel}>
        <StatCard title="Repair Income" value={fmtRs(fig.repairIncome)} change="" icon={Wrench} size="large"
          onClick={() => setOpen(repairIncomeInsight(fig.issuedJobs, dateLabel))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <StatCard title="Parts Cost" value={fmtRs(partsCost)} change="" icon={Box} size="small"
            onClick={() => setOpen(partsCostInsight(fig.issuedJobs, partRequests, parts, dateLabel))} />
          <StatCard title="Labour Cost" value={fmtRs(labourCost)} change="" icon={Hammer} size="small"
            onClick={() => setOpen(labourInsight(fig.issuedJobs, rateFor, dateLabel))} />
          <StatCard title="Profit" value={`${profit < 0 ? "−" : ""}${fmtRs(Math.abs(profit))}`} change="" icon={TrendingUp} size="small"
            onClick={() => setOpen(profitInsight(fig.issuedJobs, partRequests, parts, rateFor, dateLabel))} />
          <StatCard title="Total Jobs" value={String(fig.totalJobs)} change="" icon={ClipboardList} size="small" isCount
            onClick={() => setOpen(totalJobsInsight(fig.issuedJobs, dateLabel))} />
        </div>
      </StatGroup>
      {open && (
        <InsightModal {...open} onAction={() => onNavigate("Issued")} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

export default function CashierPage() {
  const [filter, setFilter] = useState<FilterPeriod>("Daily");
  const [activePage, setActivePage] = useState<ActivePage>("Home");
  const [repairSection, setRepairSection] = useState<RepairSection | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [insight, setInsight] = useState<InsightSpec | null>(null);

  const goToRepair = (section?: RepairSection) => { setRepairSection(section); setActivePage("Repair Management"); };
  const dateLabel = getDateLabel(filter);

  // Live figures, read from the database rather than the zeroed constants.
  const fig = useIssuedFigures(filter);
  const isManaged = MANAGED_PAGES.includes(activePage);

  return (
    <AuditProvider>
    <ShiftProvider>
    <CashRegisterProvider>
    <RepairProvider>
    <WarrantyProvider>
    <SalesProvider>
    <HeldSalesProvider>
    <InventoryProvider>
    <PartsProvider>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>
        <Sidebar
          activePage={activePage}
          onNavigate={(p) => { setRepairSection(undefined); setActivePage(p as ActivePage); }}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
          <Navbar
            activePage={activePage}
            onMenuClick={() => setSidebarOpen(true)}
          />

          <main
            className={isManaged ? "resp-main-tight scroll-x" : "resp-main scroll-x"}
            style={{
              flex: 1, position: "relative",
              overflowY: isManaged ? "hidden" : "auto",
              display: "flex", flexDirection: "column", gap: 20,
            }}
          >

            {activePage === "Repair Management"    && <RepairManagement initialSection={repairSection} />}
            {activePage === "Warranty Center"      && <WarrantyCenter />}
            {activePage === "Sales Management"     && <SalesManagement />}
            {activePage === "Inventory Management" && <InventoryManagement />}
            {activePage === "Admin Control"        && <AdminControl />}
            {activePage === "Customer Management"  && <CustomerManagement />}
            {activePage === "Reports"              && <ReportsManagement />}
            {activePage === "Audit Trail"          && <AuditLog />}
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

                {/* Paused-jobs alert */}
                <PendingAlert onView={() => goToRepair("Pending")} />

                {/* Today snapshot */}
                <TodaySnapshot onNavigate={goToRepair} />

                {/* Filter bar */}
                <FilterBar active={filter} onChange={(f) => setFilter(f as FilterPeriod)} />

                {/* Stat groups */}
                <div className="resp-grid-3">
                  <StatGroup index={0} title="Revenue" dateLabel={dateLabel}>
                    <StatCard title="Total Revenue"   value={fmtRs(fig.repairIncome)}   change=""   icon={DollarSign}  size="large"
                      onClick={() => setInsight(repairIncomeInsight(fig.issuedJobs, dateLabel))} />
                    <div className="resp-grid-2">
                      <StatCard title="Sales"         value={fmtRs(fig.salesRevenue)}   change=""   icon={TrendingUp}  size="small"
                        onClick={() => setInsight(salesInsight("Sales Revenue", dateLabel))} />
                      <StatCard title="Repairs"       value={fmtRs(fig.repairIncome)}  change=""  icon={Wrench}      size="small"
                        onClick={() => setInsight(repairIncomeInsight(fig.issuedJobs, dateLabel))} />
                    </div>
                  </StatGroup>

                  <StatGroup index={1} title="Sales" dateLabel={dateLabel}>
                    <StatCard title="Total Sales"     value={fmtRs(fig.salesRevenue)}     change=""     icon={ShoppingCart}   size="large"
                      onClick={() => setInsight(salesInsight("Total Sales", dateLabel))} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <StatCard title="Mobile"        value={fmtRs(0)}    change=""    icon={Smartphone}     size="small"
                        onClick={() => setInsight(salesInsight("Mobile Sales", dateLabel))} />
                      <StatCard title="Accessory"     value={fmtRs(0)} change="" icon={Package}        size="small"
                        onClick={() => setInsight(salesInsight("Accessory Sales", dateLabel))} />
                      <StatCard title="Other"         value={fmtRs(0)}     change=""     icon={MoreHorizontal} size="small"
                        onClick={() => setInsight(salesInsight("Other Sales", dateLabel))} />
                    </div>
                  </StatGroup>

                  <RepairsStatGroup fig={fig} dateLabel={dateLabel} onNavigate={goToRepair} />
                </div>

                {/* Quick actions + Activity feed */}
                <div className="resp-grid-2">
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Actions</p>
                    <div className="resp-grid-2">
                      <QuickAction label="New Repair Job"   sub="Register a device"       color="#34d399" onClick={() => goToRepair("New Repair")} />
                      <QuickAction label="New Sale"         sub="Process a transaction"   color="#60a5fa" onClick={() => setActivePage("Sales Management")} />
                      <QuickAction label="Cash Register"    sub="Manage the drawer"       color="#fbbf24" onClick={() => setActivePage("Cash Register")} />
                      <QuickAction label="View Reports"     sub="Daily & sales reports"   color="#a78bfa" onClick={() => setActivePage("Reports")} />
                    </div>
                  </div>
                  <ActivityFeed />
                </div>

                {/* Charts */}
                <div className="resp-grid-2">
                  <ChartCard title="Revenue Growth"  index={0} color="#e8e8e8" data={REVENUE_CHART_DATA} />
                  <ChartCard title="Sales Overview"  index={1} color="#a8a8a8" data={SALES_CHART_DATA}   />
                </div>

                {/* Info cards */}
                <div className="resp-grid-3">
                  <InfoCard title="Built for Scale"  description="Manage repairs, sales, inventory and customers from one unified dashboard." tag="Platform"    index={0} />
                  <InfoCard title="Smart Workflows"  description="Automate your repair pipeline and reduce manual operations."                tag="Automation" accent index={1} />
                  <InfoCard title="Work Smart"       description="Build systems that scale without adding complexity."                        tag="Efficiency" index={2} />
                </div>
              </>
            )}
          </main>
        </div>
      </div>
      <JobScanFab />
      {/* Breakdown behind whichever Revenue/Sales figure was clicked. Mounted
          here rather than inside the group so it survives the group re-render
          that opening it causes. */}
      {insight && (
        <InsightModal
          {...insight}
          onAction={() => goToRepair("Issued")}
          onClose={() => setInsight(null)}
        />
      )}
    </PartsProvider>
    </InventoryProvider>
    </HeldSalesProvider>
    </SalesProvider>
    </WarrantyProvider>
    </RepairProvider>
    </CashRegisterProvider>
    </ShiftProvider>
    </AuditProvider>
  );
}
