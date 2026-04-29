"use client";

import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Grid3X3, List, Plus, Minus, Trash2, Eye, EyeOff, Tag, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string;
  model: string;
  brand: string;
  supplier: string;
  category: string;
  insight: string;
  sellingPrice: number;
  buyingPrice: number;
  stock: number;
}

interface CartItem {
  product: Product;
  qty: number;
}

interface CustomerInfo {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  nic: string;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const INITIAL_PRODUCTS: Product[] = [
  { id: 1,  name: "Tempered Glass",    model: "Universal 6.5\"",    brand: "OG Shield",  supplier: "Tech Supplies PVT",     category: "Screen Protector", insight: "Best seller this week",    sellingPrice: 350,  buyingPrice: 180,  stock: 45 },
  { id: 2,  name: "Phone Case",        model: "iPhone 15 Pro Max",  brand: "Spigen",     supplier: "Mobile Accessories LK", category: "Case",             insight: "Low stock — reorder soon", sellingPrice: 1200, buyingPrice: 650,  stock: 12 },
  { id: 3,  name: "USB-C Charger",     model: "65W GaN",            brand: "Anker",      supplier: "Tech Supplies PVT",     category: "Charger",          insight: "High margin item",         sellingPrice: 2800, buyingPrice: 1800, stock: 8  },
  { id: 4,  name: "Wireless Earbuds",  model: "TWS Pro",            brand: "Xiaomi",     supplier: "Digital Zone",          category: "Audio",            insight: "Popular among students",   sellingPrice: 3500, buyingPrice: 2100, stock: 20 },
  { id: 5,  name: "USB-C Cable",       model: "1m Braided",         brand: "Baseus",     supplier: "Mobile Accessories LK", category: "Cable",            insight: "Frequently bought with chargers", sellingPrice: 450, buyingPrice: 220, stock: 60 },
  { id: 6,  name: "Power Bank",        model: "20000mAh",           brand: "Romoss",     supplier: "Tech Supplies PVT",     category: "Power",            insight: "Top revenue contributor",  sellingPrice: 4200, buyingPrice: 2800, stock: 5  },
  { id: 7,  name: "Selfie Stick",      model: "Bluetooth",          brand: "No Brand",   supplier: "Local Import",          category: "Accessory",        insight: "Slow mover — discount?",   sellingPrice: 650,  buyingPrice: 300,  stock: 18 },
  { id: 8,  name: "Back Cover",        model: "Samsung A55",        brand: "OEM",        supplier: "Local Import",          category: "Case",             insight: "Good fit with Galaxy range", sellingPrice: 250, buyingPrice: 120,  stock: 30 },
  { id: 9,  name: "Ring Light",        model: "10\" LED",           brand: "Ulanzi",     supplier: "Digital Zone",          category: "Accessory",        insight: "Growing demand",           sellingPrice: 2200, buyingPrice: 1300, stock: 7  },
  { id: 10, name: "Screen Protector",  model: "Privacy Film",       brand: "ZAGG",       supplier: "Tech Supplies PVT",     category: "Screen Protector", insight: "Premium segment buyer",    sellingPrice: 800,  buyingPrice: 420,  stock: 22 },
];

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 11px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text-primary)", fontSize: 13,
  fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  transition: "border-color 0.15s", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "var(--text-secondary)", marginBottom: 4, display: "block",
  letterSpacing: "0.06em", textTransform: "uppercase",
};

