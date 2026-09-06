"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

/**
 * Click-to-sort table headers, in one place.
 *
 * Every table in this app was written with its own header markup and its own
 * ideas about ordering — some sorted by date, some by whatever order the rows
 * arrived in, none of them by anything the person reading could change. Sorting
 * added table by table would have meant the same comparison bugs repeated a
 * dozen times: numbers ordered as text, blanks floating to the top, a second
 * click doing nothing.
 *
 * So the comparison lives here and each table supplies only two things: how to
 * read a value out of its own row type, and where to put the header.
 */

export type SortDir = "asc" | "desc";

export interface SortState {
  /** Null means "leave the rows in the order they arrived". */
  key: string | null;
  dir: SortDir;
}

/** What a column can be sorted on. Undefined and null both mean "no value". */
export type SortValue = string | number | Date | null | undefined;

const NO_SORT: SortState = { key: null, dir: "asc" };

/**
 * Order two values of whatever type the column reads.
 *
 * Numbers compare numerically and strings with localeCompare's numeric option,
 * so "RM-9" comes before "RM-10" rather than after it — the single most
 * noticeable way a naive sort looks broken on this data.
 *
 * Blanks always sort last, in both directions. They are the absence of an
 * answer, not the smallest one, and a column sorted descending that opens with
 * a screen of dashes has buried what was asked for.
 */
function compare(a: SortValue, b: SortValue, dir: SortDir): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const flip = dir === "asc" ? 1 : -1;

  if (a instanceof Date || b instanceof Date) {
    return (new Date(a as string).getTime() - new Date(b as string).getTime()) * flip;
  }
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * flip;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }) * flip;
}

/**
 * Sorted rows, plus the state the headers need.
 *
 * `accessors` maps a column key to how that column reads a row. A key with no
 * accessor is simply not sortable, which is the right answer for a column of
 * buttons.
 */
export function useTableSort<T>(
  rows: T[],
  accessors: Record<string, (row: T) => SortValue>,
  initial: SortState = NO_SORT,
) {
  const [sort, setSort] = useState<SortState>(initial);

  const toggle = (key: string) => {
    if (!accessors[key]) return;
    setSort(s =>
      s.key !== key
        ? { key, dir: "asc" }
        // Third click clears it, so the table can be put back the way it came
        // — which for most of these is a deliberate order, newest first.
        : s.dir === "asc"
          ? { key, dir: "desc" }
          : NO_SORT,
    );
  };

  const read = sort.key ? accessors[sort.key] : undefined;

  const sorted = useMemo(() => {
    if (!read) return rows;
    // Copied before sorting: these arrays come from context and props, and
    // sorting one in place would reorder it for every other screen holding it.
    return [...rows].sort((x, y) => compare(read(x), read(y), sort.dir));
    // `read` rather than `accessors`: callers build the map inline, so it is a
    // new object every render and depending on it would re-sort on every
    // keystroke elsewhere in the page. The function for the active column is
    // what the result actually depends on.
  }, [rows, sort.dir, read]);

  return { sorted, sort, toggle, sortable: (key: string) => !!accessors[key] };
}

/**
 * A header cell that sorts.
 *
 * Takes the table's own `style` rather than imposing one, because these headers
 * live in a dozen tables that do not otherwise look alike, and a sort control
 * that changed the header's appearance would be the most visible thing about
 * a feature that should be almost invisible until used.
 */
export function SortHeader({ label, sortKey, sort, onSort, sortable = true, style, align = "left" }: {
  label: React.ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  sortable?: boolean;
  style?: React.CSSProperties;
  align?: "left" | "right" | "center";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;

  if (!sortable) return <th style={{ ...style, textAlign: align }}>{label}</th>;

  return (
    <th style={{ ...style, textAlign: align }}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={active ? (sort.dir === "asc" ? "Sorted A–Z · click for Z–A" : "Sorted Z–A · click to clear") : "Sort A–Z"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
          background: "none", border: "none", padding: 0, font: "inherit",
          color: active ? "var(--accent)" : "inherit",
          letterSpacing: "inherit", textTransform: "inherit",
          flexDirection: align === "right" ? "row-reverse" : "row",
        }}
      >
        {label}
        {/* The idle chevrons sit at low opacity: enough to say the header can
            be clicked, not enough to compete with the header text itself. */}
        <Icon size={11} style={{ opacity: active ? 1 : 0.35, flexShrink: 0 }} />
      </button>
    </th>
  );
}
