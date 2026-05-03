"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, Trash2, Plus, Minus, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Phone {
  id: number;
  imei: string;
  name: string;
  brand: string;
  supplier: string;
  storage: string;
  color: string;
  buyingPrice: number;
  boughtDate: string;
  minSellingPrice: number;
  suggestedPrice: number;
}

interface PhoneCartItem {
  phone: Phone;
  sellingPrice: string;
  discount: string;
}

interface AccessoryCartItem {
  id: number;
  code: string;
  name: string;
  model: string;
  brand: string;
  price: number;
  discount: string;
  qty: number;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const PHONE_INVENTORY: Phone[] = [
  { id: 1, imei: "352000001234567", name: "iPhone 15 Pro Max",        brand: "Apple",   supplier: "Apple Official LK",   storage: "256GB", color: "Black Titanium", buyingPrice: 285000, boughtDate: "2024-12-10", minSellingPrice: 295000, suggestedPrice: 312000 },
  { id: 2, imei: "860000009876543", name: "Samsung Galaxy S25 Ultra", brand: "Samsung", supplier: "Samsung Official LK", storage: "512GB", color: "Phantom Black",  buyingPrice: 235000, boughtDate: "2025-01-15", minSellingPrice: 248000, suggestedPrice: 262000 },
  { id: 3, imei: "490154203237518", name: "Xiaomi 14 Pro",            brand: "Xiaomi",  supplier: "Digital Zone",        storage: "512GB", color: "White",          buyingPrice: 145000, boughtDate: "2025-02-01", minSellingPrice: 155000, suggestedPrice: 168000 },
  { id: 4, imei: "353170062581234", name: "OnePlus 12",               brand: "OnePlus", supplier: "TechSupply Co.",      storage: "256GB", color: "Silky Black",    buyingPrice: 132000, boughtDate: "2025-02-20", minSellingPrice: 140000, suggestedPrice: 152000 },
  { id: 5, imei: "867400023456789", name: "iPhone 16",                brand: "Apple",   supplier: "Apple Official LK",   storage: "128GB", color: "Ultramarine",    buyingPrice: 210000, boughtDate: "2025-03-05", minSellingPrice: 220000, suggestedPrice: 235000 },
  { id: 6, imei: "359304050987654", name: "Samsung Galaxy A55",       brand: "Samsung", supplier: "Mobile Parts Ltd.",   storage: "128GB", color: "Awesome Navy",   buyingPrice:  82000, boughtDate: "2025-01-28", minSellingPrice:  88000, suggestedPrice:  95000 },
];

const ACCESSORIES = [
  { id: 1, code: "ACC001", name: "Tempered Glass",  model: "Universal 6.5\"",   brand: "OG Shield", price: 350  },
  { id: 2, code: "ACC002", name: "Phone Case",       model: "iPhone 15 Pro Max", brand: "Spigen",    price: 1200 },
  { id: 3, code: "ACC003", name: "USB-C Cable 1m",  model: "65W Fast Charge",   brand: "Anker",     price: 850  },
  { id: 4, code: "ACC004", name: "Power Bank",       model: "10000mAh PD",       brand: "Romoss",    price: 3500 },
  { id: 5, code: "ACC005", name: "TWS Earbuds",      model: "Pro X1 Active",     brand: "Haylou",    price: 2800 },
  { id: 6, code: "ACC006", name: "Wireless Charger", model: "15W Qi2",           brand: "Baseus",    price: 2200 },
];

interface CreditCustomer {
  id: number;
  name: string;
  phone: string;
  nic: string;
  creditLimit: number;
  usedCredit: number;
}

const CREDIT_CUSTOMERS: CreditCustomer[] = [
  { id: 1, name: "Kasun Perera",   phone: "0771234567", nic: "199012345678", creditLimit: 50000,  usedCredit: 12000 },
  { id: 2, name: "Nimal Silva",    phone: "0712345678", nic: "198534567890", creditLimit: 100000, usedCredit: 45000 },
  { id: 3, name: "Amal Fernando",  phone: "0751234567", nic: "200134567890", creditLimit: 75000,  usedCredit: 0     },
  { id: 4, name: "Sunil Bandara",  phone: "0761234567", nic: "197845678901", creditLimit: 150000, usedCredit: 80000 },
  { id: 5, name: "Dilani Jayawardena", phone: "0779876543", nic: "199567890123", creditLimit: 60000, usedCredit: 10000 },
];

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text-primary)", fontSize: 13,
  fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  transition: "border-color 0.15s", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
  textTransform: "uppercase" as const, color: "var(--text-muted)",
  display: "block", marginBottom: 4,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const sectionHead: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
  textTransform: "uppercase" as const, color: "var(--text-secondary)",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const fmt = (n: number) => `Rs. ${n.toLocaleString("en-LK")}`;

const searchBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 8, border: "none", flexShrink: 0,
  background: "var(--accent)", color: "var(--accent-fg)",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

// ─── Card Payment Modal ───────────────────────────────────────────────────────

function CardPaymentModal({
  invoiceNo, phoneCart, accessoryCart, customer,
  subtotal, overallDiscount, total,
  onConfirm, onCancel,
}: {
  invoiceNo: string;
  phoneCart: PhoneCartItem[];
  accessoryCart: AccessoryCartItem[];
  customer: { name: string; phone: string; whatsapp: string; email: string; nic: string };
  subtotal: number;
  overallDiscount: number;
  total: number;
  onConfirm: (ref: string) => void;
  onCancel: () => void;
}) {
  const [ref, setRef] = useState("");
  const today = new Date().toLocaleDateString("en-LK", { year: "numeric", month: "long", day: "numeric" });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520,
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
              Card Payment
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.02em" }}>
              {invoiceNo}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3 }}>
              {today}
            </div>
          </div>
          <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Items */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", maxHeight: 220, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}>
            Purchased Items
          </div>
          {phoneCart.map(pc => (
            <div key={pc.phone.imei} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{pc.phone.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{pc.phone.imei}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>
                {fmt(Math.max(0, (parseFloat(pc.sellingPrice) || 0) - (parseFloat(pc.discount) || 0)))}
              </div>
            </div>
          ))}
          {accessoryCart.map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {item.name} <span style={{ color: "var(--text-muted)" }}>×{item.qty}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 }}>
                {fmt(item.price * item.qty - (parseFloat(item.discount) || 0))}
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
              <span>Subtotal</span><span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt(subtotal)}</span>
            </div>
            {overallDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
                <span>Discount</span><span style={{ color: "#ef4444", fontWeight: 600 }}>− {fmt(overallDiscount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}>
              <span style={{ color: "var(--text-primary)" }}>Total</span>
              <span style={{ color: "var(--accent)" }}>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Customer */}
        {(customer.name || customer.phone) && (
          <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>
              Customer
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {customer.name  && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{customer.name}</span>}
              {customer.phone && <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{customer.phone}</span>}
              {customer.nic   && <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>NIC: {customer.nic}</span>}
            </div>
          </div>
        )}

        {/* Reference input */}
        <div style={{ padding: "16px 22px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "block", marginBottom: 8 }}>
            Card Transaction Reference No. *
          </label>
          <input
            autoFocus
            value={ref}
            onChange={e => setRef(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ref.trim() && onConfirm(ref.trim())}
            placeholder="Enter reference number from terminal..."
            style={{
              width: "100%", padding: "10px 13px", borderRadius: 9,
              border: `1px solid ${ref.trim() ? "var(--border-active)" : "var(--border)"}`,
              background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14,
              fontFamily: "monospace", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}>
            Transaction will not be marked complete until a reference number is entered.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 22px 18px", display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={() => ref.trim() && onConfirm(ref.trim())}
            disabled={!ref.trim()}
            style={{
              flex: 2, padding: "10px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700,
              cursor: ref.trim() ? "pointer" : "not-allowed",
              background: ref.trim() ? "var(--accent)" : "var(--border)",
              color: ref.trim() ? "var(--accent-fg)" : "var(--text-muted)",
              fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
            }}
          >
            {ref.trim() ? `Confirm Payment · ${fmt(total)}` : "Enter reference to confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Credit Customer Modal ────────────────────────────────────────────────────

function CreditCustomerModal({
  customers, total, onConfirm, onCancel,
}: {
  customers: CreditCustomer[];
  total: number;
  onConfirm: (c: CreditCustomer) => void;
  onCancel: () => void;
}) {
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<CreditCustomer | null>(null);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.nic.includes(search)
  );

  const available = (c: CreditCustomer) => c.creditLimit - c.usedCredit;
  const canAfford = (c: CreditCustomer) => available(c) >= total;

  const thStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: 11, fontWeight: 700, textAlign: "left",
    color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: "0.05em", textTransform: "uppercase" as const,
    borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
    position: "sticky" as const, top: 0, whiteSpace: "nowrap" as const,
  };
  const tdStyle: React.CSSProperties = {
    padding: "11px 14px", fontSize: 13, color: "var(--text-primary)",
    fontFamily: "'Plus Jakarta Sans', sans-serif", borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 760,
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          maxHeight: "calc(100vh - 80px)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Credit Customer
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
              Only registered credit customers can purchase on credit
            </div>
          </div>
          <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, or NIC..."
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--bg-secondary)",
              color: "var(--text-primary)", fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }} />
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>NIC</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Credit Limit</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Used</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Available</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "28px 0", color: "var(--text-muted)" }}>
                    No registered credit customer found
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const avail    = available(c);
                  const afford   = canAfford(c);
                  const isSelected = selected?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => afford && setSelected(c)}
                      style={{
                        cursor: afford ? "pointer" : "not-allowed",
                        opacity: afford ? 1 : 0.45,
                        background: isSelected ? `rgba(var(--accent-rgb),0.07)` : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={tdStyle}>
                        <input
                          type="radio"
                          checked={isSelected}
                          disabled={!afford}
                          onChange={() => setSelected(c)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: afford ? "pointer" : "not-allowed", accentColor: "var(--accent)" }}
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{c.phone}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 12 }}>{c.nic}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(c.creditLimit)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: c.usedCredit > 0 ? "#f59e0b" : "var(--text-secondary)" }}>
                        {fmt(c.usedCredit)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: afford ? "#4ade80" : "#ef4444" }}>
                        {fmt(avail)}
                        {!afford && <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 400 }}>Insufficient</div>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
          <div style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span style={{ color: "var(--text-secondary)" }}>Required: </span>
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>{fmt(total)}</span>
            {selected && (
              <span style={{ color: "var(--text-muted)", marginLeft: 12 }}>
                · {selected.name} selected
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onCancel}
              style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Cancel
            </button>
            <button
              onClick={() => selected && onConfirm(selected)}
              disabled={!selected}
              style={{
                padding: "9px 22px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700,
                cursor: selected ? "pointer" : "not-allowed",
                background: selected ? "var(--accent)" : "var(--border)",
                color: selected ? "var(--accent-fg)" : "var(--text-muted)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {selected ? `Assign Credit · ${selected.name}` : "Select a customer"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Phone Search Popup ───────────────────────────────────────────────────────

function PhoneSearchPopup({
  phones, phoneCart, onAddMultiple, onClose,
}: {
  phones: Phone[];
  phoneCart: PhoneCartItem[];
  onAddMultiple: (selected: Phone[]) => void;
  onClose: () => void;
}) {
  const [filterBrand,   setFilterBrand]   = useState("");
  const [filterStorage, setFilterStorage] = useState("");
  const [filterColor,   setFilterColor]   = useState("");
  const [filterName,    setFilterName]    = useState("");
  const [filterImei,    setFilterImei]    = useState("");
  const [selectedImeis, setSelectedImeis] = useState<Set<string>>(new Set());

  const brands    = [...new Set(phones.map(p => p.brand))];
  const storages  = [...new Set(phones.map(p => p.storage))];
  const colors    = [...new Set(phones.map(p => p.color))];

  const filtered = phones.filter(p => {
    if (filterBrand   && p.brand   !== filterBrand)   return false;
    if (filterStorage && p.storage !== filterStorage) return false;
    if (filterColor   && p.color   !== filterColor)   return false;
    if (filterName    && !p.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterImei) {
      const q = filterImei.trim();
      if (!p.imei.includes(q) && !p.imei.endsWith(q)) return false;
    }
    return true;
  });

  const toggleSelect = (imei: string) =>
    setSelectedImeis(prev => { const n = new Set(prev); n.has(imei) ? n.delete(imei) : n.add(imei); return n; });

  const toggleAll = () =>
    setSelectedImeis(selectedImeis.size === filtered.length ? new Set() : new Set(filtered.map(p => p.imei)));

  const addSelected = () => {
    onAddMultiple(filtered.filter(p => selectedImeis.has(p.imei)));
    onClose();
  };

  const inCart = (imei: string) => phoneCart.some(pc => pc.phone.imei === imei);

  const selStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12,
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", cursor: "pointer",
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 700, textAlign: "left",
    color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: "0.05em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
    borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
    position: "sticky" as const, top: 0,
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
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 1100,
          height: "100%", maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Search Device
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
              Filter inventory and select devices to add to this sale
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <input
            value={filterImei}
            onChange={e => setFilterImei(e.target.value)}
            placeholder="IMEI or last 6 digits..."
            style={{ ...selStyle, width: 190, fontFamily: "monospace" }}
          />
          <input
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            placeholder="Phone name..."
            style={{ ...selStyle, width: 160 }}
          />
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={selStyle}>
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filterStorage} onChange={e => setFilterStorage(e.target.value)} style={selStyle}>
            <option value="">All Storage</option>
            {storages.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterColor} onChange={e => setFilterColor(e.target.value)} style={selStyle}>
            <option value="">All Colors</option>
            {colors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(filterImei || filterName || filterBrand || filterStorage || filterColor) && (
            <button
              onClick={() => { setFilterImei(""); setFilterName(""); setFilterBrand(""); setFilterStorage(""); setFilterColor(""); }}
              style={{ ...selStyle, color: "#ef4444", border: "1px solid #ef444440" }}
            >
              Clear
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
                    checked={filtered.length > 0 && selectedImeis.size === filtered.length}
                    onChange={toggleAll}
                    style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                </th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>IMEI</th>
                <th style={thStyle}>Brand</th>
                <th style={thStyle}>Storage</th>
                <th style={thStyle}>Color</th>
                <th style={thStyle}>Supplier</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Min Price</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Suggested</th>
                <th style={{ ...thStyle, textAlign: "center", width: 80 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                    No devices match the filters
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const selected = selectedImeis.has(p.imei);
                  const already  = inCart(p.imei);
                  return (
                    <tr
                      key={p.imei}
                      onClick={() => !already && toggleSelect(p.imei)}
                      style={{
                        cursor: already ? "not-allowed" : "pointer",
                        opacity: already ? 0.45 : 1,
                        background: selected ? `rgba(var(--accent-rgb),0.06)` : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={already}
                          onChange={() => toggleSelect(p.imei)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: already ? "not-allowed" : "pointer", accentColor: "var(--accent)" }}
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                        {filterImei && p.imei.includes(filterImei.trim()) ? (() => {
                          const idx = p.imei.lastIndexOf(filterImei.trim());
                          return (<>
                            {p.imei.slice(0, idx)}
                            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{p.imei.slice(idx, idx + filterImei.trim().length)}</span>
                            {p.imei.slice(idx + filterImei.trim().length)}
                          </>);
                        })() : p.imei}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.brand}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.storage}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.color}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{p.supplier}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#f59e0b" }}>
                        Rs. {p.minSellingPrice.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                        Rs. {p.suggestedPrice.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {already ? (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            In cart
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {filtered.length} device{filtered.length !== 1 ? "s" : ""} shown
            {selectedImeis.size > 0 && <span style={{ color: "var(--accent)", fontWeight: 700 }}> · {selectedImeis.size} selected</span>}
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
              disabled={selectedImeis.size === 0}
              style={{
                padding: "9px 22px", borderRadius: 8, border: "none", fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
                cursor: selectedImeis.size === 0 ? "not-allowed" : "pointer",
                background: selectedImeis.size === 0 ? "var(--border)" : "var(--accent)",
                color: selectedImeis.size === 0 ? "var(--text-muted)" : "var(--accent-fg)",
              }}
            >
              {selectedImeis.size === 0 ? "Select devices to add" : `Add ${selectedImeis.size} device${selectedImeis.size > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Accessory Search Popup ───────────────────────────────────────────────────

type AccessoryBase = typeof ACCESSORIES[number];

function AccessorySearchPopup({
  accessories, accessoryCart, onAddMultiple, onClose,
}: {
  accessories: AccessoryBase[];
  accessoryCart: AccessoryCartItem[];
  onAddMultiple: (selected: AccessoryBase[]) => void;
  onClose: () => void;
}) {
  const [filterBrand, setFilterBrand] = useState("");
  const [filterName,  setFilterName]  = useState("");
  const [filterCode,  setFilterCode]  = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const brands = [...new Set(accessories.map(a => a.brand))];

  const filtered = accessories.filter(a => {
    if (filterBrand && a.brand !== filterBrand) return false;
    if (filterName  && !a.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterCode  && !a.code.toLowerCase().includes(filterCode.trim().toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(a => a.id)));

  const addSelected = () => {
    onAddMultiple(filtered.filter(a => selectedIds.has(a.id)));
    onClose();
  };

  const inCart = (id: number) => accessoryCart.some(i => i.id === id);

  const selStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12,
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", cursor: "pointer",
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 700, textAlign: "left",
    color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    letterSpacing: "0.05em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
    borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
    position: "sticky" as const, top: 0,
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
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 900,
          height: "100%", maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Search Item
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
              Select accessories to add to this sale
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <input
            value={filterCode}
            onChange={e => setFilterCode(e.target.value)}
            placeholder="Product code..."
            style={{ ...selStyle, width: 160, fontFamily: "monospace" }}
          />
          <input
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            placeholder="Item name..."
            style={{ ...selStyle, width: 180 }}
          />
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={selStyle}>
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {(filterCode || filterName || filterBrand) && (
            <button
              onClick={() => { setFilterCode(""); setFilterName(""); setFilterBrand(""); }}
              style={{ ...selStyle, color: "#ef4444", border: "1px solid #ef444440" }}
            >
              Clear
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
                <th style={thStyle}>Code</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Price</th>
                <th style={{ ...thStyle, textAlign: "center", width: 80 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                    No items match the filters
                  </td>
                </tr>
              ) : (
                filtered.map(a => {
                  const selected = selectedIds.has(a.id);
                  const already  = inCart(a.id);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => toggleSelect(a.id)}
                      style={{
                        cursor: "pointer",
                        background: selected ? `rgba(var(--accent-rgb),0.06)` : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(a.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{a.name}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{a.model}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{a.brand}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                        {filterCode && a.code.toLowerCase().includes(filterCode.trim().toLowerCase()) ? (() => {
                          const q = filterCode.trim().toLowerCase();
                          const idx = a.code.toLowerCase().indexOf(q);
                          return (<>
                            {a.code.slice(0, idx)}
                            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{a.code.slice(idx, idx + q.length)}</span>
                            {a.code.slice(idx + q.length)}
                          </>);
                        })() : a.code}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                        Rs. {a.price.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {already && (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            In cart
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
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} shown
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
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
                cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
                background: selectedIds.size === 0 ? "var(--border)" : "var(--accent)",
                color: selectedIds.size === 0 ? "var(--text-muted)" : "var(--accent-fg)",
              }}
            >
              {selectedIds.size === 0 ? "Select items to add" : `Add ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MobileSales() {
  const [imeiQuery,       setImeiQuery]       = useState("");
  const [imeiError,       setImeiError]       = useState(false);
  const [phoneCart,       setPhoneCart]       = useState<PhoneCartItem[]>([]);
  const [showPhoneSearch, setShowPhoneSearch] = useState(false);

  const [barcodeQuery,      setBarcodeQuery]      = useState("");
  const [accessoryCart,     setAccessoryCart]     = useState<AccessoryCartItem[]>([]);
  const [showAccessorySearch, setShowAccessorySearch] = useState(false);

  const [overallDiscount, setOverallDiscount] = useState("");
  const [paymentMethod,   setPaymentMethod]   = useState<"" | "Cash" | "Card" | "Credit">("");
  const [customer,        setCustomer]        = useState({ name: "", phone: "", whatsapp: "", email: "", nic: "" });
  const [completed,            setCompleted]            = useState(false);
  const [showCardModal,        setShowCardModal]        = useState(false);
  const [showCreditModal,      setShowCreditModal]      = useState(false);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<CreditCustomer | null>(null);

  const invoiceNo = useMemo(() => {
    const now = new Date();
    const yy  = String(now.getFullYear()).slice(2);
    const mm  = String(now.getMonth() + 1).padStart(2, "0");
    const dd  = String(now.getDate()).padStart(2, "0");
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    return `INV-${yy}${mm}${dd}-${seq}`;
  }, []);

  // ── Phone cart handlers ────────────────────────────────────────────────────
  const handleImeiSearch = () => {
    const q = imeiQuery.trim().toLowerCase();
    if (!q) return;
    const found = PHONE_INVENTORY.find(p =>
      p.imei.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    );
    if (found) {
      const alreadyIn = phoneCart.find(pc => pc.phone.imei === found.imei);
      if (!alreadyIn) {
        setPhoneCart(prev => [...prev, { phone: found, sellingPrice: found.suggestedPrice.toString(), discount: "" }]);
      }
      setImeiError(false);
      setImeiQuery("");
    } else {
      setImeiError(true);
    }
  };

  const handleAddMultiplePhones = (selected: Phone[]) => {
    setPhoneCart(prev => {
      const existing = new Set(prev.map(pc => pc.phone.imei));
      const toAdd = selected
        .filter(p => !existing.has(p.imei))
        .map(p => ({ phone: p, sellingPrice: p.suggestedPrice.toString(), discount: "" }));
      return [...prev, ...toAdd];
    });
  };

  const updatePhonePrice    = (imei: string, val: string) =>
    setPhoneCart(prev => prev.map(pc => pc.phone.imei === imei ? { ...pc, sellingPrice: val } : pc));
  const updatePhoneDiscount = (imei: string, val: string) =>
    setPhoneCart(prev => prev.map(pc => pc.phone.imei === imei ? { ...pc, discount: val } : pc));
  const removePhone         = (imei: string) =>
    setPhoneCart(prev => prev.filter(pc => pc.phone.imei !== imei));

  // ── Accessory cart handlers ────────────────────────────────────────────────
  const handleBarcodeAdd = () => {
    const q = barcodeQuery.trim().toLowerCase();
    const acc = ACCESSORIES.find(a => a.code.toLowerCase() === q || a.name.toLowerCase().includes(q));
    if (acc) {
      setAccessoryCart(prev => {
        const existing = prev.find(i => i.id === acc.id);
        if (existing) return prev.map(i => i.id === acc.id ? { ...i, qty: i.qty + 1 } : i);
        return [...prev, { ...acc, discount: "", qty: 1 }];
      });
      setBarcodeQuery("");
    }
  };

  const handleAddMultipleAccessories = (selected: typeof ACCESSORIES[number][]) => {
    setAccessoryCart(prev => {
      let next = [...prev];
      selected.forEach(a => {
        const existing = next.find(i => i.id === a.id);
        if (existing) {
          next = next.map(i => i.id === a.id ? { ...i, qty: i.qty + 1 } : i);
        } else {
          next = [...next, { ...a, discount: "", qty: 1 }];
        }
      });
      return next;
    });
  };

  const updateAccQty      = (id: number, delta: number) =>
    setAccessoryCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  const updateAccDiscount = (id: number, val: string) =>
    setAccessoryCart(prev => prev.map(i => i.id === id ? { ...i, discount: val } : i));
  const removeAcc         = (id: number) =>
    setAccessoryCart(prev => prev.filter(i => i.id !== id));

  // ── Bill ───────────────────────────────────────────────────────────────────
  const phonesNet   = phoneCart.reduce((s, pc) =>
    s + Math.max(0, (parseFloat(pc.sellingPrice) || 0) - (parseFloat(pc.discount) || 0)), 0);
  const accNet      = accessoryCart.reduce((s, i) =>
    s + i.price * i.qty - (parseFloat(i.discount) || 0), 0);
  const subtotal    = phonesNet + Math.max(0, accNet);
  const overallAmt  = Math.min(subtotal, parseFloat(overallDiscount) || 0);
  const total       = subtotal - overallAmt;

  const belowMin    = phoneCart.some(pc =>
    parseFloat(pc.sellingPrice) > 0 && parseFloat(pc.sellingPrice) < pc.phone.minSellingPrice
  );
  const canComplete = phoneCart.length > 0 && !belowMin &&
    (paymentMethod === "Cash" ||
     paymentMethod === "Card" ||
     (paymentMethod === "Credit" && selectedCreditCustomer !== null));

  const resetAll = () => {
    setPhoneCart([]); setAccessoryCart([]); setImeiQuery(""); setBarcodeQuery("");
    setOverallDiscount(""); setPaymentMethod("");
    setCustomer({ name: "", phone: "", whatsapp: "", email: "", nic: "" });
    setSelectedCreditCustomer(null);
    setShowCardModal(false); setShowCreditModal(false);
    setCompleted(false);
  };

  if (completed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, textAlign: "center" }}>
        <div style={{ fontSize: 52, color: "var(--accent)" }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}>Invoice Complete</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {phoneCart.length} device{phoneCart.length !== 1 ? "s" : ""} · {fmt(total)} · {paymentMethod}
        </div>
        <button onClick={resetAll} style={{ marginTop: 8, padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          New Sale
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

      {showPhoneSearch && (
        <PhoneSearchPopup
          phones={PHONE_INVENTORY}
          phoneCart={phoneCart}
          onAddMultiple={handleAddMultiplePhones}
          onClose={() => setShowPhoneSearch(false)}
        />
      )}

      {showAccessorySearch && (
        <AccessorySearchPopup
          accessories={ACCESSORIES}
          accessoryCart={accessoryCart}
          onAddMultiple={handleAddMultipleAccessories}
          onClose={() => setShowAccessorySearch(false)}
        />
      )}

      {showCardModal && (
        <CardPaymentModal
          invoiceNo={invoiceNo}
          phoneCart={phoneCart}
          accessoryCart={accessoryCart}
          customer={customer}
          subtotal={subtotal}
          overallDiscount={parseFloat(overallDiscount) || 0}
          total={total}
          onConfirm={() => { setShowCardModal(false); setCompleted(true); }}
          onCancel={() => setShowCardModal(false)}
        />
      )}

      {showCreditModal && (
        <CreditCustomerModal
          customers={CREDIT_CUSTOMERS}
          total={total}
          onConfirm={c => { setSelectedCreditCustomer(c); setPaymentMethod("Credit"); setShowCreditModal(false); }}
          onCancel={() => setShowCreditModal(false)}
        />
      )}

      {/* ── Col 1: Devices ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1.3, display: "flex", flexDirection: "column", gap: 14, paddingRight: 20, borderRight: "1px solid var(--border)", minHeight: 0 }}>

        {/* IMEI search */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={imeiQuery}
              onChange={e => { setImeiQuery(e.target.value); setImeiError(false); }}
              onKeyDown={e => e.key === "Enter" && handleImeiSearch()}
              placeholder="Scan IMEI or enter phone name..."
              style={{ ...inputStyle, flex: 1, borderColor: imeiError ? "#ef4444" : undefined }}
            />
            <button onClick={() => setShowPhoneSearch(true)} style={searchBtn}><Search size={15} /></button>
          </div>
          {imeiError && (
            <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              No device found — check IMEI or name
            </div>
          )}
        </div>

        {/* Device tiles list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {phoneCart.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ fontSize: 32, opacity: 0.25 }}>📱</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center" }}>
                Scan or enter IMEI to add a device
              </div>
            </div>
          ) : (
            phoneCart.map(pc => {
              const sp = parseFloat(pc.sellingPrice) || 0;
              const isBelowMin = sp > 0 && sp < pc.phone.minSellingPrice;
              return (
                <div key={pc.phone.imei} style={{
                  padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${isBelowMin ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                  background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10,
                }}>
                  {/* Row 1: name + remove */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {pc.phone.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
                        {pc.phone.color} · {pc.phone.storage} · <span style={{ fontFamily: "monospace" }}>{pc.phone.imei}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removePhone(pc.phone.imei)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", padding: 2, flexShrink: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Row 2: min price info row */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      ["Brand",    pc.phone.brand],
                      ["Supplier", pc.phone.supplier],
                      ["Bought",   pc.phone.boughtDate],
                    ].map(([k, v]) => (
                      <span key={k} style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{k}:</span> {v}
                      </span>
                    ))}
                  </div>

                  {/* Min price badge */}
                  <div style={{ padding: "5px 8px", borderRadius: 6, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)", display: "inline-flex", alignSelf: "flex-start" }}>
                    <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>
                      Min. price: {fmt(pc.phone.minSellingPrice)}
                    </span>
                  </div>

                  {/* Row 3: selling price + discount */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, marginBottom: 3 }}>Selling Price (Rs.)</label>
                      <input
                        type="number" value={pc.sellingPrice}
                        onChange={e => updatePhonePrice(pc.phone.imei, e.target.value)}
                        style={{ ...inputStyle, fontWeight: 700, borderColor: isBelowMin ? "#ef4444" : undefined }}
                      />
                      {isBelowMin && (
                        <div style={{ fontSize: 10, color: "#ef4444", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 3 }}>
                          Below minimum
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, marginBottom: 3 }}>Discount (Rs.)</label>
                      <input
                        type="number" value={pc.discount}
                        onChange={e => updatePhoneDiscount(pc.phone.imei, e.target.value)}
                        placeholder="0"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Col 2: Accessories ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "0 20px", borderRight: "1px solid var(--border)", minHeight: 0 }}>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <input
            value={barcodeQuery}
            onChange={e => setBarcodeQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleBarcodeAdd()}
            placeholder="Scan barcode or enter item code..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => setShowAccessorySearch(true)} style={searchBtn}><Search size={15} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {accessoryCart.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ fontSize: 28, opacity: 0.25 }}>📦</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center" }}>
                Scan accessories or extras<br />to add to this sale
              </div>
            </div>
          ) : (
            accessoryCart.map(item => (
              <div key={item.id} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>{item.model} · {item.brand}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>Rs. {item.price.toLocaleString()}</span>
                    <button onClick={() => removeAcc(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: 3 }}>Discount (Rs.)</label>
                    <input type="number" min={0} value={item.discount} onChange={e => updateAccDiscount(item.id, e.target.value)} placeholder="0" style={{ ...inputStyle, fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 3 }}>Qty</label>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
                      <button onClick={() => updateAccQty(item.id, -1)} style={{ width: 28, height: 32, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={11} /></button>
                      <span style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.qty}</span>
                      <button onClick={() => updateAccQty(item.id, 1)} style={{ width: 28, height: 32, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={11} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Col 3: Customer + Bill ────────────────────────────────────────────── */}
      <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", paddingLeft: 20, minHeight: 0, overflowY: "auto" }}>

        <div style={{ ...sectionHead, marginBottom: 12 }}>Customer Info</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {([
            { key: "name",     label: "Name *",              placeholder: "Customer name"      },
            { key: "phone",    label: "Phone Number *",      placeholder: "07X XXX XXXX"       },
            { key: "whatsapp", label: "WhatsApp (Optional)", placeholder: "07X XXX XXXX"       },
            { key: "email",    label: "Email (Optional)",    placeholder: "customer@email.com" },
            { key: "nic",      label: "NIC (Optional)",      placeholder: "199912345678"       },
          ] as { key: keyof typeof customer; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input value={customer[key]} onChange={e => setCustomer(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", marginBottom: 16 }} />

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
            Invoice No.
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.03em" }}>
            {invoiceNo}
          </div>
        </div>

        <div style={{ ...sectionHead, marginBottom: 10 }}>Bill Summary</div>

        {/* Per-phone breakdown */}
        {phoneCart.map(pc => (
          <div key={pc.phone.imei} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
            <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{pc.phone.name}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600, flexShrink: 0 }}>
              {fmt(Math.max(0, (parseFloat(pc.sellingPrice) || 0) - (parseFloat(pc.discount) || 0)))}
            </span>
          </div>
        ))}

        {/* Per-accessory breakdown */}
        {accessoryCart.map(item => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
            <span style={{ color: "var(--text-secondary)" }}>{item.name} ×{item.qty}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {fmt(item.price * item.qty - (parseFloat(item.discount) || 0))}
            </span>
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>
            <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt(subtotal)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Overall Discount (Rs.)</label>
          <input type="number" min={0} value={overallDiscount} onChange={e => setOverallDiscount(e.target.value)} placeholder="0" style={inputStyle} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt(total)}</span>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(["Cash", "Card", "Credit"] as const).map(m => (
            <button
              key={m}
              onClick={() => {
                if (m === "Credit") {
                  setShowCreditModal(true);
                } else {
                  setPaymentMethod(paymentMethod === m ? "" : m);
                  if (paymentMethod !== m) setSelectedCreditCustomer(null);
                }
              }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${paymentMethod === m ? "var(--border-active)" : "var(--border)"}`,
                background: paymentMethod === m ? "var(--accent-dim)" : "transparent",
                color: paymentMethod === m ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
              }}
            >{m}</button>
          ))}
        </div>

        {selectedCreditCustomer && (
          <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 7, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{selectedCreditCustomer.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Available: {fmt(selectedCreditCustomer.creditLimit - selectedCreditCustomer.usedCredit)}
              </div>
            </div>
            <button
              onClick={() => { setPaymentMethod(""); setSelectedCreditCustomer(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2 }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        <button
          onClick={() => {
            if (!canComplete) return;
            if (paymentMethod === "Card") { setShowCardModal(true); return; }
            setCompleted(true);
          }}
          disabled={!canComplete}
          style={{
            width: "100%", padding: "11px", borderRadius: 9, border: "none",
            background: canComplete ? "var(--accent)" : "var(--border)",
            color: canComplete ? "var(--accent-fg)" : "var(--text-muted)",
            fontWeight: 700, fontSize: 13, cursor: canComplete ? "pointer" : "not-allowed",
            fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
          }}
        >
          {phoneCart.length === 0
            ? "Scan a device first"
            : belowMin
            ? "Price below minimum"
            : !paymentMethod
            ? "Select payment method"
            : paymentMethod === "Credit" && !selectedCreditCustomer
            ? "Select credit customer"
            : `Complete Invoice · ${fmt(total)}`}
        </button>
      </div>
    </div>
  );
}
