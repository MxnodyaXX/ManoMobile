"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import AgentsManager from "@/admin/components/repair/AgentsManager";
import { useToast } from "@/lib/ui/toast";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import Barcode from "react-barcode";
import {
  Tag, Layers, Truck, Barcode as BarcodeIcon, Settings,
  Plus, Edit2, Trash2, X, Search, Phone, Mail, Eye, KeyRound, Check,
  Store, MapPin, CalendarDays, Building2, Package, ClipboardCheck,
  CheckCircle2, XCircle, Clock, AlertTriangle,
} from "lucide-react";
import {
  useInventory,
  type Brand, type Category, type Supplier, type BarcodeSettings,
} from "@/cashier/contexts/InventoryContext";
import { useRepair, type RepairDealer } from "@/cashier/contexts/RepairContext";
import { useParts, PART_CATEGORIES, type SparePart, type PartCategory, type PartRequestStatus } from "@/cashier/contexts/PartsContext";
import BarcodeLabelModal from "@/cashier/components/shared/BarcodeLabelModal";

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)",
  fontSize: 13, width: "100%", outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, display: "block",
};

const thStyle: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
  background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px", fontSize: 13, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)", fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const btnAccent: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
  borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
  cursor: "pointer", fontSize: 12, fontWeight: 600,
  fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap",
};

// ─── Chip toggle helper ───────────────────────────────────────────────────────

