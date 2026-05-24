"use client";

import { Bell, Clock } from "lucide-react";
import type { AdminPage } from "./AdminSidebar";
import { useAdmin } from "@/admin/contexts/AdminContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

const PAGE_SUBS: Record<AdminPage, string> = {
  "Dashboard":       "System overview and key metrics",
  "Staff Management":"Manage staff accounts and roles",
  "Permissions":     "Role-based access control matrix",
  "Suppliers":       "Supplier database and contacts",
  "Purchase Orders": "Procurement and goods received",
  "Device Registry": "IMEI tracking and device history",
  "Notifications":   "SMS, WhatsApp and email templates",
  "System Settings": "Business configuration and audit log",
};

export default function AdminNavbar({ activePage }: { activePage: AdminPage }) {
  const { purchaseOrders } = useAdmin();
  const pendingPOs = purchaseOrders.filter(p => p.status === "Approved" || p.status === "Sent").length;
  const today = new Date("2026-05-22").toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{
      height: 56, padding: "0 24px", borderBottom: "1px solid var(--border)",
      background: "var(--bg-secondary)", display: "flex", alignItems: "center",
      justifyContent: "space-between", flexShrink: 0, fontFamily: ff,
    }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{activePage}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{PAGE_SUBS[activePage]}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={12} color="var(--text-muted)" />
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{today}</span>
        </div>

        {pendingPOs > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 7, background: `${AA}12`, border: `1px solid ${AA}25` }}>
            <Bell size={12} color={AA} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: AA, fontFamily: ff }}>{pendingPOs} PO{pendingPOs !== 1 ? "s" : ""} pending</span>
          </div>
        )}

        <div style={{ padding: "4px 10px", borderRadius: 7, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#f87171", fontFamily: ff, letterSpacing: "0.04em" }}>ADMIN</span>
        </div>
      </div>
    </div>
  );
}
