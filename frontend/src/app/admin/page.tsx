"use client";

import { useState } from "react";
import { Shield, ArrowRight } from "lucide-react";
import { AdminProvider } from "@/admin/contexts/AdminContext";
import AdminSidebar, { type AdminPage } from "@/admin/components/layout/AdminSidebar";
import AdminNavbar    from "@/admin/components/layout/AdminNavbar";
import AdminDashboard from "@/admin/components/dashboard/AdminDashboard";
import BusinessInsights from "@/admin/components/insights/BusinessInsights";
import StaffManagement from "@/admin/components/staff/StaffManagement";
import Permissions    from "@/admin/components/permissions/Permissions";
import Suppliers      from "@/admin/components/suppliers/Suppliers";
import PurchaseOrders from "@/admin/components/purchaseorders/PurchaseOrders";
import DeviceRegistry from "@/admin/components/devices/DeviceRegistry";
import Notifications  from "@/admin/components/notifications/Notifications";
import Appearance from "@/admin/components/appearance/Appearance";
import SystemSettings from "@/admin/components/settings/SystemSettings";
import { useStaffByRole } from "@/lib/staff/roster";
import { RepairProvider } from "@/cashier/contexts/RepairContext";
import { WarrantyProvider } from "@/cashier/contexts/WarrantyContext";
import { InventoryProvider } from "@/cashier/contexts/InventoryContext";
import { AccessoriesProvider } from "@/cashier/contexts/AccessoriesContext";
import { PartsProvider } from "@/cashier/contexts/PartsContext";
import TabTitle from "@/lib/ui/TabTitle";
import { useAuth } from "@/lib/auth/AuthContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";


function AdminSelect({ onSelect }: { onSelect: (name: string) => void }) {
  const [hov, setHov] = useState<string | null>(null);
  // Roster comes from the staff directory, never a hard-coded list.
  const { staff, loading } = useStaffByRole("Admin");

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
          {loading && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff, textAlign: "center", padding: "20px 0" }}>Loading staff…</p>
          )}
          {!loading && staff.length === 0 && (
            <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", fontFamily: ff, marginBottom: 5 }}>No Admin staff found</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.55 }}>
                Add them in Supabase with the <strong>Admin</strong> role and they will appear here.
              </p>
            </div>
          )}
          {staff.map(({ name }) => {
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
  const [picked, setPicked]         = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AdminPage>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * Who is running the panel.
   *
   * This used to be a name off a list with no password behind it, which is how
   * the sidebar could read "admin" while every API call and RLS policy saw a
   * cashier. A signed-in Admin is now simply themselves; the list stays only
   * for a session that is not an Admin's, where it names the shell without
   * pretending to authorise anything — the database still refuses the writes.
   */
  const { profile, signOut } = useAuth();
  const adminName = profile?.role === "Admin" ? (profile.fullName || "Admin") : picked;

  if (!adminName) return <AdminSelect onSelect={setPicked} />;

  return (
    <AdminProvider>
    {/* Business Insights needs live jobs/parts/inventory data — the rest of
        Admin Control didn't need these before, so they weren't wrapped here. */}
    <RepairProvider>
    <WarrantyProvider>
    <InventoryProvider>
    <AccessoriesProvider>
    <PartsProvider>
      <TabTitle role="Admin" />
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>

        <AdminSidebar
          activePage={activePage}
          onNavigate={setActivePage}
          adminName={adminName}
          onLogout={() => { void signOut().then(() => window.location.assign("/")); }}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <AdminNavbar activePage={activePage} onMenuClick={() => setSidebarOpen(true)} />

          <main className="resp-main" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {activePage === "Dashboard"        && <AdminDashboard />}
            {activePage === "Business Insights"&& <BusinessInsights />}
            {activePage === "Staff Management" && <StaffManagement />}
            {activePage === "Permissions"      && <Permissions />}
            {activePage === "Suppliers"        && <Suppliers />}
            {activePage === "Purchase Orders"  && <PurchaseOrders />}
            {activePage === "Device Registry"  && <DeviceRegistry />}
            {activePage === "Notifications"    && <Notifications />}
            {activePage === "Appearance"       && <Appearance />}
            {activePage === "System Settings"  && <SystemSettings />}
          </main>
        </div>
      </div>
    </PartsProvider>
    </AccessoriesProvider>
    </InventoryProvider>
    </WarrantyProvider>
    </RepairProvider>
    </AdminProvider>
  );
}

export default function AdminPage() {
  return <AdminPageInner />;
}
