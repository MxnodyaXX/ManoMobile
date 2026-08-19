"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  index = 0,
  size = "large",
  isCount = false,
  onClick,
}: {
  title: string;
  value: string;
  change: string;
  icon?: any;
  index?: number;
  size?: "large" | "small";
  isCount?: boolean;
  /** Opens the breakdown behind this figure. Omitted, the card is inert. */
  onClick?: () => void;
}) {
  const isPositive = change.startsWith("+");
  const isSmall = size === "small";

  // A button when it does something, a div when it does not — so the pointer,
  // focus ring and Enter key all follow from the element rather than being
  // bolted onto a div that only looks clickable.
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      title={onClick ? `See what makes up ${title}` : undefined}
      className={onClick ? "stat-card-clickable" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isSmall ? 6 : 12,
        padding: isSmall ? "12px 0" : "4px 0",
        // Reset the button back to card appearance; only the interaction
        // differs. All four borders as longhands, never the `border`
        // shorthand — mixing the two makes React warn when one is dropped
        // on a rerender.
        borderTop: isSmall ? "1px solid var(--border)" : "none",
        borderRight: "none",
        borderBottom: "none",
        borderLeft: "none",
        background: "none",
        textAlign: "left",
        width: "100%",
        font: "inherit",
        color: "inherit",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{
          fontSize: isSmall ? 12 : 12.5,
          color: "var(--text-secondary)",
          fontWeight: 600,
          letterSpacing: "0.01em",
          lineHeight: 1.3,
        }}>
          {title}
        </p>
        {Icon && !isSmall && (
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-glow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent)",
          }}>
            <Icon size={15} strokeWidth={2} />
          </div>
        )}
        {Icon && isSmall && (
          <Icon size={13} strokeWidth={1.8} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        )}
      </div>

      {/* Value */}
      <p
        className="stat-number"
        style={{
          fontSize: isSmall ? (isCount ? 20 : 17) : 28,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </p>

      {/* Change badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: isSmall ? 11 : 11.5,
          fontWeight: 700,
          color: isPositive ? "var(--success)" : "var(--danger)",
          background: isPositive ? "rgba(5,150,105,0.09)" : "rgba(220,38,38,0.09)",
          border: `1px solid ${isPositive ? "rgba(5,150,105,0.22)" : "rgba(220,38,38,0.22)"}`,
          padding: isSmall ? "2px 7px" : "3px 9px",
          borderRadius: 100,
        }}>
          {isPositive
            ? <TrendingUp size={isSmall ? 9 : 10} strokeWidth={2.5} />
            : <TrendingDown size={isSmall ? 9 : 10} strokeWidth={2.5} />
          }
          {change}
        </span>
        {!isSmall && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>vs last month</span>
        )}
        {isSmall && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>vs last mo.</span>
        )}
      </div>
    </Tag>
  );
}