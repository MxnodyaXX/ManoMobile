"use client";

import { useTheme } from "next-themes";
import { Bell, Search, Sun, Moon, User, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

const pageTitles: Record<string, { title: string; sub: string }> = {
  "Home":                  { title: "Dashboard",         sub: "Overview" },
  "Repair Management":     { title: "Repair Management", sub: "Jobs & Tickets" },
  "Sales Management":      { title: "Sales Management",  sub: "Transactions" },
  "Inventory Management":  { title: "Inventory",         sub: "Stock & Parts" },
  "Customer Management":   { title: "Customers",         sub: "Profiles" },
  "Reports":               { title: "Reports",           sub: "Analytics & Exports" },
  "Cash Register":         { title: "Cash Register",     sub: "Drawer & Shift" },
  "Invoice History":       { title: "Invoice History",   sub: "All Invoices" },
  "Admin Control":         { title: "Admin Control",     sub: "Settings" },
};

interface NavbarProps {
  activePage?: string;
  onMenuClick?: () => void;
}

export default function Navbar({ activePage, onMenuClick }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => setMounted(true), []);

  const pageInfo = pageTitles[activePage || "Home"] || pageTitles["Home"];

  const iconBtnStyle: React.CSSProperties = {
    width: 38, height: 38, borderRadius: 9,
    border: "1px solid var(--border)",
    background: "var(--bg-card)",
    color: "var(--text-secondary)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", transition: "all 0.18s", position: "relative",
    boxShadow: "var(--shadow-card)",
    flexShrink: 0,
  };

  return (
    <header style={{
      height: isMobile ? 56 : 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: isMobile ? "0 14px" : "0 28px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-secondary)",
      gap: 10,
      flexShrink: 0,
    }}>
      {/* Left: hamburger (mobile) + title */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 8, minWidth: 0, flex: 1 }}>
        {/* Hamburger — mobile only */}
        <button
          className="hamburger-btn"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
          <span className="heading" style={{ fontSize: isMobile ? 14 : 15, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
            {pageInfo.title}
          </span>
          {!isMobile && (
            <>
              <span style={{ color: "var(--border-active)", fontSize: 14 }}>/</span>
              <span style={{ color: "var(--text-muted)", fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap" }}>{pageInfo.sub}</span>
            </>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            marginLeft: 4, padding: "3px 8px",
            borderRadius: 100,
            border: "1px solid rgba(5,150,105,0.25)",
            background: "rgba(5,150,105,0.08)",
            flexShrink: 0,
          }}>
            <span className="live-dot" style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--success)", display: "block",
            }} />
            {!isMobile && (
              <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, letterSpacing: "0.06em" }}>
                LIVE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Search — hidden on mobile */}
        {!isMobile && (
          <button style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 14px", borderRadius: 9,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-muted)",
            cursor: "pointer", fontSize: 13.5, fontWeight: 500,
            transition: "all 0.18s",
            boxShadow: "var(--shadow-card)",
          }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-active)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <Search size={14} />
            <span>Search...</span>
            <kbd style={{
              fontSize: 11, padding: "2px 6px", borderRadius: 5,
              border: "1px solid var(--border-active)",
              color: "var(--text-muted)", fontFamily: "monospace",
              background: "var(--bg-primary)",
            }}>⌘K</kbd>
          </button>
        )}

        {/* Bell */}
        <button
          style={iconBtnStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-active)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
          aria-label="Notifications"
        >
          <Bell size={15} />
          <span style={{
            position: "absolute", top: 8, right: 8,
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent)",
            border: "2px solid var(--bg-secondary)",
          }} />
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={iconBtnStyle}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-active)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}

        {/* User avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--accent-fg)",
          boxShadow: "0 2px 8px var(--accent-glow)",
          flexShrink: 0,
        }}>
          <User size={15} strokeWidth={2} />
        </div>
      </div>
    </header>
  );
}
