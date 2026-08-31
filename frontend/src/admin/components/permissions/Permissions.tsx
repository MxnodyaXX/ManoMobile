"use client";

import { Fragment, useMemo, useState } from "react";
import { Check, Save, RotateCcw } from "lucide-react";
import WorkRulesCard from "@/admin/components/permissions/WorkRulesCard";
import TechnicianPermissions from "@/admin/components/permissions/TechnicianPermissions";
import CashierPermissions from "@/admin/components/permissions/CashierPermissions";
import { useModuleAccessMatrix, saveModuleAccess, type Access as StoredAccess } from "@/lib/settings/moduleAccess";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

type Role = "Admin" | "Cashier" | "Technician" | "Accounts" | "Procurement";
type Access = "full" | "view" | "none";
type PermMatrix = Record<string, Record<Role, Access>>;

const ROLES: Role[] = ["Admin", "Cashier", "Technician", "Accounts", "Procurement"];
const ROLE_COLORS: Record<Role, string> = {
  Admin: "#a78bfa", Cashier: "#6355ff", Technician: "#34d399", Accounts: "#f59e0b", Procurement: "#60a5fa",
};

const MODULES = [
  { module: "Dashboard",         description: "Overview stats & charts",        group: "Core" },
  { module: "Sales / POS",       description: "Cash register, invoicing",       group: "Core" },
  { module: "Repairs",           description: "Job management, status updates", group: "Core" },
  { module: "Inventory",         description: "Stock receiving, item lookup",   group: "Core" },
  { module: "Customers",         description: "Customer profiles & credit",     group: "Core" },
  { module: "Cash Register",     description: "End-of-day cash reconciliation", group: "Core" },
  { module: "Sales Reports",     description: "Revenue, sales breakdown",       group: "Reports" },
  { module: "Repair Reports",    description: "Job stats, technician output",   group: "Reports" },
  { module: "Financial Reports", description: "P&L, stock valuation",          group: "Reports" },
  { module: "General Ledger",    description: "Journal entries & accounts",    group: "Accounts" },
  { module: "AR / AP",           description: "Receivables and payables",      group: "Accounts" },
  { module: "Staff Management",  description: "Add/edit staff accounts",       group: "Admin" },
  { module: "Suppliers",         description: "Supplier database",             group: "Admin" },
  { module: "Purchase Orders",   description: "Procurement workflow",          group: "Admin" },
  { module: "Device Registry",   description: "IMEI tracking",                 group: "Admin" },
  { module: "Notifications",     description: "SMS/WhatsApp/Email templates",  group: "Admin" },
  { module: "System Settings",   description: "Business config, audit log",    group: "Admin" },
];

const DEFAULT_PERMS: PermMatrix = {
  "Dashboard":         { Admin:"full", Cashier:"view",  Technician:"view",  Accounts:"view",  Procurement:"view"  },
  "Sales / POS":       { Admin:"full", Cashier:"full",  Technician:"none",  Accounts:"none",  Procurement:"none"  },
  "Repairs":           { Admin:"full", Cashier:"full",  Technician:"full",  Accounts:"none",  Procurement:"none"  },
  "Inventory":         { Admin:"full", Cashier:"full",  Technician:"view",  Accounts:"none",  Procurement:"view"  },
  "Customers":         { Admin:"full", Cashier:"full",  Technician:"view",  Accounts:"view",  Procurement:"none"  },
  "Cash Register":     { Admin:"full", Cashier:"full",  Technician:"none",  Accounts:"view",  Procurement:"none"  },
  "Sales Reports":     { Admin:"full", Cashier:"view",  Technician:"none",  Accounts:"view",  Procurement:"none"  },
  "Repair Reports":    { Admin:"full", Cashier:"view",  Technician:"view",  Accounts:"view",  Procurement:"none"  },
  "Financial Reports": { Admin:"full", Cashier:"none",  Technician:"none",  Accounts:"full",  Procurement:"none"  },
  "General Ledger":    { Admin:"full", Cashier:"none",  Technician:"none",  Accounts:"full",  Procurement:"none"  },
  "AR / AP":           { Admin:"full", Cashier:"none",  Technician:"none",  Accounts:"full",  Procurement:"none"  },
  "Staff Management":  { Admin:"full", Cashier:"none",  Technician:"none",  Accounts:"none",  Procurement:"none"  },
  "Suppliers":         { Admin:"full", Cashier:"none",  Technician:"none",  Accounts:"view",  Procurement:"full"  },
  "Purchase Orders":   { Admin:"full", Cashier:"none",  Technician:"none",  Accounts:"view",  Procurement:"full"  },
  "Device Registry":   { Admin:"full", Cashier:"view",  Technician:"view",  Accounts:"none",  Procurement:"none"  },
  "Notifications":     { Admin:"full", Cashier:"none",  Technician:"none",  Accounts:"none",  Procurement:"none"  },
  "System Settings":   { Admin:"full", Cashier:"none",  Technician:"none",  Accounts:"none",  Procurement:"none"  },
};

