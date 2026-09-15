"use client";

import { Search } from "lucide-react";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  categories: string[];
  activeCategory: string;
  onCategoryChange: (c: string) => void;
}

export const ALL = "All";

export function SearchBar({ query, onQueryChange, categories, activeCategory, onCategoryChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          type="text"
          placeholder="Search products by name, code or brand"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-500/10"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <CategoryChip label={ALL} active={activeCategory === ALL} onClick={() => onCategoryChange(ALL)} />
        {categories.map(c => (
          <CategoryChip key={c} label={c} active={activeCategory === c} onClick={() => onCategoryChange(c)} />
        ))}
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-slate-900 text-white dark:bg-violet-600"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
