"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { Plus, Briefcase, AlertCircle, Clock, Hourglass, LayoutGrid, XCircle, PackageCheck, CheckCheck, FileClock, DatabaseZap, Zap, RotateCcw, History } from "lucide-react";
import { useRepair } from "@/cashier/contexts/RepairContext";
import NewRepairForm, { StepIndicator } from "./NewRepairForm";
import InstantJobForm from "./InstantJobForm";
import PastJobForm from "./PastJobForm";
import RefundsOwed from "./RefundsOwed";
import { useOwedRefunds } from "@/lib/accounts/cashReturns";
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
  | "Refunds Owed"
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
  // Not a job state — a debt. It sits among the states because that is where
  // somebody looks when working through the day, and money owed back has no
  // other home.
  { id: "Refunds Owed", icon: RotateCcw,    label: "Refunds Owed" },
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
  "Refunds Owed": "Cash Returns and unrefunded advances still to be settled",
  "All Jobs":     "Complete list of all repair jobs",
};

export default function RepairManagement({ initialSection }: { initialSection?: RepairSection }) {
  const [active, setActive] = useState<RepairSection>(initialSection ?? "New Repair");
  /**
   * Which of the three ways in is on screen.
   *
   * Not sections of their own: an instant job and a past record are both still
   * a repair job being created, so they belong behind the same tab rather than
   * adding two more items to a sidebar that already has eleven.
   *
   *   normal   booked in now, worked on after
   *   instant  repaired minutes ago, written up at the counter
   *   past     out of the old job book, with its own dates
   */
  const [entry, setEntry] = useState<"normal" | "instant" | "past">("normal");
  // Counted at this level so the badge is visible from every other tab. A
  // debt nobody is looking at is exactly the one that goes unpaid.
  const { owed } = useOwedRefunds();
  // The draft the wizard should open with. Cleared whenever a tab is picked by
  // hand, so "New Repair" is a blank intake unless a draft was explicitly resumed.
  const [resuming, setResuming] = useState<RepairDraft | null>(null);
  const { backend, error: backendError } = useRepair();
  const isMobile = useIsMobile();
  // Mirrors NewRepairForm's own step state, purely so the step indicator can
  // render up here — next to the section card instead of stacked below it —
  // without lifting the wizard's real state out of the component that owns it.
  const [wizardStep, setWizardStep] = useState(1);

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
                {id === "Refunds Owed" && owed.length > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 20,
                    background: isActive ? "var(--accent)" : "#fbbf24",
                    color: isActive ? "var(--accent-fg)" : "#000",
                  }}>
                    {owed.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Demo mode — nothing here reaches the database. Loud on purpose: without
          it, a job "saves", prints a receipt, and vanishes on reload. */}
      {backend === "local" && (
        <div className="fade-up" style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
          borderRadius: 12, background: "rgba(251,191,36,0.08)",
          border: "1px solid rgba(251,191,36,0.4)",
        }}>
          <DatabaseZap size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            <strong style={{ color: "var(--warning)" }}>Demo mode — nothing is being saved.</strong>{" "}
            Supabase isn&apos;t configured, so jobs live in this browser tab only and disappear on reload.
            Create <code>frontend/.env.local</code> from <code>.env.local.example</code>, then restart the
            dev server. Setup steps are in <code>docs/BACKEND-SETUP.md</code>.
          </p>
        </div>
      )}

      {/* A backend that IS configured but failing must not look like success either. */}
      {backend === "supabase" && backendError && (
        <div className="fade-up" style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
          borderRadius: 12, background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.4)",
        }}>
          <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            <strong style={{ color: "var(--danger)" }}>Database error:</strong> {backendError}
          </p>
        </div>
      )}

      {/* Active section card — only stands alone for New Repair (paired with
          the step indicator, same row) and Drafts. Every jobs-list view
          renders its own version of this card up against its search bar
          instead — see JobsTable's icon/description props below. */}
      {(active === "New Repair" || active === "Drafts") && (
        <div className="fade-up fade-up-2" style={{
          display: "flex", flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center", gap: 16,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 18px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            width: "fit-content", flexShrink: 0,
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
          {active === "New Repair" && entry === "normal" && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <StepIndicator current={wizardStep} />
            </div>
          )}

          {active === "New Repair" && (
            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)", flexShrink: 0 }}>
              {([
                ["normal",  "Normal Repair", "Booked in now, worked on after", null],
                ["instant", "Instant Job",   "Already repaired — write it up", Zap],
                ["past",    "Past Record",   "An old job, entered with its own dates", History],
              ] as const).map(([id, text, hint, Icon]) => {
                const on = entry === id;
                return (
                  <button
                    key={id}
                    onClick={() => setEntry(id)}
                    title={hint}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8,
                      fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer",
                      border: on ? "1px solid var(--accent-glow)" : "1px solid transparent",
                      background: on ? "var(--accent-dim)" : "transparent",
                      color: on ? "var(--accent)" : "var(--text-muted)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap",
                    }}
                  >
                    {Icon && <Icon size={13} />}{text}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="fade-up fade-up-3" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
        {active === "New Repair" ? (
          entry === "instant" ? (
            <InstantJobForm
              // Straight to Non-Issued: the job is finished, so the next thing
              // anybody does with it is bill it.
              onCreated={() => { setEntry("normal"); setActive("Non-Issued"); }}
              onCancel={() => setEntry("normal")}
            />
          ) : entry === "past" ? (
            <PastJobForm
              // Wherever the record says it ended up — a collected job lands in
              // Issued, an uncollected one in Non-Issued. The form knows which
              // because the person typing it said so.
              onCreated={(view) => { setEntry("normal"); setActive(view); }}
              onCancel={() => setEntry("normal")}
            />
          ) : (
            <NewRepairForm initialDraft={resuming} onStepChange={setWizardStep} />
          )
        ) : active === "Drafts" ? (
          <DraftsList onResume={(d) => { setResuming(d); setActive("New Repair"); }} />
        ) : active === "Refunds Owed" ? (
          <RefundsOwed />
        ) : (
          <JobsTable
            title={active}
            icon={ActiveIcon}
            description={sectionDescriptions[active]}
            view={activeSection.view ?? "All"}
          />
        )}
      </div>
    </div>
  );
}
