"use client";

import { useState, useRef, useEffect, useMemo, useId, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Check, X } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * A design-matched combobox:
 *  • Opening the list always shows every option — the current selection is
 *    ticked and scrolled to, so switching choices never needs a manual clear.
 *  • Typing filters the list; the filter only applies to text the user has
 *    actually typed since opening (not to the selected value sitting in the box).
 *  • Free-typing is allowed when allowAdd; if what you typed isn't in the list,
 *    an "Add … to list" row appears. Choosing it calls onAddOption (so it
 *    persists for next time) and selects the value.
 *  • Arrow keys / Enter / Escape drive the list from the keyboard.
 */
export default function Combobox({
  value,
  onChange,
  options,
  onAddOption,
  placeholder = "Type or select…",
  allowAdd = true,
  inputStyle,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onAddOption?: (v: string) => void;
  placeholder?: string;
  allowAdd?: boolean;
  inputStyle?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  // Has the user edited the text since the list was opened? Until they do, the
  // box holds the current selection and must NOT be treated as a filter.
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /**
   * Where the list goes, in page coordinates.
   *
   * The list is rendered into document.body rather than under the input. Under
   * the input it was position: absolute, and any ancestor with overflow: hidden
   * — the job editor's sections have it for their rounded corners — clipped it
   * to that box, so the brand list opened as a strip cut off at both ends with
   * the next section's heading showing through. A portal cannot be clipped by
   * an ancestor's overflow, and is immune to the same problem from any
   * container this is dropped into next.
   *
   * Below the input by default; above it when there is more room there, so the
   * list is never pushed off the bottom of a short screen.
   */
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const up = below < 300 && r.top > below;
      setRect({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, up });
    };
    place();
    // The page can scroll or resize under an open list; it follows the input.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  // Keep the visible text in sync when the value changes externally
  // (e.g. model-number auto-fill), derived during render rather than in an effect.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) { setLastValue(value); setQuery(value); }

  const q = query.trim().toLowerCase();
  // Hard invariant: the text of the *current selection* is never a filter, so
  // reopening the list after picking always shows every option. Only text the
  // user typed, and which differs from what is selected, narrows the list.
  const isFiltering = typed && q.length > 0 && q !== value.trim().toLowerCase();
  const filtered = useMemo(
    () => (isFiltering ? options.filter(o => o.toLowerCase().includes(q)) : options),
    [options, q, isFiltering],
  );
  const exact = options.some(o => o.toLowerCase() === q);
  const showAdd = allowAdd && isFiltering && !exact;
  const rowCount = filtered.length + (showAdd ? 1 : 0);

  const close = () => { setOpen(false); setTyped(false); setActive(-1); };

  /** Open with the full list showing and the current selection highlighted. */
  const openList = () => { setTyped(false); setOpen(true); setActive(options.findIndex(o => o === value)); };

  /** Leaving the field: keep free-typed text only where adding is allowed. */
  const commitAndClose = () => {
    if (typed && query !== value) {
      if (allowAdd) onChange(query);
      else setQuery(value); // list-only field — discard the half-typed filter
    }
    close();
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const inWrap = wrapRef.current?.contains(t) ?? false;
      const inList = listRef.current?.contains(t) ?? false;
      if (!inWrap && !inList) commitAndClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  });

  // Keep the active row in view as the arrow keys move it.
  useEffect(() => {
    if (open && active >= 0) rowRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const baseInput: React.CSSProperties = {
    width: "100%", padding: "9px 58px 9px 12px", borderRadius: 8,
    border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13.5,
    fontFamily: ff, outline: "none", boxSizing: "border-box",
    boxShadow: open ? "0 0 0 3px var(--accent-glow)" : "none",
    cursor: disabled ? "not-allowed" : "text",
    transition: "border-color 0.15s, box-shadow 0.15s",
    ...inputStyle,
  };

  const select = (v: string) => { onChange(v); setQuery(v); close(); };
  const add = () => { const v = query.trim(); onAddOption?.(v); select(v); };
  const pick = (i: number) => { if (i >= 0 && i < filtered.length) select(filtered[i]); else if (showAdd) add(); };

  const iconBtn: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 22, height: 22, borderRadius: 6, border: "none", padding: 0,
    background: "transparent", color: "var(--text-muted)",
    cursor: "pointer", transition: "color 0.15s, background 0.15s",
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        value={query}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={e => { setQuery(e.target.value); setTyped(true); setActive(-1); setOpen(true); }}
        onFocus={e => { openList(); e.target.select(); }}
        onClick={() => { if (!open) openList(); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) { openList(); return; }
            if (!rowCount) return;
            const dir = e.key === "ArrowDown" ? 1 : -1;
            setActive(a => (a + dir + rowCount) % rowCount);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && active >= 0) pick(active);
            else if (showAdd) add();
            else if (filtered.length === 1) select(filtered[0]);
            else commitAndClose();
          } else if (e.key === "Escape") {
            setQuery(value);
            close();
          } else if (e.key === "Tab") {
            commitAndClose();
          }
        }}
        placeholder={placeholder}
        style={baseInput}
      />

      {!disabled && query.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { onChange(""); setQuery(""); setTyped(false); setActive(-1); inputRef.current?.focus(); }}
          style={{ ...iconBtn, right: 32 }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <X size={13} />
        </button>
      )}

      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Close list" : "Show all options"}
        disabled={disabled}
        onMouseDown={e => e.preventDefault()}
        onClick={() => { if (open) commitAndClose(); else { openList(); inputRef.current?.focus(); } }}
        style={{
          ...iconBtn, right: 8,
          color: open ? "var(--accent)" : "var(--text-muted)",
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        <ChevronDown size={15} style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: "transform 0.18s" }} />
      </button>

      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          id={listId}
          ref={listRef}
          className="combo-pop"
          role="listbox"
          style={{
            position: "fixed", left: rect.left, width: rect.width, zIndex: 1400,
            ...(rect.up ? { bottom: window.innerHeight - rect.top } : { top: rect.top }),
            background: "var(--bg-card)", border: "1px solid var(--border-active)", borderRadius: 12,
            boxShadow: "0 18px 44px rgba(0,0,0,0.34)", padding: 5,
            maxHeight: 268, overflowY: "auto", overscrollBehavior: "contain",
            fontFamily: ff,
          }}
        >
          {rowCount === 0 && (
            <div style={{ padding: "12px 10px", fontSize: 12.5, fontFamily: ff, color: "var(--text-muted)", textAlign: "center" }}>
              No matches for &ldquo;{query.trim()}&rdquo;
            </div>
          )}

          {filtered.map((opt, i) => {
            const isSel = opt === value;
            const isActive = i === active;
            return (
              <button
                key={opt}
                ref={el => { rowRefs.current[i] = el; }}
                type="button"
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => { e.preventDefault(); select(opt); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8,
                  // Left padding trimmed to 7px so the text lines up exactly
                  // under the input's own text above (12px input padding −
                  // 5px popup padding = 7px needed here), instead of sitting
                  // a few pixels further right than the selected value.
                  width: "100%", padding: "9px 11px 9px 7px", border: "none", borderRadius: 8,
                  cursor: "pointer", textAlign: "left",
                  background: isActive ? "var(--bg-card-hover)" : isSel ? "var(--accent-dim)" : "transparent",
                  color: isSel ? "var(--accent)" : "var(--text-primary)",
                  fontSize: 13, fontWeight: isSel ? 600 : 400, fontFamily: ff,
                  transition: "background 0.12s",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{opt}</span>
                {isSel && <Check size={14} style={{ flexShrink: 0, marginLeft: "auto" }} />}
              </button>
            );
          })}

          {showAdd && (
            <button
              ref={el => { rowRefs.current[filtered.length] = el; }}
              type="button"
              role="option"
              aria-selected={false}
              onMouseEnter={() => setActive(filtered.length)}
              onMouseDown={e => { e.preventDefault(); add(); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 11px 10px 7px",
                border: "none", borderRadius: 8, marginTop: filtered.length ? 4 : 0,
                borderTop: filtered.length ? "1px solid var(--border)" : "none",
                cursor: "pointer", textAlign: "left",
                background: active === filtered.length ? "var(--bg-card-hover)" : "transparent",
                color: "var(--accent)", fontSize: 13, fontWeight: 600, fontFamily: ff,
                transition: "background 0.12s",
              }}
            >
              <Plus size={14} /> Add &ldquo;{query.trim()}&rdquo; to the list
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
