"use client";

import { Users, Wrench, PackageCheck, Bell, TrendingUp, AlertTriangle, Clock, RefreshCw, Inbox } from "lucide-react";
import { useAdminOverview } from "@/lib/admin/overview";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

/** Shop-facing status names, matching the labels used in Repair Management. */
const STATUS_LABEL: Record<string, string> = {
  "Non-Issued": "Not started",
  "Issued": "In progress",
  "Pending": "On hold",
  "Completed": "Awaiting collection",
  "Delivered": "Collected",
  "Cancelled": "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  "Non-Issued": "#94a3b8",
  "Issued": "#34d399",
  "Pending": "#fbbf24",
  "Completed": "#60a5fa",
  "Delivered": "#a78bfa",
  "Cancelled": "#f87171",
};

const ROLE_COLORS: Record<string, string> = {
  Admin: AA, Cashier: "#6355ff", Technician: "#34d399", Accounts: "#f59e0b",
};

const money = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;

function KPI({ label, value, sub, icon: Icon, color, highlight }: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string; highlight?: boolean;
}) {
  return (
    <div style={{ padding: "18px 20px", borderRadius: 14, border: `1px solid ${highlight ? color + "35" : "var(--border)"}`, background: highlight ? `${color}07` : "var(--bg-card)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, fontWeight: 600 }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: highlight ? color : "var(--text-primary)", fontFamily: ff, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{sub}</p>
    </div>
  );
}

/** A panel with nothing in it should say why, not sit blank. */
function Empty({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "26px 12px", color: "var(--text-muted)" }}>
      <Inbox size={18} />
      <p style={{ fontSize: 12, fontFamily: ff, textAlign: "center", lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

/**
 * Admin dashboard.
 *
 * Every figure is counted from the database. This screen used to read an
 * in-memory context that nothing ever wrote to, so it reported zeros for a shop
 * that had staff and live jobs — and stamped a hard-coded date on top of them.
 */
export default function AdminDashboard() {
  const { data, loading, error, reload, configured } = useAdminOverview();

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const roles = Object.keys(ROLE_COLORS);
  const statuses = Object.keys(STATUS_LABEL).filter(s => (data.jobsByStatus[s] ?? 0) > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Admin Dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>
            System overview · {today}{loading ? " · loading…" : ""}
          </p>
        </div>
        <button
          onClick={() => void reload()}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12.5, cursor: "pointer", fontFamily: ff }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* A dashboard of zeros should say why it is zero. */}
      {(!configured || error || data.missing.length > 0) && (
        <div className="fade-up" style={{ display: "flex", gap: 9, padding: "12px 15px", borderRadius: 11, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.55 }}>
            {!configured
              ? "Supabase is not configured — these figures stay at zero until it is connected."
              : error
                ? error
                : <>These tables are not in the database yet, so their figures are missing:{" "}
                    <strong>{data.missing.join(", ")}</strong>. Run the outstanding files in <code>supabase/migrations</code>.</>}
          </p>
        </div>
      )}

      {/* KPIs — every one counted from a real table */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        <KPI icon={Wrench} color="#34d399" label="Jobs In Progress" value={String(data.jobsInProgress)}
             sub={`${data.jobsToday} taken in today`} highlight />
        <KPI icon={Inbox} color="#fbbf24" label="Waiting To Be Picked Up" value={String(data.jobsUnassigned)}
             sub="Unassigned, ready for a technician" />
        <KPI icon={PackageCheck} color="#60a5fa" label="Awaiting Collection" value={String(data.jobsAwaitingCollection)}
             sub="Repaired, customer not yet in" />
        <KPI icon={TrendingUp} color="#f97316" label="Outstanding Balance" value={money(data.outstandingValue)}
             sub="Owed on jobs not yet collected" />
        <KPI icon={Users} color={AA} label="Active Staff" value={String(data.staffActive)}
             sub={`${data.staffTotal} total · ${data.staffByRole.Technician ?? 0} technicians`} />
        <KPI icon={Bell} color="#a78bfa" label="SMS Sent Today"
             value={data.smsAvailable ? String(data.smsToday) : "—"}
             sub={data.smsAvailable
               ? (data.smsFailed > 0 ? `${data.smsFailed} failed overall` : "None failed")
               : "SMS log table not created"} />
      </div>

      <div className="fade-up resp-grid-2" style={{ gap: 16 }}>

        {/* Staff by role — from profiles */}
        <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Staff by Role</p>
          {data.staffTotal === 0 ? (
            <Empty text="No staff yet. Add them under Staff and they can sign in straight away." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {roles.map(role => {
                const count = data.staffByRole[role] ?? 0;
                const pct = data.staffTotal > 0 ? (count / data.staffTotal) * 100 : 0;
                return (
                  <div key={role}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{role}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{count}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: ROLE_COLORS[role], borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Repair pipeline — from repair_jobs */}
        <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Repair Pipeline</p>
          {statuses.length === 0 ? (
            <Empty text="No repair jobs yet. They appear here as soon as the counter takes one in." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {statuses.map(s => (
                <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLOR[s], display: "inline-block" }} />
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>{STATUS_LABEL[s]}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[s], fontFamily: ff }}>{data.jobsByStatus[s]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest jobs — the real activity feed */}
      <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Latest Repair Jobs</p>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
            {data.jobsTotal} total · {data.dealers} dealers · {data.agents} agents
          </span>
        </div>
        {data.recentJobs.length === 0 ? (
          <Empty text="Nothing booked in yet." />
        ) : data.recentJobs.map((j, i) => (
          <div key={j.id} style={{ padding: "12px 18px", borderBottom: i < data.recentJobs.length - 1 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 12, background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${STATUS_COLOR[j.status] ?? AA}14`, border: `1px solid ${STATUS_COLOR[j.status] ?? AA}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: STATUS_COLOR[j.status] ?? AA, flexShrink: 0 }}>
              {(j.customer || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{j.id}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{j.customer}</span>
                <span style={{ fontSize: 10.5, padding: "1px 8px", borderRadius: 20, background: `${STATUS_COLOR[j.status] ?? AA}14`, color: STATUS_COLOR[j.status] ?? AA, fontWeight: 600, fontFamily: ff }}>
                  {STATUS_LABEL[j.status] ?? j.status}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>
                {j.device || "Device not recorded"} · {j.technician && j.technician.toLowerCase() !== "unassigned" ? j.technician : "Unassigned"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <Clock size={10} color="var(--text-muted)" />
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>
                {new Date(j.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts worth acting on */}
      {(data.jobsUnassigned > 0 || data.smsFailed > 0) && (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.jobsUnassigned > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={14} color="#fbbf24" />
              <span style={{ fontSize: 12.5, color: "#fbbf24", fontFamily: ff, fontWeight: 600 }}>
                {data.jobsUnassigned} job{data.jobsUnassigned > 1 ? "s" : ""} waiting for a technician to pick up
              </span>
            </div>
          )}
          {data.smsFailed > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={14} color="#f87171" />
              <span style={{ fontSize: 12.5, color: "#f87171", fontFamily: ff, fontWeight: 600 }}>
                {data.smsFailed} customer message{data.smsFailed > 1 ? "s" : ""} failed to send — check Notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
