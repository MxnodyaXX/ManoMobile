"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { Plus, Briefcase, AlertCircle, Clock, Hourglass, LayoutGrid, XCircle, PackageCheck, CheckCheck, FileClock } from "lucide-react";
import NewRepairForm from "./NewRepairForm";
import JobsTable from "./JobsTable";
import DraftsList from "./DraftsList";
import type { RepairView } from "@/cashier/contexts/RepairContext";
import type { RepairDraft } from "@/cashier/hooks/useRepairDrafts";

export type RepairSection =
  | "New Repair"
  | "Drafts"
  | "New"
  | "Not Started"
  | "Started"
  | "Pending"
  | "Non-Issued"
  | "Issued"
  | "Cancelled"
  | "All Jobs";

const sections: { id: RepairSection; icon: any; label: string; view?: RepairView }[] = [
  { id: "New Repair",   icon: Plus,         label: "New Repair" },
  { id: "Drafts",       icon: FileClock,    label: "Drafts" },
  { id: "New",          icon: Clock,        label: "New",          view: "New" },
  { id: "Not Started",  icon: AlertCircle,  label: "Not Started",  view: "Not Started" },
  { id: "Started",      icon: Briefcase,    label: "Started",      view: "Started" },
  { id: "Pending",      icon: Hourglass,    label: "Pending",      view: "Pending" },
  { id: "Non-Issued",   icon: PackageCheck, label: "Non-Issued",   view: "Non-Issued" },
  { id: "Issued",       icon: CheckCheck,   label: "Issued",       view: "Issued" },
  { id: "Cancelled",    icon: XCircle,      label: "Cancelled",    view: "Cancelled" },
  { id: "All Jobs",     icon: LayoutGrid,   label: "All Jobs",     view: "All" },
];

const sectionDescriptions: Record<RepairSection, string> = {
  "New Repair":   "Register a new device repair job",
  "Drafts":       "Unfinished intakes, saved as you type — resume one where you left off",
  "New":          "Jobs received today, not yet started",
  "Not Started":  "Received earlier but still not started — needs attention",
  "Started":      "Repairs currently in progress",
  "Pending":      "Started jobs that are paused — with the reason",
  "Non-Issued":   "Repaired and waiting for the customer to collect",
  "Issued":       "Collected & signed for by the customer",
  "Cancelled":    "Cancelled repair jobs — with reason and date",
  "All Jobs":     "Complete list of all repair jobs",
};

export default function RepairManagement({ initialSection }: { initialSection?: RepairSection }) {
  const [active, setActive] = useState<RepairSection>(initialSection ?? "New Repair");
  // The draft the wizard should open with. Cleared whenever a tab is picked by
  // hand, so "New Repair" is a blank intake unless a draft was explicitly resumed.
  const [resuming, setResuming] = useState<RepairDraft | null>(null);
  const isMobile = useIsMobile();

  // Allow the dashboard (or other callers) to deep-link a tab.
  useEffect(() => { if (initialSection) setActive(initialSection); }, [initialSection]);

  const activeSection = sections.find(s => s.id === active)!;
  const ActiveIcon = activeSection.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>

      {/* Page header + Sub-nav */}
      <div className="fade-up" style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: "space-between", gap: isMobile ? 12 : 16,
      }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>
            Repair Management
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
            Manage repair jobs, track status, and assign technicians.
          </p>
        </div>

        <div className={isMobile ? "tabs-scroll" : undefined}>
        <div style={{
          display: "flex", gap: 4,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12, padding: 5,
          width: "fit-content",
        }}>
          {sections.map(({ id, icon: Icon, label }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => { setActive(id); setResuming(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8, fontSize: 12.5,
                  border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent",
                  background: isActive ? "var(--accent-dim)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer", transition: "all 0.18s",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                  }
                }}
              >
                <Icon size={13} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Active section card */}
      <div className="fade-up fade-up-2" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 18px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        width: "fit-content",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: "var(--accent-dim)",
          border: "1px solid var(--accent-glow)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--accent)",
        }}>
          <ActiveIcon size={15} strokeWidth={2.2} />
        </div>
        <div>
          <h2 className="heading" style={{ fontSize: 15, color: "var(--text-primary)" }}>
            {active}
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
            {sectionDescriptions[active]}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="fade-up fade-up-3" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {active === "New Repair" ? (
          <NewRepairForm initialDraft={resuming} />
        ) : active === "Drafts" ? (
          <DraftsList onResume={(d) => { setResuming(d); setActive("New Repair"); }} />
        ) : (
          <JobsTable
            title={active}
            view={activeSection.view ?? "All"}
          />
        )}
      </div>
    </div>
  );
}
