"use client";

import { useState, useMemo, useRef } from "react";
import { Search, X, ChevronDown, Shield } from "lucide-react";
import { useAudit, type AuditAction, type AuditEntry } from "@/cashier/contexts/AuditContext";
import ExportButtons from "@/cashier/components/shared/ExportButtons";
import { exportToPdf, exportToExcel, exportToPng } from "@/cashier/utils/exportUtils";

// ─── Action Config ────────────────────────────────────────────────────────────

const ACTION_CFG: Record<AuditAction, { label: string; color: string; bg: string; border: string }> = {
  sale_created:          { label: "Sale Created",          color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
  sale_voided:           { label: "Sale Voided",           color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  sale_returned:         { label: "Sale Returned",         color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  repair_created:        { label: "Repair Created",        color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
  repair_updated:        { label: "Repair Updated",        color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
  stock_received:        { label: "Stock Received",        color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  stock_adjusted:        { label: "Stock Adjusted",        color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  shift_opened:          { label: "Shift Opened",          color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  shift_closed:          { label: "Shift Closed",          color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  discount_authorized:   { label: "Discount Auth.",        color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  credit_sale:           { label: "Credit Sale",           color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  po_created:            { label: "PO Created",            color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  customer_added:        { label: "Customer Added",        color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
  price_changed:         { label: "Price Changed",         color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  login:                 { label: "Login",                 color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  logout:                { label: "Logout",                color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
};

const CATEGORY_GROUPS: { label: string; actions: AuditAction[] }[] = [
  { label: "Sales",     actions: ["sale_created", "sale_voided", "sale_returned", "credit_sale", "discount_authorized"] },
  { label: "Repairs",   actions: ["repair_created", "repair_updated"] },
  { label: "Inventory", actions: ["stock_received", "stock_adjusted", "po_created", "price_changed"] },
  { label: "Shift",     actions: ["shift_opened", "shift_closed"] },
  { label: "Users",     actions: ["customer_added", "login", "logout"] },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AuditLog() {
  const { log } = useAudit();
  const containerRef = useRef<HTMLDivElement>(null);

  const [search,       setSearch]       = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "All">("All");
  const [userFilter,   setUserFilter]   = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  const users = useMemo(() => Array.from(new Set(log.map(e => e.user))), [log]);

  const filtered = useMemo(() => log.filter(entry => {
    const q = search.toLowerCase();
    if (q && !entry.entity.toLowerCase().includes(q) && !entry.detail.toLowerCase().includes(q)) return false;
    if (actionFilter !== "All" && entry.action !== actionFilter) return false;
    if (userFilter && entry.user !== userFilter) return false;
    const d = entry.timestamp.toISOString().slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo   && d > dateTo)   return false;
    return true;
  }), [log, search, actionFilter, userFilter, dateFrom, dateTo]);

  const fmtDT = (d: Date) => new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };

  const PDF_HEADERS  = ["Timestamp", "Action", "Entity", "Detail", "User", "Amount"];
  const excelRows    = () => filtered.map(e => [
    fmtDT(e.timestamp), ACTION_CFG[e.action]?.label ?? e.action, e.entity, e.detail, e.user, e.amount ?? "",
  ]);
  const filename     = `audit-log-${new Date().toISOString().slice(0, 10)}`;

  const hasFilters = search || actionFilter !== "All" || userFilter || dateFrom || dateTo;

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>

      {/* Header */}
      <div className="fade-up">
        <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Audit Trail</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
          Complete activity log — every action by every user, timestamped and immutable.
        </p>
      </div>

      <div className="fade-up fade-up-2" style={{ borderTop: "1px solid var(--border)" }} />

      {/* Stats */}
      <div className="fade-up fade-up-2" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {CATEGORY_GROUPS.map(group => {
          const count = log.filter(e => group.actions.includes(e.action)).length;
          return (
            <div key={group.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{group.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="fade-up fade-up-3" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            placeholder="Search entity or detail…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value as any)} style={{ ...inputStyle, paddingRight: 28, appearance: "none" as const, cursor: "pointer", minWidth: 160 }}>
            <option value="All">All Actions</option>
            {CATEGORY_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.actions.map(a => <option key={a} value={a}>{ACTION_CFG[a]?.label ?? a}</option>)}
              </optgroup>
            ))}
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>

        <div style={{ position: "relative" }}>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ ...inputStyle, paddingRight: 28, appearance: "none" as const, cursor: "pointer", minWidth: 130 }}>
            <option value="">All Users</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: 140 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
        <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ ...inputStyle, width: 140 }} />

        {hasFilters && (
          <button onClick={() => { setSearch(""); setActionFilter("All"); setUserFilter(""); setDateFrom(""); setDateTo(""); }}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 8,
              padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)",
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            <X size={12} /> Clear
          </button>
        )}

        <div style={{ marginLeft: "auto" }}>
          <ExportButtons
            onPdf={()   => exportToPdf("Audit Log", PDF_HEADERS, excelRows(), filename, "landscape")}
            onExcel={()  => exportToExcel(filename, "Audit Log", PDF_HEADERS, excelRows())}
            onPng={()   => containerRef.current && exportToPng(containerRef.current, filename)}
          />
        </div>
      </div>

      {/* Summary chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Shield size={13} color="var(--accent)" />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Showing <strong style={{ color: "var(--text-primary)" }}>{filtered.length}</strong> of {log.length} entries
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Timestamp", "Action", "Entity", "Detail", "User", "Amount"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", textAlign: "left", fontSize: 11,
                  color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No audit entries match your filters.
                </td>
              </tr>
            ) : filtered.map((entry, i) => {
              const cfg = ACTION_CFG[entry.action];
              return (
                <tr key={entry.id} style={{
                  borderBottom: "1px solid var(--border)",
                  background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)",
                }}>
                  <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 12, fontFamily: "monospace" }}>
                    {fmtDT(entry.timestamp)}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      color: cfg?.color ?? "var(--text-muted)",
                      background: cfg?.bg ?? "transparent",
                      border: `1px solid ${cfg?.border ?? "var(--border)"}`,
                      whiteSpace: "nowrap",
                    }}>
                      {cfg?.label ?? entry.action}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{entry.entity}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.detail}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{entry.user}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                    {entry.amount !== undefined ? `Rs. ${entry.amount.toLocaleString()}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
