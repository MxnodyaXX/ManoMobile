"use client";

import { useState } from "react";
import { sidebarData } from "@/cashier/data/sidebarData";
import { roleMenus } from "@/cashier/data/sidebarRoles";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Smartphone } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

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

  const menuItems = sidebarData.filter((item) =>
    roleMenus[userRole].includes(item.title)
  );

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
            background: "var(--accent)",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Smartphone size={18} color="var(--accent-fg)" strokeWidth={2.5} />
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
