"use client";

import { Users, Truck, ShoppingCart, Smartphone, Bell, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useAdmin } from "@/admin/contexts/AdminContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

function KPI({ label, value, sub, icon: Icon, color, highlight }: { label: string; value: string; sub: string; icon: any; color: string; highlight?: boolean }) {
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

export default function AdminDashboard() {
  const { staff, suppliers, purchaseOrders, devices, notificationLog, auditLog } = useAdmin();

  const activeStaff   = staff.filter(s => s.status === "Active").length;
  const activeSup     = suppliers.filter(s => s.status === "Active").length;
  const pendingPOs    = purchaseOrders.filter(p => ["Draft", "Approved", "Sent"].includes(p.status)).length;
  const poTotal       = purchaseOrders.reduce((s, p) => s + p.total, 0);
  const inRepair      = devices.filter(d => d.status === "In Repair").length;
  const blacklisted   = devices.filter(d => d.status === "Blacklisted").length;
  const sentToday     = notificationLog.filter(n => n.sentAt.startsWith("2026-05-22")).length;
  const failedNotifs  = notificationLog.filter(n => n.status === "Failed").length;
  const recentAudit   = auditLog.slice(0, 6);

  const poByStatus: Record<string, number> = {};
  purchaseOrders.forEach(p => { poByStatus[p.status] = (poByStatus[p.status] ?? 0) + 1; });

  const roleCount: Record<string, number> = {};
  staff.forEach(s => { roleCount[s.role] = (roleCount[s.role] ?? 0) + 1; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff }}>

      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Admin Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>System overview · 22 May 2026 · Mano Mobile</p>
      </div>

      {/* KPI grid */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        <KPI icon={Users}       color={AA}        label="Active Staff"         value={String(activeStaff)}                     sub={`${staff.length} total · ${staff.filter(s=>s.status==="Inactive").length} inactive`} highlight />
        <KPI icon={Truck}       color="#60a5fa"   label="Active Suppliers"     value={String(activeSup)}                       sub={`${suppliers.length} total registered`} />
        <KPI icon={ShoppingCart}color="#fbbf24"   label="Open Purchase Orders" value={String(pendingPOs)}                      sub={`Rs. ${poTotal.toLocaleString()} pipeline`} />
        <KPI icon={TrendingUp}  color="#34d399"   label="PO Pipeline Value"    value={`Rs. ${(poTotal/1000).toFixed(0)}K`}     sub="Total uncommitted value" />
        <KPI icon={Smartphone}  color="#f97316"   label="Devices In Repair"    value={String(inRepair)}                        sub={`${devices.length} registered · ${blacklisted} blacklisted`} />
        <KPI icon={Bell}        color="#a78bfa"   label="Notifications Sent"   value={String(sentToday)}                       sub={`${failedNotifs > 0 ? failedNotifs + " failed" : "All delivered"} today`} />
      </div>

      {/* Middle row */}
      <div className="fade-up resp-grid-2" style={{ gap: 16 }}>

        {/* Staff by role */}
        <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Staff by Role</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["Admin","Cashier","Technician","Accounts","Procurement"] as const).map(role => {
              const count = roleCount[role] ?? 0;
              const pct   = staff.length > 0 ? (count / staff.length) * 100 : 0;
              const colors: Record<string,string> = { Admin: AA, Cashier: "#6355ff", Technician: "#34d399", Accounts: "#f59e0b", Procurement: "#60a5fa" };
              return (
                <div key={role}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff }}>{role}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{count}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--bg-secondary)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: colors[role], borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PO pipeline */}
        <div style={{ padding: 20, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Purchase Order Pipeline</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["Draft","Approved","Sent","Partially Received","Received","Cancelled"] as const).map(s => {
              const count = poByStatus[s] ?? 0;
              if (count === 0) return null;
              const colors: Record<string,string> = { Draft:"#6b7280", Approved:"#60a5fa", Sent:"#fbbf24", "Partially Received":"#f97316", Received:"#34d399", Cancelled:"#f87171" };
              return (
                <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[s], display: "inline-block" }} />
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>{s}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors[s], fontFamily: ff }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent audit log */}
      <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Recent Activity</p>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>System audit trail</span>
        </div>
        <div>
          {recentAudit.map((e, i) => (
            <div key={e.id} style={{ padding: "12px 18px", borderBottom: i < recentAudit.length - 1 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "flex-start", gap: 12, background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${AA}12`, border: `1px solid ${AA}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: AA, flexShrink: 0 }}>
                {e.user[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{e.user}</span>
                  <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: `${AA}12`, color: AA, fontWeight: 600, fontFamily: ff }}>{e.role}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>{e.action}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>{e.detail}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                <Clock size={10} color="var(--text-muted)" />
                <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>{e.timestamp.split(" ")[1]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {(blacklisted > 0 || failedNotifs > 0) && (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {blacklisted > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={14} color="#f87171" />
              <span style={{ fontSize: 12.5, color: "#f87171", fontFamily: ff, fontWeight: 600 }}>{blacklisted} blacklisted device{blacklisted > 1 ? "s" : ""} in registry — review in Device Registry</span>
            </div>
          )}
          {failedNotifs > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={14} color="#fbbf24" />
              <span style={{ fontSize: 12.5, color: "#fbbf24", fontFamily: ff, fontWeight: 600 }}>{failedNotifs} notification{failedNotifs > 1 ? "s" : ""} failed to deliver — check Notifications log</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
