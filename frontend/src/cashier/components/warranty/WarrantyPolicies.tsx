"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Smartphone, Package, Cpu, Box } from "lucide-react";
import { useMyPermissions } from "@/lib/settings/staffRules";
import { useToast } from "@/lib/ui/toast";
import { savePolicy, deletePolicy, type WarrantyPolicy } from "@/lib/warranty/lookup";

/**
 * Warranty Center → Policies: how long each kind of thing the shop sells is
 * covered. One default per kind (phones, accessories, parts, anything else),
 * plus optional accessory-category rules — "Chargers: 90 days", "Cases: none".
 * The Lookup tab reads these against the sale date. Repairs are not here:
 * each repair's warranty is set by the technician when the job is finished.
 */

const ff = "'Plus Jakarta Sans', sans-serif";

const KINDS: { id: WarrantyPolicy["kind"]; label: string; icon: typeof Smartphone; blurb: string }[] = [
  { id: "device",    label: "Phones & devices", icon: Smartphone, blurb: "Every phone sold through Mobile Sales." },
  { id: "accessory", label: "Accessories",      icon: Package,    blurb: "Default for accessories; add a category rule to override it." },
  { id: "part",      label: "Spare parts",      icon: Cpu,        blurb: "Parts sold over the counter." },
  { id: "other",     label: "Anything else",    icon: Box,        blurb: "SIMs, reloads and hand-typed items." },
];

const QUICK = [0, 7, 30, 90, 180, 365];
const quickLabel = (d: number) => d === 0 ? "None" : d === 7 ? "7 days" : d === 365 ? "1 year" : d % 30 === 0 ? `${d / 30} mo` : `${d} d`;

const input: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12.5, outline: "none", fontFamily: ff, boxSizing: "border-box" };

