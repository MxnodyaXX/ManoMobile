"use client";

import { Search, X } from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * Search and filtering for one bench section.
 *
 * Per section rather than one bar for the whole screen: a technician narrowing
 * down what to start next has no interest in also narrowing the finished pile,
 * and a shared filter would silently hide jobs in a section they were not
 * even looking at.
 *
 * The dealer and brand options come from the jobs in that section, so the
 * lists only ever offer something that will actually match — an option that
 * returns nothing is a dead end the cashier has to back out of.
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

export default function BenchFilters({ jobs, value, onChange, shown }: {
  /** The section's full list, before filtering — the option lists come from it. */
  jobs: RepairJob[];
  value: BenchFilter;
  onChange: (f: BenchFilter) => void;
  /** How many survived the filter, for the "3 of 17" line. */
  shown: number;
}) {
  const dealers = Array.from(new Set(jobs.map(j => j.dealer).filter((d): d is string => !!d?.trim()))).sort();
  const brands  = Array.from(new Set(jobs.map(j => j.brand).filter((b): b is string => !!b?.trim()))).sort();
  const active  = isFiltering(value);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
      <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
        <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        <input
          value={value.q}
          onChange={e => onChange({ ...value, q: e.target.value })}
          placeholder="Search job, customer, device, fault…"
          style={{ ...control, width: "100%", paddingLeft: 32, boxSizing: "border-box" }}
        />
      </div>

      {/* Offered only when there is more than one to choose between — a filter
          with a single option filters nothing. */}
      {dealers.length > 1 && (
        <select
          value={value.dealer}
          onChange={e => onChange({ ...value, dealer: e.target.value })}
          style={{ ...control, cursor: "pointer", maxWidth: 180 }}
        >
          <option value="">All dealers</option>
          {dealers.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      )}

      {brands.length > 1 && (
        <select
          value={value.brand}
          onChange={e => onChange({ ...value, brand: e.target.value })}
          style={{ ...control, cursor: "pointer", maxWidth: 150 }}
        >
          <option value="">All brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      )}

      <select
        value={value.sort}
        onChange={e => onChange({ ...value, sort: e.target.value as BenchFilter["sort"] })}
        style={{ ...control, cursor: "pointer" }}
      >
        <option value="oldest">Oldest first</option>
        <option value="priceAsc">Price: low to high</option>
        <option value="priceDesc">Price: high to low</option>
      </select>

      {active && (
        <>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>
            {shown} of {jobs.length}
          </span>
          <button
            onClick={() => onChange(EMPTY_FILTER)}
            style={{
              display: "flex", alignItems: "center", gap: 5, minHeight: 40, padding: "0 11px",
              borderRadius: 9, fontSize: 12, cursor: "pointer", fontFamily: ff,
              background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)",
            }}
          >
            <X size={12} /> Clear
          </button>
        </>
      )}
    </div>
  );
}
