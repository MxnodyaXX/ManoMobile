"use client";

import { TrendingUp } from "lucide-react";

export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  index = 0,
  size = "large",
  isCount = false,
}: {
  title: string;
  value: string;
  change: string;
  icon?: any;
  index?: number;
  size?: "large" | "small";
  isCount?: boolean;
}) {
  const isPositive = change.startsWith("+");
  const isSmall = size === "small";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isSmall ? 6 : 12,
        padding: isSmall ? "10px 0" : "4px 0",
        borderTop: isSmall ? "1px solid var(--border)" : "none",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{
          fontSize: isSmall ? 11 : 12,
          color: "var(--text-secondary)",
          fontWeight: 500,
          letterSpacing: "0.01em",
          lineHeight: 1.3,
        }}>
          {title}
        </p>
        {Icon && !isSmall && (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-glow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent)",
          }}>
            <Icon size={14} strokeWidth={2} />
          </div>
        )}
        {Icon && isSmall && (
          <Icon size={12} strokeWidth={1.8} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        )}
      </div>

      {/* Value */}
      <p
        className="stat-number"
        style={{
          fontSize: isSmall ? (isCount ? 18 : 16) : 26,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </p>

      {/* Change badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: isSmall ? 10 : 11,
          fontWeight: 600,
          color: isPositive ? "var(--success)" : "var(--danger)",
          background: isPositive ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
          border: `1px solid ${isPositive ? "rgba(74,222,128,0.18)" : "rgba(248,113,113,0.18)"}`,
          padding: isSmall ? "2px 7px" : "3px 9px",
          borderRadius: 100,
        }}>
          <TrendingUp size={isSmall ? 8 : 10} strokeWidth={2.5} />
          {change}
        </span>
        {!isSmall && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>vs last month</span>
        )}
        {isSmall && (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>vs last mo.</span>
        )}
      </div>
    </div>
  );
}