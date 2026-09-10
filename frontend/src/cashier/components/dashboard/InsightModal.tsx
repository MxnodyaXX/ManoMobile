"use client";

import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, Inbox, ChevronDown } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * A colour per group, so two open at once are two different things.
 *
 * With several expanded, every heading and every indented row looked the same,
 * and the only thing separating one invoice's jobs from the next was counting
 * down from the right heading. Giving each group its own tint means the eye
 * does that instead: the rail beside a row and the heading it belongs to are
 * visibly the same colour.
 *
 * Keyed on the group's position in the list rather than on the order they were
 * opened, so a group's colour never changes underneath somebody — opening a
 * third invoice between two others does not recolour either of them.
 *
 * Grey first: one invoice open is the ordinary case and should look calm. The
 * colours start when there is something to tell apart.
 */
const GROUP_TINTS = ["#94a3b8", "#60a5fa", "#fbbf24", "#a78bfa", "#34d399", "#f472b6"] as const;

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

/**
 * Rows gathered under one heading, with the heading's own total.
 *
 * The invoice case is what this exists for: a repair charged and a Cash Return
 * against it are two jobs, one piece of paper and one net figure. Listed flat
 * they read as unrelated records and the arithmetic behind the invoice total is
 * nowhere on screen.
 */
export interface InsightGroup {
  id: string;
  title: string;
  subtitle?: string;
  /** The group's own total, already formatted. */
  value: string;
  /** Money out — shown in the same blue the rest of the app uses for it. */
  negative?: boolean;
  rows: InsightRow[];
}

