"use client";

import { Search, X, LayoutGrid, Grid2x2, Rows3 } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * The bench's one toolbar: search, filters, what to show, and how to show it.
 *
 * This used to be a separate filter bar inside each section, on the reasoning
 * that narrowing "to start" should not also narrow the finished pile. That
 * holds for a bench with six jobs on it and falls apart at fifty: a technician
 * hunting one job by its number does not know which section it is in, and
 * searching five bars in turn to find out is the problem, not the protection.
 *
 * So the search is universal and the sections are where results land — every
 * section filters together, each keeps its own count, and a section holding a
 * match opens itself. The status pills are the other half of the same idea:
 * they narrow to one section when the technician does know which one they
 * want.
 *
 * The dealer and brand options come from the jobs on screen, so the lists only
 * ever offer something that will actually match — an option that returns
 * nothing is a dead end to back out of.
 */

export interface BenchFilter {
  q: string;
  dealer: string;
  brand: string;
  sort: "oldest" | "priceAsc" | "priceDesc";
}

export const EMPTY_FILTER: BenchFilter = { q: "", dealer: "", brand: "", sort: "oldest" };

export const isFiltering = (f: BenchFilter) =>
  f.q.trim() !== "" || f.dealer !== "" || f.brand !== "" || f.sort !== "oldest";

const deviceOf = (j: RepairJob) => [j.brand, j.model].filter(Boolean).join(" ");

/** Applies the filter, then the sort. Sorting last so price order survives a
 *  search rather than being overruled by it. */
export function applyBenchFilter(jobs: RepairJob[], f: BenchFilter): RepairJob[] {
  const q = f.q.trim().toLowerCase();

  const out = jobs.filter(j => {
    if (f.dealer && (j.dealer ?? "") !== f.dealer) return false;
    if (f.brand && (j.brand ?? "") !== f.brand) return false;
    if (!q) return true;
    // Everything printed on the card, plus the dealer's own number — staff are
    // as likely to be given "54000" as our own job number.
    return [
      j.id, j.dealerJobNo, j.customerName, j.phone,
      deviceOf(j), j.issue, j.dealer,
    ].some(v => (v ?? "").toLowerCase().includes(q));
  });

  const byOldest = (a: RepairJob, b: RepairJob) =>
    new Date(a.startedAt ?? a.createdAt).getTime() - new Date(b.startedAt ?? b.createdAt).getTime();

  if (f.sort === "priceAsc")  return [...out].sort((a, b) => a.estimatedCost - b.estimatedCost);
  if (f.sort === "priceDesc") return [...out].sort((a, b) => b.estimatedCost - a.estimatedCost);
  return [...out].sort(byOldest);
}

const control: React.CSSProperties = {
  minHeight: 40, padding: "0 10px", borderRadius: 9, fontSize: 12.5,
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-primary)", fontFamily: ff, outline: "none",
};

/**
 * Tiles or rows.
 *
 * Cards are the working view — everything about a job legible at arm's length
 * while it is in your hand. Rows are the finding view: fifty jobs on one
 * screen when you know what you are looking for. Compact is between them: a
 * row's height, three to five across, so a whole section fits without a job
 * shrinking to a line of text. None replaces the others, so the choice is the
 * technician's and it sticks.
 */
export type BenchView = "cards" | "compact" | "list";

export interface BenchSectionTab {
  key: string;
  title: string;
  tint?: string;
  /** How many are in it now — after the search, so the pills stay truthful. */
  count: number;
}

