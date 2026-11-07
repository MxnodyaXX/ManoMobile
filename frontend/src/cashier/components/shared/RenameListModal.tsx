"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

export interface RenameItem {
  key: string;
  /** What identifies it besides the name: its code or SKUs. */
  label: string;
  oldName: string;
  newName: string;
}

/**
 * Old and new names side by side for checking. Nothing changes until the button
 * at the bottom is pressed. The list is taken once on opening: a sale on another
 * till reloads the catalogue, and that shouldn't rebuild it under someone's edits.
 */
export default function RenameListModal({ title, intro, items, catalogue, clashNote, blocked, rename, onFinished, onClose }: {
  title: string;
  intro: string;
  items: RenameItem[];
  /** Every entry in the catalogue with its current name, to spot two ending up the same. */
  catalogue: { key: string; name: string }[];
  clashNote: string;
  /** Why renaming can't go ahead yet, shown in place of the list. */
  blocked?: string;
  /** Resolves false when nothing changed because someone else renamed it first. */
  rename: (item: RenameItem, newName: string) => Promise<boolean>;
  onFinished: () => Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(() => items
    .map(i => ({ ...i, picked: true }))
    .sort((a, b) => a.newName.localeCompare(b.newName)));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ done: number; skipped: string[]; failed: string[] } | null>(null);

  const clashes = useMemo(() => {
    const byKey = new Map(rows.map(r => [r.key, r]));
    const counts = new Map<string, number>();
    for (const entry of catalogue) {
      const r = byKey.get(entry.key);
      const name = (r?.picked ? r.newName : entry.name).trim().toLowerCase();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [rows, catalogue]);

  const patch = (key: string, change: { picked?: boolean; newName?: string }) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...change } : r)));

  const picked = rows.filter(r => r.picked && r.newName.trim() && r.newName.trim() !== r.oldName);
  const clashCount = rows.filter(r => r.picked && (clashes.get(r.newName.trim().toLowerCase()) ?? 0) > 1).length;

  async function apply() {
    if (saving || picked.length === 0) return;
    setSaving(true);
    let done = 0;
    const skipped: string[] = [], failed: string[] = [];
    for (const r of picked) {
      try {
        if (await rename(r, r.newName.trim())) done++;
        else skipped.push(r.label);
      } catch {
        failed.push(r.label);
      }
    }
    await onFinished().catch(() => {});
    setResult({ done, skipped, failed });
    setSaving(false);
  }

  const button = (primary: boolean, off = false): React.CSSProperties => ({
    padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: primary ? 600 : 500, fontFamily: ff,
    cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.5 : 1,
    border: primary ? "none" : "1px solid var(--border)",
    background: primary ? "var(--accent)" : "transparent",
    color: primary ? "#fff" : "var(--text-secondary)",
  });

  const editable = !result && !blocked && rows.length > 0;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", fontFamily: ff }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{intro}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, flexShrink: 0 }}><X size={18} /></button>
        </div>

        {result ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
            <div style={{ fontWeight: 700 }}>{result.done} renamed.</div>
            {result.skipped.length > 0 && <div style={{ color: "#b45309" }}>Left alone, because someone else renamed them first: {result.skipped.join("; ")}</div>}
            {result.failed.length > 0 && <div style={{ color: "#dc2626" }}>Could not save: {result.failed.join("; ")}. Open this screen again to retry them.</div>}
          </div>
        ) : blocked ? (
          <div style={{ padding: 20, fontSize: 13, color: "#b45309" }}>{blocked}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: "var(--text-secondary)" }}>Every name already follows the format.</div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {rows.map(r => {
              const clash = r.picked && (clashes.get(r.newName.trim().toLowerCase()) ?? 0) > 1;
              return (
                <div key={r.key} style={{ display: "flex", gap: 10, padding: "10px 20px", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
                  <input type="checkbox" checked={r.picked} disabled={saving} onChange={e => patch(r.key, { picked: e.target.checked })} aria-label={`Rename ${r.oldName}`} style={{ marginTop: 3, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                      <span style={{ fontFamily: "monospace" }}>{r.label}</span> · now: {r.oldName}
                    </div>
                    <input
                      value={r.newName}
                      disabled={saving}
                      onChange={e => patch(r.key, { newName: e.target.value })}
                      aria-label={`New name for ${r.oldName}`}
                      style={{ marginTop: 4, width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 7, border: `1px solid ${clash ? "#d97706" : "var(--border)"}`, background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, fontFamily: ff, opacity: r.picked ? 1 : 0.5 }}
                    />
                    {clash && <div style={{ fontSize: 11, color: "#b45309", marginTop: 3 }}>{clashNote}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          {editable && clashCount > 0 && <div style={{ fontSize: 12, color: "#b45309", marginRight: "auto" }}>{clashCount} would share a name</div>}
          <button onClick={onClose} disabled={saving} style={button(false, saving)}>{editable ? "Cancel" : "Close"}</button>
          {editable && (
            <button onClick={apply} disabled={saving || picked.length === 0} style={button(true, saving || picked.length === 0)}>
              {saving ? "Renaming…" : `Rename ${picked.length}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
