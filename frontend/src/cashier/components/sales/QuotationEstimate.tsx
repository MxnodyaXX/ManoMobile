"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import {
  Plus, Trash2, Printer, FileText, X, CheckCircle,
  Clock, ChevronDown, Copy,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

interface Quote {
  id: string;
  quoteNo: string;
  date: string;
  validUntil: string;
  customer: string;
  phone: string;
  items: QuoteItem[];
  notes: string;
  status: "Active" | "Converted" | "Expired";
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_QUOTES: Quote[] = [
  {
    id: "q1", quoteNo: "QT-001", date: "2026-05-18", validUntil: "2026-05-25",
    customer: "Ranil Perera", phone: "+94 77 111 2222",
    status: "Active", notes: "Customer to confirm by Friday",
    items: [
      { id: "i1", description: "Samsung Galaxy S25 128GB (Phantom Black)", qty: 1, unitPrice: 165000, discount: 0 },
      { id: "i2", description: "Spigen Case + Baseus Tempered Glass",       qty: 1, unitPrice: 2400,   discount: 10 },
    ],
  },
  {
    id: "q2", quoteNo: "QT-002", date: "2026-05-15", validUntil: "2026-05-22",
    customer: "Shirani Fernando", phone: "+94 71 333 4444",
    status: "Expired", notes: "",
    items: [
      { id: "i3", description: "iPhone 15 Pro 256GB", qty: 1, unitPrice: 205000, discount: 0 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Rs   = (n: number) => `Rs. ${n.toLocaleString()}`;
const uid  = () => String(Date.now() + Math.random());
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_CFG = {
  Active:    { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
  Converted: { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  Expired:   { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
};

function lineTotal(item: QuoteItem) {
  return item.qty * item.unitPrice * (1 - item.discount / 100);
}

// ─── Quote Print Modal ────────────────────────────────────────────────────────

function QuotePrintModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const total = quote.items.reduce((s, i) => s + lineTotal(i), 0);

  const handlePrint = () => {
    const id = "__quote_print__";
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.id = id;
    div.innerHTML = `
      <style>
        @media print {
          body > *:not(#${id}) { display: none !important; }
          #${id} { display: block !important; font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
        }
        #${id} { display: none; }
        .q-row { display: flex; justify-content: space-between; margin: 4px 0; }
        .q-line { border-top: 1px dashed #ccc; margin: 8px 0; }
        th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; }
      </style>
      <div>
        <div style="text-align:center; margin-bottom:16px">
          <h2 style="margin:0">MANO MOBILE CENTRE</h2>
          <p style="margin:4px 0; font-size:11px">Colombo, Sri Lanka | +94 77 123 4567</p>
          <h3 style="margin:8px 0">QUOTATION / PRICE ESTIMATE</h3>
          <p style="font-size:11px; color:#666">${quote.quoteNo} · Valid until ${fmtD(quote.validUntil)}</p>
        </div>
        <div class="q-line"></div>
        <div class="q-row"><span>Customer:</span><span>${quote.customer} | ${quote.phone}</span></div>
        <div class="q-row"><span>Date:</span><span>${fmtD(quote.date)}</span></div>
        <div class="q-line"></div>
        <table style="width:100%; border-collapse:collapse; margin:12px 0">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Total</th></tr></thead>
          <tbody>
            ${quote.items.map(i => `
              <tr>
                <td>${i.description}</td>
                <td>${i.qty}</td>
                <td>Rs. ${i.unitPrice.toLocaleString()}</td>
                <td>${i.discount}%</td>
                <td>Rs. ${lineTotal(i).toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="q-line"></div>
        <div class="q-row" style="font-weight:bold; font-size:14px"><span>TOTAL ESTIMATE</span><span>Rs. ${total.toLocaleString()}</span></div>
        <div class="q-line"></div>
        ${quote.notes ? `<p style="font-size:11px; color:#666">Note: ${quote.notes}</p>` : ""}
        <p style="font-size:10px; color:#999; text-align:center; margin-top:16px">
          This is a price estimate only and is valid until ${fmtD(quote.validUntil)}.
          Prices subject to change without notice.
        </p>
      </div>
    `;
    document.body.appendChild(div);
    window.print();
    setTimeout(() => { const el = document.getElementById(id); if (el) el.remove(); }, 2000);
  };

  const total2 = quote.items.reduce((s, i) => s + lineTotal(i), 0);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 560,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0,
          }}>
            <FileText size={17} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{quote.quoteNo}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{quote.customer} · Valid until {fmtD(quote.validUntil)}</p>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)" }}>
                {["Description", "Qty", "Unit Price", "Disc.", "Total"].map(h => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => (
                <tr key={item.id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 1 ? "var(--bg-secondary)" : "transparent" }}>
                  <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>{item.description}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{item.qty}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{Rs(item.unitPrice)}</td>
                  <td style={{ padding: "10px 12px", color: item.discount > 0 ? "#fbbf24" : "var(--text-muted)" }}>{item.discount > 0 ? `${item.discount}%` : "—"}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{Rs(lineTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 20px", textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total Estimate</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>{Rs(total2)}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>Close</button>
          <button onClick={handlePrint} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--accent-glow)",
            background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            <Printer size={14} /> Print Quotation
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── New/Edit Quote Form ───────────────────────────────────────────────────────

function QuoteForm({ existing, onSave, onCancel }: {
  existing?: Quote;
  onSave: (q: Quote) => void;
  onCancel: () => void;
}) {
  const today      = new Date().toISOString().slice(0, 10);
  const validDef   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [customer,    setCustomer]    = useState(existing?.customer    ?? "");
  const [phone,       setPhone]       = useState(existing?.phone       ?? "");
  const [validUntil,  setValidUntil]  = useState(existing?.validUntil  ?? validDef);
  const [notes,       setNotes]       = useState(existing?.notes       ?? "");
  const [items,       setItems]       = useState<QuoteItem[]>(existing?.items ?? [
    { id: uid(), description: "", qty: 1, unitPrice: 0, discount: 0 },
  ]);

  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "9px 11px", fontSize: 13,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
    width: "100%",
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const canSave = customer.trim() && items.every(i => i.description && i.qty > 0 && i.unitPrice > 0);

  const handleSave = () => {
    const quoteNo = existing?.quoteNo ?? `QT-${String(Math.floor(Math.random() * 900) + 100)}`;
    onSave({
      id:         existing?.id ?? uid(),
      quoteNo,
      date:       existing?.date ?? today,
      validUntil,
      customer:   customer.trim(),
      phone:      phone.trim(),
      notes:      notes.trim(),
      items,
      status:     existing?.status ?? "Active",
    });
  };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)",
        }}>
          <FileText size={15} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
          {existing ? `Edit ${existing.quoteNo}` : "New Quotation"}
        </p>
      </div>

      {/* Header fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer Name *</label>
          <input placeholder="Customer name" value={customer} onChange={e => setCustomer(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone</label>
          <input placeholder="+94 7X XXX XXXX" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Valid Until</label>
          <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</label>
          <input placeholder="Optional note…" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* Line items */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Items</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "3fr 80px 120px 80px 100px 36px", gap: 8, alignItems: "center" }}>
              <input placeholder="Description / product name" value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} style={inputStyle} />
              <input type="number" min="1" placeholder="Qty" value={item.qty} onChange={e => updateItem(item.id, "qty", Number(e.target.value))} style={{ ...inputStyle, textAlign: "center" }} />
              <input type="number" min="0" placeholder="Unit price" value={item.unitPrice || ""} onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value))} style={inputStyle} />
              <input type="number" min="0" max="100" placeholder="Disc%" value={item.discount || ""} onChange={e => updateItem(item.id, "discount", Number(e.target.value))} style={{ ...inputStyle, textAlign: "center" }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", padding: "9px 0", whiteSpace: "nowrap" }}>
                {Rs(lineTotal(item))}
              </div>
              {items.length > 1 && (
                <button onClick={() => setItems(p => p.filter(i => i.id !== item.id))} style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.07)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setItems(p => [...p, { id: uid(), description: "", qty: 1, unitPrice: 0, discount: 0 }])}
          style={{
            marginTop: 10, display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--text-secondary)", cursor: "pointer", fontSize: 12.5,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <Plus size={13} /> Add Item
        </button>
      </div>

      {/* Total + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 18px" }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total Estimate</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>{Rs(subtotal)}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            padding: "10px 20px", borderRadius: 9, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>Cancel</button>
          <button disabled={!canSave} onClick={handleSave} style={{
            padding: "10px 20px", borderRadius: 9, border: "1px solid var(--accent-glow)",
            background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
            opacity: canSave ? 1 : 0.4,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <CheckCircle size={14} /> Save Quotation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main QuotationEstimate Component ─────────────────────────────────────────

export default function QuotationEstimate() {
  const isMobile = useIsMobile();
  const [quotes,      setQuotes]      = useState<Quote[]>(SEED_QUOTES);
  const [mode,        setMode]        = useState<"list" | "new" | "edit">("list");
  const [editing,     setEditing]     = useState<Quote | undefined>(undefined);
  const [viewQuote,   setViewQuote]   = useState<Quote | null>(null);
  const [statusFilter, setStatusFilter] = useState<Quote["status"] | "All">("All");

  const filtered = useMemo(() => quotes.filter(q =>
    statusFilter === "All" || q.status === statusFilter
  ), [quotes, statusFilter]);

  const handleSave = (q: Quote) => {
    setQuotes(prev => {
      const exists = prev.find(x => x.id === q.id);
      return exists ? prev.map(x => x.id === q.id ? q : x) : [q, ...prev];
    });
    setMode("list");
    setEditing(undefined);
  };

  const handleMarkConverted = (id: string) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: "Converted" } : q));
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };

  if (mode === "new" || mode === "edit") {
    return (
      <QuoteForm
        existing={editing}
        onSave={handleSave}
        onCancel={() => { setMode("list"); setEditing(undefined); }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toolbar */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...inputStyle, paddingRight: 28, appearance: "none" as const, cursor: "pointer", width: "100%" }}>
                <option value="All">All Quotes</option>
                <option value="Active">Active</option>
                <option value="Converted">Converted</option>
                <option value="Expired">Expired</option>
              </select>
              <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            </div>
            <button
              onClick={() => { setEditing(undefined); setMode("new"); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 14px",
                borderRadius: 9, border: "1px solid var(--accent-glow)", background: "var(--accent-dim)",
                color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0,
              }}>
              <Plus size={14} /> New Quotation
            </button>
          </div>
          <div className="tabs-scroll">
            <div style={{ display: "flex", gap: 8, width: "fit-content" }}>
              {[
                { label: "Total",     value: quotes.length,                                     color: "var(--text-primary)" },
                { label: "Active",    value: quotes.filter(q => q.status === "Active").length,    color: "#4ade80"             },
                { label: "Converted", value: quotes.filter(q => q.status === "Converted").length, color: "#60a5fa"             },
                { label: "Expired",   value: quotes.filter(q => q.status === "Expired").length,   color: "#f87171"             },
              ].map(c => (
                <div key={c.label} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 9, padding: "7px 12px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{c.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: c.color }}>{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...inputStyle, paddingRight: 28, appearance: "none" as const, cursor: "pointer", minWidth: 140 }}>
              <option value="All">All Quotes</option>
              <option value="Active">Active</option>
              <option value="Converted">Converted</option>
              <option value="Expired">Expired</option>
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            {[
              { label: "Total",     value: quotes.length,                                     color: "var(--text-primary)" },
              { label: "Active",    value: quotes.filter(q => q.status === "Active").length,    color: "#4ade80"             },
              { label: "Converted", value: quotes.filter(q => q.status === "Converted").length, color: "#60a5fa"             },
              { label: "Expired",   value: quotes.filter(q => q.status === "Expired").length,   color: "#f87171"             },
            ].map(c => (
              <div key={c.label} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 9, padding: "7px 12px", display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: c.color }}>{c.value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setEditing(undefined); setMode("new"); }}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
              borderRadius: 9, border: "1px solid var(--accent-glow)", background: "var(--accent-dim)",
              color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
            <Plus size={14} /> New Quotation
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)" }}>
              {["Quote No.", "Customer", "Items", "Total", "Date", "Valid Until", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No quotations found.
                </td>
              </tr>
            ) : filtered.map((q, i) => {
              const cfg   = STATUS_CFG[q.status];
              const total = q.items.reduce((s, item) => s + lineTotal(item), 0);
              return (
                <tr key={q.id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 1 ? "var(--bg-secondary)" : "transparent" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 700, fontFamily: "monospace", fontSize: 12, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{q.quoteNo}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-primary)" }}>
                    <p style={{ fontWeight: 600 }}>{q.customer}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{q.phone}</p>
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)" }}>{q.items.length} item{q.items.length > 1 ? "s" : ""}</td>
                  <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{Rs(total)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtD(q.date)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                    <Clock size={11} />
                    {fmtD(q.validUntil)}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                    }}>{q.status}</span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setViewQuote(q)} title="View / Print" style={{
                        width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)",
                        background: "var(--bg-card)", color: "var(--text-secondary)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Printer size={13} />
                      </button>
                      {q.status === "Active" && (
                        <>
                          <button onClick={() => { setEditing(q); setMode("edit"); }} title="Edit Quote" style={{
                            width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)",
                            background: "var(--bg-card)", color: "var(--text-secondary)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Copy size={13} />
                          </button>
                          <button onClick={() => handleMarkConverted(q.id)} title="Mark Converted" style={{
                            width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(96,165,250,0.25)",
                            background: "rgba(96,165,250,0.07)", color: "#60a5fa",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <CheckCircle size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewQuote && <QuotePrintModal quote={viewQuote} onClose={() => setViewQuote(null)} />}
    </div>
  );
}
