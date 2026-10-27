"use client";

import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { PaymentStatus, ReceivingStatus } from "@/lib/purchasing/api";

/** Shared look for the purchasing screens — the app's own tokens, nothing new. */

export const ff = "'Plus Jakarta Sans', sans-serif";
export const Rs = (v: number) => `Rs. ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)",
  fontSize: 13, fontFamily: ff, outline: "none",
};

export const label: CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase",
  letterSpacing: "0.06em", marginBottom: 5, fontFamily: ff,
};

export const card: CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
};

export const th: CSSProperties = {
  textAlign: "left", padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", borderBottom: "1px solid var(--border)",
};
export const td: CSSProperties = {
  padding: "10px 12px", fontSize: 12.5, color: "var(--text-primary)", borderBottom: "1px solid var(--border)", verticalAlign: "top",
};

export function Btn({ children, onClick, kind = "quiet", disabled, title, type = "button", style }: {
  children: ReactNode; onClick?: () => void; kind?: "primary" | "quiet" | "danger"; disabled?: boolean;
  title?: string; type?: "button" | "submit"; style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px",
    borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: ff, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
  };
  const look: CSSProperties =
    kind === "primary" ? { border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)" }
    : kind === "danger" ? { border: "1px solid rgba(220,38,38,0.4)", background: "transparent", color: "#dc2626" }
    : { border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)" };
  return <button type={type} onClick={onClick} disabled={disabled} title={title} style={{ ...base, ...look, ...style }}>{children}</button>;
}

const TONE: Record<string, { fg: string; bg: string }> = {
  green: { fg: "#16a34a", bg: "rgba(22,163,74,0.12)" },
  amber: { fg: "#d97706", bg: "rgba(217,119,6,0.12)" },
  red: { fg: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  blue: { fg: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  grey: { fg: "var(--text-muted)", bg: "var(--bg-surface)" },
};

export function Badge({ children, tone = "grey" }: { children: ReactNode; tone?: keyof typeof TONE }) {
  const t = TONE[tone];
  return (
    <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: t.fg, background: t.bg, whiteSpace: "nowrap", fontFamily: ff }}>
      {children}
    </span>
  );
}

export const paymentTone = (p: PaymentStatus): keyof typeof TONE =>
  p === "Paid" ? "green" : p === "Partially Paid" ? "amber" : p === "Overdue" ? "red" : p === "Unpaid" ? "blue" : "grey";
export const receivingTone = (r: ReceivingStatus): keyof typeof TONE =>
  r === "Received" ? "green" : r === "Partially received" ? "amber" : "grey";

export function Stat({ label: l, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div style={{ ...card, padding: "12px 14px", minWidth: 0 }}>
      <div style={label}>{l}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: tone ?? "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontFamily: ff }}>{sub}</div>}
    </div>
  );
}

/** Centered dialog; full-height sheet on small screens. */
export function Modal({ title, subtitle, onClose, children, footer, width = 760, busy }: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode;
  width?: number; busy?: boolean;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1030, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
    >
      <div style={{ ...card, borderRadius: 14, width: `min(${width}px, 100%)`, maxHeight: "94vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.45)", fontFamily: ff }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} disabled={busy} style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", flexShrink: 0, background: "var(--bg-card)" }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div style={{ padding: "9px 12px", borderRadius: 9, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", color: "#dc2626", fontSize: 12.5, fontFamily: ff, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
