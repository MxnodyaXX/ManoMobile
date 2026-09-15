"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * This figure against the same figure one period back.
 *
 * The card used to print a fixed "vs last month" under a badge fed an empty
 * string, so every figure on the dashboard wore a red down-arrow with no
 * number beside it, on the Daily view and the Yearly view alike. Now the
 * label says what the comparison actually is — yesterday, last week — and
 * the badge says by how much, or says honestly that there is nothing to
 * compare against.
 */
export interface Compare {
  current: number;
  previous: number;
  /** "vs yesterday", "vs last week", … */
  label: string;
}

const previousText = (n: number, isCount: boolean) =>
  isCount ? String(n) : `Rs. ${Math.round(n).toLocaleString("en-LK")}`;

export default function StatCard({
  title,
  value,
  compare,
  icon: Icon,
  index = 0,
  size = "large",
  isCount = false,
  onClick,
}: {
  title: string;
  value: string;
  /** Null hides the badge entirely — "All time" has nothing to be measured against. */
  compare?: Compare | null;
  icon?: any;
  index?: number;
  size?: "large" | "small";
  isCount?: boolean;
  /** Opens the breakdown behind this figure. Omitted, the card is inert. */
  onClick?: () => void;
}) {
  const isSmall = size === "small";

  /**
   * What the badge says.
   *   both zero        "no change", grey — nothing happened either time
   *   previous zero    "new", green — there was nothing to compare with, and
   *                    now there is something; a percentage of zero is not
   *                    a number
   *   otherwise        the percentage, signed, green up and red down
   */
  const badge = (() => {
    if (!compare) return null;
    const { current, previous } = compare;
    if (current === 0 && previous === 0) return { text: "no change", tone: "flat" as const };
    if (previous === 0) return { text: "new", tone: "up" as const };
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(pct) < 0.5) return { text: "0%", tone: "flat" as const };
    return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct) >= 1000 ? Math.round(Math.abs(pct)).toLocaleString() : Math.abs(pct).toFixed(Math.abs(pct) >= 100 ? 0 : 1)}%`, tone: pct > 0 ? "up" as const : "down" as const };
  })();
  const tone = badge?.tone ?? "flat";
  const toneColor = tone === "up" ? "var(--success)" : tone === "down" ? "var(--danger)" : "var(--text-muted)";
  const toneBg    = tone === "up" ? "rgba(5,150,105,0.09)" : tone === "down" ? "rgba(220,38,38,0.09)" : "var(--accent-dim)";
  const toneEdge  = tone === "up" ? "rgba(5,150,105,0.22)" : tone === "down" ? "rgba(220,38,38,0.22)" : "var(--border)";

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

      {/* Change badge — only where there is a comparison to make */}
      {badge && compare && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }} title={`${compare.label}: ${previousText(compare.previous, isCount)}`}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: isSmall ? 11 : 11.5,
            fontWeight: 700,
            color: toneColor, background: toneBg, border: `1px solid ${toneEdge}`,
            padding: isSmall ? "2px 7px" : "3px 9px",
            borderRadius: 100,
          }}>
            {tone === "up" ? <TrendingUp size={isSmall ? 9 : 10} strokeWidth={2.5} />
              : tone === "down" ? <TrendingDown size={isSmall ? 9 : 10} strokeWidth={2.5} />
              : <Minus size={isSmall ? 9 : 10} strokeWidth={2.5} />}
            {badge.text}
          </span>
          <span style={{ fontSize: isSmall ? 11 : 12, color: "var(--text-muted)", fontWeight: 500 }}>
            {compare.label}
          </span>
        </div>
      )}
    </Tag>
  );
}