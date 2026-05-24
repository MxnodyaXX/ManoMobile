"use client";

import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search, Printer, Eye, ChevronDown, X,
  FileText, Wrench, ShoppingCart, RotateCcw,
} from "lucide-react";
import ExportButtons from "@/cashier/components/shared/ExportButtons";
import { exportToPdf, exportToExcel, exportToPng } from "@/cashier/utils/exportUtils";

type InvoiceType   = "Sales" | "Repair" | "Return";
type InvoiceStatus = "Paid" | "Unpaid" | "Voided" | "Partial";

interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  customer: string;
  type: InvoiceType;
  description: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  status: InvoiceStatus;
}

const INVOICES: Invoice[] = [
  { id: "1",  invoiceNo: "INV-2401", date: "2026-05-19", customer: "Amal Perera",       type: "Sales",  description: "Screen Protector × 2, Phone Case",       subtotal: 2000, discount: 150,  total: 1850,  paid: 1850,  status: "Paid" },
  { id: "2",  invoiceNo: "INV-2400", date: "2026-05-19", customer: "Nalini Silva",       type: "Sales",  description: "Samsung A15 (Black)",                     subtotal: 42500, discount: 0,  total: 42500, paid: 42500, status: "Paid" },
  { id: "3",  invoiceNo: "REP-1041", date: "2026-05-19", customer: "Kasun Fernando",     type: "Repair", description: "Screen Replacement — iPhone 13",          subtotal: 9500, discount: 0,   total: 9500,  paid: 5000,  status: "Partial" },
  { id: "4",  invoiceNo: "INV-2399", date: "2026-05-18", customer: "Walk-in",            type: "Sales",  description: "Photocopy × 5, Lamination",               subtotal: 320,  discount: 0,   total: 320,   paid: 320,   status: "Voided" },
  { id: "5",  invoiceNo: "RET-0021", date: "2026-05-18", customer: "Dinesh Ratnam",      type: "Return", description: "Return: Charger (Type-C) — Defective",    subtotal: 650,  discount: 0,   total: -650,  paid: -650,  status: "Paid" },
  { id: "6",  invoiceNo: "REP-1040", date: "2026-05-17", customer: "Priya Nair",         type: "Repair", description: "Battery Replacement — Oppo A57",          subtotal: 4200, discount: 0,   total: 4200,  paid: 4200,  status: "Paid" },
  { id: "7",  invoiceNo: "INV-2398", date: "2026-05-17", customer: "Ruwan Jayasinghe",   type: "Sales",  description: "Redmi Note 13",                           subtotal: 38000, discount: 500, total: 37500, paid: 0,     status: "Unpaid" },
  { id: "8",  invoiceNo: "REP-1039", date: "2026-05-16", customer: "Madhu Weerasinghe",  type: "Repair", description: "Charging Port — Samsung A32",              subtotal: 2800, discount: 0,   total: 2800,  paid: 2800,  status: "Paid" },
  { id: "9",  invoiceNo: "INV-2397", date: "2026-05-15", customer: "Walk-in",            type: "Sales",  description: "Tempered Glass × 3",                     subtotal: 1350, discount: 0,   total: 1350,  paid: 1350,  status: "Paid" },
  { id: "10", invoiceNo: "REP-1037", date: "2026-05-15", customer: "Saman Wickrama",     type: "Repair", description: "Water Damage — iPhone SE",                subtotal: 12000, discount: 0,  total: 12000, paid: 12000, status: "Paid" },
];

const TYPE_CFG: Record<InvoiceType, { color: string; icon: any }> = {
  Sales:  { color: "#60a5fa", icon: ShoppingCart },
  Repair: { color: "#34d399", icon: Wrench },
  Return: { color: "#fbbf24", icon: RotateCcw },
};

