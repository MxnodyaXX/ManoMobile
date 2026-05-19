"use client";

import { useState, useMemo, useRef, useEffect, useCallback, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import {
  Smartphone, Package, AlertTriangle, XCircle,
  Plus, Search, Edit2, Trash2, X, Check,
  BarChart3, ArrowUpCircle, ArrowDownCircle, Sliders,
  ChevronDown, ShieldAlert,
} from "lucide-react";
import { useInventory } from "@/cashier/contexts/InventoryContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeviceItem {
  id: number;
  imei: string;
  name: string;
  brand: string;
  storage: string;
  color: string;
  buyingPrice: number;
  minSellingPrice: number;
  suggestedPrice: number;
  supplier: string;
  addedDate: string;
  status: "available" | "sold" | "reserved";
  notes: string;
}

interface AccessoryProduct {
  id: number;
  code: string;
  name: string;
  brand: string;
  category: string;
  model: string;
  buyingPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  supplier: string;
  addedDate: string;
}

interface ApprovalRequest {
  entityType: "category" | "brand" | "supplier";
  newName: string;
  presetCategoryName?: string;
  presetBrandName?: string;
  suggestedBrandType?: "device" | "accessory";
}

type InventoryTab = "Overview" | "Mobile Devices" | "Accessories";

// ─── Initial Data ─────────────────────────────────────────────────────────────

const INITIAL_DEVICES: DeviceItem[] = [
  { id: 1, imei: "358900123456789", name: "iPhone 15 Pro",      brand: "Apple",   storage: "256GB", color: "Natural Titanium", buyingPrice: 185000, minSellingPrice: 195000, suggestedPrice: 205000, supplier: "TechImports PVT", addedDate: "2025-11-10", status: "available", notes: "" },
  { id: 2, imei: "490100234567890", name: "Samsung Galaxy S25", brand: "Samsung", storage: "128GB", color: "Phantom Black",    buyingPrice: 145000, minSellingPrice: 155000, suggestedPrice: 165000, supplier: "MobileWorld",     addedDate: "2025-11-12", status: "available", notes: "" },
  { id: 3, imei: "867100345678901", name: "Xiaomi 14",          brand: "Xiaomi",  storage: "256GB", color: "White",           buyingPrice:  98000, minSellingPrice: 108000, suggestedPrice: 118000, supplier: "XiaomiSL",        addedDate: "2025-11-15", status: "sold",      notes: "" },
  { id: 4, imei: "352800456789012", name: "OnePlus 12",         brand: "OnePlus", storage: "256GB", color: "Flowy Emerald",   buyingPrice: 130000, minSellingPrice: 140000, suggestedPrice: 150000, supplier: "TechImports PVT", addedDate: "2025-11-18", status: "available", notes: "" },
  { id: 5, imei: "451200567890123", name: "iPhone 16",          brand: "Apple",   storage: "128GB", color: "Pink",            buyingPrice: 195000, minSellingPrice: 210000, suggestedPrice: 220000, supplier: "TechImports PVT", addedDate: "2025-12-01", status: "reserved",  notes: "Reserved for customer Kamal" },
  { id: 6, imei: "356700678901234", name: "Samsung Galaxy A55", brand: "Samsung", storage: "128GB", color: "Awesome Lilac",   buyingPrice:  75000, minSellingPrice:  83000, suggestedPrice:  88000, supplier: "MobileWorld",     addedDate: "2025-12-05", status: "available", notes: "" },
];

const INITIAL_ACCESSORIES: AccessoryProduct[] = [
  { id: 1, code: "TG-001", name: "Tempered Glass",       brand: "Baseus",  category: "Screen Protector", model: "iPhone 15 Pro", buyingPrice:  250, sellingPrice:  600, stock: 24, minStock: 10, supplier: "AccessoryHub",    addedDate: "2025-11-01" },
  { id: 2, code: "PC-002", name: "Phone Case",           brand: "Spigen",  category: "Case",             model: "Samsung S25",   buyingPrice:  800, sellingPrice: 1800, stock: 15, minStock:  8, supplier: "AccessoryHub",    addedDate: "2025-11-01" },
  { id: 3, code: "CB-003", name: "USB-C Cable",          brand: "Anker",   category: "Cable",            model: "Universal",     buyingPrice:  350, sellingPrice:  750, stock:  4, minStock: 15, supplier: "CableWorld",      addedDate: "2025-11-05" },
  { id: 4, code: "PB-004", name: "Power Bank 20000mAh",  brand: "Romoss",  category: "Power Bank",       model: "Universal",     buyingPrice: 2800, sellingPrice: 5500, stock:  7, minStock:  5, supplier: "TechImports PVT", addedDate: "2025-11-08" },
  { id: 5, code: "EW-005", name: "TWS Earbuds",          brand: "JBL",     category: "Audio",            model: "Universal",     buyingPrice: 2500, sellingPrice: 5000, stock:  3, minStock:  5, supplier: "AudioZone",       addedDate: "2025-11-10" },
  { id: 6, code: "WC-006", name: "Wireless Charger 15W", brand: "Baseus",  category: "Charger",          model: "Universal",     buyingPrice: 1200, sellingPrice: 2800, stock:  0, minStock:  5, supplier: "AccessoryHub",    addedDate: "2025-11-12" },
  { id: 7, code: "TG-007", name: "Tempered Glass",       brand: "Nillkin", category: "Screen Protector", model: "iPhone 16",     buyingPrice:  300, sellingPrice:  700, stock: 18, minStock: 10, supplier: "AccessoryHub",    addedDate: "2025-12-01" },
  { id: 8, code: "CH-008", name: "Fast Charger 65W",     brand: "Anker",   category: "Charger",          model: "Universal",     buyingPrice: 1800, sellingPrice: 3800, stock:  9, minStock:  6, supplier: "TechImports PVT", addedDate: "2025-12-03" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Rs = (n: number) => `Rs.${n.toLocaleString()}`;
const marginPct = (buy: number, sell: number) => (buy > 0 ? Math.round(((sell - buy) / buy) * 100) : 0);

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
  padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
  whiteSpace: "nowrap", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
};

const tdBase: React.CSSProperties = {
  padding: "11px 14px", fontSize: 12.5, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)", fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const selectStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)",
  fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
};

