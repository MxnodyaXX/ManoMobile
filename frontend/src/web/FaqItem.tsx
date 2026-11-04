"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

/**
 * One FAQ row. Opens with the grid-rows trick (0fr → 1fr), which animates to
 * the answer's real height in every browser, while the answer fades and rises
 * into place. Runs for everyone, "reduce motion" included: it only moves when
 * the visitor clicks it, and only a short distance.
 *
 * The answer is always in the HTML (just collapsed), so search engines and
 * screen-reader "find" still reach it.
 */
export default function FaqItem({ q, children, style }: { q: string; children: ReactNode; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div data-reveal style={style} className="border-b border-neutral-200">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
        className={`group flex w-full items-center justify-between gap-6 py-6 text-left text-[16px] font-medium transition-colors duration-300 md:text-[17px] ${open ? "text-neutral-950" : "text-neutral-950 hover:text-neutral-500"}`}
      >
        {q}
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.1,1)] ${open ? "rotate-[135deg] border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 group-hover:border-neutral-400"}`}>
          <Plus size={16} strokeWidth={1.5} />
        </span>
      </button>
      <div
        id={id}
        role="region"
        className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.2,0.7,0.1,1)] ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className={`max-w-2xl pb-7 pr-14 text-[14px] leading-relaxed text-neutral-600 transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.1,1)] ${open ? "translate-y-0 opacity-100 delay-100" : "-translate-y-2 opacity-0"}`}>
            {children}
          </p>
        </div>
      </div>
    </div>
  );
}
