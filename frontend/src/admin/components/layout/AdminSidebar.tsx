"use client";

import { LayoutDashboard, Users, ShieldCheck, Truck, ShoppingCart, Smartphone, Bell, Settings, LogOut, Shield } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

export type AdminPage =
  | "Dashboard"
  | "Staff Management"
  | "Permissions"
  | "Suppliers"
  | "Purchase Orders"
  | "Device Registry"
  | "Notifications"
  | "System Settings";

const NAV: { id: AdminPage; icon: any; label: string }[] = [
  { id: "Dashboard",       icon: LayoutDashboard, label: "Dashboard"       },
  { id: "Staff Management",icon: Users,           label: "Staff"           },
  { id: "Permissions",     icon: ShieldCheck,     label: "Permissions"     },
  { id: "Suppliers",       icon: Truck,           label: "Suppliers"       },
  { id: "Purchase Orders", icon: ShoppingCart,    label: "Purchase Orders" },
  { id: "Device Registry", icon: Smartphone,      label: "Device Registry" },
  { id: "Notifications",   icon: Bell,            label: "Notifications"   },
  { id: "System Settings", icon: Settings,        label: "Settings"        },
];

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

interface Props {
  activePage: AdminPage;
  onNavigate: (p: AdminPage) => void;
  adminName: string;
  onLogout: () => void;
  badges?: Partial<Record<AdminPage, number>>;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({ activePage, onNavigate, adminName, onLogout, badges = {}, isOpen = false, onClose }: Props) {
  const isMobile = useIsMobile();

  const handleNavigate = (p: AdminPage) => {
    onNavigate(p);
    if (isMobile && onClose) onClose();
  };

  return (
    <>
      {isMobile && isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}
      <aside style={{
        width: isMobile ? 280 : 224,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        height: "100vh", flexShrink: 0, fontFamily: ff,
        ...(isMobile ? {
          position: "fixed", top: 0, left: 0, zIndex: 50,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        } : {}),
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${AA}14`, border: `1px solid ${AA}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shield size={15} color={AA} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Mano Mobile</p>
            <p style={{ fontSize: 10, color: AA, fontWeight: 600, fontFamily: ff, letterSpacing: "0.04em" }}>ADMIN</p>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 10px 0", overflowY: "auto" }}>
          {NAV.map(({ id, icon: Icon, label }) => {
            const active = activePage === id;
            const badge  = badges[id];
            return (
              <button
                key={id}
                onClick={() => handleNavigate(id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: isMobile ? "13px 12px" : "9px 12px",
                  borderRadius: 9, marginBottom: 3,
                  border: active ? `1px solid ${AA}30` : "1px solid transparent",
                  background: active ? `${AA}0e` : "transparent",
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontFamily: ff,
                  minHeight: isMobile ? 52 : "auto",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <Icon size={isMobile ? 18 : 15} strokeWidth={active ? 2.4 : 1.8} color={active ? AA : "var(--text-muted)"} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: active ? 600 : 400, color: active ? "var(--text-primary)" : "var(--text-secondary)", flex: 1, fontFamily: ff }}>
                  {label}
                </span>
                {badge !== undefined && badge > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: active ? AA : `${AA}20`, color: active ? "#000" : AA, borderRadius: 20, padding: "2px 7px", minWidth: 20, textAlign: "center", fontFamily: ff }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${AA}14`, border: `1px solid ${AA}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: AA, fontFamily: ff, flexShrink: 0 }}>
              {adminName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adminName}</p>
              <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff }}>System Administrator</p>
            </div>
            <button onClick={onLogout} title="Log out" style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 6, color: "var(--text-muted)", flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
