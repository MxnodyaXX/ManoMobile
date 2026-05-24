"use client";

import { useState } from "react";
import { Shield, ArrowRight } from "lucide-react";
import { AdminProvider } from "@/admin/contexts/AdminContext";
import AdminSidebar, { type AdminPage } from "@/admin/components/layout/AdminSidebar";
import AdminNavbar    from "@/admin/components/layout/AdminNavbar";
import AdminDashboard from "@/admin/components/dashboard/AdminDashboard";
import StaffManagement from "@/admin/components/staff/StaffManagement";
import Permissions    from "@/admin/components/permissions/Permissions";
import Suppliers      from "@/admin/components/suppliers/Suppliers";
import PurchaseOrders from "@/admin/components/purchaseorders/PurchaseOrders";
import DeviceRegistry from "@/admin/components/devices/DeviceRegistry";
import Notifications  from "@/admin/components/notifications/Notifications";
import SystemSettings from "@/admin/components/settings/SystemSettings";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

const ADMIN_NAMES = ["Pradeep Silva", "Chamara Jayawardena"];

function AdminSelect({ onSelect }: { onSelect: (name: string) => void }) {
  const [hov, setHov] = useState<string | null>(null);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", fontFamily: ff, padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${AA}12`, border: `1px solid ${AA}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <Shield size={24} color={AA} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 6, fontFamily: ff }}>Admin Login</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Select your account to access the admin panel</p>
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {ADMIN_NAMES.map(name => {
            const isHov = hov === name;
            return (
              <button key={name} onClick={() => onSelect(name)} onMouseEnter={() => setHov(name)} onMouseLeave={() => setHov(null)}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14, background: isHov ? "var(--bg-card-hover)" : "var(--bg-card)", border: `1px solid ${isHov ? `${AA}50` : "var(--border)"}`, cursor: "pointer", transition: "all 0.18s", fontFamily: ff, boxShadow: isHov ? `0 0 0 1px ${AA}20, 0 4px 20px rgba(0,0,0,0.3)` : "none", transform: isHov ? "translateY(-1px)" : "none" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: isHov ? `${AA}20` : `${AA}10`, border: `1px solid ${AA}${isHov ? "40" : "25"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: AA, fontFamily: ff, flexShrink: 0, transition: "all 0.15s" }}>
                  {name[0]}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 2 }}>{name}</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>System Administrator · Mano Mobile</p>
                </div>
                <ArrowRight size={15} style={{ color: isHov ? AA : "var(--text-muted)", transition: "color 0.15s", flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminPageInner() {
  const [adminName, setAdminName]   = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AdminPage>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!adminName) return <AdminSelect onSelect={setAdminName} />;

  return (
    <AdminProvider>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>

        <AdminSidebar
          activePage={activePage}
          onNavigate={setActivePage}
          adminName={adminName}
          onLogout={() => setAdminName(null)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <AdminNavbar activePage={activePage} onMenuClick={() => setSidebarOpen(true)} />

          <main className="resp-main" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {activePage === "Dashboard"       && <AdminDashboard />}
            {activePage === "Staff Management"&& <StaffManagement />}
            {activePage === "Permissions"     && <Permissions />}
            {activePage === "Suppliers"       && <Suppliers />}
            {activePage === "Purchase Orders" && <PurchaseOrders />}
            {activePage === "Device Registry" && <DeviceRegistry />}
            {activePage === "Notifications"   && <Notifications />}
            {activePage === "System Settings" && <SystemSettings />}
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}

export default function AdminPage() {
  return <AdminPageInner />;
}
