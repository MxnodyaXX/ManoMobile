"use client";

import { useState, useMemo, useRef, useEffect, useLayoutEffect, createElement } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { createPortal } from "react-dom";
import { Search, Grid3X3, List, Plus, Minus, Trash2, Eye, EyeOff, X } from "lucide-react";
import CreditCustomerPicker, { type POSCreditCustomer } from "./CreditCustomerPicker";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { fetchNextInvoiceNo } from "@/lib/sales/invoiceNo";
import InvoiceNoBadge from "@/cashier/components/sales/InvoiceNoBadge";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import { matchScannedAccessory } from "@/lib/inventory/accessoryScan";
import { useToast } from "@/lib/ui/toast";
import AccessoryScanModal from "./AccessoryScanModal";
import { categoryIcon } from "@/web/ui";
import AccessoryInvoicePrintable, { ACCESSORY_INVOICE_PAGE_CSS, type AccessoryInvoiceLine } from "./AccessoryInvoicePrintable";
import { printInvoiceDocument, usePersistInvoiceDocument } from "@/lib/sales/invoiceDoc";
import { useAuth } from "@/lib/auth/AuthContext";
import { warrantyLabel } from "./QuickSaleModal";
import { docDate } from "@/lib/docDate";

// ─── Types ────────────────────────────────────────────────────────────────────

// The catalogue this screen sells from — see AccessoriesContext for why it's
// no longer a local, disconnected product list. Kept as a local alias so the
// rest of this file (already written against "Product") doesn't need renaming.
type Product = AccessoryProduct;

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

/** Warranty choices at the counter, and the days each is stored as on the sale
 *  line (what the Warranty Center reads). */
const WARRANTY_OPTIONS: { label: string; days: number }[] = [
  { label: "None", days: 0 },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "6 Months", days: 180 },
  { label: "1 Year", days: 365 },
  { label: "2 Years", days: 730 },
];
const warrantyDaysOf = (label: string | undefined) => WARRANTY_OPTIONS.find(w => w.label === label)?.days ?? 0;

const invoiceLines = (cart: CartItem[], warranties: Record<number, string>): AccessoryInvoiceLine[] =>
  cart.map(c => ({
    productId: c.product.id, name: c.product.name, code: c.product.code, brand: c.product.brand,
    category: c.product.category, qty: c.qty, unitPrice: c.product.sellingPrice,
    warranty: warranties[c.product.id] || "None",
  }));

const invoiceDate = (d: Date) => docDate(d);

/** An A5 sheet (210mm) zoomed to whatever width its box has — the preview of
 *  the invoice that prints, not a separate mock of it. */
function FitToWidth({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.4);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const sheetPx = 210 * (96 / 25.4);
    const fit = () => setZoom(Math.max(0.2, box.clientWidth / sheetPx));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={boxRef} style={{ width: "100%" }}>
      <div style={{ zoom, boxShadow: "0 4px 24px rgba(0,0,0,0.18)", width: "fit-content" }}>{children}</div>
    </div>
  );
}