function getCategoryAbbr(cat: string): string {
  return cat.split(/[\s/\-–]+/).filter(w => w.length > 0).map(w => w[0].toUpperCase()).join("");
}

function generateCode(cat: string, existing: AccessoryProduct[]): string {
  const abbr = getCategoryAbbr(cat);
  if (!abbr) return "";
  const re = new RegExp(`^${abbr}-(\\d+)$`);
  let max = 0;
  for (const p of existing) {
    const m = p.code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${abbr}-${String(max + 1).padStart(3, "0")}`;
}

// ─── ComboField ───────────────────────────────────────────────────────────────

interface ComboFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  entityType: "category" | "brand" | "supplier";
  onNewRequest: (typed: string) => void;
  onPromptChange?: (active: boolean) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

function ComboField({ label, value, onChange, options, entityType, onNewRequest, onPromptChange, error, disabled, placeholder }: ComboFieldProps) {
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelected = useRef(false);
  const promptRef = useRef(onPromptChange);
  promptRef.current = onPromptChange;

  const entityLabel = entityType === "category" ? "Category" : entityType === "brand" ? "Brand" : "Supplier";

  const setPrompt = useCallback((v: boolean) => {
    setShowPrompt(v);
    promptRef.current?.(v);
  }, []);

  const filtered = useMemo(() => {
    if (!value.trim()) return options;
    const q = value.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [value, options]);

  useEffect(() => {
    if (!value) { setPrompt(false); setOpen(false); }
    else if (options.includes(value)) setPrompt(false);
  }, [value, options, setPrompt]);

  // When the field is blocked by another field's mismatch (disabled=true externally)
  // but this field owns the prompt, keep it interactive by ignoring the disabled prop.
  const isActuallyDisabled = disabled && !showPrompt;

  function openDrop() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(true);
    setPrompt(false);
  }

  function handleBlur() {
    setTimeout(() => {
      if (justSelected.current) { justSelected.current = false; return; }
      setOpen(false);
      const cur = inputRef.current?.value ?? "";
      if (cur.trim() && !options.includes(cur)) setPrompt(true);
    }, 150);
  }

  function selectOption(opt: string) {
    justSelected.current = true;
    onChange(opt);
    setOpen(false);
    setPrompt(false);
  }

  const disabledPlaceholder = entityType === "brand" ? "Select category first" : "Select brand first";

  return (
    <div style={{ position: "relative" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setPrompt(false); }}
          onFocus={openDrop}
          onBlur={handleBlur}
          disabled={isActuallyDisabled}
          placeholder={isActuallyDisabled ? disabledPlaceholder : (placeholder ?? `Type or select ${entityLabel}…`)}
          style={{
            ...inputStyle, paddingRight: 32,
            borderColor: error ? "#dc2626" : showPrompt ? "#f59e0b" : "var(--border)",
            opacity: isActuallyDisabled ? 0.5 : 1,
            cursor: isActuallyDisabled ? "not-allowed" : "text",
          }}
        />
        <ChevronDown size={14} style={{
          position: "absolute", right: 10, top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: "var(--text-muted)", pointerEvents: "none", transition: "transform 0.15s",
        }} />
      </div>

      {open && filtered.length > 0 && createPortal(
        <div style={{
          position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 1200,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 8, maxHeight: 160, overflowY: "auto",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {filtered.map(opt => (
            <div
              key={opt}
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectOption(opt)}
              style={{
                padding: "9px 14px", fontSize: 13, cursor: "pointer",
                color: opt === value ? "var(--accent)" : "var(--text-primary)",
                background: opt === value ? "var(--accent-dim)" : "transparent",
              }}
              onMouseEnter={e => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)"; }}
              onMouseLeave={e => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              {opt}
            </div>
          ))}
        </div>,
        document.body
      )}

      {showPrompt && (
        <div style={{
          marginTop: 4, padding: "7px 12px", borderRadius: 8,
          background: "#fffbeb", border: "1px solid #fcd34d",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ fontSize: 12, color: "#92400e", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            No {entityLabel} found. Is &quot;{value}&quot; new?
          </span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => { setPrompt(false); onNewRequest(value); }}
              style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#d97706", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => { onChange(""); setPrompt(false); }}
              style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fcd34d", background: "transparent", color: "#92400e", fontSize: 11, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              No
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{error}</div>}
      {!error && !isActuallyDisabled && options.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>No {entityLabel.toLowerCase()}s — type a name to add one</div>
      )}
    </div>
  );
}

// ─── Local Chip Group (used inside AdminApprovalModal) ────────────────────────

function LocalChipGroup({ options, selected, onChange }: {
  options: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const on = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(on ? selected.filter(id => id !== opt.id) : [...selected, opt.id])}
            style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              border: on ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
              background: on ? "var(--accent-dim)" : "transparent",
              color: on ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: on ? 600 : 400,
            }}
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Admin Approval Modal ─────────────────────────────────────────────────────

function AdminApprovalModal({ request, onEntityAdded, onClose }: {
  request: ApprovalRequest;
  onEntityAdded: (entityType: ApprovalRequest["entityType"], name: string) => void;
  onClose: () => void;
}) {
  const { adminCredentials, brands, categories, setBrands, setCategories, setSuppliers } = useInventory();

  const [step, setStep] = useState<"auth" | "add">("auth");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState("");

  // Category form
  const [catName, setCatName] = useState(request.newName);

  // Brand form
  const [brandName, setBrandName] = useState(request.newName);
  const [brandType, setBrandTypeState] = useState<"device" | "accessory" | "both">(request.suggestedBrandType ?? "accessory");
  const [brandCatIds, setBrandCatIds] = useState<number[]>(() => {
    if (request.presetCategoryName) {
      const c = categories.find(x => x.name === request.presetCategoryName);
      return c ? [c.id] : [];
    }
    return [];
  });

  // Supplier form
  const [suppName, setSuppName] = useState(request.newName);
  const [suppPhone, setSuppPhone] = useState("");
  const [suppEmail, setSuppEmail] = useState("");
  const [suppBrandIds, setSuppBrandIds] = useState<number[]>(() => {
    if (request.presetBrandName) {
      const b = brands.find(x => x.name === request.presetBrandName);
      return b ? [b.id] : [];
    }
    return [];
  });

  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const entityLabel = request.entityType === "category" ? "Category" : request.entityType === "brand" ? "Brand" : "Supplier";

  function handleAuth() {
    if (authUser === adminCredentials.username && authPass === adminCredentials.password) {
      setStep("add");
      setAuthError("");
    } else {
      setAuthError("Invalid username or password");
    }
  }

  function handleSave() {
    const errs: Record<string, string> = {};
    if (request.entityType === "category") {
      if (!catName.trim()) { errs.name = "Name is required"; setAddErrors(errs); return; }
      const newCat = { id: Date.now(), name: catName.trim() };
      setCategories(prev => [...prev, newCat]);
      onEntityAdded("category", newCat.name);
    } else if (request.entityType === "brand") {
      if (!brandName.trim()) { errs.name = "Name is required"; setAddErrors(errs); return; }
      const newBrand = { id: Date.now(), name: brandName.trim(), type: brandType, categoryIds: brandType === "device" ? [] : brandCatIds };
      setBrands(prev => [...prev, newBrand]);
      onEntityAdded("brand", newBrand.name);
    } else {
      if (!suppName.trim()) { errs.name = "Name is required"; setAddErrors(errs); return; }
      const newSupp = { id: Date.now(), name: suppName.trim(), phone: suppPhone.trim(), email: suppEmail.trim(), brandIds: suppBrandIds };
      setSuppliers(prev => [...prev, newSupp]);
      onEntityAdded("supplier", newSupp.name);
    }
    onClose();
  }

  const iStyle: React.CSSProperties = { ...inputStyle, borderColor: "var(--border)" };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 460, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={16} color="#d97706" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {step === "auth" ? "Admin Approval Required" : `Add New ${entityLabel}`}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                {step === "auth" ? "Verify credentials to continue" : "Fill in the details below"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Info strip */}
          <div style={{ padding: "10px 14px", borderRadius: 9, background: "var(--bg-surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={13} color="var(--accent)" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Adding new <strong style={{ color: "var(--text-primary)" }}>{entityLabel}</strong>: &quot;{request.newName}&quot;
            </span>
          </div>

          {/* ── Step 1: Auth ── */}
          {step === "auth" && (
            <>
              <div>
                <label style={labelStyle}>Admin Username</label>
                <input type="text" value={authUser} onChange={e => setAuthUser(e.target.value)} placeholder="Enter admin username" style={iStyle} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Admin Password</label>
                <input type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="Enter admin password"
                  onKeyDown={e => { if (e.key === "Enter") handleAuth(); }}
                  style={{ ...iStyle, borderColor: authError ? "#dc2626" : "var(--border)" }} />
                {authError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{authError}</div>}
              </div>
            </>
          )}

          {/* ── Step 2: Add form ── */}
          {step === "add" && request.entityType === "category" && (
            <div>
              <label style={labelStyle}>Category Name</label>
              <input type="text" value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Memory Card"
                style={{ ...iStyle, borderColor: addErrors.name ? "#dc2626" : "var(--border)" }} autoFocus />
              {addErrors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{addErrors.name}</div>}
            </div>
          )}

          {step === "add" && request.entityType === "brand" && (
            <>
              <div>
                <label style={labelStyle}>Brand Name</label>
                <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g. Belkin"
                  style={{ ...iStyle, borderColor: addErrors.name ? "#dc2626" : "var(--border)" }} autoFocus />
                {addErrors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{addErrors.name}</div>}
              </div>
              <div>
                <label style={labelStyle}>Brand Type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["device", "accessory", "both"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setBrandTypeState(t); if (t === "device") setBrandCatIds([]); }}
                      style={{
                        flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                        fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: brandType === t ? 700 : 400,
                        border: brandType === t ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
                        background: brandType === t ? "var(--accent-dim)" : "transparent",
                        color: brandType === t ? "var(--accent)" : "var(--text-secondary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {(brandType === "accessory" || brandType === "both") && (
                <div>
                  <label style={labelStyle}>Accessory Categories</label>
                  {categories.length === 0
                    ? <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No categories yet</p>
                    : <LocalChipGroup options={categories} selected={brandCatIds} onChange={setBrandCatIds} />
                  }
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>Leave empty = appears in all categories</div>
                </div>
              )}
            </>
          )}

          {step === "add" && request.entityType === "supplier" && (
            <>
              <div>
                <label style={labelStyle}>Supplier Name</label>
                <input type="text" value={suppName} onChange={e => setSuppName(e.target.value)} placeholder="e.g. ElectroHub PVT"
                  style={{ ...iStyle, borderColor: addErrors.name ? "#dc2626" : "var(--border)" }} autoFocus />
                {addErrors.name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{addErrors.name}</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Phone (optional)</label>
                  <input type="text" value={suppPhone} onChange={e => setSuppPhone(e.target.value)} placeholder="+94 77 000 0000" style={iStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email (optional)</label>
                  <input type="text" value={suppEmail} onChange={e => setSuppEmail(e.target.value)} placeholder="orders@supplier.lk" style={iStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Brands Supplied</label>
                {brands.length === 0
                  ? <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No brands yet</p>
                  : <LocalChipGroup options={brands} selected={suppBrandIds} onChange={setSuppBrandIds} />
                }
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>Leave empty = supplies all brands</div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          {step === "auth"
            ? <button onClick={handleAuth} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Verify →</button>
            : <button onClick={handleSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Save {entityLabel}</button>
          }
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ name, onConfirm, onClose }: {
  name: string; onConfirm: () => void; onClose: () => void;
}) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: 380, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={16} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Delete Item</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>This action cannot be undone</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
          Are you sure you want to remove <strong style={{ color: "var(--text-primary)" }}>{name}</strong> from inventory?
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Add / Edit Device Modal ──────────────────────────────────────────────────

function AddEditDeviceModal({ device, onSave, onClose }: {
  device: DeviceItem | null; onSave: (d: DeviceItem) => void; onClose: () => void;
}) {
  const { brands, suppliers } = useInventory();
  const blank: DeviceItem = { id: 0, imei: "", name: "", brand: "", storage: "", color: "", buyingPrice: 0, minSellingPrice: 0, suggestedPrice: 0, supplier: "", addedDate: new Date().toISOString().slice(0, 10), status: "available", notes: "" };
  const [form, setForm] = useState<DeviceItem>(device ?? blank);
  const [errors, setErrors] = useState<Partial<Record<keyof DeviceItem, string>>>({});
  const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
  const [anyMismatch, setAnyMismatch] = useState(false);

  const set = (k: keyof DeviceItem, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const deviceBrands = useMemo(
    () => brands.filter(b => b.type === "device" || b.type === "both").map(b => b.name).sort(),
    [brands]
  );
  const selectedBrandObj = useMemo(() => brands.find(b => b.name === form.brand), [brands, form.brand]);
  const deviceSuppliers = useMemo(
    () => suppliers
      .filter(s => !selectedBrandObj || s.brandIds.length === 0 || s.brandIds.includes(selectedBrandObj.id))
      .map(s => s.name).sort(),
    [suppliers, selectedBrandObj]
  );

  function handleBrandChange(v: string) { setForm(f => ({ ...f, brand: v, supplier: "" })); }

  function handleEntityAdded(entityType: ApprovalRequest["entityType"], name: string) {
    if (entityType === "brand") setForm(f => ({ ...f, brand: name, supplier: "" }));
    else if (entityType === "supplier") setForm(f => ({ ...f, supplier: name }));
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.imei.trim()) e.imei = "IMEI is required";
    else if (!/^\d{15}$/.test(form.imei.trim())) e.imei = "Must be exactly 15 digits";
    if (!form.name.trim()) e.name = "Device name is required";
    if (!form.brand.trim()) e.brand = "Brand is required";
    if (!form.supplier.trim()) e.supplier = "Supplier is required";
    if (form.buyingPrice <= 0) e.buyingPrice = "Must be greater than 0";
    if (form.minSellingPrice < form.buyingPrice) e.minSellingPrice = "Must be ≥ buying price";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const field = (label: string, key: keyof DeviceItem, type = "text", placeholder = "") => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={form[key] as string | number}
        onChange={e => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        disabled={anyMismatch}
        style={{ ...inputStyle, borderColor: errors[key] ? "#dc2626" : "var(--border)", opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : undefined }}
      />
      {errors[key] && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors[key]}</div>}
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{device ? "Edit Device" : "Add New Device"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Fill in the device details below</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {field("IMEI Number", "imei", "text", "15-digit IMEI")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Device Name / Model", "name", "text", "e.g. iPhone 15 Pro")}
            <ComboField
              label="Brand"
              value={form.brand}
              onChange={handleBrandChange}
              options={deviceBrands}
              entityType="brand"
              error={errors.brand}
              disabled={anyMismatch}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "brand", newName: v, suggestedBrandType: "device" })}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Storage", "storage", "text", "e.g. 256GB")}
            {field("Color", "color", "text", "e.g. Natural Titanium")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {field("Buying Price (Rs.)", "buyingPrice", "number")}
            {field("Min Selling Price (Rs.)", "minSellingPrice", "number")}
            {field("Suggested Price (Rs.)", "suggestedPrice", "number")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ComboField
              label="Supplier"
              value={form.supplier}
              onChange={v => set("supplier", v)}
              options={deviceSuppliers}
              entityType="supplier"
              error={errors.supplier}
              disabled={anyMismatch || !form.brand}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "supplier", newName: v, presetBrandName: form.brand })}
            />
            {field("Date Added", "addedDate", "date")}
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} disabled={anyMismatch} style={{ ...inputStyle, opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : undefined }}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes about this device…" rows={2} disabled={anyMismatch} style={{ ...inputStyle, resize: "vertical", opacity: anyMismatch ? 0.45 : 1 }} />
          </div>
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={() => { if (!anyMismatch && validate()) onSave({ ...form, id: form.id || Date.now() }); }} disabled={anyMismatch} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: anyMismatch ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: anyMismatch ? 0.5 : 1 }}>
            {device ? "Save Changes" : "Add Device"}
          </button>
        </div>
      </div>
      {approvalReq && (
        <AdminApprovalModal
          request={approvalReq}
          onEntityAdded={handleEntityAdded}
          onClose={() => setApprovalReq(null)}
        />
      )}
    </div>,
    document.body
  );
}

// ─── Add / Edit Product Modal ─────────────────────────────────────────────────

function AddEditProductModal({ product, existingProducts, onSave, onClose }: {
  product: AccessoryProduct | null; existingProducts: AccessoryProduct[]; onSave: (p: AccessoryProduct) => void; onClose: () => void;
}) {
  const { brands, categories, suppliers } = useInventory();
  const blank: AccessoryProduct = { id: 0, code: "", name: "", brand: "", category: "", model: "", buyingPrice: 0, sellingPrice: 0, stock: 0, minStock: 5, supplier: "", addedDate: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState<AccessoryProduct>(product ?? blank);
  const [errors, setErrors] = useState<Partial<Record<keyof AccessoryProduct, string>>>({});
  const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
  const [anyMismatch, setAnyMismatch] = useState(false);

  const set = (k: keyof AccessoryProduct, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  // Cascade: category → brand → supplier
  const selectedCatObj = useMemo(() => categories.find(c => c.name === form.category), [categories, form.category]);
  const selectedBrandObj = useMemo(() => brands.find(b => b.name === form.brand), [brands, form.brand]);

  const categoryOptions = useMemo(() => categories.map(c => c.name).sort(), [categories]);

  const brandOptions = useMemo(
    () => brands
      .filter(b =>
        (b.type === "accessory" || b.type === "both") &&
        (!selectedCatObj || b.categoryIds.length === 0 || b.categoryIds.includes(selectedCatObj.id))
      )
      .map(b => b.name).sort(),
    [brands, selectedCatObj]
  );

  const supplierOptions = useMemo(
    () => suppliers
      .filter(s => !selectedBrandObj || s.brandIds.length === 0 || s.brandIds.includes(selectedBrandObj.id))
      .map(s => s.name).sort(),
    [suppliers, selectedBrandObj]
  );

  function handleCategoryChange(v: string) {
    const newCode = v ? generateCode(v, existingProducts.filter(p => p.id !== form.id)) : "";
    setForm(f => ({ ...f, category: v, brand: "", supplier: "", code: newCode }));
  }
  function handleBrandChange(v: string)    { setForm(f => ({ ...f, brand: v, supplier: "" })); }

  function handleEntityAdded(entityType: ApprovalRequest["entityType"], name: string) {
    if (entityType === "category") setForm(f => ({ ...f, category: name, brand: "", supplier: "" }));
    else if (entityType === "brand") setForm(f => ({ ...f, brand: name, supplier: "" }));
    else setForm(f => ({ ...f, supplier: name }));
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.code.trim()) e.code = "Code is required";
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.brand.trim()) e.brand = "Brand is required";
    if (!form.category.trim()) e.category = "Category is required";
    if (!form.supplier.trim()) e.supplier = "Supplier is required";
    if (form.buyingPrice <= 0) e.buyingPrice = "Must be greater than 0";
    if (form.sellingPrice <= 0) e.sellingPrice = "Must be greater than 0";
    if (form.stock < 0) e.stock = "Cannot be negative";
    if (form.minStock < 0) e.minStock = "Cannot be negative";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const field = (label: string, key: keyof AccessoryProduct, type = "text", placeholder = "") => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={form[key] as string | number}
        onChange={e => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        disabled={anyMismatch}
        style={{ ...inputStyle, borderColor: errors[key] ? "#dc2626" : "var(--border)", opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : undefined }}
      />
      {errors[key] && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors[key]}</div>}
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{product ? "Edit Product" : "Add New Product"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Fill in the product details below</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Row 1: Item Category + Item Brand (cascade) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ComboField
              label="Item Category"
              value={form.category}
              onChange={handleCategoryChange}
              options={categoryOptions}
              entityType="category"
              error={errors.category}
              disabled={anyMismatch}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "category", newName: v })}
            />
            <ComboField
              label="Item Brand"
              value={form.brand}
              onChange={handleBrandChange}
              options={brandOptions}
              entityType="brand"
              error={errors.brand}
              disabled={anyMismatch || !form.category}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "brand", newName: v, presetCategoryName: form.category, suggestedBrandType: "accessory" })}
            />
          </div>
          {/* Row 2: Item Name */}
          {field("Item Name", "name", "text", "e.g. Tempered Glass")}
          {/* Row 3: Item Supplier + Auto-generated Item Code */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ComboField
              label="Item Supplier"
              value={form.supplier}
              onChange={v => set("supplier", v)}
              options={supplierOptions}
              entityType="supplier"
              error={errors.supplier}
              disabled={anyMismatch || !form.brand}
              onPromptChange={setAnyMismatch}
              onNewRequest={v => setApprovalReq({ entityType: "supplier", newName: v, presetBrandName: form.brand })}
            />
            <div>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                Item Code
                <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>AUTO</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={e => set("code", e.target.value)}
                placeholder={form.category ? `${getCategoryAbbr(form.category)}-001` : "Select category first"}
                disabled={anyMismatch}
                style={{ ...inputStyle, borderColor: errors.code ? "#dc2626" : "var(--border)", opacity: anyMismatch ? 0.45 : 1, cursor: anyMismatch ? "not-allowed" : "text" }}
              />
              {errors.code && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{errors.code}</div>}
              {!errors.code && form.category && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                  Generated from &quot;{form.category}&quot; — editable
                </div>
              )}
            </div>
          </div>
          {/* Row 4: Compatible Model */}
          {field("Compatible Model", "model", "text", "e.g. iPhone 15 / Universal")}
          {/* Row 5: Pricing */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("Buying Price (Rs.)", "buyingPrice", "number")}
            {field("Selling Price (Rs.)", "sellingPrice", "number")}
          </div>
          {/* Row 6: Stock + Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "end" }}>
            {field("Current Stock", "stock", "number")}
            {field("Min Stock (Reorder At)", "minStock", "number")}
            {field("Date Added", "addedDate", "date")}
          </div>
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-card)" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={() => { if (!anyMismatch && validate()) onSave({ ...form, id: form.id || Date.now() }); }} disabled={anyMismatch} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: anyMismatch ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: anyMismatch ? 0.5 : 1 }}>
            {product ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
      {approvalReq && (
        <AdminApprovalModal
          request={approvalReq}
          onEntityAdded={handleEntityAdded}
          onClose={() => setApprovalReq(null)}
        />
      )}
    </div>,
    document.body
  );
}

// ─── Stock Adjust Modal ───────────────────────────────────────────────────────

function StockAdjustModal({ product, onSave, onClose }: {
  product: AccessoryProduct; onSave: (newStock: number) => void; onClose: () => void;
}) {
  const [adjType, setAdjType] = useState<"add" | "remove" | "set">("add");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("Received");
  const [error, setError] = useState("");

  const newStock = useMemo(() => {
    if (adjType === "add") return product.stock + qty;
    if (adjType === "remove") return Math.max(0, product.stock - qty);
    return qty;
  }, [adjType, qty, product.stock]);

  function handleSave() {
    if (qty < 0) { setError("Quantity cannot be negative"); return; }
    setError("");
    onSave(newStock);
  }

  const typeBtn = (t: "add" | "remove" | "set", label: string, icon: React.ReactNode) => (
    <button
      onClick={() => { setAdjType(t); setQty(0); setError(""); }}
      style={{
        flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        border: adjType === t ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
        background: adjType === t ? "var(--accent-dim)" : "transparent",
        color: adjType === t ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      {icon}{label}
    </button>
  );

  const isWarn = newStock < product.minStock && newStock > 0;
  const isOut = newStock === 0;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 420, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Adjust Stock</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{product.name} · {product.code}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Current Stock</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{product.stock} units</span>
          </div>
          <div>
            <label style={labelStyle}>Adjustment Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {typeBtn("add", "Add Stock", <ArrowUpCircle size={14} />)}
              {typeBtn("remove", "Remove Stock", <ArrowDownCircle size={14} />)}
              {typeBtn("set", "Set Exact", <Sliders size={14} />)}
            </div>
          </div>
          <div>
            <label style={labelStyle}>{adjType === "set" ? "New Stock Count" : "Quantity"}</label>
            <input
              type="number" min={0}
              value={qty}
              onChange={e => { setQty(Number(e.target.value)); setError(""); }}
              style={{ ...inputStyle, borderColor: error ? "#dc2626" : "var(--border)" }}
            />
            {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{error}</div>}
          </div>
          <div>
            <label style={labelStyle}>Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} style={{ ...inputStyle }}>
              <option>Received</option>
              <option>Returned by Customer</option>
              <option>Damaged / Written Off</option>
              <option>Sold (Manual)</option>
              <option>Stock Count Correction</option>
              <option>Other</option>
            </select>
          </div>
          <div style={{
            background: isOut ? "#fee2e2" : isWarn ? "#fef3c7" : "var(--accent-dim)",
            border: `1px solid ${isOut ? "#fca5a5" : isWarn ? "#fcd34d" : "var(--accent-glow)"}`,
            borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Stock After Adjustment</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: isOut ? "#dc2626" : isWarn ? "#b45309" : "var(--accent)" }}>
              {newStock} units
            </span>
          </div>
        </div>
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Confirm Adjustment
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ devices, accessories }: { devices: DeviceItem[]; accessories: AccessoryProduct[] }) {
  const availableDevices = devices.filter(d => d.status === "available");
  const soldDevices = devices.filter(d => d.status === "sold");
  const mobileStockValue = availableDevices.reduce((s, d) => s + d.buyingPrice, 0);
  const accessoryStockValue = accessories.reduce((s, p) => s + p.buyingPrice * p.stock, 0);
  const lowStockItems = accessories.filter(p => p.stock > 0 && p.stock < p.minStock);
  const outOfStockItems = accessories.filter(p => p.stock === 0);

  const statusColors = {
    available: { bg: "#dcfce7", color: "#16a34a", label: "Available" },
    sold:      { bg: "var(--bg-surface)", color: "var(--text-muted)", label: "Sold" },
    reserved:  { bg: "#fef3c7", color: "#b45309", label: "Reserved" },
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {([
          { icon: <Smartphone size={18} />, iconBg: "var(--accent-dim)", iconColor: "var(--accent)", title: "Mobile Devices", main: `${availableDevices.length} available`, sub: `${soldDevices.length} sold · Stock ${Rs(mobileStockValue)}` },
          { icon: <Package size={18} />,    iconBg: "#dbeafe",           iconColor: "#1d4ed8",       title: "Accessories",    main: `${accessories.length} SKUs`,           sub: `Total stock value ${Rs(accessoryStockValue)}` },
          { icon: <AlertTriangle size={18} />, iconBg: "#fef3c7",        iconColor: "#b45309",       title: "Low Stock",      main: `${lowStockItems.length} items`,         sub: "Below reorder point" },
          { icon: <XCircle size={18} />,    iconBg: "#fee2e2",           iconColor: "#dc2626",       title: "Out of Stock",   main: `${outOfStockItems.length} items`,       sub: "Need restocking immediately" },
        ] as const).map(({ icon, iconBg, iconColor, title, main, sub }, idx) => (
          <div key={title} className={`fade-up fade-up-${idx + 1}`} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: iconColor, flexShrink: 0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{main}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={15} color="#b45309" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Low Stock Alerts</span>
            {lowStockItems.length > 0 && (
              <span style={{ marginLeft: "auto", background: "#fef3c7", color: "#b45309", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{lowStockItems.length}</span>
            )}
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Check size={28} style={{ marginBottom: 8, display: "block", margin: "0 auto 8px", opacity: 0.4 }} />
              All stock levels are healthy
            </div>
          ) : lowStockItems.map(p => (
            <div key={p.id} style={{ padding: "11px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.code} · {p.brand}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#b45309" }}>{p.stock}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>min: {p.minStock}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <XCircle size={15} color="#dc2626" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Out of Stock</span>
            {outOfStockItems.length > 0 && (
              <span style={{ marginLeft: "auto", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{outOfStockItems.length}</span>
            )}
          </div>
          {outOfStockItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Check size={28} style={{ marginBottom: 8, display: "block", margin: "0 auto 8px", opacity: 0.4 }} />
              All products are in stock
            </div>
          ) : outOfStockItems.map(p => (
            <div key={p.id} style={{ padding: "11px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.code} · {p.brand}</div>
              </div>
              <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>OUT OF STOCK</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Mobile Device Status Summary</span>
        </div>
        {devices.slice().sort((a, b) => a.name.localeCompare(b.name)).map(d => {
          const sc = statusColors[d.status];
          const m = d.suggestedPrice - d.buyingPrice;
          const mp = marginPct(d.buyingPrice, d.suggestedPrice);
          return (
            <div key={d.id} style={{ padding: "11px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{d.imei} · {d.storage} · {d.color}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 120 }}>{d.supplier}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 120, textAlign: "right" }}>Cost: {Rs(d.buyingPrice)}</div>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, minWidth: 100, textAlign: "right" }}>+{Rs(m)} ({mp}%)</div>
              <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, minWidth: 72, textAlign: "center" }}>{sc.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mobile Devices Tab ───────────────────────────────────────────────────────

function MobileDevicesTab({ devices, setDevices }: {
  devices: DeviceItem[]; setDevices: Dispatch<SetStateAction<DeviceItem[]>>;
}) {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editDevice, setEditDevice] = useState<DeviceItem | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceItem | null>(null);

  const { brands: brandList } = useInventory();
  const brands = useMemo(
    () => ["All", ...brandList.filter(b => b.type === "device" || b.type === "both").map(b => b.name).sort()],
    [brandList]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter(d => {
      if (brandFilter !== "All" && d.brand !== brandFilter) return false;
      if (statusFilter !== "All" && d.status !== statusFilter.toLowerCase()) return false;
      if (q && !d.imei.includes(q) && !d.name.toLowerCase().includes(q) && !d.brand.toLowerCase().includes(q) && !d.supplier.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [devices, search, brandFilter, statusFilter]);

  const available = devices.filter(d => d.status === "available").length;
  const sold = devices.filter(d => d.status === "sold").length;
  const reserved = devices.filter(d => d.status === "reserved").length;
  const stockVal = devices.filter(d => d.status === "available").reduce((s, d) => s + d.buyingPrice, 0);

  function handleSave(d: DeviceItem) {
    setDevices(prev => prev.find(x => x.id === d.id) ? prev.map(x => x.id === d.id ? d : x) : [...prev, d]);
    setEditDevice(null);
  }

  const statusColors = {
    available: { bg: "#dcfce7", color: "#16a34a" },
    sold:      { bg: "var(--bg-surface)", color: "var(--text-muted)" },
    reserved:  { bg: "#fef3c7", color: "#b45309" },
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {([
          { label: "Available", value: available, color: "#16a34a", bg: "#dcfce7" },
          { label: "Sold", value: sold, color: "var(--text-muted)", bg: "var(--bg-surface)" },
          { label: "Reserved", value: reserved, color: "#b45309", bg: "#fef3c7" },
          { label: "Stock Value", value: Rs(stockVal), color: "var(--accent)", bg: "var(--accent-dim)" },
        ] as const).map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color, background: bg, padding: "2px 10px", borderRadius: 8 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by IMEI, name, brand, supplier…" style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={selectStyle}>
          {brands.map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
          {["All", "Available", "Reserved", "Sold"].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setEditDevice("new")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
          <Plus size={14} /> Add Device
        </button>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <thead>
              <tr>
                {["#", "IMEI", "Device", "Brand", "Storage", "Color", "Buying Price", "Min Selling", "Suggested", "Margin", "Supplier", "Date Added", "Status", ""].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={14} style={{ ...tdBase, textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No devices match your filters</td></tr>
              ) : filtered.map((d, i) => {
                const sc = statusColors[d.status];
                const m = d.suggestedPrice - d.buyingPrice;
                const mp = marginPct(d.buyingPrice, d.suggestedPrice);
                return (
                  <tr key={d.id} style={{ background: d.status === "sold" ? "var(--bg-surface)" : "transparent", opacity: d.status === "sold" ? 0.7 : 1 }}>
                    <td style={{ ...tdBase, color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                    <td style={{ ...tdBase, fontFamily: "monospace", fontSize: 11.5, letterSpacing: "0.02em" }}>{d.imei}</td>
                    <td style={{ ...tdBase, fontWeight: 600, whiteSpace: "nowrap" }}>{d.name}</td>
                    <td style={tdBase}>{d.brand}</td>
                    <td style={tdBase}>{d.storage}</td>
                    <td style={tdBase}>{d.color}</td>
                    <td style={tdBase}>{Rs(d.buyingPrice)}</td>
                    <td style={tdBase}>{Rs(d.minSellingPrice)}</td>
                    <td style={{ ...tdBase, fontWeight: 600 }}>{Rs(d.suggestedPrice)}</td>
                    <td style={{ ...tdBase, color: "#16a34a", fontWeight: 700, whiteSpace: "nowrap" }}>
                      +{Rs(m)} <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>({mp}%)</span>
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)" }}>{d.supplier}</td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)", fontSize: 12 }}>{d.addedDate}</td>
                    <td style={tdBase}>
                      <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "capitalize" }}>{d.status}</span>
                    </td>
                    <td style={{ ...tdBase, width: 72 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setEditDevice(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Edit"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteTarget(d)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {filtered.length} of {devices.length} devices
        </div>
      </div>

      {editDevice !== null && (
        <AddEditDeviceModal device={editDevice === "new" ? null : editDevice} onSave={handleSave} onClose={() => setEditDevice(null)} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          name={`${deleteTarget.name} (${deleteTarget.imei})`}
          onConfirm={() => { setDevices(prev => prev.filter(x => x.id !== deleteTarget.id)); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Accessories Tab ──────────────────────────────────────────────────────────

function AccessoriesTab({ accessories, setAccessories }: {
  accessories: AccessoryProduct[]; setAccessories: Dispatch<SetStateAction<AccessoryProduct[]>>;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [editProduct, setEditProduct] = useState<AccessoryProduct | null | "new">(null);
  const [adjustProduct, setAdjustProduct] = useState<AccessoryProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccessoryProduct | null>(null);

  const { categories: categoryList } = useInventory();
  const categories = useMemo(() => ["All", ...categoryList.map(c => c.name).sort()], [categoryList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessories.filter(p => {
      if (categoryFilter !== "All" && p.category !== categoryFilter) return false;
      if (stockFilter === "In Stock" && p.stock === 0) return false;
      if (stockFilter === "Low Stock" && (p.stock === 0 || p.stock >= p.minStock)) return false;
      if (stockFilter === "Out of Stock" && p.stock > 0) return false;
      if (q && !p.code.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q) && !p.supplier.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [accessories, search, categoryFilter, stockFilter]);

  const inStock = accessories.filter(p => p.stock > 0).length;
  const lowStock = accessories.filter(p => p.stock > 0 && p.stock < p.minStock).length;
  const outOfStock = accessories.filter(p => p.stock === 0).length;
  const totalValue = accessories.reduce((s, p) => s + p.buyingPrice * p.stock, 0);

  function handleSave(p: AccessoryProduct) {
    setAccessories(prev => prev.find(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [...prev, p]);
    setEditProduct(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {([
          { label: "Total Products", value: accessories.length, color: "var(--text-primary)", bg: "var(--bg-surface)" },
          { label: "In Stock", value: inStock, color: "#16a34a", bg: "#dcfce7" },
          { label: "Low Stock", value: lowStock, color: "#b45309", bg: "#fef3c7" },
          { label: "Out of Stock", value: outOfStock, color: "#dc2626", bg: "#fee2e2" },
        ] as const).map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color, background: bg, padding: "2px 10px", borderRadius: 8 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code, name, brand, supplier…" style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selectStyle}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} style={selectStyle}>
          {["All", "In Stock", "Low Stock", "Out of Stock"].map(s => <option key={s}>{s}</option>)}
        </select>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
          Value: <strong style={{ color: "var(--text-primary)" }}>{Rs(totalValue)}</strong>
        </div>
        <button onClick={() => setEditProduct("new")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
          <Plus size={14} /> Add Product
        </button>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <thead>
              <tr>
                {["Code", "Product", "Brand", "Category", "Compatible", "Stock", "Min", "Buying", "Selling", "Margin", "Supplier", ""].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ ...tdBase, textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No products match your filters</td></tr>
              ) : filtered.map(p => {
                const isOut = p.stock === 0;
                const isLow = !isOut && p.stock < p.minStock;
                const m = p.sellingPrice - p.buyingPrice;
                const mp = marginPct(p.buyingPrice, p.sellingPrice);
                return (
                  <tr key={p.id} style={{ background: isOut ? "rgba(220,38,38,0.04)" : isLow ? "rgba(180,83,9,0.04)" : "transparent" }}>
                    <td style={{ ...tdBase, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{p.code}</td>
                    <td style={{ ...tdBase, fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</td>
                    <td style={tdBase}>{p.brand}</td>
                    <td style={tdBase}>
                      <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>{p.category}</span>
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)", fontSize: 12 }}>{p.model}</td>
                    <td style={{ ...tdBase, fontWeight: 700, color: isOut ? "#dc2626" : isLow ? "#b45309" : "#16a34a" }}>
                      {p.stock}
                      {isOut && <span style={{ marginLeft: 6, background: "#fee2e2", color: "#dc2626", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>OUT</span>}
                      {isLow && <span style={{ marginLeft: 6, background: "#fef3c7", color: "#b45309", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>LOW</span>}
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)" }}>{p.minStock}</td>
                    <td style={tdBase}>{Rs(p.buyingPrice)}</td>
                    <td style={{ ...tdBase, fontWeight: 600 }}>{Rs(p.sellingPrice)}</td>
                    <td style={{ ...tdBase, color: "#16a34a", fontWeight: 700, whiteSpace: "nowrap" }}>
                      +{Rs(m)} <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>({mp}%)</span>
                    </td>
                    <td style={{ ...tdBase, color: "var(--text-secondary)", fontSize: 12 }}>{p.supplier}</td>
                    <td style={{ ...tdBase, width: 120 }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button
                          onClick={() => setAdjustProduct(p)}
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--accent)", padding: "4px 8px", fontSize: 11, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Stock
                        </button>
                        <button onClick={() => setEditProduct(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Edit"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteTarget(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {filtered.length} of {accessories.length} products
        </div>
      </div>

      {editProduct !== null && (
        <AddEditProductModal product={editProduct === "new" ? null : editProduct} existingProducts={accessories} onSave={handleSave} onClose={() => setEditProduct(null)} />
      )}
      {adjustProduct && (
        <StockAdjustModal
          product={adjustProduct}
          onSave={newStock => { setAccessories(prev => prev.map(p => p.id === adjustProduct.id ? { ...p, stock: newStock } : p)); setAdjustProduct(null); }}
          onClose={() => setAdjustProduct(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          name={`${deleteTarget.name} (${deleteTarget.code})`}
          onConfirm={() => { setAccessories(prev => prev.filter(x => x.id !== deleteTarget.id)); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InventoryManagement() {
  const [tab, setTab] = useState<InventoryTab>("Overview");
  const [devices, setDevices] = useState<DeviceItem[]>(INITIAL_DEVICES);
  const [accessories, setAccessories] = useState<AccessoryProduct[]>(INITIAL_ACCESSORIES);

  const lowStockCount = accessories.filter(p => p.stock >= 0 && p.stock < p.minStock).length;

  const tabs: { id: InventoryTab; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string }[] = [
    { id: "Overview",       icon: BarChart3,  label: "Overview" },
    { id: "Mobile Devices", icon: Smartphone, label: "Mobile Devices" },
    { id: "Accessories",    icon: Package,    label: "Accessories" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>
      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Inventory Management</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
            Track devices, accessories, stock levels, and margins.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 6 }}>
          {tabs.map(({ id, icon: Icon, label }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8, fontSize: 13, border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent", background: isActive ? "var(--accent-dim)" : "transparent", color: isActive ? "var(--accent)" : "var(--text-secondary)", fontWeight: isActive ? 600 : 400, cursor: "pointer", transition: "all 0.18s", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap", position: "relative" }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; } }}
              >
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
                {id === "Accessories" && lowStockCount > 0 && (
                  <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 10, marginLeft: 2 }}>
                    {lowStockCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fade-up fade-up-2" style={{ borderTop: "1px solid var(--border)", marginTop: -8 }} />

      <div className="fade-up fade-up-3" style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
        {tab === "Overview"       && <OverviewTab devices={devices} accessories={accessories} />}
        {tab === "Mobile Devices" && <MobileDevicesTab devices={devices} setDevices={setDevices} />}
        {tab === "Accessories"    && <AccessoriesTab accessories={accessories} setAccessories={setAccessories} />}
      </div>
    </div>
  );
}