function ChipGroup({ items, selected, onToggle, hint }: {
  items: { id: number; label: string }[];
  selected: number[];
  onToggle: (id: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map(it => {
          const sel = selected.includes(it.id);
          return (
            <button key={it.id} onClick={() => onToggle(it.id)} style={{ padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: sel ? 600 : 400, border: sel ? "1px solid var(--accent-glow)" : "1px solid var(--border)", background: sel ? "var(--accent-dim)" : "transparent", color: sel ? "var(--accent)" : "var(--text-secondary)" }}>
              {it.label}
            </button>
          );
        })}
      </div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{hint}</div>}
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: 360, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={16} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Remove Entry</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Cannot be undone</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
          Remove <strong style={{ color: "var(--text-primary)" }}>{name}</strong>? This won&apos;t affect existing inventory items.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Remove</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Simple Name Modal (Category only) ───────────────────────────────────────

function NameModal({ title, initial, onSave, onClose }: { title: string; initial: string; onSave: (name: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  function handleSave() {
    if (!value.trim()) { setError("Name is required"); return; }
    onSave(value.trim());
  }
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: 360, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Name</label>
          <input autoFocus type="text" value={value} onChange={e => { setValue(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleSave()} placeholder="Enter name…" style={{ ...inputStyle, borderColor: error ? "#dc2626" : "var(--border)" }} />
          {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{error}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Brand Modal ──────────────────────────────────────────────────────────────

function BrandModal({ brand, onSave, onClose }: { brand: Brand | null; onSave: (b: Brand) => void; onClose: () => void }) {
  const { categories } = useInventory();
  const [name, setName]           = useState(brand?.name ?? "");
  const [type, setType]           = useState<Brand["type"]>(brand?.type ?? "accessory");
  const [catIds, setCatIds]       = useState<number[]>(brand?.categoryIds ?? []);
  const [nameError, setNameError] = useState("");

  const toggle = (id: number) => setCatIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  function handleSave() {
    if (!name.trim()) { setNameError("Name is required"); return; }
    onSave({ id: brand?.id ?? Date.now(), name: name.trim(), type, categoryIds: type === "device" ? [] : catIds });
  }

  const typeOptions: { value: Brand["type"]; label: string; desc: string }[] = [
    { value: "device",    label: "Device Brand",    desc: "Phones, tablets, etc."   },
    { value: "accessory", label: "Accessory Brand", desc: "Cases, cables, audio…"   },
    { value: "both",      label: "Both",            desc: "Devices & accessories"   },
  ];

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{brand ? "Edit Brand" : "Add Brand"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Configure brand type and category associations</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Brand Name</label>
            <input autoFocus type="text" value={name} onChange={e => { setName(e.target.value); setNameError(""); }} style={{ ...inputStyle, borderColor: nameError ? "#dc2626" : "var(--border)" }} placeholder="e.g. Baseus" />
            {nameError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{nameError}</div>}
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Brand Type</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {typeOptions.map(t => (
                <button key={t.value} onClick={() => setType(t.value)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "left", border: type === t.value ? "1px solid var(--accent-glow)" : "1px solid var(--border)", background: type === t.value ? "var(--accent-dim)" : "var(--bg-surface)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: type === t.value ? "var(--accent)" : "var(--text-primary)" }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{t.desc}</div>
                  </div>
                  {type === t.value && <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={11} color="#fff" /></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Categories (only for accessory / both) */}
          {(type === "accessory" || type === "both") && (
            <div>
              <label style={labelStyle}>Relevant Categories</label>
              <ChipGroup
                items={categories.map(c => ({ id: c.id, label: c.name }))}
                selected={catIds}
                onToggle={toggle}
                hint="Leave empty to show for all accessory categories"
              />
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ ...btnAccent, padding: "9px 20px" }}>{brand ? "Save Changes" : "Add Brand"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Supplier Modal ───────────────────────────────────────────────────────────

function SupplierModal({ supplier, onSave, onClose }: { supplier: Supplier | null; onSave: (s: Supplier) => void; onClose: () => void }) {
  const { brands } = useInventory();
  const blank: Supplier = { id: 0, name: "", phone: "", email: "", brandIds: [] };
  const [form, setForm] = useState<Supplier>(supplier ?? blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Supplier, string>>>({});

  const set = (k: keyof Supplier, v: string) => setForm(f => ({ ...f, [k]: v }));
  const toggleBrand = (id: number) => setForm(f => ({ ...f, brandIds: f.brandIds.includes(id) ? f.brandIds.filter(x => x !== id) : [...f.brandIds, id] }));

  function validate() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, id: form.id || Date.now() });
  }

  const field = (label: string, key: keyof Supplier, placeholder = "") => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="text" value={form[key] as string} onChange={e => { set(key, e.target.value); setErrors(p => ({ ...p, [key]: undefined })); }} placeholder={placeholder} style={{ ...inputStyle, borderColor: errors[key] ? "#dc2626" : "var(--border)" }} />
      {errors[key] && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors[key]}</div>}
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{supplier ? "Edit Supplier" : "Add Supplier"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Contact details and brand associations</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {field("Supplier Name", "name", "e.g. TechImports PVT")}
          {field("Phone", "phone", "+94 77 000 0000")}
          {field("Email", "email", "orders@supplier.lk")}
          <div>
            <label style={labelStyle}>Supplied Brands</label>
            <ChipGroup
              items={brands.map(b => ({ id: b.id, label: b.name }))}
              selected={form.brandIds}
              onToggle={toggleBrand}
              hint="Leave empty to show for all brands"
            />
          </div>
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ ...btnAccent, padding: "9px 20px" }}>{supplier ? "Save Changes" : "Add Supplier"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Categories Manager ───────────────────────────────────────────────────────

function CategoriesManager() {
  const { categories, setCategories } = useInventory();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Category | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  function handleSave(name: string) {
    setCategories(prev => modal && modal !== "new" ? prev.map(c => c.id === modal.id ? { ...c, name } : c) : [...prev, { id: Date.now(), name }]);
    setModal(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories…" style={{ ...inputStyle, paddingLeft: 34, fontSize: 12 }} />
        </div>
        <button onClick={() => setModal("new")} style={btnAccent}><Plus size={13} /> Add Category</button>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Category Name</th><th style={{ ...thStyle, width: 80 }}></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>{search ? "No categories match" : "No categories added yet"}</td></tr>
              : filtered.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 12, width: 48 }}>{i + 1}</td>
                  <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}><Tag size={13} /></div><span style={{ fontWeight: 500 }}>{c.name}</span></div></td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: 4 }}><button onClick={() => setModal(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Edit2 size={14} /></button><button onClick={() => setDeleteTarget(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{filtered.length} of {categories.length} categories</div>
      </div>
      {modal !== null && <NameModal title={modal === "new" ? "Add Category" : "Edit Category"} initial={modal === "new" ? "" : modal.name} onSave={handleSave} onClose={() => setModal(null)} />}
      {deleteTarget && <DeleteConfirm name={deleteTarget.name} onConfirm={() => { setCategories(prev => prev.filter(c => c.id !== deleteTarget.id)); setDeleteTarget(null); }} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}

// ─── Brands Manager ───────────────────────────────────────────────────────────

function BrandsManager() {
  const { brands, setBrands } = useInventory();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Brand | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const filtered = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  const typeBadge = (type: Brand["type"]) => {
    const map = { device: { bg: "#dbeafe", color: "#1d4ed8", label: "Device" }, accessory: { bg: "var(--accent-dim)", color: "var(--accent)", label: "Accessory" }, both: { bg: "#dcfce7", color: "#16a34a", label: "Both" } } as const;
    const s = map[type];
    return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{s.label}</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brands…" style={{ ...inputStyle, paddingLeft: 34, fontSize: 12 }} />
        </div>
        <button onClick={() => setModal("new")} style={btnAccent}><Plus size={13} /> Add Brand</button>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Brand Name</th><th style={thStyle}>Type</th><th style={thStyle}>Categories</th><th style={{ ...thStyle, width: 80 }}></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>{search ? "No brands match" : "No brands added yet"}</td></tr>
              : filtered.map((b, i) => (
                <tr key={b.id}>
                  <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 12, width: 48 }}>{i + 1}</td>
                  <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", flexShrink: 0 }}><Layers size={13} /></div><span style={{ fontWeight: 600 }}>{b.name}</span></div></td>
                  <td style={tdStyle}>{typeBadge(b.type)}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)" }}>
                    {b.categoryIds.length === 0 ? <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>All</span> : b.categoryIds.length + " linked"}
                  </td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: 4 }}><button onClick={() => setModal(b)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Edit2 size={14} /></button><button onClick={() => setDeleteTarget(b)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{filtered.length} of {brands.length} brands</div>
      </div>
      {modal !== null && <BrandModal brand={modal === "new" ? null : modal} onSave={b => { setBrands(prev => prev.find(x => x.id === b.id) ? prev.map(x => x.id === b.id ? b : x) : [...prev, b]); setModal(null); }} onClose={() => setModal(null)} />}
      {deleteTarget && <DeleteConfirm name={deleteTarget.name} onConfirm={() => { setBrands(prev => prev.filter(b => b.id !== deleteTarget.id)); setDeleteTarget(null); }} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}

// ─── Suppliers Manager ────────────────────────────────────────────────────────

function SuppliersManager() {
  const { suppliers, setSuppliers, brands } = useInventory();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Supplier | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, email…" style={{ ...inputStyle, paddingLeft: 34, fontSize: 12 }} />
        </div>
        <button onClick={() => setModal("new")} style={btnAccent}><Plus size={13} /> Add Supplier</button>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Supplier Name</th><th style={thStyle}>Phone</th><th style={thStyle}>Email</th><th style={thStyle}>Brands</th><th style={{ ...thStyle, width: 80 }}></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>{search ? "No suppliers match" : "No suppliers added yet"}</td></tr>
              : filtered.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 12, width: 48 }}>{i + 1}</td>
                  <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 30, height: 30, borderRadius: 8, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8", flexShrink: 0 }}><Truck size={13} /></div><span style={{ fontWeight: 600 }}>{s.name}</span></div></td>
                  <td style={tdStyle}>{s.phone ? <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)", fontSize: 12.5 }}><Phone size={12} />{s.phone}</div> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}</td>
                  <td style={tdStyle}>{s.email ? <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)", fontSize: 12.5 }}><Mail size={12} />{s.email}</div> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-secondary)" }}>
                    {s.brandIds.length === 0 ? <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>All</span> : brands.filter(b => s.brandIds.includes(b.id)).map(b => b.name).join(", ")}
                  </td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: 4 }}><button onClick={() => setModal(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Edit2 size={14} /></button><button onClick={() => setDeleteTarget(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{filtered.length} of {suppliers.length} suppliers</div>
      </div>
      {modal !== null && <SupplierModal supplier={modal === "new" ? null : modal} onSave={s => { setSuppliers(prev => prev.find(x => x.id === s.id) ? prev.map(x => x.id === s.id ? s : x) : [...prev, s]); setModal(null); }} onClose={() => setModal(null)} />}
      {deleteTarget && <DeleteConfirm name={deleteTarget.name} onConfirm={() => { setSuppliers(prev => prev.filter(s => s.id !== deleteTarget.id)); setDeleteTarget(null); }} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}

// ─── Repair Dealer Modal ──────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

/** "2021-07-05" → "05 Jul 2021" (falls back to the raw value if unparseable). */
function fmtJoined(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function DealerModal({ dealer, onSave, onClose }: { dealer: RepairDealer | null; onSave: (d: RepairDealer) => void; onClose: () => void }) {
  const blank: RepairDealer = { id: 0, name: "", address: "", contact: "", joinedAt: today(), remarks: "" };
  const [form, setForm] = useState<RepairDealer>(dealer ?? blank);
  const [errors, setErrors] = useState<Partial<Record<keyof RepairDealer, string>>>({});

  const set = (k: keyof RepairDealer, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  function handleSave() {
    const e: typeof errors = {};
    if (!form.name.trim())    e.name    = "Dealer name is required";
    if (!form.contact.trim()) e.contact = "Contact number is required";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      ...form,
      id: form.id || Date.now(),
      name: form.name.trim(),
      address: form.address.trim(),
      contact: form.contact.trim(),
      joinedAt: form.joinedAt || today(),
      remarks: form.remarks?.trim() || "",
    });
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{dealer ? "Edit Repair Dealer" : "Add Repair Dealer"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Shown in the dealer dropdown when logging a new repair</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Dealer Name *</label>
            <input autoFocus type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Tech Hub Colombo" style={{ ...inputStyle, borderColor: errors.name ? "#dc2626" : "var(--border)" }} />
            {errors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.name}</div>}
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <textarea value={form.address} onChange={e => set("address", e.target.value)} placeholder="e.g. 123 Galle Road, Colombo 03" style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} />
          </div>
          <div>
            <label style={labelStyle}>Contact Number *</label>
            <input type="text" value={form.contact} onChange={e => set("contact", e.target.value)} placeholder="+94 11 234 5678" style={{ ...inputStyle, borderColor: errors.contact ? "#dc2626" : "var(--border)" }} />
            {errors.contact && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.contact}</div>}
          </div>
          <div>
            <label style={labelStyle}>Joining Date</label>
            <input type="date" value={form.joinedAt} max={today()} onChange={e => set("joinedAt", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea value={form.remarks ?? ""} onChange={e => set("remarks", e.target.value)} placeholder="e.g. Wholesale partner — 15% discount" style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} />
          </div>
        </div>

        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ ...btnAccent, padding: "9px 20px" }}>{dealer ? "Save Changes" : "Add Dealer"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Repair Dealers Manager ───────────────────────────────────────────────────

function DealersManager() {
  const { dealers, setDealers } = useRepair();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<RepairDealer | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<RepairDealer | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = dealers.filter(d =>
    !q || d.name.toLowerCase().includes(q) || d.address.toLowerCase().includes(q) || d.contact.toLowerCase().includes(q)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 380 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, address, contact…" style={{ ...inputStyle, paddingLeft: 34, fontSize: 12 }} />
        </div>
        <button onClick={() => setModal("new")} style={btnAccent}><Plus size={13} /> Add Dealer</button>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Dealer Name</th><th style={thStyle}>Address</th><th style={thStyle}>Contact</th><th style={thStyle}>Joined</th><th style={{ ...thStyle, width: 80 }}></th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: 36, color: "var(--text-muted)" }}>{search ? "No dealers match" : "No repair dealers added yet"}</td></tr>
                : filtered.map((d, i) => (
                  <tr key={d.id}>
                    <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 12, width: 48 }}>{i + 1}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}><Store size={13} /></div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>{d.name}</span>
                            {d.inHouse && <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>In-house</span>}
                          </div>
                          {d.remarks && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{d.remarks}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12.5, color: "var(--text-secondary)", maxWidth: 240 }}>
                      {d.address ? <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}><MapPin size={12} style={{ marginTop: 2, flexShrink: 0 }} />{d.address}</div> : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={tdStyle}>{d.contact ? <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)", fontSize: 12.5, whiteSpace: "nowrap" }}><Phone size={12} />{d.contact}</div> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}</td>
                    <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)", fontSize: 12.5, whiteSpace: "nowrap" }}><CalendarDays size={12} />{fmtJoined(d.joinedAt)}</div></td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setModal(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Edit2 size={14} /></button>
                        {/* The in-house entry drives receipt formatting shop-wide — editable, not removable. */}
                        {!d.inHouse && <button onClick={() => setDeleteTarget(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{filtered.length} of {dealers.length} dealers</div>
      </div>

      {modal !== null && <DealerModal dealer={modal === "new" ? null : modal} onSave={d => {
          const isEdit = dealers.some(x => x.id === d.id);
          setDealers(prev => prev.find(x => x.id === d.id) ? prev.map(x => x.id === d.id ? d : x) : [...prev, d]);
          toast.dialog("success", isEdit ? "Dealer updated" : "Dealer added", d.name);
          setModal(null);
        }} onClose={() => setModal(null)} />}
      {deleteTarget && <DeleteConfirm name={deleteTarget.name} onConfirm={() => {
          setDealers(prev => prev.filter(d => d.id !== deleteTarget.id));
          toast.dialog("success", "Dealer deleted", `${deleteTarget.name} has been removed from the registry.`);
          setDeleteTarget(null);
        }} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}

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
    onSave({ ...form, id: form.id || `part-${Date.now()}`, compatibleWith });
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
  const { parts, setParts } = useParts();
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
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <thead><tr>
            <th style={thStyle}>Part</th><th style={thStyle}>SKU</th><th style={thStyle}>Category</th>
            <th style={thStyle}>Compatible With</th><th style={thStyle}>Stock</th><th style={thStyle}>Cost</th>
            <th style={thStyle}>Location</th><th style={{ ...thStyle, width: 104 }}></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
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
          onSave={p => {
            setParts(prev => prev.find(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [...prev, p]);
            toast.dialog("success", modal === "new" ? "Part added" : "Part updated", `${p.name} (${p.sku})`);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={() => {
            setParts(prev => prev.filter(x => x.id !== deleteTarget.id));
            toast.dialog("success", "Part removed", `${deleteTarget.name} has been removed from the catalog.`);
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

// ─── Part Requests Manager ────────────────────────────────────────────────────

const REQ_STATUS_CFG: Record<PartRequestStatus, { color: string; bg: string; border: string }> = {
  Pending:  { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
  Approved: { color: "#16a34a", bg: "rgba(22,163,74,0.1)",   border: "rgba(22,163,74,0.25)"   },
  Issued:   { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)"  },
  Rejected: { color: "#dc2626", bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.25)"   },
};

function fmtRequestedAt(d: Date) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Where a technician's part request is approved or rejected. Auto-approved
 * requests (technician has the "use parts without approval" permission —
 * Admin Control → Repair Parts... see TechnicianPermissions) never land here
 * as Pending; they show up already Approved, for visibility only.
 */
function PartRequestsManager() {
  const { partRequests, parts, resolveRequest } = useParts();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<PartRequestStatus | "All">("Pending");

  const sorted = [...partRequests].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  const filtered = statusFilter === "All" ? sorted : sorted.filter(r => r.status === statusFilter);
  const pendingCount = partRequests.filter(r => r.status === "Pending").length;

  function approve(r: typeof partRequests[number]) {
    resolveRequest(r.id, "Approved");
    toast.dialog("success", "Request approved", `${r.quantity}× ${r.partName} for ${r.jobId} — stock updated.`);
  }
  function reject(r: typeof partRequests[number]) {
    resolveRequest(r.id, "Rejected");
    toast.dialog("success", "Request rejected", `${r.partName} for ${r.jobId} was rejected — no stock deducted.`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content", flexWrap: "wrap" }}>
        {(["Pending", "Approved", "Issued", "Rejected", "All"] as (PartRequestStatus | "All")[]).map(s => {
          const active = statusFilter === s;
          const count = s === "All" ? partRequests.length : partRequests.filter(r => r.status === s).length;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, fontSize: 12.5, background: active ? "var(--bg-secondary)" : "transparent", border: active ? "1px solid var(--border-active)" : "1px solid transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {s}
              {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: active ? "var(--border)" : "var(--bg-surface)", color: active ? "var(--text-primary)" : "var(--text-muted)" }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {pendingCount === 0 && statusFilter === "Pending" ? (
        <div style={{ padding: "36px 18px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center" }}>
          <ClipboardCheck size={26} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No requests waiting on approval</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "36px 18px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No {statusFilter.toLowerCase()} requests</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(r => {
            const cfg = REQ_STATUS_CFG[r.status];
            const part = parts.find(p => p.sku === r.partSku);
            const shortStock = r.status === "Pending" && part && part.stock < r.quantity;
            return (
              <div key={r.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cfg.color}12`, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                  {r.status === "Pending" && <Clock size={16} />}
                  {r.status === "Approved" && <CheckCircle2 size={16} />}
                  {r.status === "Issued" && <Package size={16} />}
                  {r.status === "Rejected" && <XCircle size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{r.quantity}× {r.partName}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>{r.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
                    <span>Job: <strong style={{ color: "var(--text-secondary)" }}>{r.jobId}</strong></span>
                    <span>Device: <strong style={{ color: "var(--text-secondary)" }}>{r.jobDevice}</strong></span>
                    <span>Technician: <strong style={{ color: "var(--text-secondary)" }}>{r.technicianName}</strong></span>
                    <span>SKU: <strong style={{ color: "var(--text-secondary)" }}>{r.partSku}</strong></span>
                  </div>
                  {r.note && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Note: {r.note}</p>}
                  {shortStock && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: "#b45309" }}>
                      <AlertTriangle size={12} /> Only {part!.stock} in stock — approving will still floor stock at 0
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    Requested {fmtRequestedAt(r.requestedAt)}
                    {r.resolvedAt && ` · Resolved ${fmtRequestedAt(r.resolvedAt)}`}
                  </p>
                </div>
                {r.status === "Pending" && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => reject(r)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid rgba(220,38,38,0.35)", background: "rgba(220,38,38,0.08)", color: "#dc2626", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <XCircle size={13} /> Reject
                    </button>
                    <button onClick={() => approve(r)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.1)", color: "#16a34a", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      <CheckCircle2 size={13} /> Approve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Barcode Manager ──────────────────────────────────────────────────────────

const FORMAT_OPTIONS: { value: BarcodeSettings["format"]; label: string; desc: string }[] = [
  { value: "CODE128", label: "Code 128", desc: "Alphanumeric · compact · most common" },
  { value: "CODE39",  label: "Code 39",  desc: "Uppercase letters + digits" },
  { value: "EAN13",   label: "EAN-13",   desc: "13-digit numeric retail standard" },
];

// The two label rolls actually in use — picking a preset avoids retyping
// (and mistyping) dimensions each time the roll gets swapped. Whichever one
// is picked here must also be selected as the matching paper size/stock in
// the printer driver — the app can't switch that half automatically.
const LABEL_PRESETS: { width: number; height: number; label: string }[] = [
  { width: 50, height: 25, label: "50 × 25mm" },
  { width: 38, height: 25, label: "38 × 25mm" },
];

function BarcodeManager() {
  const { barcodeSettings: s, setBarcodeSettings } = useInventory();
  const set = <K extends keyof BarcodeSettings>(k: K, v: BarcodeSettings[K]) => setBarcodeSettings(prev => ({ ...prev, [k]: v }));
  const sampleCode = s.format === "EAN13" ? "123456789012" : `${s.prefix || "MM"}-TG-001`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Settings size={15} color="var(--accent)" /><span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Barcode Settings</span>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>Format</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FORMAT_OPTIONS.map(f => (
                <button key={f.value} onClick={() => set("format", f.value)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "left", border: s.format === f.value ? "1px solid var(--accent-glow)" : "1px solid var(--border)", background: s.format === f.value ? "var(--accent-dim)" : "var(--bg-surface)" }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: s.format === f.value ? "var(--accent)" : "var(--text-primary)" }}>{f.label}</div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{f.desc}</div></div>
                  {s.format === f.value && <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={11} color="#fff" /></div>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Product Code Prefix</label>
            <input type="text" value={s.prefix} onChange={e => set("prefix", e.target.value.toUpperCase())} placeholder="e.g. MM" style={inputStyle} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Codes generated in inventory will start with this prefix</div>
          </div>
          <div>
            <label style={labelStyle}>Label Size (mm)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {LABEL_PRESETS.map(p => {
                const active = s.labelWidthMm === p.width && s.labelHeightMm === p.height;
                return (
                  <button
                    key={p.label}
                    onClick={() => setBarcodeSettings(prev => ({ ...prev, labelWidthMm: p.width, labelHeightMm: p.height }))}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: 12, fontWeight: 700,
                      border: active ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
                      background: active ? "var(--accent-dim)" : "var(--bg-surface)",
                      color: active ? "var(--accent)" : "var(--text-primary)",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input type="number" min={10} max={150} value={s.labelWidthMm} onChange={e => set("labelWidthMm", Number(e.target.value) || s.labelWidthMm)} placeholder="Width" style={inputStyle} />
              <input type="number" min={10} max={150} value={s.labelHeightMm} onChange={e => set("labelHeightMm", Number(e.target.value) || s.labelHeightMm)} placeholder="Height" style={inputStyle} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Must match the label stock loaded in the printer <strong>and</strong> the paper size/stock selected in the print dialog — switching this alone doesn&apos;t change what Windows sends to the printer.
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={labelStyle}>Label Side Margin</label>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.labelMarginMm}mm</span>
            </div>
            <input type="range" min={0} max={8} step={0.5} value={s.labelMarginMm} onChange={e => set("labelMarginMm", Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Blank space kept on the left and right of the barcode so it doesn&apos;t sit flush against the label edge</div>
          </div>
          {([["Bar Width", "width", 1, 4], ["Bar Height", "height", 30, 120], ["Font Size", "fontSize", 8, 20]] as [string, "width" | "height" | "fontSize", number, number][]).map(([lbl, key, min, max]) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={labelStyle}>{lbl}</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s[key]}{key === "width" ? "×" : "px"}</span>
              </div>
              <input type="range" min={min} max={max} value={s[key]} onChange={e => set(key, Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }} />
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Show Text Below</div><div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Human-readable code under bars</div></div>
            <button onClick={() => set("showText", !s.showText)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: s.showText ? "var(--accent)" : "var(--bg-surface)", boxShadow: "inset 0 0 0 1px var(--border)", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, left: s.showText ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
        </div>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={15} color="var(--accent)" /><span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Live Preview</span>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid var(--border)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Barcode value={sampleCode} format={s.format} width={s.width} height={s.height} fontSize={s.fontSize} displayValue={s.showText} margin={6} />
          </div>
          <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "14px 16px" }}>
            {([["Format", FORMAT_OPTIONS.find(f => f.value === s.format)?.label ?? s.format], ["Sample Code", sampleCode], ["Bar Width", `${s.width}×`], ["Height", `${s.height}px`], ["Font", `${s.fontSize}px`], ["Show Text", s.showText ? "Yes" : "No"], ["Label Size", `${s.labelWidthMm} × ${s.labelHeightMm} mm`], ["Side Margin", `${s.labelMarginMm}mm`]] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <span style={{ color: "var(--text-muted)" }}>{k}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings (Admin Credentials) ────────────────────────────────────────────

function CredentialsManager() {
  const { adminCredentials, setAdminCredentials } = useInventory();
  const [currentPw, setCurrentPw]   = useState("");
  const [newUser, setNewUser]       = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [authError, setAuthError]   = useState("");
  const [success, setSuccess]       = useState("");

  function handleChange() {
    setAuthError(""); setSuccess("");
    if (currentPw !== adminCredentials.password) { setAuthError("Current password is incorrect"); return; }
    const u = newUser.trim() || adminCredentials.username;
    if (newPw && newPw.length < 6) { setAuthError("New password must be at least 6 characters"); return; }
    if (newPw && newPw !== confirmPw) { setAuthError("Passwords do not match"); return; }
    setAdminCredentials({ username: u, password: newPw || adminCredentials.password });
    setCurrentPw(""); setNewUser(""); setNewPw(""); setConfirmPw("");
    setSuccess("Credentials updated successfully");
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <KeyRound size={15} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Admin Credentials</span>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Current info */}
          <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Current Username</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{adminCredentials.username}</span>
          </div>
          <div>
            <label style={labelStyle}>New Username (leave blank to keep current)</label>
            <input type="text" value={newUser} onChange={e => setNewUser(e.target.value)} placeholder={adminCredentials.username} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Current Password *</label>
            <input type="password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setAuthError(""); setSuccess(""); }} style={inputStyle} placeholder="Enter current password to confirm changes" />
          </div>
          <div>
            <label style={labelStyle}>New Password (leave blank to keep current)</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" style={inputStyle} />
          </div>
          {authError && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#dc2626", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{authError}</div>}
          {success && <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#16a34a", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{success}</div>}
          <button onClick={handleChange} style={{ ...btnAccent, alignSelf: "flex-end" }}>Update Credentials</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type AdminTab = "Categories" | "Brands" | "Suppliers" | "Dealers" | "Agents" | "Parts" | "PartRequests" | "Barcode" | "Settings";

const tabs: { id: AdminTab; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string }[] = [
  { id: "Categories",   icon: Tag,            label: "Item Categories" },
  { id: "Brands",       icon: Layers,         label: "Brands"          },
  { id: "Suppliers",    icon: Truck,          label: "Suppliers"       },
  { id: "Dealers",      icon: Store,          label: "Repair Dealers"  },
  { id: "Agents",       icon: Building2,      label: "Repair Agents"   },
  { id: "Parts",        icon: Package,        label: "Repair Parts"    },
  { id: "PartRequests", icon: ClipboardCheck, label: "Part Requests"   },
  { id: "Barcode",      icon: BarcodeIcon,    label: "Barcode"         },
  { id: "Settings",     icon: KeyRound,       label: "Settings"        },
];

export default function AdminControl() {
  const [tab, setTab] = useState<AdminTab>("Categories");
  const isMobile = useIsMobile();
  const { partRequests } = useParts();
  const pendingRequestCount = partRequests.filter(r => r.status === "Pending").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>
      <div className="fade-up" style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: "space-between", gap: isMobile ? 12 : 16,
      }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Admin Control</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>Manage reference data used across the inventory system.</p>
        </div>
        <div className={isMobile ? "tabs-scroll" : undefined}>
        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 6, width: "fit-content" }}>
          {tabs.map(({ id, icon: Icon, label }) => {
            const isActive = tab === id;
            const badge = id === "PartRequests" && pendingRequestCount > 0 ? pendingRequestCount : undefined;
            return (
              <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8, fontSize: 13, border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent", background: isActive ? "var(--accent-dim)" : "transparent", color: isActive ? "var(--accent)" : "var(--text-secondary)", fontWeight: isActive ? 600 : 400, cursor: "pointer", transition: "all 0.18s", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; } }}
              >
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />{label}
                {badge !== undefined && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: isActive ? "var(--accent)" : "#fbbf24", color: isActive ? "var(--accent-fg)" : "#000" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>
      <div className="fade-up fade-up-2" style={{ borderTop: "1px solid var(--border)", marginTop: -8 }} />
      <div className="fade-up fade-up-3" style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
        {tab === "Categories"   && <CategoriesManager />}
        {tab === "Brands"       && <BrandsManager />}
        {tab === "Suppliers"    && <SuppliersManager />}
        {tab === "Dealers"      && <DealersManager />}
        {tab === "Agents"       && <AgentsManager />}
        {tab === "Parts"        && <PartsManager />}
        {tab === "PartRequests" && <PartRequestsManager />}
        {tab === "Barcode"      && <BarcodeManager />}
        {tab === "Settings"     && <CredentialsManager />}
      </div>
    </div>
  );
}