export default function BenchFilters({
  jobs, value, onChange, shown, view, onViewChange, sections, active, onActiveChange,
}: {
  /** Every job on the bench, before filtering — the option lists come from it. */
  jobs: RepairJob[];
  value: BenchFilter;
  onChange: (f: BenchFilter) => void;
  /** How many survived the filter, for the "3 of 17" line. */
  shown: number;
  view: BenchView;
  onViewChange: (v: BenchView) => void;
  sections: BenchSectionTab[];
  /** "" is all of them. */
  active: string;
  onActiveChange: (key: string) => void;
}) {
  const dealers = Array.from(new Set(jobs.map(j => j.dealer).filter((d): d is string => !!d?.trim()))).sort();
  const brands  = Array.from(new Set(jobs.map(j => j.brand).filter((b): b is string => !!b?.trim()))).sort();
  const activeF = isFiltering(value);
  const total   = sections.reduce((n, s) => n + s.count, 0);

  const pill = (on: boolean, tint?: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 7,
    minHeight: 36, padding: "0 12px", borderRadius: 20, cursor: "pointer",
    fontSize: 12.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap",
    // The section's own dot colour carries over onto its pill, so the pills
    // and the accordion headers read as the same set of things.
    border: `1px solid ${on ? (tint ?? "var(--accent)") : "var(--border)"}`,
    background: on ? "var(--bg-card)" : "transparent",
    color: on ? (tint ?? "var(--accent)") : "var(--text-secondary)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Search and narrowing ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={value.q}
            onChange={e => onChange({ ...value, q: e.target.value })}
            placeholder="Search every section — job no, customer, device, fault…"
            style={{ ...control, width: "100%", paddingLeft: 32, boxSizing: "border-box" }}
          />
        </div>

        {/* Offered only when there is more than one to choose between — a filter
            with a single option filters nothing. */}
        {dealers.length > 1 && (
          <select value={value.dealer} onChange={e => onChange({ ...value, dealer: e.target.value })} style={control}>
            <option value="">All dealers</option>
            {dealers.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {brands.length > 1 && (
          <select value={value.brand} onChange={e => onChange({ ...value, brand: e.target.value })} style={control}>
            <option value="">All brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <select value={value.sort} onChange={e => onChange({ ...value, sort: e.target.value as BenchFilter["sort"] })} style={control}>
          <option value="oldest">Oldest first</option>
          <option value="priceAsc">Value: low to high</option>
          <option value="priceDesc">Value: high to low</option>
        </select>

        <ViewSwitch view={view} onChange={onViewChange} />
      </div>

      {/* ── What to show ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
        <button onClick={() => onActiveChange("")} style={pill(active === "")}>
          All
          <span style={{ fontSize: 11, opacity: 0.75 }}>{total}</span>
        </button>
        {sections.map(sec => (
          <button
            key={sec.key}
            onClick={() => onActiveChange(active === sec.key ? "" : sec.key)}
            style={pill(active === sec.key, sec.tint)}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: sec.tint ?? "var(--text-muted)", flexShrink: 0 }} />
            {sec.title}
            <span style={{ fontSize: 11, opacity: 0.75 }}>{sec.count}</span>
          </button>
        ))}

        {(activeF || active !== "") && (
          <>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, marginLeft: 4 }}>
              {shown} of {jobs.length} shown
            </span>
            <button
              onClick={() => { onChange(EMPTY_FILTER); onActiveChange(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 5, minHeight: 32, padding: "0 10px",
                borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: ff,
                background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)",
              }}
            >
              <X size={12} /> Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Cards or rows, as a two-state segmented control. */
function ViewSwitch({ view, onChange }: { view: BenchView; onChange: (v: BenchView) => void }) {
  const opts: { id: BenchView; label: string; icon: typeof LayoutGrid }[] = [
    { id: "cards",   label: "Cards",   icon: LayoutGrid },
    { id: "compact", label: "Compact", icon: Grid2x2 },
    { id: "list",    label: "List",    icon: Rows3 },
  ];
  return (
    <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      {opts.map(o => {
        const on = view === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            title={`${o.label} view`}
            aria-pressed={on}
            style={{
              display: "flex", alignItems: "center", gap: 6, minHeight: 34, padding: "0 11px",
              borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: ff,
              background: on ? "var(--bg-card)" : "transparent",
              border: on ? "1px solid var(--border)" : "1px solid transparent",
              color: on ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <Icon size={14} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}
