"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, Inbox } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

export interface InsightColumn {
  key: string;
  label: string;
  /** Right-aligned and tabular — money and counts line up for comparison. */
  numeric?: boolean;
}

export interface InsightRow {
  id: string;
  cells: Record<string, string>;
  /** Muted styling for rows that are informational rather than countable. */
  dim?: boolean;
}

export interface InsightSummary {
  label: string;
  value: string;
  /** Emphasised — the one number the card was showing. */
  strong?: boolean;
  hint?: string;
}

/**
 * The detail behind one dashboard number.
 *
 * A KPI card is only trustworthy if you can see what it is made of; every
 * figure on the dashboard is a sum over rows that exist somewhere, and this
 * shows those rows. Where a number genuinely has nothing behind it yet, the
 * modal says so in words rather than showing an empty table, since "no data"
 * and "zero" mean very different things to a shop owner.
 */
export default function InsightModal({
  title, subtitle, columns, rows, summary, note, emptyText, actionLabel, onAction, onClose,
}: {
  title: string;
  subtitle?: string;
  columns: InsightColumn[];
  rows: InsightRow[];
  summary?: InsightSummary[];
  note?: string;
  emptyText?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const th: React.CSSProperties = {
    textAlign: "left", padding: "9px 14px", fontSize: 10.5, fontWeight: 700,
    color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px 14px", fontSize: 12.5, color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
  };

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 3400, background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        width: "min(760px, 100%)", maxHeight: "86vh", display: "flex", flexDirection: "column",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
        fontFamily: ff, overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</p>
            {subtitle && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {summary && summary.length > 0 && (
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            {summary.map((s, i) => (
              <div key={s.label} style={{
                flex: "1 1 140px", padding: "13px 18px",
                borderLeft: i === 0 ? "none" : "1px solid var(--border)",
              }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontSize: s.strong ? 19 : 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{s.value}</p>
                {s.hint && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{s.hint}</p>}
              </div>
            ))}
          </div>
        )}

        <div style={{ overflow: "auto", flex: 1 }}>
          {rows.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <Inbox size={26} color="var(--text-muted)" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
                {emptyText ?? "Nothing to show for this period."}
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{columns.map(c => (
                  <th key={c.key} style={{ ...th, textAlign: c.numeric ? "right" : "left" }}>{c.label}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ opacity: r.dim ? 0.65 : 1 }}>
                    {columns.map(c => (
                      <td key={c.key} style={{
                        ...td,
                        textAlign: c.numeric ? "right" : "left",
                        fontVariantNumeric: c.numeric ? "tabular-nums" : undefined,
                        fontWeight: c.numeric ? 600 : 400,
                      }}>
                        {r.cells[c.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {(note || actionLabel) && (
          <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {note && <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55, flex: 1, minWidth: 200 }}>{note}</p>}
            {actionLabel && onAction && (
              <button
                onClick={() => { onAction(); onClose(); }}
                style={{
                  marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
                  background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer", fontFamily: ff,
                }}
              >
                {actionLabel} <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
