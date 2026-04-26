"use client";

import { useTheme } from "next-themes";
import { Bell, Search, Sun, Moon, User } from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header style={{
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 28px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-secondary)",
      gap: 16,
    }}>
      {/* Breadcrumb + live badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="heading" style={{ fontSize: 16, color: "var(--text-primary)" }}>
          Dashboard
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>/</span>
        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Overview</span>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          marginLeft: 8, padding: "3px 10px",
          borderRadius: 100,
          border: "1px solid rgba(74,222,128,0.2)",
          background: "rgba(74,222,128,0.07)",
        }}>
          <span className="live-dot" style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--success)", display: "block",
          }} />
          <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, letterSpacing: "0.05em" }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Search */}
        <button style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          color: "var(--text-muted)",
          cursor: "pointer", fontSize: 13,
          transition: "all 0.18s",
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
            fontSize: 10, padding: "1px 6px", borderRadius: 4,
            border: "1px solid var(--border-active)",
            color: "var(--text-muted)", fontFamily: "monospace",
          }}>⌘K</kbd>
        </button>

        {/* Bell */}
        <button style={{
          width: 38, height: 38, borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          color: "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.18s", position: "relative",
        }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-active)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          <Bell size={16} />
          <span style={{
            position: "absolute", top: 8, right: 8,
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent)",
            border: "1.5px solid var(--bg-secondary)",
          }} />
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              width: 38, height: 38, borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.18s",
            }}
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

        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--accent-dim)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--accent)",
        }}>
          <User size={16} />
        </div>
      </div>
    </header>
  );
}