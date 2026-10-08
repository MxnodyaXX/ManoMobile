"use client";

import { ShieldCheck } from "lucide-react";

/**
 * The warranty a phone is sold with — picked when it is stocked, editable
 * later (sold phones included). Days count from the sale date; "Shop default"
 * leaves it to Warranty Center → Policies. See migration 20261006000068.
 */

const ff = "'Plus Jakarta Sans', sans-serif";

const CHOICES: { days: number | null; label: string }[] = [
  { days: null, label: "Shop default" },
  { days: 0,    label: "None" },
  { days: 30,   label: "1 month" },
  { days: 90,   label: "3 months" },
  { days: 180,  label: "6 months" },
  { days: 365,  label: "1 year" },
  { days: 730,  label: "2 years" },
];

const NOTE_SUGGESTIONS = ["Company warranty", "Shop warranty", "Used phone — shop warranty", "Refurbished"];

export default function DeviceWarrantyField({ days, note, onChange, disabled }: {
  days: number | null | undefined;
  note: string | undefined;
  onChange: (next: { days: number | null; note: string }) => void;
  disabled?: boolean;
}) {
  const current = days ?? null;
  const custom = current !== null && !CHOICES.some(c => c.days === current);

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 12, display: "flex", flexDirection: "column", gap: 10, fontFamily: ff, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        <ShieldCheck size={13} color="var(--accent)" /> Warranty
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CHOICES.map(c => {
          const on = current === c.days;
          return (
            <button
              key={String(c.days)} type="button" disabled={disabled}
              onClick={() => onChange({ days: c.days, note: note ?? "" })}
              style={{
                padding: "6px 11px", borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: ff,
                cursor: disabled ? "not-allowed" : "pointer",
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                background: on ? "var(--accent-dim)" : "transparent",
                color: on ? "var(--accent)" : "var(--text-secondary)",
              }}
            >{c.label}</button>
          );
        })}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <input
            type="number" min={0} disabled={disabled}
            value={custom ? current ?? "" : ""}
            placeholder="Days"
            onChange={e => onChange({ days: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))), note: note ?? "" })}
            style={{ width: 72, padding: "6px 8px", borderRadius: 8, border: `1px solid ${custom ? "var(--accent)" : "var(--border)"}`, background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, outline: "none", fontFamily: ff }}
          />
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>days</span>
        </span>
      </div>
      <input
        value={note ?? ""} disabled={disabled}
        onChange={e => onChange({ days: current, note: e.target.value })}
        placeholder="Whose warranty / conditions — e.g. Samsung company warranty"
        list="device-warranty-notes"
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12.5, outline: "none", fontFamily: ff }}
      />
      <datalist id="device-warranty-notes">
        {NOTE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
      </datalist>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Counted from the day it is sold. &ldquo;Shop default&rdquo; uses the phone policy in Warranty Center → Policies.
      </div>
    </div>
  );
}
