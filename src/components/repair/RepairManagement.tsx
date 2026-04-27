"use client";

import { useState } from "react";
import { Plus, Briefcase, AlertCircle, Clock, CheckSquare, LayoutGrid } from "lucide-react";
import NewRepairForm from "./NewRepairForm";
import JobsTable, { JobStatus } from "./JobsTable";

type RepairSection = "New Repair" | "Non-Issued Jobs" | "Issued Jobs" | "Pending Jobs" | "All Jobs";

const sections: { id: RepairSection; icon: any; label: string; status?: JobStatus | "All" }[] = [
  { id: "New Repair",     icon: Plus,        label: "New Repair" },
  { id: "Non-Issued Jobs", icon: Clock,       label: "Non-Issued Jobs",  status: "Non-Issued" },
  { id: "Issued Jobs",    icon: Briefcase,   label: "Issued Jobs",       status: "Issued" },
  { id: "Pending Jobs",   icon: AlertCircle, label: "Pending Jobs",      status: "Pending" },
  { id: "All Jobs",       icon: LayoutGrid,  label: "All Jobs",          status: "All" },
];

const sectionDescriptions: Record<RepairSection, string> = {
  "New Repair": "Register a new device repair job",
  "Non-Issued Jobs": "Jobs that have been logged but not yet assigned",
  "Issued Jobs": "Jobs currently assigned to a technician",
  "Pending Jobs": "Jobs awaiting parts, approval, or follow-up",
  "All Jobs": "Complete list of all repair jobs",
};

export default function RepairManagement() {
  const [active, setActive] = useState<RepairSection>("New Repair");

  const activeSection = sections.find(s => s.id === active)!;
  const ActiveIcon = activeSection.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Page header */}
      <div className="fade-up">
        <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>
          Repair Management
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
          Manage repair jobs, track status, and assign technicians.
        </p>
      </div>

      {/* Sub-nav tabs */}
      <div className="fade-up fade-up-1" style={{
        display: "flex", gap: 6,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12, padding: 6,
        width: "fit-content",
      }}>
        {sections.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 16px", borderRadius: 8, fontSize: 13,
                border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent",
                background: isActive ? "var(--accent-dim)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer", transition: "all 0.18s",
                fontFamily: "'DM Sans', sans-serif",
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
              <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Section header */}
      <div className="fade-up fade-up-2" style={{
        display: "flex", alignItems: "center", gap: 10,
        paddingBottom: 16,
        borderBottom: "1px solid var(--border)",
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
      <div className="fade-up fade-up-3">
        {active === "New Repair" ? (
          <NewRepairForm />
        ) : (
          <JobsTable
            title={active}
            filterStatus={activeSection.status as JobStatus | "All"}
          />
        )}
      </div>
    </div>
  );
}