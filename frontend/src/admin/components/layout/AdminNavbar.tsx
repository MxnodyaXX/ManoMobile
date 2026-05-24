"use client";

import { Bell, Clock, Menu } from "lucide-react";
import type { AdminPage } from "./AdminSidebar";
import { useAdmin } from "@/admin/contexts/AdminContext";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

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

interface Props {
  activePage: AdminPage;
  onMenuClick?: () => void;
}

export default function AdminNavbar({ activePage, onMenuClick }: Props) {
  const { purchaseOrders } = useAdmin();
  const isMobile = useIsMobile();
  const pendingPOs = purchaseOrders.filter(p => p.status === "Approved" || p.status === "Sent").length;
  const today = new Date("2026-05-22").toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{
      height: isMobile ? 56 : 56,
      padding: isMobile ? "0 14px" : "0 24px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-secondary)",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0, fontFamily: ff, gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        <button className="hamburger-btn" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: isMobile ? 14 : 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activePage}</p>
          {!isMobile && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{PAGE_SUBS[activePage]}</p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, flexShrink: 0 }}>
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{today}</span>
          </div>
        )}

        {pendingPOs > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 7, background: `${AA}12`, border: `1px solid ${AA}25` }}>
            <Bell size={12} color={AA} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: AA, fontFamily: ff }}>{pendingPOs} PO{pendingPOs !== 1 ? "s" : ""}</span>
          </div>
        )}

        <div style={{ padding: "4px 10px", borderRadius: 7, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#f87171", fontFamily: ff, letterSpacing: "0.04em" }}>ADMIN</span>
        </div>
      </div>
    </div>
  );
}