function AccessCell({ value, onChange, locked }: { value: Access; onChange: (v: Access) => void; locked?: boolean }) {
  const cycle: Access[] = ["full", "view", "none"];
  const next = () => !locked && onChange(cycle[(cycle.indexOf(value) + 1) % cycle.length]);

  const cfg = {
    full: { bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.35)",  color: "#34d399", label: "Full" },
    view: { bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.35)",  color: "#60a5fa", label: "View" },
    none: { bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)",  color: "#6b7280", label: "—"    },
  }[value];

  return (
    <button onClick={next} title={locked ? "Admin always has full access" : "Click to cycle: Full → View → None"} style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 6, padding: "4px 10px", minWidth: 52,
      fontSize: 11, fontWeight: 600, color: cfg.color, fontFamily: ff,
      cursor: locked ? "default" : "pointer", opacity: locked ? 0.7 : 1,
      transition: "all 0.15s",
    }}>
      {cfg.label}
    </button>
  );
}

export default function Permissions() {
  /**
   * The stored grid, not a copy of the constants.
   *
   * This screen used to hold DEFAULT_PERMS in local state with a Save that set
   * a flag for two seconds and wrote nothing — every change was lost on
   * refresh and nothing read it. It now loads from role_module_access, and the
   * same rows are what Postgres enforces.
   */
  const { matrix, error: permsError, reload } = useModuleAccessMatrix();
  // Unsaved edits only. The grid on screen is the stored rows with these laid
  // over — derived at render rather than copied into state by an effect, so
  // there is no moment where the two disagree.
  const [edits, setEdits] = useState<PermMatrix | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Stored rows over the defaults, so a module added to the app but not yet in
  // the table still shows something sensible rather than an empty column.
  const stored = useMemo(() => {
    const next: PermMatrix = JSON.parse(JSON.stringify(DEFAULT_PERMS));
    for (const [module, byRole] of Object.entries(matrix)) {
      for (const [role, access] of Object.entries(byRole)) {
        if (next[module]) next[module][role as Role] = access as Access;
      }
    }
    return next;
  }, [matrix]);

  const perms = edits ?? stored;

  const set = (module: string, role: Role, val: Access) => {
    if (role === "Admin") return;
    setEdits(p => ({ ...(p ?? stored), [module]: { ...(p ?? stored)[module], [role]: val } }));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      await saveModuleAccess(perms as Record<string, Record<string, StoredAccess>>);
      await reload();
      // Drop the draft so the grid falls back to what is actually stored.
      setEdits(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Back to the shipped defaults on screen — still needs Save to be stored,
  // so a mis-click cannot wipe the shop's settings without confirmation.
  const reset = () => { setEdits(JSON.parse(JSON.stringify(DEFAULT_PERMS))); setSaved(false); };

  const groups = [...new Set(MODULES.map(m => m.group))];

  /**
   * One tab per audience.
   *
   * Everything used to stack on one page: shop-wide work rules, a card per
   * technician, a card per cashier, and a seventeen-row grid. An admin who
   * came to change one cashier scrolled past every technician to reach them.
   *
   * Module access keeps its own tab rather than being split across the role
   * tabs, because it is one grid read across roles — comparing what a cashier
   * and an accountant may open is the reason it is a grid at all.
   */
  const TABS = [
    { id: "modules",     label: "Module Access" },
    { id: "technicians", label: "Technicians"   },
    { id: "cashiers",    label: "Cashiers"      },
    { id: "accounts",    label: "Accounts"      },
  ] as const;
  type TabId = (typeof TABS)[number]["id"];
  const SUBTITLE: Record<TabId, string> = {
    modules:     "Role-based access control — click a cell to cycle Full / View / None",
    technicians: "How the bench works, and where a technician differs from the shop rule",
    cashiers:    "What each person at the counter may authorise",
    accounts:    "Ledger access is set by module",
  };
  const [tab, setTab] = useState<TabId>("modules");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Permissions</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>{SUBTITLE[tab]}</p>
        </div>
        <div style={{ display: tab === "modules" ? "flex" : "none", gap: 8 }}>
          <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff }}>
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: saved ? "rgba(52,211,153,0.15)" : `${AA}18`, border: `1px solid ${saved ? "rgba(52,211,153,0.4)" : AA + "40"}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: saved ? "#34d399" : AA, fontFamily: ff, transition: "all 0.2s" }}>
            {saved ? <Check size={13} /> : <Save size={13} />}
            {busy ? "Saving…" : saved ? "Saved" : edits ? "Save Changes" : "Saved"}
          </button>
        </div>
      </div>

      {/* Work rules sit with permissions: both answer "what is this role allowed to do?" */}
      {(permsError || saveError) && (
        <div style={{
          display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, marginBottom: 14,
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)",
        }}>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: ff }}>
            {saveError ?? `${permsError} — run migration 20260831000008_role_module_access.sql.`}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="fade-up" style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content", flexWrap: "wrap" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                minHeight: 36, padding: "0 16px", borderRadius: 7, fontSize: 12.5, cursor: "pointer",
                fontFamily: ff, fontWeight: active ? 700 : 500,
                background: active ? "var(--bg-secondary)" : "transparent",
                border: active ? "1px solid var(--border-active)" : "1px solid transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "technicians" && (
        <>
          {/* The shop-wide rule first, then the people who differ from it —
              a per-person "Shop" setting means nothing until you can see what
              the shop rule actually is. */}
          <WorkRulesCard />
          <TechnicianPermissions />
        </>
      )}

      {tab === "cashiers" && <CashierPermissions />}

      {tab === "accounts" && (
        <div style={{ padding: "26px 20px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 6 }}>
            Nothing to set per person yet
          </p>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.6 }}>
            An accountant&apos;s access is defined entirely by which modules their role can open —
            set that on the <strong>Module Access</strong> tab. Per-person rules exist for technicians
            (how they work) and cashiers (what they may authorise); the ledger side has no equivalent
            actions to gate yet.
          </p>
        </div>
      )}

      {tab === "modules" && (<>

      {/* Legend */}
      <div className="fade-up" style={{ display: "flex", gap: 16, padding: "10px 16px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)", width: "fit-content" }}>
        {[
          { label: "Full Access", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
          { label: "View Only",   color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
          { label: "No Access",   color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1px solid ${l.color}50`, display: "inline-block" }} />
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>· Admin is always Full</span>
      </div>

      {/* Matrix table */}
      <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, fontFamily: ff, minWidth: 220 }}>Module</th>
                {ROLES.map(role => (
                  <th key={role} style={{ padding: "12px 20px", textAlign: "center", fontFamily: ff, minWidth: 90 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: ROLE_COLORS[role] }}>{role}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                // The key belongs on what map returns — a bare <> cannot carry
                // one, which is what React was warning about.
                <Fragment key={group}>
                  <tr>
                    <td colSpan={6} style={{ padding: "7px 16px", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: AA, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: ff }}>{group}</span>
                    </td>
                  </tr>
                  {MODULES.filter(m => m.group === group).map((m, i) => (
                    <tr key={m.module} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                      <td style={{ padding: "11px 16px" }}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, marginBottom: 2 }}>{m.module}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{m.description}</p>
                      </td>
                      {ROLES.map(role => (
                        <td key={role} style={{ padding: "11px 20px", textAlign: "center" }}>
                          <AccessCell
                            value={perms[m.module]?.[role] ?? "none"}
                            onChange={v => set(m.module, role, v)}
                            locked={role === "Admin"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </>)}
    </div>
  );
}
