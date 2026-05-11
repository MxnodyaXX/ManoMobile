"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
import {
  Tag, Layers, Truck, Barcode as BarcodeIcon, Settings,
  Plus, Edit2, Trash2, X, Search, Phone, Mail, Eye, KeyRound, Check,
} from "lucide-react";
import {
  useInventory,
  type Brand, type Category, type Supplier, type BarcodeSettings,
} from "@/contexts/InventoryContext";

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

// ─── Barcode Manager ──────────────────────────────────────────────────────────

const FORMAT_OPTIONS: { value: BarcodeSettings["format"]; label: string; desc: string }[] = [
  { value: "CODE128", label: "Code 128", desc: "Alphanumeric · compact · most common" },
  { value: "CODE39",  label: "Code 39",  desc: "Uppercase letters + digits" },
  { value: "EAN13",   label: "EAN-13",   desc: "13-digit numeric retail standard" },
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
            {([["Format", FORMAT_OPTIONS.find(f => f.value === s.format)?.label ?? s.format], ["Sample Code", sampleCode], ["Bar Width", `${s.width}×`], ["Height", `${s.height}px`], ["Font", `${s.fontSize}px`], ["Show Text", s.showText ? "Yes" : "No"]] as [string, string][]).map(([k, v]) => (
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

type AdminTab = "Categories" | "Brands" | "Suppliers" | "Barcode" | "Settings";

const tabs: { id: AdminTab; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string }[] = [
  { id: "Categories", icon: Tag,         label: "Item Categories" },
  { id: "Brands",     icon: Layers,      label: "Brands"          },
  { id: "Suppliers",  icon: Truck,       label: "Suppliers"       },
  { id: "Barcode",    icon: BarcodeIcon, label: "Barcode"         },
  { id: "Settings",   icon: KeyRound,    label: "Settings"        },
];

export default function AdminControl() {
  const [tab, setTab] = useState<AdminTab>("Categories");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>
      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Admin Control</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>Manage reference data used across the inventory system.</p>
        </div>
        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 6 }}>
          {tabs.map(({ id, icon: Icon, label }) => {
            const isActive = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8, fontSize: 13, border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent", background: isActive ? "var(--accent-dim)" : "transparent", color: isActive ? "var(--accent)" : "var(--text-secondary)", fontWeight: isActive ? 600 : 400, cursor: "pointer", transition: "all 0.18s", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; } }}
              >
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />{label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="fade-up fade-up-2" style={{ borderTop: "1px solid var(--border)", marginTop: -8 }} />
      <div className="fade-up fade-up-3" style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
        {tab === "Categories" && <CategoriesManager />}
        {tab === "Brands"     && <BrandsManager />}
        {tab === "Suppliers"  && <SuppliersManager />}
        {tab === "Barcode"    && <BarcodeManager />}
        {tab === "Settings"   && <CredentialsManager />}
      </div>
    </div>
  );
}