export default function WarrantyPolicies({ policies, onChanged, error }: { policies: WarrantyPolicy[]; onChanged: () => void; error: string | null }) {
  const { isAdminCashier } = useMyPermissions();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, Partial<WarrantyPolicy>>>({});
  const [newCat, setNewCat] = useState({ category: "", days: "90", label: "" });
  const [busy, setBusy] = useState(false);

  const keyOf = (p: WarrantyPolicy) => String(p.id);
  const val = <K extends keyof WarrantyPolicy>(p: WarrantyPolicy, k: K) => (draft[keyOf(p)]?.[k] ?? p[k]) as WarrantyPolicy[K];
  const set = (p: WarrantyPolicy, patch: Partial<WarrantyPolicy>) => setDraft(d => ({ ...d, [keyOf(p)]: { ...d[keyOf(p)], ...patch } }));

  const save = async (p: WarrantyPolicy) => {
    setBusy(true);
    try {
      await savePolicy({ ...p, ...draft[keyOf(p)] });
      setDraft(d => { const n = { ...d }; delete n[keyOf(p)]; return n; });
      toast.success("Warranty policy saved");
      onChanged();
    } catch (e) { toast.dialog("error", "Could not save", e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const addCategory = async () => {
    if (!newCat.category.trim()) return;
    setBusy(true);
    try {
      const days = Math.max(0, parseInt(newCat.days) || 0);
      await savePolicy({ kind: "accessory", category: newCat.category, durationDays: days, label: newCat.label || (days ? `${quickLabel(days)} warranty` : "No warranty"), terms: "" });
      setNewCat({ category: "", days: "90", label: "" });
      toast.success("Category rule added");
      onChanged();
    } catch (e) { toast.dialog("error", "Could not add", e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const remove = async (p: WarrantyPolicy) => {
    setBusy(true);
    try { await deletePolicy(p.id); onChanged(); }
    catch (e) { toast.dialog("error", "Could not remove", e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const editor = (p: WarrantyPolicy) => {
    const dirty = !!draft[keyOf(p)];
    const days = Number(val(p, "durationDays"));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK.map(d => (
            <button key={d} disabled={!isAdminCashier} onClick={() => set(p, { durationDays: d, label: d ? `${quickLabel(d)} warranty` : "No warranty" })} style={{
              padding: "5px 11px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: isAdminCashier ? "pointer" : "default", fontFamily: ff,
              border: `1px solid ${days === d ? "var(--accent)" : "var(--border)"}`, background: days === d ? "var(--accent-dim)" : "transparent",
              color: days === d ? "var(--accent)" : "var(--text-secondary)",
            }}>{quickLabel(d)}</button>
          ))}
          <input type="number" min={0} disabled={!isAdminCashier} value={days} onChange={e => set(p, { durationDays: Number(e.target.value) })} style={{ ...input, width: 90 }} aria-label="Days" />
          <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>days</span>
        </div>
        <input disabled={!isAdminCashier} value={String(val(p, "label"))} onChange={e => set(p, { label: e.target.value })} placeholder="Label shown to the cashier" style={{ ...input, width: "100%" }} />
        <textarea disabled={!isAdminCashier} value={String(val(p, "terms"))} onChange={e => set(p, { terms: e.target.value })} rows={2} placeholder="What is and is not covered…" style={{ ...input, width: "100%", resize: "vertical" }} />
        {isAdminCashier && dirty && (
          <button onClick={() => void save(p)} disabled={busy} style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>
            <Save size={13} /> Save
          </button>
        )}
      </div>
    );
  };

  const categoryRules = policies.filter(p => p.kind === "accessory" && p.category);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: ff }}>
      {error && <div style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 12.5, color: "var(--text-secondary)" }}>{error}</div>}
      {!isAdminCashier && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Only an Admin or Admin Cashier can change these.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {KINDS.map(k => {
          const p = policies.find(x => x.kind === k.id && !x.category);
          const Icon = k.icon;
          return (
            <div key={k.id} style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-card)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-dim)", color: "var(--accent)", display: "grid", placeItems: "center" }}><Icon size={17} /></div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{k.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{k.blurb}</div>
                </div>
              </div>
              {p ? editor(p) : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No default yet — run the warranty migration.</div>}
            </div>
          );
        })}
      </div>

      {/* Accessory category rules */}
      <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-card)", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>Accessory category rules</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Override the accessory default for one category — matched against the product&apos;s category in Inventory.</div>
        </div>
        {categoryRules.map(p => (
          <div key={p.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ width: 160, fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", paddingTop: 6 }}>{p.category}</div>
            <div style={{ flex: 1, minWidth: 260 }}>{editor(p)}</div>
            {isAdminCashier && (
              <button onClick={() => void remove(p)} disabled={busy} title="Remove rule" style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 6 }}><Trash2 size={15} /></button>
            )}
          </div>
        ))}
        {isAdminCashier && (
          <div style={{ padding: "14px 16px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "var(--bg-secondary)" }}>
            <input value={newCat.category} onChange={e => setNewCat(c => ({ ...c, category: e.target.value }))} placeholder="Category, e.g. Chargers" style={{ ...input, width: 200 }} />
            <input type="number" min={0} value={newCat.days} onChange={e => setNewCat(c => ({ ...c, days: e.target.value }))} style={{ ...input, width: 90 }} aria-label="Days" />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>days</span>
            <input value={newCat.label} onChange={e => setNewCat(c => ({ ...c, label: e.target.value }))} placeholder="Label (optional)" style={{ ...input, flex: 1, minWidth: 160 }} />
            <button onClick={() => void addCategory()} disabled={busy || !newCat.category.trim()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: newCat.category.trim() ? "var(--accent)" : "var(--border)", color: newCat.category.trim() ? "var(--accent-fg)" : "var(--text-muted)", fontSize: 12.5, fontWeight: 700, cursor: newCat.category.trim() ? "pointer" : "not-allowed", fontFamily: ff }}>
              <Plus size={13} /> Add rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
