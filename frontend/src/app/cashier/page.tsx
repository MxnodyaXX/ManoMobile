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
import { AccessoriesProvider } from "@/cashier/contexts/AccessoriesContext";
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
  fmtRs, type FilterPeriod,
} from "@/cashier/data/dashboardData";
import {
  DollarSign, ShoppingCart, Wrench,
  TrendingUp, Smartphone, Package, MoreHorizontal,
  Hammer, Box, ClipboardList,
  AlertTriangle, CheckCircle, Clock, ArrowRight,
} from "lucide-react";
import {
  useIssuedFigures, seriesShape, recentActivity,
  revenueByCategorySeries, repairStatusSlices, receivedVsCompletedSeries,
  type IssuedFigures, type ActivityItem,
} from "@/lib/repair/figures";
import { VizStyle } from "@/cashier/components/dashboard/charts/viz";
import RevenueTrendChart from "@/cashier/components/dashboard/charts/RevenueTrendChart";
import RepairStatusDonut from "@/cashier/components/dashboard/charts/RepairStatusDonut";
import ReceivedVsCompletedChart from "@/cashier/components/dashboard/charts/ReceivedVsCompletedChart";
import TechnicianWorkloadChart from "@/cashier/components/dashboard/charts/TechnicianWorkloadChart";
import { useMyPermissions } from "@/lib/settings/staffRules";
import TabTitle from "@/lib/ui/TabTitle";

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

/**
 * Admin Control, behind the admin-cashier tick.
 *
 * The sidebar already hides the item, but hiding a nav button is a courtesy,
 * not a control: activePage is state, and anything that sets it — a deep link,
 * a shortcut added later, a stale value — would render the settings screen for
 * a cashier who should not have it. This is the check that actually holds, and
 * the parts catalogue behind it is refused by Postgres regardless.
 */