const STATUS_CFG: Record<InvoiceStatus, { color: string; bg: string; border: string }> = {
  Paid:    { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)" },
  Unpaid:  { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  Voided:  { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)" },
};

function fmtRs(n: number) {
  const abs = Math.abs(n);
  return `${n < 0 ? "-" : ""}Rs. ${abs.toLocaleString()}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Invoice Detail + Print Modal ── */
function InvoiceModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const typeCfg  = TYPE_CFG[inv.type];
  const TypeIcon = typeCfg.icon;
  const statusCfg = STATUS_CFG[inv.status];
  const balance   = inv.total - inv.paid;

  const handlePrint = () => {
    const id = "__invoice_print__";
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.id = id;
    div.innerHTML = `
      <style>
        @media print {
          body > *:not(#${id}) { display: none !important; }
          #${id} { display: block !important; font-family: 'Courier New', monospace; font-size: 12px; max-width: 340px; margin: 0 auto; }
        }
        #${id} { display: none; }
        .i-center { text-align: center; }
        .i-bold   { font-weight: bold; }
        .i-line   { border-top: 1px dashed #000; margin: 6px 0; }
        .i-row    { display: flex; justify-content: space-between; margin: 3px 0; }
        .i-right  { text-align: right; }
      </style>
      <div>
        <div class="i-center i-bold" style="font-size:16px">MANO MOBILE CENTRE</div>
        <div class="i-center" style="font-size:10px">Colombo, Sri Lanka | +94 77 123 4567</div>
        <div class="i-line"></div>
        <div class="i-center i-bold">${inv.type.toUpperCase()} INVOICE</div>
        <div class="i-line"></div>
        <div class="i-row"><span>${inv.invoiceNo}</span><span>${inv.date}</span></div>
        <div class="i-row"><span>Customer:</span><span>${inv.customer}</span></div>
        <div class="i-line"></div>
        <div style="margin:4px 0">${inv.description}</div>
        <div class="i-line"></div>
        <div class="i-row"><span>Subtotal</span><span>${fmtRs(inv.subtotal)}</span></div>
        ${inv.discount > 0 ? `<div class="i-row"><span>Discount</span><span>-${fmtRs(inv.discount)}</span></div>` : ""}
        <div class="i-row i-bold"><span>TOTAL</span><span>${fmtRs(inv.total)}</span></div>
        <div class="i-row"><span>Paid</span><span>${fmtRs(inv.paid)}</span></div>
        ${Math.abs(balance) > 0 ? `<div class="i-row i-bold"><span>Balance Due</span><span>${fmtRs(balance)}</span></div>` : ""}
        <div class="i-line"></div>
        <div class="i-row"><span>Status:</span><span>${inv.status}</span></div>
        <div class="i-line"></div>
        <div class="i-center" style="font-size:10px">Thank you for choosing Mano Mobile!</div>
      </div>
    `;
    document.body.appendChild(div);
    window.print();
    setTimeout(() => { const el = document.getElementById(id); if (el) el.remove(); }, 2000);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 500,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `${typeCfg.color}14`, border: `1px solid ${typeCfg.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center", color: typeCfg.color, flexShrink: 0,
            }}>
              <TypeIcon size={17} />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>{inv.invoiceNo}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{fmtDate(inv.date)} · {inv.customer}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
              color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
            }}>{inv.status}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Description */}
        <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Items / Description</p>
          <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{inv.description}</p>
        </div>

        {/* Financials */}
        <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          {[
            { label: "Subtotal",  value: fmtRs(inv.subtotal), bold: false },
            ...(inv.discount > 0 ? [{ label: "Discount", value: `-${fmtRs(inv.discount)}`, bold: false }] : []),
            { label: "Total",     value: fmtRs(inv.total),    bold: true  },
            { label: "Paid",      value: fmtRs(inv.paid),     bold: false },
            ...(Math.abs(balance) > 0 ? [{ label: "Balance Due", value: fmtRs(balance), bold: true }] : []),
          ].map(row => (
            <div key={row.label} style={{
              display: "flex", justifyContent: "space-between",
              padding: "6px 0", borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 12.5, color: row.bold ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: row.bold ? 700 : 400 }}>
                {row.label}
              </span>
              <span style={{
                fontSize: 12.5, fontWeight: row.bold ? 800 : 600,
                color: row.label === "Balance Due" && balance > 0 ? "#f87171" : "var(--text-primary)",
              }}>
                {row.value}
              </span>
            </div>
          ))}
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
            fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            <Printer size={14} /> Reprint Invoice
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Main Component ── */
export default function InvoiceHistory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState<InvoiceType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [viewInv,      setViewInv]      = useState<Invoice | null>(null);

  const filtered = useMemo(() => {
    return INVOICES.filter(inv => {
      const q = search.toLowerCase();
      const matchSearch = !q || inv.invoiceNo.toLowerCase().includes(q) || inv.customer.toLowerCase().includes(q) || inv.description.toLowerCase().includes(q);
      const matchType   = typeFilter   === "All" || inv.type   === typeFilter;
      const matchStatus = statusFilter === "All" || inv.status === statusFilter;
      const matchFrom   = !dateFrom || inv.date >= dateFrom;
      const matchTo     = !dateTo   || inv.date <= dateTo;
      return matchSearch && matchType && matchStatus && matchFrom && matchTo;
    });
  }, [search, typeFilter, statusFilter, dateFrom, dateTo]);

  const totals = useMemo(() => ({
    count:    filtered.length,
    revenue:  filtered.filter(i => i.status !== "Voided").reduce((a, b) => a + b.total, 0),
    unpaid:   filtered.filter(i => i.status === "Unpaid" || i.status === "Partial").reduce((a, b) => a + (b.total - b.paid), 0),
    voided:   filtered.filter(i => i.status === "Voided").length,
  }), [filtered]);

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "none" as const, paddingRight: 28 };

  const INV_HEADERS = ["Invoice No", "Date", "Customer", "Type", "Description", "Subtotal (Rs.)", "Discount (Rs.)", "Total (Rs.)", "Paid (Rs.)", "Status"];
  const invRows     = () => filtered.map(inv => [inv.invoiceNo, inv.date, inv.customer, inv.type, inv.description, inv.subtotal, inv.discount, inv.total, inv.paid, inv.status]);
  const invFilename = `invoices-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>

      {/* Summary chips + export */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Invoices",     value: totals.count,          color: "var(--accent)" },
          { label: "Total Billed", value: fmtRs(totals.revenue), color: "#4ade80" },
          { label: "Outstanding",  value: fmtRs(totals.unpaid),  color: "#f87171" },
          { label: "Voided",       value: totals.voided,         color: "#94a3b8" },
        ].map(c => (
          <div key={c.label} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{c.value}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <ExportButtons
            onPdf={()   => exportToPdf("Invoice History", INV_HEADERS, invRows(), invFilename)}
            onExcel={()  => exportToExcel(invFilename, "Invoices", INV_HEADERS, invRows())}
onPng={() => {
  if (!containerRef.current) return;
  return exportToPng(containerRef.current, invFilename);
}}          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            placeholder="Search invoice #, customer, description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} style={{ ...selectStyle, minWidth: 120 }}>
            <option value="All">All Types</option>
            <option value="Sales">Sales</option>
            <option value="Repair">Repair</option>
            <option value="Return">Return</option>
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>

        <div style={{ position: "relative" }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...selectStyle, minWidth: 120 }}>
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
            <option value="Voided">Voided</option>
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: 140 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
        <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ ...inputStyle, width: 140 }} />

        {(search || typeFilter !== "All" || statusFilter !== "All" || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(""); setTypeFilter("All"); setStatusFilter("All"); setDateFrom(""); setDateTo(""); }}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 8,
              padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", gap: 6,
            }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              {["Invoice #", "Date", "Customer", "Type", "Description", "Total", "Paid", "Status", ""].map(h => (
                <th key={h} style={{
                  padding: "11px 14px", textAlign: "left", fontWeight: 600,
                  fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.06em", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No invoices match your filters.
                </td>
              </tr>
            ) : filtered.map((inv, i) => {
              const typeCfg   = TYPE_CFG[inv.type];
              const statusCfg = STATUS_CFG[inv.status];
              const TypeIcon  = typeCfg.icon;
              return (
                <tr key={inv.id} style={{
                  borderBottom: "1px solid var(--border)",
                  background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)",
                  transition: "background 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "transparent" : "var(--bg-secondary)"}
                >
                  <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{inv.invoiceNo}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{fmtDate(inv.date)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-primary)" }}>{inv.customer}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <TypeIcon size={12} color={typeCfg.color} />
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: typeCfg.color,
                        background: `${typeCfg.color}14`, border: `1px solid ${typeCfg.color}30`,
                        padding: "2px 7px", borderRadius: 5,
                      }}>{inv.type}</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inv.description}
                  </td>
                  <td style={{ padding: "11px 14px", fontWeight: 700, color: inv.total < 0 ? "#f87171" : "var(--text-primary)", whiteSpace: "nowrap" }}>
                    {fmtRs(inv.total)}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{fmtRs(inv.paid)}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
                    }}>{inv.status}</span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <button onClick={() => setViewInv(inv)} title="View Invoice" style={{
                      width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)",
                      background: "var(--bg-card)", color: "var(--text-secondary)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewInv && <InvoiceModal inv={viewInv} onClose={() => setViewInv(null)} />}
    </div>
  );
}
