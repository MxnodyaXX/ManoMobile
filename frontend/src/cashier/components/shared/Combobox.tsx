"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
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
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) commitAndClose();
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

      {open && (
        <div
          id={listId}
          className="combo-pop"
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
            background: "var(--bg-card)", border: "1px solid var(--border-active)", borderRadius: 12,
            boxShadow: "0 18px 44px rgba(0,0,0,0.34)", padding: 5,
            maxHeight: 268, overflowY: "auto", overscrollBehavior: "contain",
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
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  width: "100%", padding: "9px 11px", border: "none", borderRadius: 8,
                  cursor: "pointer", textAlign: "left",
                  background: isActive ? "var(--bg-card-hover)" : isSel ? "var(--accent-dim)" : "transparent",
                  color: isSel ? "var(--accent)" : "var(--text-primary)",
                  fontSize: 13, fontWeight: isSel ? 600 : 400, fontFamily: ff,
                  transition: "background 0.12s",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt}</span>
                {isSel && <Check size={14} style={{ flexShrink: 0 }} />}
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
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 11px",
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
        </div>
      )}
    </div>
  );
}
