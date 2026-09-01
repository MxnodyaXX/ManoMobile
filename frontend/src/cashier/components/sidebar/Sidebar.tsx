"use client";

import { useState } from "react";
import { sidebarData } from "@/cashier/data/sidebarData";
import { roleMenus } from "@/cashier/data/sidebarRoles";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useMyModuleAccess } from "@/lib/settings/moduleAccess";
import { useMyPermissions } from "@/lib/settings/staffRules";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Which Permissions module each nav item belongs to.
 *
 * Items with no entry are always shown: Warranty Center rides along with
 * Repairs and has no module of its own, and hiding it on a guess would be
 * worse than leaving it. Reports maps to Repair Reports because that is what
 * the screen actually shows a cashier — Sales Reports is a section inside it,
 * and gating the whole page on the stricter of the two would hide work they
 * are allowed to see.
 *
 * Admin Control is not in here. It is not gated by a module cell at all — it is
 * the shop's settings screen, and it belongs to Admins and admin cashiers only.
 * See ADMIN_ONLY below.
 */
const NAV_MODULE: Record<string, string> = {
  "Home":                  "Dashboard",
  "Repair Management":     "Repairs",
  "Sales Management":      "Sales / POS",
  "Inventory Management":  "Inventory",
  "Customer Management":   "Customers",
  "Reports":               "Repair Reports",
  "Cash Register":         "Cash Register",
  "Invoice History":       "Sales / POS",
  "Audit Trail":           "System Settings",
};

/**
 * Nav items only an Admin or an admin cashier ever sees.
 *
 * Admin Control edits categories, brands, suppliers, dealers, repair agents,
 * the parts catalogue, the fault checklist, barcode design and the counter PIN
 * — every one of them shop-wide. On a counter with three people on shift, three
 * people could rewrite the catalogue between customers. Now the senior cashier
 * can, and the others do not see the door.
 */
const ADMIN_ONLY = new Set(["Admin Control"]);

type ActivePage = string;

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ activePage, onNavigate, isOpen = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const userRole = "admin";
  // What the signed-in person may actually open. Permissive until it loads and
  // permissive on failure, matching the database — the policies are the
  // control, this only keeps the sidebar honest about what is reachable.
  const { canOpen } = useMyModuleAccess();
  // False until it has loaded, so the settings screen never flashes up for
  // somebody who is about to lose it.
  const { isAdminCashier } = useMyPermissions();
  /**
   * Who is at this till, and the way out.
   *
   * The technician, admin and accounts shells all end their sidebar with this;
   * the cashier one ended at the collapse toggle, so the only person who could
   * not sign out was the one whose shift actually changes hands mid-day. A
   * till nobody can hand over is a till that stays signed in as whoever opened
   * the shop.
   */
  const { profile, signOut } = useAuth();

  const menuItems = sidebarData
    .filter((item) => roleMenus[userRole].includes(item.title))
    .filter((item) => !ADMIN_ONLY.has(item.title) || isAdminCashier)
    .filter((item) => {
      const mod = NAV_MODULE[item.title];
      return !mod || canOpen(mod);
    });

  const handleNavigate = (page: ActivePage) => {
    onNavigate(page);
    if (isMobile && onClose) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}

      <motion.aside
        animate={
          isMobile
            ? { width: 280, x: isOpen ? 0 : -300 }
            : { width: collapsed ? 72 : 260, x: 0 }
        }
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
          flexShrink: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...(isMobile ? {
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 50,
          } : {}),
        }}
      >
        {/* Logo */}
        <div style={{
          padding: "28px 20px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          overflow: "hidden",
        }}>
          <div style={{
            width: 36, height: 36,
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, padding: 5,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ManoMobileBlack.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          {(!collapsed || isMobile) && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <p className="heading" style={{ fontSize: 15, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                Mano Mobile
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                Management Suite
              </p>
            </motion.div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
          {(!collapsed || isMobile) && (
            <p style={{
              fontSize: 10, color: "var(--text-muted)", fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "4px 10px 10px",
              fontFamily: "'Syne', sans-serif",
            }}>
              Navigation
            </p>
          )}
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = activePage === item.title;
            return (
              <button
                key={i}
                onClick={() => handleNavigate(item.title as ActivePage)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: (collapsed && !isMobile) ? "12px 0" : "13px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  border: "none",
                  background: isActive ? "var(--accent-dim)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  transition: "all 0.18s ease",
                  width: "100%",
                  justifyContent: (collapsed && !isMobile) ? "center" : "flex-start",
                  position: "relative",
                  outline: "none",
                  minHeight: 48,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                  }
                }}
              >
                {isActive && (
                  <span style={{
                    position: "absolute", left: 0,
                    top: "50%", transform: "translateY(-50%)",
                    width: 3, height: 20,
                    background: "var(--accent)",
                    borderRadius: "0 2px 2px 0",
                  }} />
                )}
                <Icon size={isMobile ? 20 : 18} strokeWidth={isActive ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                {(!collapsed || isMobile) && (
                  <span style={{
                    fontSize: isMobile ? 14 : 13.5,
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.01em",
                  }}>
                    {item.title}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Who is signed in, and the way out */}
        {profile && (
          <div style={{ padding: "12px 12px 0" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: collapsed && !isMobile ? "10px 0" : "10px",
              justifyContent: collapsed && !isMobile ? "center" : "flex-start",
              background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800, color: "var(--accent)",
              }}>
                {(profile.fullName || profile.email || "?").charAt(0).toUpperCase()}
              </div>

              {(!collapsed || isMobile) && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {profile.fullName || profile.email}
                    </p>
                    {/* The role, not the shell. The tab already says "Cashier"
                        for anyone standing here; what matters is which account
                        the database is actually seeing. */}
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{profile.role}</p>
                  </div>

                  <button
                    onClick={() => { void signOut().then(() => window.location.assign("/")); }}
                    title="Log out"
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 5,
                      borderRadius: 6, color: "var(--text-muted)", flexShrink: 0,
                      transition: "color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Collapsed to an icon rail, the row above has no room for a
                button — so the sign-out becomes the whole tile. */}
            {collapsed && !isMobile && (
              <button
                onClick={() => { void signOut().then(() => window.location.assign("/")); }}
                title={`Log out ${profile.fullName || ""}`.trim()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "100%", marginTop: 6, padding: "8px 0", borderRadius: 8,
                  background: "transparent", border: "1px solid var(--border)",
                  color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        )}

        {/* Collapse toggle (desktop only) */}
        {!isMobile && (
          <div style={{ padding: "16px 12px", borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-end",
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-active)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        )}
      </motion.aside>
    </>
  );
}