export interface InsightSummary {
  label: string;
  value: string;
  /** Emphasised — the one number the card was showing. */
  strong?: boolean;
  hint?: string;
  /**
   * What kind of figure this is, so the eye can sort them without reading.
   *
   * Money in and money still owed are the two a shop looks for first, and in a
   * row of identical grey numbers they are found by reading every label. The
   * default is plain: colour means something here, so most figures do not get
   * any.
   */
  tone?: "good" | "warn" | "bad";
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
  title, subtitle, columns, rows, summary, groups, groupLabel, note, emptyText, actionLabel, onAction, onClose,
}: {
  title: string;
  subtitle?: string;
  columns: InsightColumn[];
  rows: InsightRow[];
  summary?: InsightSummary[];
  groups?: InsightGroup[];
  groupLabel?: string;
  note?: string;
  emptyText?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  /**
   * Flat rows or grouped. Purely how the same numbers are laid out — the
   * summary above is computed from the jobs either way, so switching can never
   * move a total.
   *
   * Off by default: the flat list is what the shop already knows, and grouping
   * only earns its place when somebody is asking how an invoice added up.
   */
  const [grouped, setGrouped] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const canGroup = !!groups && groups.length > 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const th: React.CSSProperties = {
    textAlign: "left", padding: "10px 16px", fontSize: 10, fontWeight: 700,
    color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    // Opaque, or the rows scroll visibly through the pinned heading.
    background: "var(--bg-card)",
  };
  const td: React.CSSProperties = {
    padding: "11px 16px", fontSize: 12.5, color: "var(--text-primary)",
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
          {canGroup && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", flexShrink: 0, fontSize: 12, color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={grouped}
                onChange={e => setGrouped(e.target.checked)}
                style={{ accentColor: "var(--accent)", width: 14, height: 14, cursor: "pointer" }}
              />
              {groupLabel ?? "Group"}
            </label>
          )}
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Cards rather than a divided strip. The figures were four columns
            of the same grey inside one box, which reads as a header rather
            than as the answer — and the one number the card was opened for was
            the same size and colour as the three beside it.

            auto-fit rather than a column count, so two figures fill the width
            and five wrap instead of shrinking to unreadable slivers. */}
        {summary && summary.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10, padding: "14px 20px",
            background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
          }}>
            {summary.map(s => {
              const tint = s.tone === "good" ? "#4ade80"
                : s.tone === "warn" ? "#fbbf24"
                : s.tone === "bad" ? "#f87171"
                : null;
              return (
                <div key={s.label} style={{
                  padding: "11px 13px", borderRadius: 11, minWidth: 0,
                  background: s.strong ? "var(--accent-dim)" : tint ? `${tint}14` : "var(--bg-card)",
                  border: `1px solid ${s.strong ? "var(--accent-glow)" : tint ? `${tint}40` : "var(--border)"}`,
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    {s.label}
                  </p>
                  <p style={{
                    fontSize: s.strong ? 21 : 17, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 3,
                    color: s.strong ? "var(--accent)" : tint ?? "var(--text-primary)",
                    wordBreak: "break-word",
                  }}>
                    {s.value}
                  </p>
                  {s.hint && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{s.hint}</p>}
                </div>
              );
            })}
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
          ) : grouped && groups ? (
            /**
             * One table, with the invoices as headings inside it.
             *
             * Each group used to be its own little table, so with three open at
             * once there were three grids whose columns did not line up, no
             * headings anywhere, and nothing to say where one invoice's jobs
             * ended and the next invoice began. Two rows reading "Rs. 800" and
             * "Rs. 800" sat under a third reading "Rs. 4,350" and the eye had
             * no way to group them.
             *
             * A single grid fixes all of it at once: every column aligns down
             * the whole list, one pinned heading names them, and each invoice's
             * jobs sit indented behind a coloured rail that runs from the
             * heading they belong to.
             */
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{columns.map((c, ci) => (
                  <th key={c.key} style={{
                    ...th,
                    textAlign: c.numeric ? "right" : "left",
                    position: "sticky", top: 0, zIndex: 2,
                    paddingLeft: ci === 0 ? 34 : undefined,
                  }}>{c.label}</th>
                ))}</tr>
              </thead>
              <tbody>
                {groups.map((g, gi) => {
                  const isOpen = !!open[g.id];
                  const tint = GROUP_TINTS[gi % GROUP_TINTS.length];
                  return (
                    <Fragment key={g.id}>
                      <tr
                        onClick={() => setOpen(o => ({ ...o, [g.id]: !o[g.id] }))}
                        style={{
                          cursor: "pointer",
                          background: isOpen ? `${tint}1f` : "var(--bg-secondary)",
                          borderTop: `1px solid ${isOpen ? `${tint}55` : "var(--border)"}`,
                        }}
                      >
                        <td colSpan={Math.max(columns.length - 1, 1)} style={{ ...td, borderBottom: "none", padding: "11px 16px" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <ChevronDown
                              size={13}
                              style={{ color: isOpen ? tint : "var(--text-muted)", flexShrink: 0, transform: isOpen ? undefined : "rotate(-90deg)", transition: "transform 0.18s" }}
                            />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: isOpen ? tint : "var(--text-primary)" }}>{g.title}</span>
                              {g.subtitle && <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{g.subtitle}</span>}
                            </span>
                          </span>
                        </td>
                        <td style={{
                          ...td, borderBottom: "none", textAlign: "right", padding: "11px 16px",
                          fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                          color: g.negative ? "#60a5fa" : "var(--text-primary)",
                        }}>
                          {g.value}
                        </td>
                      </tr>

                      {isOpen && g.rows.map(r => (
                        <tr key={r.id} style={{ opacity: r.dim ? 0.65 : 1, background: `${tint}0a` }}>
                          {columns.map((c, ci) => (
                            <td key={c.key} style={{
                              ...td,
                              textAlign: c.numeric ? "right" : "left",
                              fontVariantNumeric: c.numeric ? "tabular-nums" : undefined,
                              fontWeight: ci === 0 ? 700 : c.numeric ? 600 : 400,
                              color: ci === 0 ? "var(--accent)" : "var(--text-primary)",
                              // The rail. It starts at the heading's chevron and
                              // runs the height of that invoice's jobs, so a row
                              // belongs to the invoice above it by sight rather
                              // than by counting.
                              // The rail, in the heading's own colour: a row
                              // belongs to the invoice above it by matching,
                              // not by counting.
                              ...(ci === 0 ? {
                                paddingLeft: 34,
                                boxShadow: `inset 3px 0 0 0 ${tint}`,
                              } : null),
                            }}>
                              {r.cells[c.key] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                {/* Pinned, because these lists run to thirty rows and a column
                    of figures with no heading in sight is a column of numbers
                    nobody can name. */}
                <tr>{columns.map(c => (
                  <th key={c.key} style={{ ...th, textAlign: c.numeric ? "right" : "left", position: "sticky", top: 0, zIndex: 1 }}>{c.label}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ opacity: r.dim ? 0.65 : 1, background: i % 2 ? "var(--bg-secondary)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i % 2 ? "var(--bg-secondary)" : "transparent"}
                  >
                    {columns.map((c, ci) => (
                      <td key={c.key} style={{
                        ...td,
                        textAlign: c.numeric ? "right" : "left",
                        fontVariantNumeric: c.numeric ? "tabular-nums" : undefined,
                        // The first column is what the row IS — a job number,
                        // a name, a part — and every other column is something
                        // about it. Weighting it makes the list scannable down
                        // its left edge instead of read line by line.
                        fontWeight: ci === 0 ? 700 : c.numeric ? 600 : 400,
                        color: ci === 0 ? "var(--accent)" : "var(--text-primary)",
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