function AdminControlPage() {
  const { isAdminCashier, loading } = useMyPermissions();

  if (loading) {
    return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Checking permissions…</p>;
  }
  if (!isAdminCashier) {
    return (
      <div className="fade-up" style={{ padding: "30px 24px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", maxWidth: 560 }}>
        <h1 className="heading-xl" style={{ fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>Admin Control</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Only an admin cashier can open the shop settings — dealers, brands, suppliers,
          the parts catalogue and the barcode design are shared by everyone on the counter.
          Ask an Admin to mark you as an admin cashier under <strong>Permissions → Cashiers</strong>.
        </p>
      </div>
    );
  }
  return <AdminControl />;
}

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
/**
 * The last things that happened, off the jobs and sales already loaded.
 *
 * This read an empty constant — the mock feed was stripped and nothing real
 * put in its place, so the panel was a heading over blank space on every
 * open. A job booked in, finished or collected, and a sale rung up, are all
 * timestamped on their own rows; that is the feed.
 */
const ACTIVITY_LOOK: Record<ActivityItem["kind"], { icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = {
  booked:    { icon: ClipboardList, color: "#60a5fa" },
  completed: { icon: CheckCircle,   color: "#34d399" },
  delivered: { icon: ArrowRight,    color: "#a78bfa" },
  sale:      { icon: ShoppingCart,  color: "#fbbf24" },
};

const whenText = (iso: string) => {
  const t = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

/**
 * Three on the card, the rest behind a button.
 *
 * Eight rows made the panel the tallest thing in its row and pushed the
 * charts below the fold on a laptop. Three is a glance — what just happened
 * — and "View all" opens the same list at full length for when a glance is
 * not enough. `all` is the long list; the card shows its head.
 */
const FEED_ON_CARD = 3;

function ActivityFeed({ all }: { all: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  const items = all.slice(0, FEED_ON_CARD);
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Recent Activity</p>
        {all.length > FEED_ON_CARD && (
          <button
            onClick={() => setOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            View all <ArrowRight size={11} />
          </button>
        )}
      </div>
      {open && (
        <InsightModal
          title="Recent Activity"
          subtitle={`The last ${all.length} things recorded`}
          columns={[{ key: "when", label: "When" }, { key: "what", label: "What happened" }, { key: "ref", label: "Ref" }]}
          rows={all.map((a, i) => ({ id: `${a.ref}-${a.kind}-${i}`, cells: { when: whenText(a.at), what: a.text, ref: a.ref } }))}
          emptyText="Nothing recorded yet."
          onClose={() => setOpen(false)}
        />
      )}
      {items.length === 0 && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nothing recorded yet.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((raw, i) => {
          const item = { ...ACTIVITY_LOOK[raw.kind], text: raw.text, time: whenText(raw.at) };
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
/**
 * Six small tiles, each a count with the money behind it.
 *
 * Four wide tiles carried one number apiece and a lot of white space around
 * it. Six narrower ones fit the same row and each says two things: how many,
 * and what that many is worth — because "9 waiting to be collected" and
 * "Rs. 42,500 walks in when they do" are the same fact, and the second is the
 * one the owner is actually asking. Every tile still opens the rows behind
 * it and jumps to the tab that holds them.
 */
function TodaySnapshot({ onNavigate }: { onNavigate: (section?: RepairSection) => void }) {
  const { jobs } = useRepair();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState<{ spec: InsightSpec; section?: RepairSection } | null>(null);

  const money = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
  const owed = (j: RepairJob) => Math.max(0, j.estimatedCost - j.advancePaid);
  const isOpen = (j: RepairJob) => j.status === "Non-Issued" || j.status === "Issued" || j.status === "Pending";
  // A job promised for today is not late until tomorrow, so "now" is the
  // start of today — and it is a date, not Date.now(), so a render is the same
  // render twice over.
  const overdue = (j: RepairJob) => isOpen(j) && !!j.estimatedCompletion && j.estimatedCompletion < today;

  const takenIn = jobs.filter(j => (j.createdAt ?? "").slice(0, 10) === today);
  const queue   = jobs.filter(j => j.status === "Non-Issued");
  const active  = jobs.filter(j => j.status === "Issued");
  const hold    = jobs.filter(j => j.status === "Pending");
  const late    = jobs.filter(overdue);
  const ready   = jobs.filter(j => j.status === "Completed");

  const snaps: {
    label: string; color: string; section: RepairSection;
    jobs: RepairJob[]; sub: string; subtitle: string; empty: string;
  }[] = [
    {
      label: "Taken in today", color: "#4ade80", section: "New", jobs: takenIn,
      sub: takenIn.length ? `${money(takenIn.reduce((t, j) => t + j.estimatedCost, 0))} quoted` : "nothing yet",
      subtitle: "Devices booked in at the counter today", empty: "Nothing has been booked in today yet.",
    },
    {
      label: "In queue", color: "#fbbf24", section: "Not Started", jobs: queue,
      sub: queue.length ? `${queue.filter(j => !j.technician || j.technician.trim().toLowerCase() === "unassigned").length} unassigned` : "all started",
      subtitle: "Accepted but not started by a technician", empty: "Nothing is waiting — every job has been started.",
    },
    {
      label: "In progress", color: "#60a5fa", section: "Started", jobs: active,
      sub: active.length ? `${money(active.reduce((t, j) => t + j.estimatedCost, 0))} on the bench` : "bench is clear",
      subtitle: "Currently being worked on", empty: "No repairs are in progress right now.",
    },
    {
      label: "On hold", color: "#fb923c", section: "Pending", jobs: hold,
      sub: hold.length ? "waiting on a part, a decision or an agent" : "nothing parked",
      subtitle: "Started, then paused — with the reason", empty: "Nothing is on hold.",
    },
    {
      // The one tile that is a warning rather than a count: a promise already
      // broken. Red, and first thing in the morning it is the tile to open.
      label: "Overdue", color: "#f87171", section: "Not Started", jobs: late,
      sub: late.length ? "past the date promised" : "everything on time",
      subtitle: "Open jobs past the completion date the customer was given", empty: "Nothing is overdue.",
    },
    {
      label: "Ready to collect", color: "#a78bfa", section: "Non-Issued", jobs: ready,
      // What walks in when they walk in. The advance is already in the till,
      // so this is the balance still owed, not the value of the repairs.
      sub: ready.length ? `${money(ready.reduce((t, j) => t + owed(j), 0))} to collect` : "nothing waiting",
      subtitle: "Repaired and waiting for the customer to collect", empty: "Nothing is waiting to be collected.",
    },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
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
              borderLeft: `3px solid ${s.color}`,
              borderRadius: 10, padding: "10px 12px", textAlign: "left",
              cursor: "pointer", font: "inherit", width: "100%", minWidth: 0,
            }}
          >
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</p>
            <p className="stat-number" style={{ fontSize: 20, color: s.jobs.length === 0 && s.label === "Overdue" ? "var(--text-muted)" : s.color }}>{s.jobs.length}</p>
            <p style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.sub}>{s.sub}</p>
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

  // The same three costs for the window before, so the badges compare like
  // with like — a parts figure against last week's parts figure, not against
  // nothing.
  const prev = fig.previous;
  const prevParts = prev
    ? partRequests
        .filter(r => prev.issuedJobIds.includes(r.jobId) && (r.status === "Approved" || r.status === "Issued"))
        .reduce((sum, r) => sum + (parts.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0)
    : 0;
  const prevLabour = prev
    ? prev.issuedJobs.reduce((sum, j) => sum + labourForJob(j, rateFor(j.technician || "")).amount, 0)
    : 0;
  const prevProfit = prev ? prev.repairIncome - prevParts - prevLabour : 0;
  const cmp = (current: number, previous: number) =>
    prev ? { current, previous, label: fig.compareLabel } : null;

  return (
    <>
      <StatGroup index={2} title="Repairs" dateLabel={dateLabel}>
        <StatCard title="Repair Income" value={fmtRs(fig.repairIncome)} compare={cmp(fig.repairIncome, prev?.repairIncome ?? 0)} icon={Wrench} size="large"
          onClick={() => setOpen(repairIncomeInsight(fig.issuedJobs, dateLabel))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <StatCard title="Parts Cost" value={fmtRs(partsCost)} compare={cmp(partsCost, prevParts)} icon={Box} size="small"
            onClick={() => setOpen(partsCostInsight(fig.issuedJobs, partRequests, parts, dateLabel))} />
          <StatCard title="Labour Cost" value={fmtRs(labourCost)} compare={cmp(labourCost, prevLabour)} icon={Hammer} size="small"
            onClick={() => setOpen(labourInsight(fig.issuedJobs, rateFor, dateLabel))} />
          <StatCard title="Profit" value={`${profit < 0 ? "−" : ""}${fmtRs(Math.abs(profit))}`} compare={cmp(profit, prevProfit)} icon={TrendingUp} size="small"
            onClick={() => setOpen(profitInsight(fig.issuedJobs, partRequests, parts, rateFor, dateLabel))} />
          <StatCard title="Total Jobs" value={String(fig.totalJobs)} compare={cmp(fig.totalJobs, prev?.totalJobs ?? 0)} icon={ClipboardList} size="small" isCount
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
  /**
   * A job to land on, from the scan panel.
   *
   * Kept with a token rather than just the id, because scanning the same job
   * twice has to work: the token changes on every request and keys the subtree
   * below, so Repair Management remounts and re-seeds instead of quietly
   * ignoring a navigation to where it already is.
   */
  const [repairJump, setRepairJump] = useState<{ id: string; token: number } | null>(null);
  /** A finished repair sent from the scan panel to be billed. Same token
   *  trick, for the same reason: billing two jobs in a row must work. */
  const [salesJump, setSalesJump] = useState<{ id: string; dealer: string; token: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [insight, setInsight] = useState<InsightSpec | null>(null);

  const goToRepair = (section?: RepairSection) => { setRepairJump(null); setRepairSection(section); setActivePage("Repair Management"); };

  /** Straight into one job's record, with everything it can do — billing,
   *  cancelling, the intake slip, and Ctrl+E to correct the details. */
  /** Straight to the till that bills repairs, with this job already picked. */
  const issueRepairJob = (job: RepairJob) => {
    setSalesJump({ id: job.id, dealer: job.dealer ?? "", token: Date.now() });
    setActivePage("Sales Management");
  };

  const openRepairJob = (job: RepairJob) => {
    setRepairSection(jobLabel(job) as RepairSection);
    setRepairJump({ id: job.id, token: Date.now() });
    setActivePage("Repair Management");
  };
  const dateLabel = getDateLabel(filter);

  // Live figures, read from the database rather than the zeroed constants.
  const fig = useIssuedFigures(filter);
  /**
   * A card's comparison: this window against the one before it, for whichever
   * figure the card shows. Null on "All", which has no "before" — the card
   * then shows no badge rather than a made-up one.
   */
  const cmp = (pick: (f: typeof fig) => number) =>
    fig.previous ? { current: pick(fig), previous: pick(fig.previous as typeof fig), label: fig.compareLabel } : null;
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
    <AccessoriesProvider>
    <PartsProvider>
      <TabTitle role="Cashier" />
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>
        <Sidebar
          activePage={activePage}
          onNavigate={(p) => { setRepairSection(undefined); setRepairJump(null); setSalesJump(null); setActivePage(p as ActivePage); }}
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

            {activePage === "Repair Management"    && (
              <RepairManagement
                key={repairJump ? `job-${repairJump.token}` : "list"}
                initialSection={repairSection}
                initialSearch={repairJump?.id}
                openJobId={repairJump?.id}
              />
            )}
            {activePage === "Warranty Center"      && <WarrantyCenter />}
            {activePage === "Sales Management"     && (
              <SalesManagement
                key={salesJump ? `issue-${salesJump.token}` : "tills"}
                initialSection={salesJump ? "Repair Sales" : undefined}
                jobToIssue={salesJump ? { id: salesJump.id, dealer: salesJump.dealer } : undefined}
              />
            )}
            {activePage === "Inventory Management" && <InventoryManagement />}
            {activePage === "Admin Control"        && <AdminControlPage />}
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
                <div className="fade-up fade-up-3" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
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
                    <StatCard title="Total Revenue"   value={fmtRs(fig.totalRevenue)}   compare={cmp(f => f.totalRevenue)}   icon={DollarSign}  size="large"
                      onClick={() => setInsight(repairIncomeInsight(fig.issuedJobs, dateLabel))} />
                    <div className="resp-grid-2">
                      <StatCard title="Sales"         value={fmtRs(fig.salesRevenue)}   compare={cmp(f => f.salesRevenue)}   icon={TrendingUp}  size="small"
                        onClick={() => setInsight(salesInsight("Sales Revenue", dateLabel, fig.periodSales))} />
                      <StatCard title="Repairs"       value={fmtRs(fig.repairIncome)}  compare={cmp(f => f.repairIncome)}  icon={Wrench}      size="small"
                        onClick={() => setInsight(repairIncomeInsight(fig.issuedJobs, dateLabel))} />
                    </div>
                  </StatGroup>

                  <StatGroup index={1} title="Sales" dateLabel={dateLabel}>
                    <StatCard title="Total Sales"     value={fmtRs(fig.salesRevenue)}     compare={cmp(f => f.salesRevenue)}     icon={ShoppingCart}   size="large"
                      onClick={() => setInsight(salesInsight("Total Sales", dateLabel, fig.periodSales))} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <StatCard title="Mobile"        value={fmtRs(fig.sales.mobile)}      compare={cmp(f => f.sales.mobile)}      icon={Smartphone}     size="small"
                        onClick={() => setInsight(salesInsight("Mobile Sales", dateLabel, fig.periodSales, "Mobile"))} />
                      <StatCard title="Accessory"     value={fmtRs(fig.sales.accessories)} compare={cmp(f => f.sales.accessories)} icon={Package}        size="small"
                        onClick={() => setInsight(salesInsight("Accessory Sales", dateLabel, fig.periodSales, "Accessories"))} />
                      <StatCard title="Other"         value={fmtRs(fig.sales.others)}      compare={cmp(f => f.sales.others)}      icon={MoreHorizontal} size="small"
                        onClick={() => setInsight(salesInsight("Other Sales", dateLabel, fig.periodSales, "Others"))} />
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
                  <ActivityFeed all={recentActivity(fig.allJobs, fig.allSales, 60)} />
                </div>

                {/* ── The four charts ──────────────────────────────────────
                    Money, the state of the bench, the backlog, and who is
                    carrying it. Four, not a wall: each answers a question the
                    owner actually asks in the morning, and all four read the
                    same filter as the figures above them. */}
                <VizStyle />
                <div className="resp-grid-2" style={{ alignItems: "start" }}>
                  <RevenueTrendChart
                    data={revenueByCategorySeries(fig.allJobs, fig.allSales, filter)}
                    subtitle={seriesShape(filter).label}
                  />
                  <RepairStatusDonut
                    slices={repairStatusSlices(fig.allJobs)}
                    onPick={section => goToRepair(section)}
                  />
                  <ReceivedVsCompletedChart
                    data={receivedVsCompletedSeries(fig.allJobs, filter)}
                    subtitle={seriesShape(filter).label}
                  />
                  <TechnicianWorkloadChart jobs={fig.allJobs} />
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
      <JobScanFab onOpenJob={openRepairJob} onIssueJob={issueRepairJob} />
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
    </AccessoriesProvider>
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
