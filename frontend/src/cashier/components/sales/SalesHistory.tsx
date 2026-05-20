"use client";

import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useSales } from "@/cashier/contexts/SalesContext";
import type { TxCategory, TxStatus, SaleTx } from "@/cashier/contexts/SalesContext";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import ExportButtons from "@/cashier/components/shared/ExportButtons";
import { exportToPdf, exportToExcel, exportToPng } from "@/cashier/utils/exportUtils";
import {
  Search, Printer, XCircle, RotateCcw,
  ChevronDown, FileText, AlertTriangle, X, CheckCircle,
} from "lucide-react";


const STATUS_CFG: Record<TxStatus, { color: string; bg: string; border: string }> = {
  Paid:     { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)" },
  Voided:   { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  Returned: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)" },
};

const CAT_COLORS: Record<TxCategory, string> = {
  Accessories: "#60a5fa",
  Mobile:      "#a78bfa",
  Repair:      "#34d399",
  Others:      "#94a3b8",
};

function fmtRs(n: number) { return `Rs. ${n.toLocaleString()}`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

/* ── Void Confirmation Modal ── */
function VoidModal({ tx, onConfirm, onClose }: { tx: SaleTx; onConfirm: () => void; onClose: () => void }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 420,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", flexShrink: 0,
          }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Void Transaction</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{tx.invoiceNo}</p>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>This will permanently void:</p>
          <p style={{ color: "var(--text-primary)", fontWeight: 600 }}>{tx.items}</p>
          <p style={{ color: "#f87171", fontWeight: 700, marginTop: 6 }}>{fmtRs(tx.total)}</p>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          A voided transaction cannot be undone. Customer will need to be reimbursed separately if payment was received.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            Keep Transaction
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid rgba(248,113,113,0.3)",
            background: "rgba(248,113,113,0.1)", color: "#f87171", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            Void Transaction
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Return Modal ── */
function ReturnModal({ tx, onConfirm, onClose }: {
  tx: SaleTx;
  onConfirm: (amount: number, reason: string) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(tx.total));
  const [reason, setReason] = useState("");
  const [done,   setDone]   = useState(false);

  const isPartial = Number(amount) < tx.total && Number(amount) > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 9, padding: "10px 12px", fontSize: 13,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };

  const handleConfirm = () => {
    onConfirm(Number(amount), reason || "Customer return");
    setDone(true);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 460,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24",
            }}>
              <CheckCircle size={26} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Return Processed</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Rs. {Number(amount).toLocaleString()} refunded for {tx.invoiceNo}
              </p>
            </div>
            <button onClick={onClose} style={{
              padding: "9px 24px", borderRadius: 9, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
              fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24", flexShrink: 0,
              }}>
                <RotateCcw size={18} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Process Return</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{tx.invoiceNo} — {tx.customer}</p>
              </div>
              <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 14px", marginBottom: 18, fontSize: 13 }}>
              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Items</p>
              <p style={{ color: "var(--text-primary)" }}>{tx.items}</p>
              <p style={{ color: "var(--accent)", fontWeight: 700, marginTop: 6 }}>Original Total: Rs. {tx.total.toLocaleString()}</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Refund Amount (Rs.) {isPartial && <span style={{ color: "#fbbf24", marginLeft: 6 }}>Partial Return</span>}
                </label>
                <input
                  type="number" min="1" max={tx.total}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={inputStyle}
                />
                {Number(amount) > tx.total && (
                  <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>Cannot exceed original total.</p>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Return Reason
                </label>
                <select value={reason} onChange={e => setReason(e.target.value)} style={{ ...inputStyle, appearance: "none" as const, cursor: "pointer" }}>
                  <option value="">Select reason…</option>
                  <option value="Defective product">Defective product</option>
                  <option value="Wrong item sold">Wrong item sold</option>
                  <option value="Customer changed mind">Customer changed mind</option>
                  <option value="Item not as described">Item not as described</option>
                  <option value="Duplicate transaction">Duplicate transaction</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{
              background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
              borderRadius: 9, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#fbbf24",
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>A cash-out entry will be created for Rs. {Number(amount || 0).toLocaleString()} in the Cash Register. Ensure cash is returned to the customer.</span>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--border)",
                background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
                fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>Cancel</button>
              <button
                disabled={!amount || !reason || Number(amount) <= 0 || Number(amount) > tx.total}
                onClick={handleConfirm}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 9,
                  border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.1)",
                  color: "#fbbf24", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  opacity: !amount || !reason || Number(amount) <= 0 || Number(amount) > tx.total ? 0.4 : 1,
                }}>
                <RotateCcw size={13} style={{ marginRight: 6 }} />
                Confirm Return
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── Receipt Modal ── */
function ReceiptModal({ tx, onClose }: { tx: SaleTx; onClose: () => void }) {
  const handlePrint = () => {
    const id = "__receipt__";
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const now = new Date().toLocaleString("en-GB");
    const div = document.createElement("div");
    div.id = id;
    div.innerHTML = `
      <style>
        @media print {
          body > *:not(#${id}) { display: none !important; }
          #${id} { display: block !important; font-family: 'Courier New', monospace; font-size: 12px; max-width: 280px; margin: 0 auto; }
        }
        #${id} { display: none; }
        .r-center { text-align: center; }
        .r-bold   { font-weight: bold; }
        .r-line   { border-top: 1px dashed #000; margin: 6px 0; }
        .r-row    { display: flex; justify-content: space-between; margin: 3px 0; }
      </style>
      <div>
        <div class="r-center r-bold" style="font-size:16px">MANO MOBILE CENTRE</div>
        <div class="r-center" style="font-size:10px">Colombo, Sri Lanka | +94 77 123 4567</div>
        <div class="r-line"></div>
        <div class="r-center r-bold">SALES RECEIPT</div>
        <div class="r-line"></div>
        <div class="r-row"><span>${tx.invoiceNo}</span><span>${tx.date}</span></div>
        <div class="r-row"><span>Customer:</span><span>${tx.customer}</span></div>
        <div class="r-row"><span>Category:</span><span>${tx.category}</span></div>
        <div class="r-line"></div>
        <div style="margin: 4px 0">${tx.items}</div>
        <div class="r-line"></div>
        <div class="r-row r-bold"><span>TOTAL</span><span>${fmtRs(tx.total)}</span></div>
        <div class="r-row"><span>Status:</span><span>${tx.status}</span></div>
        <div class="r-line"></div>
        <div class="r-center" style="font-size:10px">Printed: ${now}</div>
        <div class="r-center" style="font-size:10px">Thank you for your business!</div>
      </div>
    `;
    document.body.appendChild(div);
    window.print();
    setTimeout(() => { const el = document.getElementById(id); if (el) el.remove(); }, 2000);
  };

  const cfg = STATUS_CFG[tx.status];

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 460,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)",
            }}>
              <FileText size={15} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{tx.invoiceNo}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(tx.date)}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            ["Customer",  tx.customer],
            ["Category",  tx.category],
            ["Total",     fmtRs(tx.total)],
            ["Status",    tx.status],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "10px 12px" }}>
              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k}</p>
              <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{v}</p>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Items</p>
          <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{tx.items}</p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            Close
          </button>
          <button onClick={handlePrint} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--accent-glow)",
            background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            <Printer size={14} /> Reprint Receipt
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Main Component ── */
export default function SalesHistory() {
  const { sales: txList, updateSale, returnSale } = useSales();
  const { addEntry } = useCashRegister();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search,   setSearch]   = useState("");
  const [catFilter, setCatFilter] = useState<TxCategory | "All">("All");
  const [statusFilter, setStatusFilter] = useState<TxStatus | "All">("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [voidTarget,   setVoidTarget]   = useState<SaleTx | null>(null);
  const [viewTarget,   setViewTarget]   = useState<SaleTx | null>(null);
  const [returnTarget, setReturnTarget] = useState<SaleTx | null>(null);

  const filtered = useMemo(() => {
    return txList.filter(tx => {
      const q = search.toLowerCase();
      const matchSearch = !q || tx.invoiceNo.toLowerCase().includes(q) || tx.customer.toLowerCase().includes(q) || tx.items.toLowerCase().includes(q);
      const matchCat    = catFilter    === "All" || tx.category === catFilter;
      const matchStatus = statusFilter === "All" || tx.status   === statusFilter;
      const matchFrom   = !dateFrom || tx.date >= dateFrom;
      const matchTo     = !dateTo   || tx.date <= dateTo;
      return matchSearch && matchCat && matchStatus && matchFrom && matchTo;
    });
  }, [txList, search, catFilter, statusFilter, dateFrom, dateTo]);

  const totals = useMemo(() => ({
    count: filtered.length,
    revenue: filtered.filter(t => t.status === "Paid").reduce((a, b) => a + b.total, 0),
    voided:  filtered.filter(t => t.status === "Voided").length,
    returned: filtered.filter(t => t.status === "Returned").length,
  }), [filtered]);

  const handleVoidConfirm = () => {
    if (!voidTarget) return;
    updateSale(voidTarget.id, { status: "Voided" });
    setVoidTarget(null);
  };

  const handleReturnConfirm = (amount: number, reason: string) => {
    if (!returnTarget) return;
    returnSale(returnTarget.id, amount, reason);
    addEntry("out", `Refund — ${returnTarget.invoiceNo} (${reason})`, amount);
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: "pointer", appearance: "none" as const, paddingRight: 28,
  };

  const PDF_HEADERS  = ["Invoice No", "Date", "Customer", "Category", "Items", "Total (Rs.)", "Status"];
  const excelRows    = () => filtered.map(tx => [tx.invoiceNo, tx.date, tx.customer, tx.category, tx.items, tx.total, tx.status]);
  const filename     = `sales-history-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>

      {/* Summary chips + export */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Transactions", value: totals.count, color: "var(--accent)" },
          { label: "Revenue (Paid)", value: fmtRs(totals.revenue), color: "#4ade80" },
          { label: "Voided", value: totals.voided, color: "#f87171" },
          { label: "Returned", value: totals.returned, color: "#fbbf24" },
        ].map(chip => (
          <div key={chip.label} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{chip.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: chip.color }}>{chip.value}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <ExportButtons
            onPdf={()   => exportToPdf("Sales History", PDF_HEADERS, excelRows(), filename)}
            onExcel={()  => exportToExcel(filename, "Sales History", PDF_HEADERS, excelRows())}
            onPng={()   => containerRef.current && exportToPng(containerRef.current, filename)}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            placeholder="Search invoice, customer, item…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value as any)} style={{ ...selectStyle, minWidth: 130 }}>
            <option value="All">All Categories</option>
            <option value="Accessories">Accessories</option>
            <option value="Mobile">Mobile</option>
            <option value="Repair">Repair</option>
            <option value="Others">Others</option>
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>

        <div style={{ position: "relative" }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...selectStyle, minWidth: 120 }}>
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Voided">Voided</option>
            <option value="Returned">Returned</option>
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: 140 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
        <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ ...inputStyle, width: 140 }} />

        {(search || catFilter !== "All" || statusFilter !== "All" || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(""); setCatFilter("All"); setStatusFilter("All"); setDateFrom(""); setDateTo(""); }}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 8,
              padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)",
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
              display: "flex", alignItems: "center", gap: 6,
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
              {["Invoice #", "Date", "Customer", "Category", "Items", "Total", "Status", "Actions"].map(h => (
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
                <td colSpan={8} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No transactions match your filters.
                </td>
              </tr>
            ) : filtered.map((tx, i) => {
              const cfg = STATUS_CFG[tx.status];
              const catColor = CAT_COLORS[tx.category];
              return (
                <tr key={tx.id} style={{
                  borderBottom: "1px solid var(--border)",
                  background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)",
                  transition: "background 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "transparent" : "var(--bg-secondary)"}
                >
                  <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{tx.invoiceNo}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{fmtDate(tx.date)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-primary)" }}>{tx.customer}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      color: catColor, background: `${catColor}14`, border: `1px solid ${catColor}30`,
                    }}>{tx.category}</span>
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.items}</td>
                  <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{fmtRs(tx.total)}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                    }}>{tx.status}</span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setViewTarget(tx)} title="View Receipt" style={{
                        width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)",
                        background: "var(--bg-card)", color: "var(--text-secondary)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <FileText size={13} />
                      </button>
                      {tx.status === "Paid" && (
                        <>
                          <button onClick={() => setReturnTarget(tx)} title="Process Return" style={{
                            width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(251,191,36,0.25)",
                            background: "rgba(251,191,36,0.07)", color: "#fbbf24",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <RotateCcw size={13} />
                          </button>
                          <button onClick={() => setVoidTarget(tx)} title="Void Transaction" style={{
                            width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(248,113,113,0.25)",
                            background: "rgba(248,113,113,0.07)", color: "#f87171",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <XCircle size={13} />
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

      {voidTarget   && <VoidModal   tx={voidTarget}   onConfirm={handleVoidConfirm}   onClose={() => setVoidTarget(null)} />}
      {returnTarget && <ReturnModal tx={returnTarget} onConfirm={handleReturnConfirm} onClose={() => setReturnTarget(null)} />}
      {viewTarget   && <ReceiptModal tx={viewTarget}  onClose={() => setViewTarget(null)} />}
    </div>
  );
}