/** Everything Step 3 prints, frozen the moment the sale went through. */
interface CompletedAccessorySale {
  invoiceNo: string;
  createdAt: string;
  cart: CartItem[];
  customer: CustomerInfo;
  payMethod: string;
  discount: number;
  received: number;
  warranties: Record<number, string>;
  cashier: string;
}

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
  const [filterSubcategory, setFilterSubcategory] = useState("");
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
  // Narrowed to whichever type is picked, same cascade as the product form.
  const subcategories = [...new Set(
    products.filter((p) => !filterType || p.category === filterType).map((p) => p.subcategory).filter(Boolean)
  )];
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
    if (filterSubcategory && p.subcategory !== filterSubcategory) return false;
    if (filterBrand && p.brand !== filterBrand) return false;
    if (filterName && !p.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterSupplier && p.supplier !== filterSupplier) return false;
    if (p.sellingPrice < priceMin || p.sellingPrice > priceMax) return false;
    return true;
  });
  if (sortPrice === "asc")  filtered = [...filtered].sort((a, b) => a.sellingPrice - b.sellingPrice);
  if (sortPrice === "desc") filtered = [...filtered].sort((a, b) => b.sellingPrice - a.sellingPrice);
  if (sortInsight) filtered = [...filtered].sort((a, b) => (a.insight ?? "").localeCompare(b.insight ?? ""));

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
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setFilterSubcategory(""); }} style={selStyle}>
            <option value="">All Types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={filterSubcategory} onChange={(e) => setFilterSubcategory(e.target.value)} style={selStyle}>
            <option value="">All Subcategories</option>
            {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
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
          {(filterType || filterSubcategory || filterBrand || filterName || filterSupplier || sortPrice || sortInsight || priceMin > 0 || priceMax < MAX_PRICE) && (
            <button
              onClick={() => { setFilterType(""); setFilterSubcategory(""); setFilterBrand(""); setFilterName(""); setFilterSupplier(""); setSortPrice(""); setSortInsight(false); setPriceMin(0); setPriceMax(MAX_PRICE); }}
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
                <th style={thStyle}>Subcategory</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Price</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Stock</th>
                <th style={thStyle}>Insight</th>
                <th style={{ ...thStyle, width: 80, textAlign: "center" }}>Select</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                    No products match the filters
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const selected = selectedIds.has(p.id);
                  const qty = cartQty(p.id);
                  // p.stock is already what's left after this cart's own
                  // reservation (see availableProducts) — 0 means nothing
                  // more of this product can be added, in cart or not.
                  const outOfStock = p.stock === 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => !outOfStock && toggleSelect(p.id)}
                      style={{
                        cursor: outOfStock ? "not-allowed" : "pointer",
                        opacity: outOfStock ? 0.5 : 1,
                        background: selected ? "rgba(var(--accent-rgb,99,102,241),0.06)" : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={outOfStock}
                          onChange={() => toggleSelect(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: outOfStock ? "not-allowed" : "pointer", accentColor: "var(--accent)" }}
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
                      <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: 12 }}>{p.subcategory || "—"}</td>
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
  onOpenSearch, onScan, scanFocusKey,
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
  /** A scanned or typed code from the SCAN box. */
  onScan: (code: string) => void;
  /** Bumped by the parent whenever the scan box should take focus back. */
  scanFocusKey: number;
}) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [barcodeVal, setBarcodeVal] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  // Keep the scan box focused so a hardware scanner types into it, rather
  // than into the page — where JobScanFab would take it for a repair ticket.
  // Not on mobile: focusing pops the on-screen keyboard over the list.
  useEffect(() => {
    if (!isMobile) scanRef.current?.focus();
  }, [scanFocusKey, isMobile]);

  const submitScan = () => {
    const code = barcodeVal.trim();
    setBarcodeVal("");
    if (code) onScan(code);
  };
  // Width of the bill/customer panel, dragged by the handle between the two
  // sides and remembered on this computer. The product list keeps at least
  // PRODUCTS_MIN so it can't be squeezed out of sight.
  const rowRef = useRef<HTMLDivElement>(null);
  const PANEL_DEFAULT = 350, PANEL_MIN = 300, PRODUCTS_MIN = 380;
  const [panelW, setPanelW] = useState<number>(() => {
    try { const v = Number(localStorage.getItem("mm-acc-panel-w")); return v >= PANEL_MIN ? v : PANEL_DEFAULT; }
    catch { return PANEL_DEFAULT; }
  });
  const [dragging, setDragging] = useState(false);
  const [handleHover, setHandleHover] = useState(false);
  const clampPanel = (w: number) => {
    const row = rowRef.current?.getBoundingClientRect().width ?? 1200;
    return Math.round(Math.max(PANEL_MIN, Math.min(w, row - PRODUCTS_MIN)));
  };
  const savePanelW = (w: number) => {
    const v = clampPanel(w);
    setPanelW(v);
    try { localStorage.setItem("mm-acc-panel-w", String(v)); } catch { /* private window */ }
  };
  const startPanelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (!row) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setDragging(true);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none"; // no text highlighting while dragging
    let last = panelW;
    const move = (ev: PointerEvent) => {
      last = clampPanel(row.getBoundingClientRect().right - ev.clientX);
      setPanelW(last);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      document.body.style.userSelect = prevSelect;
      setDragging(false);
      savePanelW(last);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  // Bill Summary as compact cards or one row per item — remembered here.
  const [billView, setBillView] = useState<"cards" | "rows">(() => {
    try { return localStorage.getItem("mm-acc-bill-view") === "rows" ? "rows" : "cards"; } catch { return "cards"; }
  });
  const setBillViewSaved = (v: "cards" | "rows") => {
    setBillView(v);
    try { localStorage.setItem("mm-acc-bill-view", v); } catch { /* private window */ }
  };

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [revealBuying, setRevealBuying] = useState<Record<number, boolean>>({});
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [sameAsPhone, setSameAsPhone] = useState(false);

  const MAX_TILES = 4;

  // Category filter: chips for a quick tap, dropdowns for when there are many.
  const [cat, setCat] = useState("");        // "" = all
  const [subcat, setSubcat] = useState("");  // "" = all within the category
  const [inStockOnly, setInStockOnly] = useState(false);

  /** Every category with how many products it has, biggest first. */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [products]);

  const subcategories = useMemo(() => {
    if (!cat) return [];
    const counts = new Map<string, number>();
    for (const p of products) if (p.category === cat && p.subcategory) counts.set(p.subcategory, (counts.get(p.subcategory) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, cat]);

  const pickCategory = (c: string) => { setCat(c); setSubcat(""); };

  const filtered = products.filter((p) => {
    if (cat && p.category !== cat) return false;
    if (subcat && p.subcategory !== subcat) return false;
    if (inStockOnly && p.stock <= 0) return false;
    const q = query.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.model.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
      || p.category.toLowerCase().includes(q) || p.subcategory.toLowerCase().includes(q)
      || p.code.toLowerCase().includes(q) || p.labelBarcode.includes(q) || p.barcodes.some(b => b.toLowerCase().includes(q));
  });
  const filtering = !!(cat || subcat || inStockOnly);

  // Enter in the name box: an exact code/barcode (a scan that landed here
  // instead of the SCAN box) goes to the cart; anything else just filters.
  const submitQuery = () => {
    const code = query.trim();
    if (code && matchScannedAccessory(products, code).length > 0) {
      setQuery("");
      onScan(code);
    }
  };

  const cartQty = (id: number) => cart.find((c) => c.product.id === id)?.qty ?? 0;

  const subtotal = cart.reduce((s, c) => s + c.product.sellingPrice * c.qty, 0);
  const discountAmt = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);

  const stockColor = (s: number) => s > 20 ? "#4ade80" : s > 5 ? "#f59e0b" : "#ef4444";

  return (
    <div ref={rowRef} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 0, flex: isMobile ? undefined : 1, minHeight: isMobile ? undefined : 0, minWidth: 0, maxWidth: "100%" }}>

      {/* ── Left: Search + Product List ── */}
      {/* minWidth 0: without it the column grows to fit the category chips and
          the whole page scrolls sideways — only the chip strip should. */}
      <div style={{ flex: isMobile ? undefined : 1, display: "flex", flexDirection: "column", gap: 10, minHeight: isMobile ? undefined : 0, minWidth: 0 }}>

        {/* Search bar row */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <input
            style={{ ...inputStyle, flex: isMobile ? "1 1 120px" : "0 0 180px" }}
            ref={scanRef}
            placeholder="SCAN Barcode"
            value={barcodeVal}
            onChange={(e) => setBarcodeVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitScan(); } }}
          />
          <input
            style={{ ...inputStyle, flex: 1, minWidth: isMobile ? "100%" : 200 }}
            placeholder="Enter Item Code or Name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitQuery(); } }}
          />
          <button
            onClick={() => (barcodeVal.trim() ? submitScan() : submitQuery())}
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

        {/* Filters: category chips (scroll sideways) + dropdowns for many */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: isMobile ? "wrap" : "nowrap", minWidth: 0, maxWidth: "100%" }}>
          <div className="mm-chip-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", overscrollBehaviorX: "contain", flex: isMobile ? "1 1 100%" : "1 1 0", minWidth: 0, maxWidth: "100%", paddingBottom: 2, scrollbarWidth: "thin" }}>
            {[["", products.length] as [string, number], ...categories].map(([c, n]) => {
              const on = cat === c;
              return (
                <button
                  key={c || "__all"}
                  onClick={() => pickCategory(c)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "6px 12px", borderRadius: 20,
                    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                    background: on ? "var(--accent)" : "var(--bg-card)", color: on ? "var(--accent-fg)" : "var(--text-secondary)",
                    fontSize: 12, fontWeight: on ? 700 : 500, fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap",
                    transition: "background 0.15s, color 0.15s, border-color 0.15s",
                  }}
                >
                  {c && createElement(categoryIcon(c), { size: 13, strokeWidth: 1.8 })}
                  {c || "All"}
                  <span style={{ fontSize: 10.5, opacity: 0.7 }}>{n}</span>
                </button>
              );
            })}
          </div>

          <select
            value={cat}
            onChange={(e) => pickCategory(e.target.value)}
            title="Category"
            style={{ ...inputStyle, flex: isMobile ? "1 1 140px" : "0 0 170px", padding: "8px 10px", cursor: "pointer" }}
          >
            <option value="">All categories</option>
            {categories.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
          </select>
          <select
            value={subcat}
            onChange={(e) => setSubcat(e.target.value)}
            disabled={!cat || subcategories.length === 0}
            title={!cat ? "Pick a category first" : "Subcategory"}
            style={{ ...inputStyle, flex: isMobile ? "1 1 140px" : "0 0 160px", padding: "8px 10px", cursor: !cat || subcategories.length === 0 ? "not-allowed" : "pointer", opacity: !cat || subcategories.length === 0 ? 0.55 : 1 }}
          >
            <option value="">{!cat ? "Subcategory" : subcategories.length ? "All subcategories" : "No subcategories"}</option>
            {subcategories.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} style={{ cursor: "pointer" }} />
            In stock
          </label>
          {filtering && (
            <button
              onClick={() => { pickCategory(""); setInStockOnly(false); }}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Product list */}
        <div style={{
          flex: isMobile ? undefined : 1,
          overflowY: isMobile ? "visible" : "auto",
          minHeight: isMobile ? undefined : 0,
          paddingRight: 4,
          ...(viewMode === "grid"
            ? { display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 8, alignContent: "flex-start" }
            : { display: "flex", flexDirection: "column", gap: 8 }),
        }}>
          {filtered.length === 0 && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              {filtering
                ? `Nothing${inStockOnly ? " in stock" : ""} in ${[cat, subcat].filter(Boolean).join(" · ") || "these filters"}${query.trim() ? ` matching "${query.trim()}"` : ""}`
                : "No products found"}
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
                    minHeight: 150, padding: "14px 16px", borderRadius: 10,
                    border: `1px solid ${inCart ? "var(--accent)" : "var(--border)"}`,
                    background: inCart ? "rgba(var(--accent-rgb,232,232,232),0.04)" : "var(--bg-card)",
                    display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8, boxSizing: "border-box", overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                    {/* What kind of item it is, at a glance */}
                    <div title={p.category} style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: "var(--bg-primary)", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)",
                    }}>
                      {createElement(categoryIcon(p.category), { size: 15, strokeWidth: 1.6 })}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      {p.category && (
                        <span style={{
                          display: "inline-block", marginTop: 4, maxWidth: "100%",
                          fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                          background: "var(--accent)", color: "var(--accent-fg)", letterSpacing: "0.04em", textTransform: "uppercase",
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "top",
                        }}>{[p.category, p.subcategory].filter(Boolean).join(" · ")}</span>
                      )}
                      {(p.brand || p.model) && (
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[p.brand, p.model].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
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
                          onClick={() => p.stock > 0 && onQtyChange(p.id, qty + 1)}
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
                {/* What kind of item it is, at a glance: a cable, earphones, a charger… */}
                <div title={p.category} style={{
                  width: 42, height: 42, borderRadius: 9, flexShrink: 0,
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)",
                }}>
                  {createElement(categoryIcon(p.category), { size: 18, strokeWidth: 1.6 })}
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                    <span style={{ fontSize: isMobile ? 13 : 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{p.name}</span>
                    {p.category && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "var(--accent)", color: "var(--accent-fg)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {[p.category, p.subcategory].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  {/* Model and brand only when known — no empty "| |". */}
                  {(p.model || p.brand) && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[p.brand, p.model].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.supplier}
                  </div>
                  {!isMobile && p.insight?.trim() && (
                    <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3, fontStyle: "italic" }}>
                      💡 {p.insight}
                    </div>
                  )}
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
                        onClick={() => p.stock > 0 && onQtyChange(p.id, qty + 1)}
                        disabled={p.stock <= 0}
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

      {/* ── Drag handle: pull left for a wider bill/customer panel ── */}
      {!isMobile && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the bill and customer panel"
          title="Drag to resize · double-click to reset"
          onPointerDown={startPanelDrag}
          onDoubleClick={() => savePanelW(PANEL_DEFAULT)}
          onPointerEnter={() => setHandleHover(true)}
          onPointerLeave={() => setHandleHover(false)}
          style={{ flex: "0 0 14px", alignSelf: "stretch", cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
        >
          <div style={{
            width: 4, borderRadius: 4,
            height: dragging || handleHover ? 72 : 56,
            background: dragging || handleHover ? "var(--accent)" : "var(--border)",
            transition: "background 0.15s, height 0.15s",
          }} />
        </div>
      )}

      {/* ── Right panel ── */}
      <div style={{ width: isMobile ? "100%" : panelW, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: isMobile ? "visible" : "auto", paddingRight: 2, paddingTop: isMobile ? 12 : 0 }}>

        {/* Bill Summary */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Bill Summary{cart.length > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> · {cart.reduce((s, c) => s + c.qty, 0)} item{cart.reduce((s, c) => s + c.qty, 0) === 1 ? "" : "s"}</span>}
            </div>
            {/* Cards (compact tiles) or rows (one line per item, editable) */}
            <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 7, border: "1px solid var(--border)" }}>
              {([["cards", Grid3X3, "Cards"], ["rows", List, "Rows"]] as const).map(([v, Icon, label]) => (
                <button
                  key={v}
                  onClick={() => setBillViewSaved(v)}
                  title={label}
                  aria-label={`Show bill as ${label.toLowerCase()}`}
                  style={{
                    width: 26, height: 22, borderRadius: 5, border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: billView === v ? "var(--accent)" : "transparent",
                    color: billView === v ? "var(--accent-fg)" : "var(--text-muted)",
                  }}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>

          {/* Rows: every item on its own line, with quantity and total */}
          {billView === "rows" && (
            cart.length === 0 ? (
              <div style={{ padding: "14px 10px", borderRadius: 8, border: "1px dashed var(--border)", textAlign: "center", fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                No items yet — scan or add a product.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto", paddingRight: 2 }}>
                {cart.map((c) => {
                  const left = products.find(p => p.id === c.product.id)?.stock ?? 0;
                  return (
                    <div key={c.product.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9,
                      background: "var(--bg-primary)", border: "1px solid var(--border)",
                    }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                        {createElement(categoryIcon(c.product.category), { size: 14, strokeWidth: 1.7 })}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.product.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[c.product.category, c.product.subcategory].filter(Boolean).join(" · ")}{c.product.category ? " · " : ""}Rs. {c.product.sellingPrice.toLocaleString()} each
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => c.qty === 1 ? onRemove(c.product.id) : onQtyChange(c.product.id, c.qty - 1)}
                          aria-label="One less"
                          style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}
                        ><Minus size={11} /></button>
                        <span style={{ minWidth: 18, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{c.qty}</span>
                        <button
                          onClick={() => left > 0 && onQtyChange(c.product.id, c.qty + 1)}
                          disabled={left <= 0}
                          aria-label="One more"
                          title={left <= 0 ? "No more in stock" : undefined}
                          style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid var(--border)", background: "transparent", cursor: left > 0 ? "pointer" : "not-allowed", opacity: left > 0 ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}
                        ><Plus size={11} /></button>
                      </div>
                      <div style={{ minWidth: 64, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>
                        Rs. {(c.product.sellingPrice * c.qty).toLocaleString()}
                      </div>
                      <button
                        onClick={() => onRemove(c.product.id)}
                        aria-label={`Remove ${c.product.name}`}
                        style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}
                      ><Trash2 size={12} /></button>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Cards: the compact tiles */}
          {billView === "cards" && (
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
          )}

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
  warranties, setWarranties, payReceived, setPayReceived,
}: {
  cart: CartItem[];
  customer: CustomerInfo;
  onCustomerChange: (d: Partial<CustomerInfo>) => void;
  payMethod: string;
  onPayMethod: (m: string) => void;
  discount: string;
  onDiscount: (v: string) => void;
  // Held by the parent: the completed invoice prints them, and the sale lines
  // store the warranty, after this step has unmounted.
  warranties: Record<number, string>;
  setWarranties: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  payReceived: string;
  setPayReceived: (v: string) => void;
}) {
  const [advance, setAdvance]         = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [printFormat, setPrintFormat] = useState<"POS" | "A5">("POS");
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<POSCreditCustomer | null>(null);
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
                    {WARRANTY_OPTIONS.map(({ label: w }) => (
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

          {/* Credit Customer Picker */}
          {payMethod === "Credit" && (
            <CreditCustomerPicker
              selected={selectedCreditCustomer}
              onSelect={(c) => {
                setSelectedCreditCustomer(c);
                if (c) onPayMethod("Credit");
              }}
            />
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
            <InvoiceNoBadge />
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
              disabled={printFormat === "A5"}
              title={printFormat === "A5" ? "The A5 invoice prints after Complete Sale, with its invoice number" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 7, fontSize: 11,
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
                border: "1px solid var(--accent)", background: "var(--accent)",
                color: "var(--accent-fg)", cursor: printFormat === "A5" ? "not-allowed" : "pointer",
                opacity: printFormat === "A5" ? 0.45 : 1,
              }}
            >
              🖨️ Print
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>

          {printFormat === "A5" ? (
            /* ── A5 Invoice — the same document Complete Sale prints ── */
            <>
              <FitToWidth>
                <AccessoryInvoicePrintable
                  invoiceNo="INV-PREVIEW"
                  createdAt={invoiceDate(new Date())}
                  customer={customer}
                  lines={invoiceLines(cart, warranties)}
                  discount={discountAmt}
                  payMethod={payMethod}
                  received={payMethod === "Cash" ? payReceivedAmt : 0}
                />
              </FitToWidth>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "center", margin: "8px 0 12px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Gets its invoice number and prints after Complete Sale.
              </p>
            </>
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

function Step3({ sale, onNewSale }: {
  sale: CompletedAccessorySale;
  onNewSale: () => void;
}) {
  const { invoiceNo, cart, customer, payMethod } = sale;
  const invoiceRef = useRef<HTMLDivElement>(null);
  const subtotal = cart.reduce((s, c) => s + c.product.sellingPrice * c.qty, 0);
  const total = Math.max(0, subtotal - sale.discount);
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);

  // The invoice as printed goes into history, same as a repair invoice — Sales
  // History reprints this, not a re-render.
  usePersistInvoiceDocument(invoiceNo, invoiceRef, ACCESSORY_INVOICE_PAGE_CSS);

  const handlePrint = () => {
    const el = invoiceRef.current;
    if (!el || el.dataset.templatePending) return;
    printInvoiceDocument({ invoiceNo, html: el.outerHTML, pageCss: ACCESSORY_INVOICE_PAGE_CSS, createdAt: sale.createdAt });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 18, padding: "24px 28px", overflowY: "auto", minHeight: 0 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4 }}>
          Sale Completed!
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}>
          Invoice #{invoiceNo} · {itemCount} item{itemCount !== 1 ? "s" : ""} sold · Rs. {total.toLocaleString()} ({payMethod})
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handlePrint}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            background: "var(--accent)", color: "var(--accent-fg)",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          🖨️ Print Invoice (A5)
        </button>
        <button
          onClick={onNewSale}
          style={{
            padding: "10px 24px", borderRadius: 8,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
          }}
        >
          + New Sale
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: 820 }}>
        <FitToWidth>
          <AccessoryInvoicePrintable
            ref={invoiceRef}
            invoiceNo={invoiceNo}
            createdAt={sale.createdAt}
            customer={customer}
            lines={invoiceLines(cart, sale.warranties)}
            discount={sale.discount}
            payMethod={payMethod}
            received={sale.received}
            cashier={sale.cashier}
          />
        </FitToWidth>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const INITIAL_CUSTOMER: CustomerInfo = { name: "", phone: "", whatsapp: "", email: "", nic: "" };

export default function AccessorySales() {
  const { addEntry } = useCashRegister();
  const { addSale } = useSales();
  const { profile } = useAuth();
  const { products, sellStock, linkBarcode, loading: productsLoading, configured: productsConfigured } = useAccessories();
  const toast = useToast();
  const [scanResolve, setScanResolve] = useState<{ mode: "pick" | "link"; barcode: string; matches: Product[] } | null>(null);
  const [scanFocusKey, setScanFocusKey] = useState(0);
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>(INITIAL_CUSTOMER);
  const [payMethod, setPayMethod] = useState("Cash");
  const [discount, setDiscount] = useState("");
  const [warranties, setWarranties] = useState<Record<number, string>>({});
  const [payReceived, setPayReceived] = useState("");
  const [completed, setCompleted] = useState<CompletedAccessorySale | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showSearchPopup, setShowSearchPopup] = useState(false);

  // Stock isn't touched locally at all any more — it's only ever really
  // deducted at checkout, atomically, via sellStock(). What the cart needs
  // in the meantime is "how many can still be added", which is just the
  // catalogue's real stock minus whatever this cart is already holding —
  // so the products list handed to the pickers below has that baked in,
  // and every add/remove/qty handler is a plain cart edit.
  const availableProducts = useMemo(() => {
    const reserved = new Map<number, number>();
    for (const c of cart) reserved.set(c.product.id, (reserved.get(c.product.id) ?? 0) + c.qty);
    return products.map((p) => ({ ...p, stock: Math.max(0, p.stock - (reserved.get(p.id) ?? 0)) }));
  }, [products, cart]);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === p.id);
      return existing
        ? prev.map((c) => c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c)
        : [...prev, { product: p, qty: 1 }];
    });
  };

  /** Adds one unit if any is left; says so if not, rather than doing nothing. */
  const addScanned = (p: Product) => {
    if (p.stock <= 0) toast.error(`${p.name} is out of stock`);
    else addToCart(p);
  };

  /**
   * A scan of the shop's own label code or a packaging barcode. One match adds
   * it; a barcode shared across products asks which; an unknown one offers to
   * link it, so the box scans straight through next time.
   */
  const handleScan = (code: string) => {
    const matches = matchScannedAccessory(availableProducts, code);
    // Several batches of one item share the box barcode; once the old batch
    // has sold out there's nothing to ask about.
    const inStock = matches.filter(p => p.stock > 0);
    if (matches.length === 1) { addScanned(matches[0]); setScanFocusKey(k => k + 1); }
    else if (inStock.length === 1) { addScanned(inStock[0]); setScanFocusKey(k => k + 1); }
    else if (matches.length > 1) setScanResolve({ mode: "pick", barcode: code, matches });
    else setScanResolve({ mode: "link", barcode: code, matches: [] });
  };

  const closeScanResolve = () => {
    setScanResolve(null);
    setScanFocusKey(k => k + 1);
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
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((c) => c.product.id !== id));
  };

  const changeQty = (id: number, qty: number) => {
    setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, qty } : c));
  };

  const updateCustomer = (d: Partial<CustomerInfo>) => setCustomer((prev) => ({ ...prev, ...d }));

  const canProceed = () => {
    if (step === 1) return cart.length > 0 && customer.name.trim() && customer.phone.trim() && payMethod;
    return true;
  };

  const handleNewSale = () => {
    setCart([]);
    setCustomer(INITIAL_CUSTOMER);
    setPayMethod("Cash");
    setDiscount("");
    setWarranties({});
    setPayReceived("");
    setStep(1);
    setCompleted(null);
  };

  if (completed) {
    return <Step3 sale={completed} onNewSale={handleNewSale} />;
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, maxWidth: "100%",
      background: "var(--bg-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {/* Step indicator */}
      <div style={{ padding: "16px 28px 8px", flexShrink: 0 }}>
        <StepIndicator current={step} />
      </div>

      {!productsConfigured && (
        <div style={{ margin: "0 28px 8px", padding: "10px 14px", borderRadius: 9, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)", fontSize: 12.5, color: "var(--text-secondary)" }}>
          Connect Supabase to sell accessories — the catalogue is empty and nothing here will be saved.
        </div>
      )}
      {productsConfigured && productsLoading && products.length === 0 && (
        <div style={{ margin: "0 28px 8px", fontSize: 12.5, color: "var(--text-muted)" }}>Loading catalogue…</div>
      )}
      {checkoutError && (
        <div style={{ margin: "0 28px 8px", padding: "10px 14px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", fontSize: 12.5, color: "#dc2626" }}>
          {checkoutError}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, padding: "0 28px", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {step === 1 && (
          <Step1
            products={availableProducts}
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
            onScan={handleScan}
            scanFocusKey={scanFocusKey}
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
            warranties={warranties}
            setWarranties={setWarranties}
            payReceived={payReceived}
            setPayReceived={setPayReceived}
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
            onClick={async () => {
              if (invoicing) return;
              setInvoicing(true);
              setCheckoutError(null);
              try {
                // Deducts stock for the whole cart in one transaction first —
                // if anything ran out since it was added (another till sold
                // it in the meantime), this throws and nothing below runs:
                // no invoice for stock that doesn't exist.
                const saleKey = crypto.randomUUID();
                await sellStock(cart.map(c => ({ id: c.product.id, qty: c.qty })), saleKey);
                const invoiceNo = await fetchNextInvoiceNo();
                const subtotal = cart.reduce((s, c) => s + c.product.sellingPrice * c.qty, 0);
                const discountAmt = parseFloat(discount) || 0;
                const total = Math.max(0, subtotal - discountAmt);
                const cashier = profile?.fullName ?? "";
                if (payMethod === "Cash") {
                  addEntry("in", `Cash Sale — Accessories`, total);
                }
                addSale({
                  invoiceNo,
                  date: new Date().toISOString().slice(0, 10),
                  customer: customer.name || "Walk-in",
                  category: "Accessories",
                  items: cart.map(c => `${c.product.name} ×${c.qty}`).join(", ") || "Accessory Sale",
                  subtotal,
                  discountAmount: discountAmt,
                  total,
                  paymentMethod: payMethod as "Cash" | "Card" | "Credit",
                  status: "Paid",
                  cashier: cashier || undefined,
                }, {
                  customerPhone: customer.phone.trim() || null,
                  // So a later void can restock exactly what this sale sold —
                  // see void_sale() in the migration.
                  lineItems: cart.map(c => ({ type: "accessory" as const, id: c.product.id, qty: c.qty })),
                  // The invoice's lines, with the warranty given on each — what
                  // the Warranty Center looks the sale up by.
                  saleItems: cart.map(c => {
                    const w = warranties[c.product.id] || "None";
                    return {
                      kind: "accessory" as const,
                      referenceId: c.product.id,
                      description: c.product.name,
                      qty: c.qty,
                      unitPrice: c.product.sellingPrice,
                      lineTotal: c.product.sellingPrice * c.qty,
                      warrantyDays: warrantyDaysOf(w),
                      warrantyLabel: warrantyLabel(warrantyDaysOf(w)),
                    };
                  }),
                  saleKey,
                });
                setCompleted({
                  invoiceNo,
                  createdAt: invoiceDate(new Date()),
                  cart,
                  customer,
                  payMethod,
                  discount: discountAmt,
                  received: payMethod === "Cash" ? (parseFloat(payReceived) || 0) : 0,
                  warranties,
                  cashier,
                });
              } catch (e) {
                setCheckoutError(e instanceof Error ? e.message : String(e));
              } finally {
                setInvoicing(false);
              }
            }}
            disabled={invoicing}
            style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "var(--accent-fg)",
              cursor: invoicing ? "not-allowed" : "pointer", fontSize: 13, opacity: invoicing ? 0.6 : 1,
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
            }}
          >
            {invoicing ? "Processing…" : "✓ Complete Sale"}
          </button>
        )}
      </div>

      {showSearchPopup && (
        <SearchPopup
          products={availableProducts}
          cart={cart}
          onAddMultiple={addMultipleToCart}
          onClose={() => setShowSearchPopup(false)}
        />
      )}

      {scanResolve && (
        <AccessoryScanModal
          mode={scanResolve.mode}
          barcode={scanResolve.barcode}
          products={scanResolve.mode === "pick" ? scanResolve.matches : availableProducts}
          onChoose={(p) => { addScanned(p); closeScanResolve(); }}
          onLink={async (p) => {
            await linkBarcode(p.id, scanResolve.barcode);
            toast.success("Barcode linked", `${scanResolve.barcode} → ${p.name}`);
            addScanned(p);
            closeScanResolve();
          }}
          onClose={closeScanResolve}
        />
      )}
    </div>
  );
}