const STEPS = [
  { num: 1, label: "Select Items" },
  { num: 2, label: "Review Order" },
  { num: 3, label: "Complete Sale" },
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16 }}>
      {STEPS.map((step, idx) => {
        const isDone = current > step.num;
        const isActive = current === step.num;
        return (
          <div key={step.num} style={{ display: "flex", alignItems: "center", flex: idx < STEPS.length - 1 ? 1 : "unset" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: isDone || isActive ? "var(--accent)" : "var(--bg-card)",
                border: `2px solid ${isDone || isActive ? "var(--accent)" : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isDone || isActive ? "var(--accent-fg)" : "var(--text-secondary)",
                fontWeight: 700, fontSize: 11, flexShrink: 0, transition: "all 0.2s",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                {isDone ? "✓" : step.num}
              </div>
              <span style={{
                fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: isActive ? "var(--accent)" : isDone ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 8px", marginBottom: 22,
                background: isDone ? "var(--accent)" : "var(--border)",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Search Manually Popup ────────────────────────────────────────────────────

function SearchPopup({
  products, cart, onAddMultiple, onClose,
}: {
  products: Product[];
  cart: CartItem[];
  onAddMultiple: (selected: Product[]) => void;
  onClose: () => void;
}) {
  const MAX_PRICE = Math.max(...products.map((p) => p.sellingPrice), 1000);

  const [filterType, setFilterType]         = useState("");
  const [filterBrand, setFilterBrand]       = useState("");
  const [filterName, setFilterName]         = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [priceMin, setPriceMin]             = useState(0);
  const [priceMax, setPriceMax]             = useState(MAX_PRICE);
  const [sortPrice, setSortPrice]           = useState<"" | "asc" | "desc">("");
  const [sortInsight, setSortInsight]       = useState(false);
  const [showPricePopover, setShowPricePopover] = useState(false);
  const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set());

  const types     = [...new Set(products.map((p) => p.category))];
  const brands    = [...new Set(products.map((p) => p.brand))];
  const suppliers = [...new Set(products.map((p) => p.supplier))];

  const BUCKETS = 12;
  const histogram = Array(BUCKETS).fill(0);
  products.forEach((p) => {
    const b = Math.min(Math.floor((p.sellingPrice / (MAX_PRICE + 1)) * BUCKETS), BUCKETS - 1);
    histogram[b]++;
  });
  const maxBucket = Math.max(...histogram, 1);

  let filtered = products.filter((p) => {
    if (filterType && p.category !== filterType) return false;
    if (filterBrand && p.brand !== filterBrand) return false;
    if (filterName && !p.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterSupplier && p.supplier !== filterSupplier) return false;
    if (p.sellingPrice < priceMin || p.sellingPrice > priceMax) return false;
    return true;
  });
  if (sortPrice === "asc")  filtered = [...filtered].sort((a, b) => a.sellingPrice - b.sellingPrice);
  if (sortPrice === "desc") filtered = [...filtered].sort((a, b) => b.sellingPrice - a.sellingPrice);
  if (sortInsight) filtered = [...filtered].sort((a, b) => a.insight.localeCompare(b.insight));

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)));

  const addSelected = () => {
    onAddMultiple(filtered.filter((p) => selectedIds.has(p.id)));
    onClose();
  };

  const cartQty = (id: number) => cart.find((c) => c.product.id === id)?.qty ?? 0;
  const stockColor = (s: number) => s > 20 ? "#4ade80" : s > 5 ? "#f59e0b" : "#ef4444";

  const selStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12,
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", cursor: "pointer",
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 700, textAlign: "left",
    color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap",
    borderBottom: "1px solid var(--border)", background: "var(--bg-card)", position: "sticky", top: 0,
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 12, color: "var(--text-primary)",
    fontFamily: "'Plus Jakarta Sans', sans-serif", borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 1200,
          height: "100%", maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-card)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 22px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Search Manually
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
              Filter products and select items to add to cart
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Filters row */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selStyle}>
            <option value="">All Types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} style={selStyle}>
            <option value="">All Brands</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>

          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Item Name"
            style={{ ...selStyle, width: 160 }}
          />

          <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} style={selStyle}>
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Price range button + popover */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowPricePopover((v) => !v)}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer",
                border: `1px solid ${showPricePopover || priceMin > 0 || priceMax < MAX_PRICE ? "var(--accent)" : "var(--border)"}`,
                background: showPricePopover || priceMin > 0 || priceMax < MAX_PRICE ? "var(--accent-dim)" : "var(--bg-card)",
                color: showPricePopover || priceMin > 0 || priceMax < MAX_PRICE ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              $ – $$$
            </button>

            {showPricePopover && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 20,
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "16px 18px", width: 260,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Price Range</span>
                  <button onClick={() => setShowPricePopover(false)} style={{ width: 20, height: 20, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    <X size={12} />
                  </button>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12 }}>
                  Rs. {priceMin.toLocaleString()} – Rs. {priceMax.toLocaleString()}
                </div>

                {/* Histogram */}
                <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 52, marginBottom: 10 }}>
                  {histogram.map((count, i) => {
                    const bucketStart = (i / BUCKETS) * MAX_PRICE;
                    const inRange = bucketStart >= priceMin && bucketStart <= priceMax;
                    return (
                      <div key={i} style={{
                        flex: 1, borderRadius: "2px 2px 0 0",
                        height: `${(count / maxBucket) * 100}%`,
                        minHeight: count > 0 ? 4 : 0,
                        background: inRange ? "var(--accent)" : "var(--border)",
                        transition: "background 0.15s",
                      }} />
                    );
                  })}
                </div>

                {/* Dual range slider */}
                <div style={{ position: "relative", height: 20, marginBottom: 14 }}>
                  {/* Track */}
                  <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", width: "100%", height: 4, background: "var(--border)", borderRadius: 2 }} />
                  {/* Active fill */}
                  <div style={{
                    position: "absolute", top: "50%", transform: "translateY(-50%)",
                    left: `${(priceMin / MAX_PRICE) * 100}%`,
                    right: `${100 - (priceMax / MAX_PRICE) * 100}%`,
                    height: 4, background: "var(--accent)", borderRadius: 2,
                  }} />
                  {/* Min thumb marker */}
                  <div style={{ position: "absolute", top: "50%", left: `${(priceMin / MAX_PRICE) * 100}%`, transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--bg-card)", pointerEvents: "none", zIndex: 2 }} />
                  {/* Max thumb marker */}
                  <div style={{ position: "absolute", top: "50%", left: `${(priceMax / MAX_PRICE) * 100}%`, transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--bg-card)", pointerEvents: "none", zIndex: 2 }} />
                  {/* Min input */}
                  <input type="range" min={0} max={MAX_PRICE} step={50} value={priceMin}
                    onChange={(e) => { const v = Number(e.target.value); if (v < priceMax) setPriceMin(v); }}
                    style={{ position: "absolute", width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0, zIndex: priceMin > MAX_PRICE * 0.9 ? 3 : 1 }}
                  />
                  {/* Max input */}
                  <input type="range" min={0} max={MAX_PRICE} step={50} value={priceMax}
                    onChange={(e) => { const v = Number(e.target.value); if (v > priceMin) setPriceMax(v); }}
                    style={{ position: "absolute", width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0, zIndex: 1 }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12 }}>
                  <span>Rs. 0</span><span>Rs. {MAX_PRICE.toLocaleString()}</span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setPriceMin(0); setPriceMax(MAX_PRICE); }}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer" }}
                  >Reset</button>
                  <button
                    onClick={() => setShowPricePopover(false)}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: "pointer" }}
                  >Apply</button>
                </div>
              </div>
            )}
          </div>

          {/* Price sort */}
          <button
            onClick={() => setSortPrice((s) => s === "" ? "asc" : s === "asc" ? "desc" : "")}
            style={{
              ...selStyle,
              border: `1px solid ${sortPrice ? "var(--accent)" : "var(--border)"}`,
              background: sortPrice ? "var(--accent-dim)" : "var(--bg-card)",
              color: sortPrice ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: sortPrice ? 600 : 400,
            }}
          >
            Price {sortPrice === "asc" ? "↑ Low–High" : sortPrice === "desc" ? "↓ High–Low" : "↕"}
          </button>

          {/* Insights sort */}
          <button
            onClick={() => setSortInsight((v) => !v)}
            style={{
              ...selStyle,
              border: `1px solid ${sortInsight ? "var(--accent)" : "var(--border)"}`,
              background: sortInsight ? "var(--accent-dim)" : "var(--bg-card)",
              color: sortInsight ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: sortInsight ? 600 : 400,
            }}
          >
            Insights {sortInsight ? "↑" : "↕"}
          </button>

          {/* Clear all */}
          {(filterType || filterBrand || filterName || filterSupplier || sortPrice || sortInsight || priceMin > 0 || priceMax < MAX_PRICE) && (
            <button
              onClick={() => { setFilterType(""); setFilterBrand(""); setFilterName(""); setFilterSupplier(""); setSortPrice(""); setSortInsight(false); setPriceMin(0); setPriceMax(MAX_PRICE); }}
              style={{ ...selStyle, color: "#ef4444", border: "1px solid #ef444440" }}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleAll}
                    style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                </th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Model</th>
                <th style={thStyle}>Brand</th>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Category</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Price</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Stock</th>
                <th style={thStyle}>Insight</th>
                <th style={{ ...thStyle, width: 80, textAlign: "center" }}>Select</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                    No products match the filters
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const selected = selectedIds.has(p.id);
                  const qty = cartQty(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      style={{
                        cursor: "pointer",
                        background: selected ? "rgba(var(--accent-rgb,99,102,241),0.06)" : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.model}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.brand}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.supplier}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>
                          {p.category}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                        Rs. {p.sellingPrice.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 600, color: stockColor(p.stock) }}>
                        {p.stock}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 11, fontStyle: "italic" }}>
                        {p.insight}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {qty > 0 && (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            ×{qty} in cart
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 22px", borderTop: "1px solid var(--border)", flexShrink: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "var(--bg-card)",
        }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {filtered.length} product{filtered.length !== 1 ? "s" : ""} shown
            {selectedIds.size > 0 && <span style={{ color: "var(--accent)", fontWeight: 700 }}> · {selectedIds.size} selected</span>}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={addSelected}
              disabled={selectedIds.size === 0}
              style={{
                padding: "9px 22px", borderRadius: 8, border: "none", fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
                background: selectedIds.size === 0 ? "var(--border)" : "var(--accent)",
                color: selectedIds.size === 0 ? "var(--text-muted)" : "var(--accent-fg)",
              }}
            >
              {selectedIds.size === 0 ? "Select items to add" : `Add ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""} to Cart`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Step 1: Select Items ─────────────────────────────────────────────────────

function Step1({
  products,
  cart, onAdd, onRemove, onQtyChange,
  customer, onCustomerChange,
  payMethod, onPayMethod,
  discount, onDiscount,
  onOpenSearch,
}: {
  products: Product[];
  cart: CartItem[];
  onAdd: (p: Product) => void;
  onRemove: (id: number) => void;
  onQtyChange: (id: number, qty: number) => void;
  customer: CustomerInfo;
  onCustomerChange: (d: Partial<CustomerInfo>) => void;
  payMethod: string;
  onPayMethod: (m: string) => void;
  discount: string;
  onDiscount: (v: string) => void;
  onOpenSearch: () => void;
}) {
  const [query, setQuery] = useState("");
  const [barcodeVal, setBarcodeVal] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [revealBuying, setRevealBuying] = useState<Record<number, boolean>>({});
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [sameAsPhone, setSameAsPhone] = useState(false);

  const MAX_TILES = 4;

  const filtered = products.filter((p) => {
    const q = query.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.model.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
  });

  const cartQty = (id: number) => cart.find((c) => c.product.id === id)?.qty ?? 0;

  const subtotal = cart.reduce((s, c) => s + c.product.sellingPrice * c.qty, 0);
  const discountAmt = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);

  const stockColor = (s: number) => s > 20 ? "#4ade80" : s > 5 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>

      {/* ── Left: Search + Product List ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

        {/* Search bar row */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <input
            style={{ ...inputStyle, flex: "0 0 180px" }}
            placeholder="SCAN Barcode"
            value={barcodeVal}
            onChange={(e) => setBarcodeVal(e.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: "0 0 900px" }}
            placeholder="Enter Item Code or Name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => {}}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "1px solid var(--accent)",
              background: "var(--accent)", color: "var(--accent-fg)", fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Enter
          </button>
          <button
            onClick={onOpenSearch}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-secondary)", fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Search Manually
          </button>
          <button
            onClick={() => setViewMode((v) => v === "list" ? "grid" : "list")}
            style={{
              width: 38, height: 38, borderRadius: 8, border: "1px solid var(--border)",
              background: viewMode === "grid" ? "var(--accent-dim)" : "transparent",
              color: viewMode === "grid" ? "var(--accent)" : "var(--text-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            {viewMode === "list" ? <Grid3X3 size={15} /> : <List size={15} />}
          </button>
        </div>

        {/* Product list */}
        <div style={{
          flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 4,
          ...(viewMode === "grid"
            ? { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, alignContent: "flex-start" }
            : { display: "flex", flexDirection: "column", gap: 8 }),
        }}>
          {filtered.length === 0 && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              No products found
            </div>
          )}

          {filtered.map((p) => {
            const qty = cartQty(p.id);
            const showBuying = revealBuying[p.id];
            const inCart = qty > 0;

            if (viewMode === "grid") {
              return (
                <div
                  key={p.id}
                  style={{
                    height: 130, padding: "14px 16px", borderRadius: 10,
                    border: `1px solid ${inCart ? "var(--accent)" : "var(--border)"}`,
                    background: inCart ? "rgba(var(--accent-rgb,232,232,232),0.04)" : "var(--bg-card)",
                    display: "flex", flexDirection: "column", gap: 8, boxSizing: "border-box", overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{p.model} · {p.brand}</div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 5,
                      background: "var(--accent-dim)", color: "var(--accent)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      maxWidth: 90, flexShrink: 0,
                    }}>{p.category}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Rs. {p.sellingPrice.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: stockColor(p.stock), fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 1 }}>
                        {p.stock} in stock
                      </div>
                    </div>
                    {qty === 0 ? (
                      <button
                        onClick={() => onAdd(p)}
                        disabled={p.stock === 0}
                        style={{
                          width: 30, height: 30, borderRadius: 7, border: "none",
                          background: "var(--accent)", color: "var(--accent-fg)",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={() => qty === 1 ? onRemove(p.id) : onQtyChange(p.id, qty - 1)}
                          style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}
                        ><Minus size={12} /></button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif", minWidth: 18, textAlign: "center" }}>{qty}</span>
                        <button
                          onClick={() => qty < p.stock && onQtyChange(p.id, qty + 1)}
                          style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}
                        ><Plus size={12} /></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // List view
            return (
              <div
                key={p.id}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                  borderRadius: 10,
                  border: `1px solid ${inCart ? "var(--accent)" : "var(--border)"}`,
                  background: inCart ? "rgba(var(--accent-rgb,232,232,232),0.04)" : "var(--bg-card)",
                  flexShrink: 0, transition: "border-color 0.15s",
                }}
              >
                {/* Category badge */}
                <div style={{
                  width: 42, height: 42, borderRadius: 9, flexShrink: 0,
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Tag size={16} color="var(--accent)" />
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>|</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.model}</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>|</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.brand}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
                    {p.supplier}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3, fontStyle: "italic" }}>
                    💡 {p.insight}
                  </div>
                </div>

                {/* Right: price + stock + actions */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Rs. {p.sellingPrice.toLocaleString()}
                  </div>
                  <button
                    onClick={() => setRevealBuying((r) => ({ ...r, [p.id]: !r[p.id] }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif",
                      color: "var(--text-muted)", background: "transparent", border: "none",
                      cursor: "pointer", padding: "2px 6px", borderRadius: 5,
                      textDecoration: "underline", textDecorationStyle: "dotted",
                    }}
                  >
                    {showBuying ? <EyeOff size={11} /> : <Eye size={11} />}
                    {showBuying ? `Cost: Rs. ${p.buyingPrice.toLocaleString()}` : "View buying price"}
                  </button>
                  <div style={{ fontSize: 11, color: stockColor(p.stock), fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>
                    {p.stock} available
                  </div>
                </div>

                {/* Qty controls / Add */}
                <div style={{ flexShrink: 0 }}>
                  {qty === 0 ? (
                    <button
                      onClick={() => onAdd(p)}
                      disabled={p.stock === 0}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 8, border: "none",
                        background: p.stock === 0 ? "var(--border)" : "var(--accent)",
                        color: p.stock === 0 ? "var(--text-muted)" : "var(--accent-fg)",
                        cursor: p.stock === 0 ? "not-allowed" : "pointer",
                        fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
                      }}
                    >
                      <Plus size={13} /> Add
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => qty === 1 ? onRemove(p.id) : onQtyChange(p.id, qty - 1)}
                        style={{
                          width: 28, height: 28, borderRadius: 7,
                          border: "1px solid var(--border)", background: "transparent",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          color: qty === 1 ? "#ef4444" : "var(--text-secondary)",
                        }}
                      >
                        {qty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                      </button>
                      <span style={{
                        fontSize: 14, fontWeight: 700, color: "var(--accent)",
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        minWidth: 20, textAlign: "center",
                      }}>{qty}</span>
                      <button
                        onClick={() => qty < p.stock && onQtyChange(p.id, qty + 1)}
                        disabled={qty >= p.stock}
                        style={{
                          width: 28, height: 28, borderRadius: 7,
                          border: "1px solid var(--border)", background: "transparent",
                          cursor: qty >= p.stock ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: qty >= p.stock ? "var(--border)" : "var(--text-secondary)",
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ width: 350, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", paddingRight: 2 }}>

        {/* Bill Summary */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Bill Summary
          </div>

          {/* Cart item tiles */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
            {cart.length === 0
              ? [0, 1, 2, 3].map((i) => (
                  <div key={i} style={{
                    flex: 1, height: 50, borderRadius: 8,
                    background: "var(--bg-primary)", border: "1px solid var(--border)",
                  }} />
                ))
              : cart.slice(0, MAX_TILES).map((c) => (
                  <div key={c.product.id} style={{
                    flex: 1, minWidth: 0, height: 50, borderRadius: 8, padding: "6px 7px",
                    background: "var(--bg-primary)", border: "1px solid var(--accent-glow)",
                    display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
                    position: "relative",
                  }}>
                    <button
                      onClick={() => onRemove(c.product.id)}
                      style={{
                        position: "absolute", top: 3, right: 3,
                        width: 14, height: 14, borderRadius: 3, border: "none",
                        background: "var(--border)", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--text-muted)", padding: 0,
                      }}
                    >
                      <X size={8} />
                    </button>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: "var(--text-primary)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      paddingRight: 14,
                    }}>{c.product.name}</div>
                    <div style={{
                      fontSize: 10, color: "var(--accent)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
                    }}>×{c.qty}</div>
                  </div>
                ))
            }
            {/* Overflow / add-more button */}
            <button
              onClick={() => cart.length > 0 && setShowCartPopup(true)}
              style={{
                width: 34, height: 50, flexShrink: 0, borderRadius: 8,
                border: "1px solid var(--border)", background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: cart.length > MAX_TILES ? "pointer" : "default",
                color: cart.length > MAX_TILES ? "var(--accent)" : "var(--text-muted)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700, fontSize: 12,
              }}
            >
              {cart.length > MAX_TILES ? `+${cart.length - MAX_TILES}` : "+"}
            </button>
          </div>

          {/* Cart popup */}
          {showCartPopup && (
            <div
              onClick={() => setShowCartPopup(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 999,
                background: "rgba(0,0,0,0.45)", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 14, padding: "20px 22px", width: 340,
                  display: "flex", flexDirection: "column", gap: 12,
                  boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Cart ({cart.length} items)
                  </span>
                  <button
                    onClick={() => setShowCartPopup(false)}
                    style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                  {cart.map((c) => (
                    <div key={c.product.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                      padding: "10px 12px", borderRadius: 9,
                      border: "1px solid var(--border)", background: "var(--bg-primary)",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.product.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 1 }}>
                          {c.qty} × Rs. {c.product.sellingPrice.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>
                        Rs. {(c.product.sellingPrice * c.qty).toLocaleString()}
                      </div>
                      <button
                        onClick={() => { onRemove(c.product.id); if (cart.length === 1) setShowCartPopup(false); }}
                        style={{ width: 20, height: 20, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Discount */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <label style={labelStyle}>Discount (Rs.)</label>
            <input
              style={{ ...inputStyle, fontSize: 12 }}
              type="number"
              min={0}
              placeholder="0"
              value={discount}
              onChange={(e) => onDiscount(e.target.value)}
            />
          </div>

          {/* Totals */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Subtotal</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {subtotal.toLocaleString()}</span>
            </div>
            {discountAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Discount</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>− Rs. {discountAmt.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {total.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment method */}
          <div style={{ display: "flex", gap: 6 }}>
            {["Cash", "Card", "Credit"].map((m) => {
              const active = payMethod === m;
              return (
                <button
                  key={m}
                  onClick={() => onPayMethod(m)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12,
                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: active ? 700 : 400,
                    border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "var(--accent-fg)" : "var(--text-secondary)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Customer Info */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Customer Info
          </div>

          <div>
            <label style={labelStyle}>Name *</label>
            <input style={{ ...inputStyle, fontSize: 12 }} placeholder="Customer name" value={customer.name} onChange={(e) => onCustomerChange({ name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Phone Number *</label>
            <input style={{ ...inputStyle, fontSize: 12 }} placeholder="07X XXX XXXX" value={customer.phone} onChange={(e) => { const val = e.target.value; onCustomerChange(sameAsPhone ? { phone: val, whatsapp: val } : { phone: val }); }} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>WhatsApp <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(Optional)</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <input type="checkbox" checked={sameAsPhone} onChange={(e) => { setSameAsPhone(e.target.checked); if (e.target.checked) onCustomerChange({ whatsapp: customer.phone }); }} style={{ accentColor: "var(--accent)", cursor: "pointer", width: 12, height: 12 }} />
                Same As Phone
              </label>
            </div>
            <input style={{ ...inputStyle, fontSize: 12, opacity: sameAsPhone ? 0.7 : 1 }} placeholder="07X XXX XXXX" value={sameAsPhone ? customer.phone : customer.whatsapp} onChange={(e) => { if (!sameAsPhone) onCustomerChange({ whatsapp: e.target.value }); }} readOnly={sameAsPhone} />
          </div>
          <div>
            <label style={labelStyle}>Email <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(Optional)</span></label>
            <input style={{ ...inputStyle, fontSize: 12 }} type="email" placeholder="customer@email.com" value={customer.email} onChange={(e) => onCustomerChange({ email: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>NIC <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(Optional)</span></label>
            <input style={{ ...inputStyle, fontSize: 12 }} placeholder="199912345678" value={customer.nic} onChange={(e) => onCustomerChange({ nic: e.target.value })} />
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Step 2: Review Order ─────────────────────────────────────────────────────

function Step2({
  cart, customer, onCustomerChange, payMethod, onPayMethod, discount, onDiscount,
}: {
  cart: CartItem[];
  customer: CustomerInfo;
  onCustomerChange: (d: Partial<CustomerInfo>) => void;
  payMethod: string;
  onPayMethod: (m: string) => void;
  discount: string;
  onDiscount: (v: string) => void;
}) {
  const [payReceived, setPayReceived] = useState("");
  const [advance, setAdvance]         = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [warranties, setWarranties]   = useState<Record<number, string>>({});
  const [printFormat, setPrintFormat] = useState<"POS" | "A5">("POS");
  const receiptRef = useRef<HTMLDivElement>(null);

  const receiptNo   = useMemo(() => `ACC-${Date.now().toString().slice(-6)}`, []);
  const receiptDate = useMemo(() => new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }), []);

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const printDiv = document.createElement("div");
    printDiv.id = "__rp__";
    printDiv.innerHTML = receiptRef.current.outerHTML;
    document.body.appendChild(printDiv);

    const styleEl = document.createElement("style");
    styleEl.id = "__rp_style__";

    if (printFormat === "POS") {
      styleEl.textContent = `
        @page { size: 80mm auto; margin: 0; }
        #__rp__ { display: none; }
        @media print {
          body { visibility: hidden; }
          #__rp__ {
            display: block !important;
            visibility: visible;
            position: fixed;
            top: 0; left: 0;
            width: 80mm;
          }
          #__rp__ * { visibility: visible; }
          #__rp__ > div {
            width: 80mm !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
        }
      `;
    } else {
      styleEl.textContent = `
        @page { size: A5 landscape; margin: 10mm; }
        #__rp__ { display: none; }
        @media print {
          body { visibility: hidden; }
          #__rp__ {
            display: block !important;
            visibility: visible;
            position: fixed;
            top: 0; left: 0;
            width: 190mm;
          }
          #__rp__ * { visibility: visible; }
          #__rp__ > div {
            width: 190mm !important;
            max-width: 190mm !important;
            border-radius: 4px !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
        }
      `;
    }

    document.head.appendChild(styleEl);

    window.print();

    setTimeout(() => {
      document.getElementById("__rp__")?.remove();
      document.getElementById("__rp_style__")?.remove();
    }, 500);
  };

  const subtotal       = cart.reduce((s, c) => s + c.product.sellingPrice * c.qty, 0);
  const discountAmt    = parseFloat(discount) || 0;
  const total          = Math.max(0, subtotal - discountAmt);
  const payReceivedAmt = parseFloat(payReceived) || 0;
  const advanceAmt     = parseFloat(advance) || 0;
  const change         = payReceivedAmt > 0 ? payReceivedAmt - total : null;

  const tileStyle: React.CSSProperties = {
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: 12, display: "flex", flexDirection: "column",
    overflow: "hidden", minHeight: 0,
  };

  const tileHead: React.CSSProperties = {
    padding: "12px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0,
    fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: "0.06em", textTransform: "uppercase",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  };

  const row: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
      gap: 14, flex: 1, minHeight: 0, paddingBottom: 20,
    }}>

      {/* ── Tile 1: Order Items ── */}
      <div style={tileStyle}>
        <div style={tileHead}>
          <span>Order Items</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            background: "var(--accent-dim)", color: "var(--accent)",
          }}>
            {cart.reduce((s, c) => s + c.qty, 0)} items
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              No items in cart
            </div>
          ) : cart.map((c) => {
            const warranty = warranties[c.product.id] || "None";
            return (
              <div key={c.product.id} style={{
                padding: "10px 12px", borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--bg-primary)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.product.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 1 }}>
                      {c.product.model} · {c.product.brand}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
                      {c.qty} × Rs. {c.product.sellingPrice.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>
                    Rs. {(c.product.sellingPrice * c.qty).toLocaleString()}
                  </div>
                </div>

                {/* Warranty selector */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>
                    Warranty
                  </span>
                  <select
                    value={warranty}
                    onChange={(e) => setWarranties((prev) => ({ ...prev, [c.product.id]: e.target.value }))}
                    style={{
                      flex: 1, padding: "4px 8px", borderRadius: 6, fontSize: 11,
                      border: `1px solid ${warranty !== "None" ? "var(--accent-glow)" : "var(--border)"}`,
                      background: warranty !== "None" ? "var(--accent-dim)" : "var(--bg-card)",
                      color: warranty !== "None" ? "var(--accent)" : "var(--text-secondary)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer", outline: "none",
                      fontWeight: warranty !== "None" ? 600 : 400,
                    }}
                  >
                    {["None", "1 Month", "3 Months", "6 Months", "1 Year", "2 Years"].map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {cart.length} product{cart.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Rs. {subtotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── Tile 2: Customer Details (editable) ── */}
      <div style={tileStyle}>
        <div style={tileHead}>Customer Details</div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {(
            [
              { label: "Name *",          key: "name"     as keyof CustomerInfo, placeholder: "Customer name"       },
              { label: "Phone Number *",  key: "phone"    as keyof CustomerInfo, placeholder: "07X XXX XXXX"        },
              { label: "WhatsApp",        key: "whatsapp" as keyof CustomerInfo, placeholder: "Same as phone?"      },
              { label: "Email",           key: "email"    as keyof CustomerInfo, placeholder: "customer@email.com", type: "email" },
              { label: "NIC",             key: "nic"      as keyof CustomerInfo, placeholder: "199912345678"        },
            ] as { label: string; key: keyof CustomerInfo; placeholder: string; type?: string }[]
          ).map(({ label, key, placeholder, type }) => {
            if (key === "phone") return (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input
                  style={{ ...inputStyle, fontSize: 12 }}
                  placeholder={placeholder}
                  value={customer[key]}
                  onChange={(e) => { const val = e.target.value; onCustomerChange(sameAsPhone ? { phone: val, whatsapp: val } : { phone: val }); }}
                />
              </div>
            );
            if (key === "whatsapp") return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>WhatsApp <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(Optional)</span></label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <input type="checkbox" checked={sameAsPhone} onChange={(e) => { setSameAsPhone(e.target.checked); if (e.target.checked) onCustomerChange({ whatsapp: customer.phone }); }} style={{ accentColor: "var(--accent)", cursor: "pointer", width: 12, height: 12 }} />
                    Same As Phone
                  </label>
                </div>
                <input
                  style={{ ...inputStyle, fontSize: 12, opacity: sameAsPhone ? 0.7 : 1 }}
                  placeholder="07X XXX XXXX"
                  value={sameAsPhone ? customer.phone : customer.whatsapp}
                  onChange={(e) => { if (!sameAsPhone) onCustomerChange({ whatsapp: e.target.value }); }}
                  readOnly={sameAsPhone}
                />
              </div>
            );
            return (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input
                  style={{ ...inputStyle, fontSize: 12 }}
                  type={type || "text"}
                  placeholder={placeholder}
                  value={customer[key]}
                  onChange={(e) => onCustomerChange({ [key]: e.target.value })}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tile 3: Bill Summary ── */}
      <div style={tileStyle}>
        <div style={tileHead}>Bill Summary</div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Payment method */}
          <div>
            <label style={labelStyle}>Payment Method</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["Cash", "Card", "Credit"].map((m) => {
                const active = payMethod === m;
                return (
                  <button key={m} onClick={() => onPayMethod(m)} style={{
                    flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 11,
                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: active ? 700 : 400,
                    border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "var(--accent-fg)" : "var(--text-secondary)", cursor: "pointer",
                  }}>{m}</button>
                );
              })}
            </div>
          </div>

          {/* Credit Profile */}
          {payMethod === "Credit" && (
            <div style={{
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 9, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Credit Profile
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {customer.name || "—"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 7, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 2 }}>Outstanding</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. 15,000</div>
                </div>
                <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 7, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 2 }}>Max Limit</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. 50,000</div>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
                  <span>Credit Used</span><span>30%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ width: "30%", height: "100%", background: "#ef4444", borderRadius: 3 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 5 }}>
                  Recent Purchases
                </div>
                {[
                  { item: "USB-C Charger",  date: "15 Apr", amount: 2800 },
                  { item: "Tempered Glass", date: "10 Apr", amount: 350  },
                  { item: "Phone Case",     date: "02 Apr", amount: 1200 },
                ].map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <div>
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{p.item}</span>
                      <span style={{ color: "var(--text-muted)", marginLeft: 5, fontSize: 10 }}>{p.date}</span>
                    </div>
                    <span style={{ color: "#ef4444", fontWeight: 600 }}>Rs. {p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discount */}
          <div>
            <label style={labelStyle}>Discount (Rs.)</label>
            <input style={{ ...inputStyle, fontSize: 12 }} type="number" min={0} placeholder="0" value={discount} onChange={(e) => onDiscount(e.target.value)} />
          </div>

          {/* Amount Received */}
          <div>
            <label style={labelStyle}>Amount Received (Rs.)</label>
            <input style={{ ...inputStyle, fontSize: 12 }} type="number" min={0} placeholder="0.00" value={payReceived} onChange={(e) => setPayReceived(e.target.value)} />
          </div>

          {/* Advance — credit only */}
          {payMethod === "Credit" && (
            <div>
              <label style={labelStyle}>Advance Paid (Rs.)</label>
              <input style={{ ...inputStyle, fontSize: 12 }} type="number" min={0} placeholder="0.00" value={advance} onChange={(e) => setAdvance(e.target.value)} />
            </div>
          )}

          {/* Calculated rows */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={row}>
              <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Rs. {subtotal.toLocaleString()}</span>
            </div>
            {discountAmt > 0 && (
              <div style={row}>
                <span style={{ color: "#4ade80" }}>Discount</span>
                <span style={{ fontWeight: 600, color: "#4ade80" }}>− Rs. {discountAmt.toLocaleString()}</span>
              </div>
            )}
            <div style={{ ...row, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>Rs. {total.toLocaleString()}</span>
            </div>
            {payReceivedAmt > 0 && (
              <>
                <div style={row}>
                  <span style={{ color: "var(--text-secondary)" }}>Received</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Rs. {payReceivedAmt.toLocaleString()}</span>
                </div>
                <div style={row}>
                  <span style={{ color: change !== null && change >= 0 ? "#4ade80" : "#ef4444" }}>
                    {change !== null && change >= 0 ? "Change" : "Short"}
                  </span>
                  <span style={{ fontWeight: 700, color: change !== null && change >= 0 ? "#4ade80" : "#ef4444" }}>
                    Rs. {change !== null ? Math.abs(change).toLocaleString() : "0"}
                  </span>
                </div>
              </>
            )}
            {payMethod === "Credit" && (
              <>
                <div style={row}>
                  <span style={{ color: "var(--text-secondary)" }}>Advance Paid</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Rs. {advanceAmt.toLocaleString()}</span>
                </div>
                <div style={{ ...row, background: "#ef444415", padding: "8px 10px", borderRadius: 7 }}>
                  <span style={{ fontWeight: 700, color: "#ef4444" }}>Balance Due</span>
                  <span style={{ fontWeight: 700, color: "#ef4444" }}>Rs. {Math.max(0, total - advanceAmt).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tile 4: Receipt Preview ── */}
      <div style={tileStyle}>
        <div style={tileHead}>
          <span>Receipt Preview</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              display: "flex", background: "var(--bg-primary)",
              border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden",
            }}>
              {(["POS", "A5"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setPrintFormat(fmt)}
                  style={{
                    padding: "4px 10px", fontSize: 10, fontWeight: 700,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    border: "none", cursor: "pointer", letterSpacing: "0.05em",
                    background: printFormat === fmt ? "var(--accent)" : "transparent",
                    color: printFormat === fmt ? "var(--accent-fg)" : "var(--text-muted)",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
            <button
              onClick={handlePrint}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 7, fontSize: 11,
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
                border: "1px solid var(--accent)", background: "var(--accent)",
                color: "var(--accent-fg)", cursor: "pointer",
              }}
            >
              🖨️ Print
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>

          {printFormat === "A5" ? (
            /* ── A5 Invoice Layout ── */
            <div ref={receiptRef} style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #d1d5db", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.18)", fontFamily: "Arial, Helvetica, sans-serif", color: "#111827" }}>

              {/* Top accent bar */}
              <div style={{ height: 4, background: "#111827" }} />

              {/* Row 1: Shop/Invoice Info  |  Customer Info */}
              <div style={{ display: "flex", borderBottom: "1.5px solid #111827" }}>

                {/* Left — Branding + Invoice ref */}
                <div style={{ flex: "0 0 52%", padding: "14px 18px 12px", borderRight: "1px solid #d1d5db" }}>
                  <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "0.12em", color: "#111827", lineHeight: 1 }}>MANO MOBILE</div>
                  <div style={{ fontSize: 8, letterSpacing: "0.22em", color: "#6b7280", marginTop: 3, marginBottom: 10 }}>MANAGEMENT SUITE</div>
                  <div style={{ fontSize: 9.5, color: "#374151", lineHeight: 1.65 }}>
                    <div style={{ color: "#374151" }}>123 Main Street, Colombo 03</div>
                    <div style={{ color: "#374151" }}>Tel: 0112 345 678</div>
                    <div style={{ color: "#374151" }}>mano@manomobile.lk</div>
                  </div>
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Invoice No.</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", letterSpacing: "0.06em", marginTop: 1 }}>{receiptNo}</div>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Date</div>
                      <div style={{ fontSize: 9, color: "#374151", marginTop: 1 }}>{receiptDate}</div>
                    </div>
                  </div>
                </div>

                {/* Right — Customer Details */}
                <div style={{ flex: 1, padding: "14px 18px 12px" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 8 }}>Bill To</div>
                  {customer.name ? (
                    <div style={{ fontSize: 10, lineHeight: 1.7 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{customer.name}</div>
                      {customer.phone && <div style={{ color: "#374151" }}>Tel: {customer.phone}</div>}
                      {customer.whatsapp && customer.whatsapp !== customer.phone && <div style={{ color: "#374151" }}>WhatsApp: {customer.whatsapp}</div>}
                      {customer.nic && <div style={{ color: "#374151" }}>NIC: {customer.nic}</div>}
                      {customer.email && <div style={{ color: "#374151" }}>{customer.email}</div>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" as const }}>Walk-in customer</div>
                  )}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 3 }}>Payment Method</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: payMethod === "Credit" ? "#dc2626" : "#111827" }}>{payMethod}</div>
                  </div>
                </div>

              </div>

              {/* Row 2: Bill Summary */}
              <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #111827" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 8 }}>Items</div>
                <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 9.5 }}>
                  <colgroup>
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "16%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #111827" }}>
                      <th style={{ textAlign: "left" as const, padding: "4px 6px 5px 0", fontWeight: 700, color: "#111827" }}>Item</th>
                      <th style={{ textAlign: "left" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Brand</th>
                      <th style={{ textAlign: "center" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Qty</th>
                      <th style={{ textAlign: "right" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Unit Price</th>
                      <th style={{ textAlign: "right" as const, padding: "4px 6px 5px", fontWeight: 700, color: "#111827" }}>Amount</th>
                      <th style={{ textAlign: "center" as const, padding: "4px 0 5px 6px", fontWeight: 700, color: "#111827" }}>Warranty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((c) => {
                      const w = warranties[c.product.id];
                      return (
                        <tr key={c.product.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "5px 6px 5px 0", fontWeight: 600, color: "#111827" }}>{c.product.name}</td>
                          <td style={{ padding: "5px 6px", color: "#6b7280" }}>{c.product.brand}</td>
                          <td style={{ padding: "5px 6px", textAlign: "center" as const, color: "#374151" }}>{c.qty}</td>
                          <td style={{ padding: "5px 6px", textAlign: "right" as const, color: "#374151" }}>Rs.{c.product.sellingPrice.toLocaleString()}</td>
                          <td style={{ padding: "5px 6px", textAlign: "right" as const, fontWeight: 700, color: "#111827" }}>Rs.{(c.product.sellingPrice * c.qty).toLocaleString()}</td>
                          <td style={{ padding: "5px 0 5px 6px", textAlign: "center" as const, fontWeight: w && w !== "None" ? 700 : 400, color: w && w !== "None" ? "#111827" : "#9ca3af" }}>{w && w !== "None" ? w : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Totals block */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <div style={{ width: 230 }}>
                    {[
                      { label: "Subtotal", value: `Rs.${subtotal.toLocaleString()}`, show: true },
                      { label: "Discount", value: `− Rs.${discountAmt.toLocaleString()}`, show: discountAmt > 0 },
                      { label: "Received", value: `Rs.${payReceivedAmt.toLocaleString()}`, show: payReceivedAmt > 0 },
                      { label: "Change", value: `Rs.${Math.max(0, payReceivedAmt - total).toLocaleString()}`, show: payReceivedAmt > 0 },
                      { label: "Advance", value: `Rs.${advanceAmt.toLocaleString()}`, show: payMethod === "Credit" && advanceAmt > 0 },
                    ].filter(r => r.show).map(r => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 9.5, borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ color: "#6b7280" }}>{r.label}</span>
                        <span style={{ color: "#374151" }}>{r.value}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", marginTop: 2, borderTop: "1.5px solid #111827", fontSize: 11, fontWeight: 700, color: "#111827" }}>
                      <span>TOTAL</span>
                      <span>Rs.{total.toLocaleString()}</span>
                    </div>
                    {payMethod === "Credit" && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 9.5, fontWeight: 700, color: "#dc2626" }}>
                        <span>Balance Due</span>
                        <span>Rs.{Math.max(0, total - advanceAmt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Terms  |  QR + Barcode */}
              <div style={{ display: "flex" }}>

                {/* Terms */}
                <div style={{ flex: "0 0 52%", padding: "10px 18px 12px", borderRight: "1px solid #d1d5db" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 6 }}>Terms &amp; Conditions</div>
                  <div style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.75, fontFamily: "Arial, Helvetica, sans-serif" }}>
                    <div style={{ color: "#374151", textDecoration: "none" }}>• All sales are final. No refunds after 7 days.</div>
                    <div style={{ color: "#374151", textDecoration: "none" }}>• Warranty valid only with this receipt.</div>
                    <div style={{ color: "#374151", textDecoration: "none" }}>• Physical damage not covered under warranty.</div>
                    <div style={{ color: "#374151", textDecoration: "none" }}>• Keep this receipt for future reference.</div>
                    <div style={{ color: "#374151", textDecoration: "none" }}>• Queries: 0112 345 678</div>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb", fontSize: 8.5, color: "#6b7280" }}>
                    Issued by: <span style={{ fontWeight: 700, color: "#111827" }}>Admin</span>
                  </div>
                </div>

                {/* QR + Barcode */}
                <div style={{ flex: 1, padding: "10px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-evenly", gap: 6 }}>
                  <QRCodeSVG value={receiptNo} size={72} level="M" />
                  <Barcode value={receiptNo} width={1.2} height={58} fontSize={8} margin={0} background="#ffffff" lineColor="#111111" displayValue />
                </div>

              </div>

            </div>
          ) : (
            /* ── POS Thermal Receipt ── */
            <div ref={receiptRef} style={{ background: "#ffffff", borderRadius: "6px 6px 0 0", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
              <div style={{ padding: "18px 16px 14px", fontFamily: "'Courier New', monospace", color: "#1a1a1a", fontSize: 11 }}>

                {/* Store header */}
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 7, letterSpacing: "0.3em", color: "#bbb", fontFamily: "sans-serif", marginBottom: 4 }}>✦ ✦ ✦</div>
                  <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.1em", fontFamily: "'Arial Black', Arial, sans-serif", color: "#111" }}>MANO MOBILE</div>
                  <div style={{ fontSize: 8, letterSpacing: "0.25em", color: "#999", marginTop: 2, fontFamily: "sans-serif" }}>MANAGEMENT SUITE</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>{receiptDate}</div>
                </div>

                {/* Receipt number box */}
                <div style={{ margin: "10px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1, borderTop: "1px dashed #bbb" }} />
                    <span style={{ fontSize: 9, color: "#999", letterSpacing: "0.1em" }}>RECEIPT</span>
                    <div style={{ flex: 1, borderTop: "1px dashed #bbb" }} />
                  </div>
                  <div style={{ border: "1px dashed #444", borderRadius: 3, padding: "6px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>{receiptNo}</div>
                    <div style={{ borderTop: "1px dashed #ccc", marginTop: 5, paddingTop: 4, fontSize: 8, color: "#aaa", letterSpacing: "0.15em" }}>
                      — — — — — — — — — —
                    </div>
                  </div>
                </div>

                {/* Payment type */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ color: "#777" }}>Payment Type</span>
                  <span style={{ fontWeight: 700 }}>{payMethod}</span>
                </div>

                <div style={{ borderTop: "1px dashed #ccc", margin: "7px 0" }} />

                {/* Customer */}
                {customer.name && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ color: "#777" }}>Customer Name</span>
                      <span style={{ fontWeight: 700, maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</span>
                    </div>
                    {customer.phone && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                        <span style={{ color: "#777" }}>Phone</span>
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {customer.nic && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                        <span style={{ color: "#777" }}>NIC</span>
                        <span>{customer.nic}</span>
                      </div>
                    )}
                    <div style={{ borderTop: "1px dashed #ccc", margin: "7px 0" }} />
                  </>
                )}

                {/* Items */}
                {cart.map((c) => {
                  const w = warranties[c.product.id];
                  return (
                    <div key={c.product.id} style={{ marginBottom: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", gap: 6 }}>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.product.name} ×{c.qty}
                        </span>
                        <span style={{ flexShrink: 0 }}>Rs.{(c.product.sellingPrice * c.qty).toLocaleString()}</span>
                      </div>
                      {w && w !== "None" && (
                        <div style={{ fontSize: 9, color: "#888", paddingLeft: 2 }}>Warranty: {w}</div>
                      )}
                    </div>
                  );
                })}

                <div style={{ borderTop: "1px dashed #ccc", margin: "7px 0" }} />

                {/* Totals */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ color: "#777" }}>Amount</span>
                  <span>Rs.{subtotal.toLocaleString()}</span>
                </div>
                {discountAmt > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span style={{ color: "#777" }}>Discount</span>
                    <span>- Rs.{discountAmt.toLocaleString()}</span>
                  </div>
                )}
                {payReceivedAmt > 0 && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ color: "#777" }}>Received</span>
                      <span>Rs.{payReceivedAmt.toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ color: "#777" }}>Change</span>
                      <span>Rs.{Math.max(0, payReceivedAmt - total).toLocaleString()}</span>
                    </div>
                  </>
                )}
                {payMethod === "Credit" && advanceAmt > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span style={{ color: "#777" }}>Advance</span>
                    <span>Rs.{advanceAmt.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #555", marginTop: 4, paddingTop: 5, fontWeight: 700, fontSize: 12 }}>
                  <span>TOTAL</span>
                  <span>Rs.{total.toLocaleString()}</span>
                </div>
                {payMethod === "Credit" && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontWeight: 700 }}>
                    <span>Balance Due</span>
                    <span>Rs.{Math.max(0, total - advanceAmt).toLocaleString()}</span>
                  </div>
                )}

                <div style={{ borderTop: "1px dashed #ccc", margin: "7px 0" }} />

                {/* Operator */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ color: "#777" }}>Operator</span>
                  <span style={{ fontWeight: 600 }}>Admin</span>
                </div>

                {/* QR + Barcode */}
                <div style={{ borderTop: "1px dashed #ccc", marginTop: 8, paddingTop: 12, paddingBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flexShrink: 0 }}>
                    <QRCodeSVG value={receiptNo} size={78} level="M" />
                  </div>
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", overflow: "hidden" }}>
                    <Barcode value={receiptNo} width={1.3} height={60} fontSize={9} margin={0} background="#ffffff" lineColor="#111111" displayValue />
                  </div>
                </div>
              </div>

              {/* Wavy tear-off bottom */}
              <div style={{
                height: 10,
                backgroundImage: "radial-gradient(circle at 6px 0%, transparent 5px, white 5px)",
                backgroundSize: "12px 10px",
                backgroundRepeat: "repeat-x",
                backgroundPosition: "0 0",
              }} />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Step 3: Complete Sale ────────────────────────────────────────────────────

function Step3({ cart, customer, payMethod, discount, onNewSale }: {
  cart: CartItem[];
  customer: CustomerInfo;
  payMethod: string;
  discount: string;
  onNewSale: () => void;
}) {
  const subtotal = cart.reduce((s, c) => s + c.product.sellingPrice * c.qty, 0);
  const discountAmt = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);

  const receiptNo = `ACC-${Date.now().toString().slice(-6)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20 }}>
      <div style={{ fontSize: 52 }}>✅</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Sale Completed!
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}>
          Receipt #{receiptNo} · {cart.reduce((s, c) => s + c.qty, 0)} item{cart.reduce((s, c) => s + c.qty, 0) !== 1 ? "s" : ""} sold
        </div>
      </div>

      <div style={{
        width: 340, background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ textAlign: "center", borderBottom: "1px dashed var(--border)", paddingBottom: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Mano Mobile</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3 }}>Accessories Sale Receipt</div>
        </div>
        {cart.map((c) => (
          <div key={c.product.id} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{c.product.name} ×{c.qty}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {(c.product.sellingPrice * c.qty).toLocaleString()}</span>
          </div>
        ))}
        {discountAmt > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Discount</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>− Rs. {discountAmt.toLocaleString()}</span>
          </div>
        )}
        <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Total Paid ({payMethod})</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rs. {total.toLocaleString()}</span>
        </div>
        {customer.name && (
          <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Customer: {customer.name} · {customer.phone}</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onNewSale}
          style={{
            padding: "10px 28px", borderRadius: 8, border: "none",
            background: "var(--accent)", color: "var(--accent-fg)",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          + New Sale
        </button>
        <button
          style={{
            padding: "10px 20px", borderRadius: 8,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
          }}
        >
          🖨️ Print Receipt
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const INITIAL_CUSTOMER: CustomerInfo = { name: "", phone: "", whatsapp: "", email: "", nic: "" };

export default function AccessorySales() {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>(INITIAL_CUSTOMER);
  const [payMethod, setPayMethod] = useState("Cash");
  const [discount, setDiscount] = useState("");
  const [completed, setCompleted] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);

  const adjustStock = (id: number, delta: number) =>
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, stock: p.stock + delta } : p));

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === p.id);
      return existing
        ? prev.map((c) => c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c)
        : [...prev, { product: p, qty: 1 }];
    });
    adjustStock(p.id, -1);
  };

  const addMultipleToCart = (selected: Product[]) => {
    setCart((prev) => {
      let next = [...prev];
      for (const p of selected) {
        const idx = next.findIndex((c) => c.product.id === p.id);
        if (idx >= 0) next = next.map((c) => c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c);
        else next = [...next, { product: p, qty: 1 }];
      }
      return next;
    });
    setProducts((prev) =>
      prev.map((p) => {
        const count = selected.filter((s) => s.id === p.id).length;
        return count > 0 ? { ...p, stock: p.stock - count } : p;
      })
    );
  };

  const removeFromCart = (id: number) => {
    const item = cart.find((c) => c.product.id === id);
    if (item) adjustStock(id, item.qty);
    setCart((prev) => prev.filter((c) => c.product.id !== id));
  };

  const changeQty = (id: number, qty: number) => {
    const item = cart.find((c) => c.product.id === id);
    if (item) adjustStock(id, item.qty - qty);
    setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, qty } : c));
  };

  const updateCustomer = (d: Partial<CustomerInfo>) => setCustomer((prev) => ({ ...prev, ...d }));

  const canProceed = () => {
    if (step === 1) return cart.length > 0 && customer.name.trim() && customer.phone.trim() && payMethod;
    return true;
  };

  const handleNewSale = () => {
    setCart([]);
    setProducts(INITIAL_PRODUCTS);
    setCustomer(INITIAL_CUSTOMER);
    setPayMethod("Cash");
    setDiscount("");
    setStep(1);
    setCompleted(false);
  };

  if (completed) {
    return (
      <Step3
        cart={cart}
        customer={customer}
        payMethod={payMethod}
        discount={discount}
        onNewSale={handleNewSale}
      />
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", flex: 1, minHeight: 0,
      background: "var(--bg-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {/* Step indicator */}
      <div style={{ padding: "16px 28px 8px", flexShrink: 0 }}>
        <StepIndicator current={step} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "0 28px", minHeight: 0, display: "flex", flexDirection: "column" }}>
        {step === 1 && (
          <Step1
            products={products}
            cart={cart}
            onAdd={addToCart}
            onRemove={removeFromCart}
            onQtyChange={changeQty}
            customer={customer}
            onCustomerChange={updateCustomer}
            payMethod={payMethod}
            onPayMethod={setPayMethod}
            discount={discount}
            onDiscount={setDiscount}
            onOpenSearch={() => setShowSearchPopup(true)}
          />
        )}
        {step === 2 && (
          <Step2
            cart={cart}
            customer={customer}
            onCustomerChange={updateCustomer}
            payMethod={payMethod}
            onPayMethod={setPayMethod}
            discount={discount}
            onDiscount={setDiscount}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "14px 28px", borderTop: "1px solid var(--border)",
        background: "var(--bg-card)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          style={{
            padding: "9px 22px", borderRadius: 8, border: "1px solid var(--border)",
            background: "transparent",
            color: step === 1 ? "var(--border)" : "var(--text-secondary)",
            cursor: step === 1 ? "not-allowed" : "pointer",
            fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
          }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              width: s === step ? 20 : 6, height: 6, borderRadius: 3,
              background: s <= step ? "var(--accent)" : "var(--border)",
              transition: "all 0.2s",
            }} />
          ))}
        </div>

        {step < 2 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            style={{
              padding: "9px 22px", borderRadius: 8, border: "none",
              background: canProceed() ? "var(--accent)" : "var(--border)",
              color: canProceed() ? "var(--accent-fg)" : "var(--text-secondary)",
              cursor: canProceed() ? "pointer" : "not-allowed",
              fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
            }}
          >
            Next Step →
          </button>
        ) : (
          <button
            onClick={() => setCompleted(true)}
            style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "var(--accent-fg)",
              cursor: "pointer", fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
            }}
          >
            ✓ Complete Sale
          </button>
        )}
      </div>

      {showSearchPopup && (
        <SearchPopup
          products={products}
          cart={cart}
          onAddMultiple={addMultipleToCart}
          onClose={() => setShowSearchPopup(false)}
        />
      )}
    </div>
  );
}
