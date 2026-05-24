"use client";

import { useState } from "react";
import { Check, Save, RotateCcw } from "lucide-react";

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
  const [perms, setPerms] = useState<PermMatrix>(() => JSON.parse(JSON.stringify(DEFAULT_PERMS)));
  const [saved, setSaved] = useState(false);

  const set = (module: string, role: Role, val: Access) => {
    if (role === "Admin") return;
    setPerms(p => ({ ...p, [module]: { ...p[module], [role]: val } }));
    setSaved(false);
  };

  const save  = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };
  const reset = () => { setPerms(JSON.parse(JSON.stringify(DEFAULT_PERMS))); setSaved(false); };

  const groups = [...new Set(MODULES.map(m => m.group))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Permissions</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Role-based access control — click a cell to cycle Full / View / None</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff }}>
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: saved ? "rgba(52,211,153,0.15)" : `${AA}18`, border: `1px solid ${saved ? "rgba(52,211,153,0.4)" : AA + "40"}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: saved ? "#34d399" : AA, fontFamily: ff, transition: "all 0.2s" }}>
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>

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
                <>
                  <tr key={`grp-${group}`}>
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
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
