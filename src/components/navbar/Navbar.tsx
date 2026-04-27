"use client";

import { useTheme } from "next-themes";
import { Bell, Search, Sun, Moon, User } from "lucide-react";
import { useState, useEffect } from "react";

const pageTitles: Record<string, { title: string; sub: string }> = {
  "Home": { title: "Dashboard", sub: "Overview" },
  "Repair Management": { title: "Repair Management", sub: "Jobs & Tickets" },
  "Sales Management": { title: "Sales Management", sub: "Transactions" },
  "Inventory Management": { title: "Inventory", sub: "Stock & Parts" },
  "Customer Management": { title: "Customers", sub: "Profiles" },
  "Admin Control": { title: "Admin Control", sub: "Settings" },
};

export default function Navbar({ activePage }: { activePage?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pageInfo = pageTitles[activePage || "Home"] || pageTitles["Home"];

  const iconBtnStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 9,
    border: "1px solid var(--border)",
    background: "var(--bg-card)",
    color: "var(--text-secondary)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", transition: "all 0.18s", position: "relative",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <header style={{
      height: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 28px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-secondary)",
      gap: 16,
      flexShrink: 0,
    }}>
      {/* Breadcrumb + live badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="heading" style={{ fontSize: 15, color: "var(--text-primary)" }}>
          {pageInfo.title}
        </span>
        <span style={{ color: "var(--border-active)", fontSize: 14 }}>/</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13.5, fontWeight: 500 }}>{pageInfo.sub}</span>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          marginLeft: 8, padding: "3px 10px",
          borderRadius: 100,
          border: "1px solid rgba(5,150,105,0.25)",
          background: "rgba(5,150,105,0.08)",
        }}>
          <span className="live-dot" style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--success)", display: "block",
          }} />
          <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, letterSpacing: "0.06em" }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Search */}
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
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}

        {/* User */}
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--accent-fg)",
          boxShadow: "0 2px 8px var(--accent-glow)",
        }}>
          <User size={15} strokeWidth={2} />
        </div>
      </div>
    </header>
  );
}