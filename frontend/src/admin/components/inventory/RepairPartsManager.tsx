"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Edit2, Trash2, Search, AlertCircle, Tag, X } from "lucide-react";
import { useParts, PART_CATEGORIES, type SparePart, type PartCategory } from "@/cashier/contexts/PartsContext";
import { useToast } from "@/lib/ui/toast";
import BarcodeLabelModal from "@/cashier/components/shared/BarcodeLabelModal";
import { inputStyle, labelStyle, thStyle, tdStyle, btnAccent, DeleteConfirm } from "@/admin/components/shared/adminUi";

/**
 * The spare-parts catalogue.
 *
 * Lives here rather than inside AdminControl because a screen and a page both
 * show it: a repair part is reference data an admin maintains AND stock the
 * shop counts, and those are the same rows seen from two directions. Kept as
 * one component so the two can never disagree about what a part is.
 */

// ─── Repair Part Modal ────────────────────────────────────────────────────────

function PartModal({ part, onSave, onClose }: { part: SparePart | null; onSave: (p: SparePart) => void; onClose: () => void }) {
  const blank: SparePart = { id: "", sku: "", name: "", category: "Screen", compatibleWith: [], stock: 0, reorderLevel: 5, costPrice: 0, location: "" };
  const [form, setForm] = useState<SparePart>(part ?? blank);
  const [compatText, setCompatText] = useState((part?.compatibleWith ?? []).join(", "));
  const [errors, setErrors] = useState<Partial<Record<"name" | "sku", string>>>({});

  const set = <K extends keyof SparePart>(k: K, v: SparePart[K]) => setForm(f => ({ ...f, [k]: v }));

  function validate() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.sku.trim()) e.sku = "SKU is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const compatibleWith = compatText.split(",").map(s => s.trim()).filter(Boolean);
    onSave({ ...form, compatibleWith });
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{part ? "Edit Part" : "Add Repair Part"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Spare-part stock consumed on repairs — separate from retail accessories</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Part Name</label>
            <input type="text" value={form.name} onChange={e => { set("name", e.target.value); setErrors(p => ({ ...p, name: undefined })); }} placeholder="e.g. iPhone 13 OLED Screen" style={{ ...inputStyle, borderColor: errors.name ? "#dc2626" : "var(--border)" }} />
            {errors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.name}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>SKU</label>
              <input type="text" value={form.sku} onChange={e => { set("sku", e.target.value); setErrors(p => ({ ...p, sku: undefined })); }} placeholder="e.g. SCR-IP13-001" style={{ ...inputStyle, borderColor: errors.sku ? "#dc2626" : "var(--border)" }} />
              {errors.sku && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.sku}</div>}
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value as PartCategory)} style={{ ...inputStyle, cursor: "pointer" }}>
                {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Compatible Devices</label>
            <input type="text" value={compatText} onChange={e => setCompatText(e.target.value)} placeholder="e.g. iPhone 13, iPhone 13 Pro" style={inputStyle} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Comma-separated — shown to technicians when they search for a part</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Stock</label>
              <input type="number" min={0} value={form.stock} onChange={e => set("stock", Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Reorder Level</label>
              <input type="number" min={0} value={form.reorderLevel} onChange={e => set("reorderLevel", Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cost Price (Rs.)</label>
              <input type="number" min={0} value={form.costPrice} onChange={e => set("costPrice", Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Storage Location</label>
            <input type="text" value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Shelf A-3" style={inputStyle} />
          </div>
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ ...btnAccent, padding: "9px 20px" }}>{part ? "Save Changes" : "Add Part"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Repair Parts Manager ─────────────────────────────────────────────────────

function PartsManager() {
  const { parts, savePart, deletePart, loading, error, configured } = useParts();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<PartCategory | "All">("All");
  const [modal, setModal] = useState<SparePart | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<SparePart | null>(null);
  const [labelPart, setLabelPart] = useState<SparePart | null>(null);

  const filtered = parts.filter(p => {
    if (catFilter !== "All" && p.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 380 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or SKU…" style={{ ...inputStyle, paddingLeft: 34, fontSize: 12 }} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value as PartCategory | "All")} style={{ ...inputStyle, width: "auto", cursor: "pointer", fontSize: 12 }}>
          <option value="All">All Categories</option>
          {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setModal("new")} style={btnAccent}><Plus size={13} /> Add Part</button>
      </div>
      {(!configured || error) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {!configured
              ? "Connect Supabase to store the parts catalog — nothing added here will be saved."
              : `${error} — run migration 20260819000010_repair_parts_catalog.sql.`}
          </p>
        </div>
      )}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <thead><tr>
            <th style={thStyle}>Part</th><th style={thStyle}>SKU</th><th style={thStyle}>Category</th>
            <th style={thStyle}>Compatible With</th><th style={thStyle}>Stock</th><th style={thStyle}>Cost</th>
            <th style={thStyle}>Location</th><th style={{ ...thStyle, width: 104 }}></th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>Loading parts…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>{search || catFilter !== "All" ? "No parts match" : "No repair parts added yet — click “Add Part” to start the catalog"}</td></tr>
            ) : filtered.map(p => {
              const low = p.stock > 0 && p.stock <= p.reorderLevel;
              return (
                <tr key={p.id}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{p.name}</span></td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{p.sku}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)" }}>{p.category}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)", maxWidth: 220 }}>{p.compatibleWith.length ? p.compatibleWith.join(", ") : "—"}</td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: p.stock === 0 ? "#dc2626" : low ? "#b45309" : "#16a34a" }}>{p.stock}</span>
                    {low && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#b45309" }}>LOW</span>}
                    {p.stock === 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#fee2e2", color: "#dc2626" }}>OUT</span>}
                  </td>
                  <td style={tdStyle}>Rs. {p.costPrice.toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{p.location || "—"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setLabelPart(p)} title="Print part label" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Tag size={14} /></button>
                      <button onClick={() => setModal(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteTarget(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{filtered.length} of {parts.length} parts</div>
      </div>
      {modal !== null && (
        <PartModal
          part={modal === "new" ? null : modal}
          onSave={async p => {
            try {
              await savePart(p);
              toast.dialog("success", modal === "new" ? "Part added" : "Part updated", `${p.name} (${p.sku})`);
              setModal(null);
            } catch (e) {
              // Modal stays open with the values still in it — a save that
              // failed must not look like one that worked.
              toast.dialog("error", "Could not save part", e instanceof Error ? e.message : String(e));
            }
          }}
          onClose={() => setModal(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={async () => {
            try {
              await deletePart(deleteTarget.id);
              toast.dialog("success", "Part removed", `${deleteTarget.name} has been removed from the catalog.`);
            } catch (e) {
              toast.dialog("error", "Could not remove part", e instanceof Error ? e.message : String(e));
            }
            setDeleteTarget(null);
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {labelPart && (
        <BarcodeLabelModal
          variant="part"
          code={labelPart.sku}
          title={labelPart.name}
          subtitle={labelPart.category}
          onClose={() => setLabelPart(null)}
        />
      )}
    </div>
  );
}

export default PartsManager;
