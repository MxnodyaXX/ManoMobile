"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * A design-matched combobox:
 *  • Type to filter the list — only matching options stay visible.
 *  • Free-typing is allowed; if what you typed isn't in the list, an
 *    "Add … to list" row appears. Choosing it calls onAddOption (so it
 *    persists for next time) and selects the value.
 *  • No separate "Other" option needed — anything can be typed.
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
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the visible text in sync when the value changes externally
  // (e.g. model-number auto-fill).
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        // commit whatever is typed
        if (query !== value) onChange(query);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [query, value, onChange]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? options.filter(o => o.toLowerCase().includes(q)) : options),
    [options, q],
  );
  const exact = options.some(o => o.toLowerCase() === q);
  const showAdd = allowAdd && q.length > 0 && !exact;

  const baseInput: React.CSSProperties = {
    width: "100%", padding: "9px 36px 9px 12px", borderRadius: 8,
    border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13.5,
    fontFamily: ff, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s",
    ...inputStyle,
  };

  const select = (v: string) => { onChange(v); setQuery(v); setOpen(false); };
  const add = () => { const v = query.trim(); onAddOption?.(v); select(v); };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={query}
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (showAdd) add();
            else if (filtered.length === 1) select(filtered[0]);
            else { onChange(query); setOpen(false); }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        style={baseInput}
      />
      <ChevronDown
        size={15}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          position: "absolute", right: 11, top: "50%", transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: "var(--text-muted)", pointerEvents: disabled ? "none" : "auto", cursor: "pointer", transition: "transform 0.18s",
        }}
      />

      {open && (filtered.length > 0 || showAdd) && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,0.28)", overflow: "hidden", maxHeight: 240, overflowY: "auto",
        }}>
          {filtered.map(opt => {
            const isSel = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onMouseDown={e => { e.preventDefault(); select(opt); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  width: "100%", padding: "9px 12px", border: "none", cursor: "pointer", textAlign: "left",
                  background: isSel ? "var(--accent-dim)" : "transparent",
                  color: isSel ? "var(--accent)" : "var(--text-primary)", fontSize: 13, fontFamily: ff,
                }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)"; }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span>{opt}</span>
                {isSel && <Check size={14} />}
              </button>
            );
          })}
          {showAdd && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); add(); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px",
                border: "none", borderTop: filtered.length ? "1px solid var(--border)" : "none",
                cursor: "pointer", textAlign: "left", background: "transparent",
                color: "var(--accent)", fontSize: 13, fontWeight: 600, fontFamily: ff,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
            >
              <Plus size={14} /> Add &ldquo;{query.trim()}&rdquo; to the list
            </button>
          )}
        </div>
      )}
    </div>
  );
}
