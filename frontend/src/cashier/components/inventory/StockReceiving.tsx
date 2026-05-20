"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Plus, X, CheckCircle, Clock, Truck, Package,
  ChevronDown, Search, AlertTriangle, FileText,
} from "lucide-react";
import { useInventory } from "@/cashier/contexts/InventoryContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type POStatus = "Draft" | "Ordered" | "Partially Received" | "Received" | "Cancelled";

interface POLineItem {
  id: string;
  productCode: string;
  productName: string;
  category: string;
  brand: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  status: POStatus;
  createdAt: string;
  expectedDate: string;
  receivedAt?: string;
  items: POLineItem[];
  notes: string;
  totalCost: number;
  createdBy: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_POS: PurchaseOrder[] = [
  {
    id: "po-1", poNumber: "PO-2026-001", supplier: "AccessoryHub",
    status: "Received", createdAt: "2026-05-10", expectedDate: "2026-05-14", receivedAt: "2026-05-14",
    createdBy: "Admin", notes: "Monthly restock",
    totalCost: 18500,
    items: [
      { id: "l1", productCode: "TG-001", productName: "Tempered Glass", category: "Screen Protector", brand: "Baseus",  orderedQty: 30, receivedQty: 30, unitCost: 250 },
      { id: "l2", productCode: "PC-002", productName: "Phone Case",     category: "Case",             brand: "Spigen",  orderedQty: 20, receivedQty: 20, unitCost: 800 },
    ],
  },
  {
    id: "po-2", poNumber: "PO-2026-002", supplier: "CableWorld",
    status: "Ordered", createdAt: "2026-05-17", expectedDate: "2026-05-22",
    createdBy: "Admin", notes: "Urgent — USB-C cables low",
    totalCost: 10500,
    items: [
      { id: "l3", productCode: "CB-003", productName: "USB-C Cable",     category: "Cable",   brand: "Anker",   orderedQty: 30, receivedQty: 0, unitCost: 350 },
    ],
  },
  {
    id: "po-3", poNumber: "PO-2026-003", supplier: "AudioZone",
    status: "Partially Received", createdAt: "2026-05-18", expectedDate: "2026-05-20",
    createdBy: "Admin", notes: "",
    totalCost: 25000,
    items: [
      { id: "l4", productCode: "EW-005", productName: "TWS Earbuds",          category: "Audio",   brand: "JBL",    orderedQty: 10, receivedQty: 5, unitCost: 2500 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Rs = (n: number) => `Rs. ${n.toLocaleString()}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_CFG: Record<POStatus, { color: string; bg: string; border: string }> = {
  "Draft":               { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  "Ordered":             { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
  "Partially Received":  { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  "Received":            { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
  "Cancelled":           { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
};

// ─── Receive Stock Modal ───────────────────────────────────────────────────────

function ReceiveModal({ po, onReceive, onClose }: {
  po: PurchaseOrder;
  onReceive: (poId: string, received: Record<string, number>) => void;
  onClose: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(po.items.map(i => [i.id, String(i.orderedQty - i.receivedQty)]))
  );
  const [done, setDone] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: 80, background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 7, padding: "7px 10px", fontSize: 13, fontWeight: 700,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
    textAlign: "center",
  };

  const handleConfirm = () => {
    const received = Object.fromEntries(
      Object.entries(quantities).map(([k, v]) => [k, Math.max(0, Number(v) || 0)])
    );
    onReceive(po.id, received);
    setDone(true);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 560,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80",
            }}>
              <CheckCircle size={26} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Stock Received</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Inventory has been updated for {po.poNumber}.</p>
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
                background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0,
              }}>
                <Truck size={18} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Receive Stock — {po.poNumber}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Supplier: {po.supplier}</p>
              </div>
              <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    {["Item", "Ordered", "Already Received", "Receiving Now"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {po.items.map(item => {
                    const remaining = item.orderedQty - item.receivedQty;
                    return (
                      <tr key={item.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "11px 14px" }}>
                          <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{item.productName}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.productCode} · {item.brand}</p>
                        </td>
                        <td style={{ padding: "11px 14px", color: "var(--text-primary)", fontWeight: 600 }}>{item.orderedQty}</td>
                        <td style={{ padding: "11px 14px", color: item.receivedQty > 0 ? "#4ade80" : "var(--text-muted)" }}>{item.receivedQty}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <input
                            type="number" min="0" max={remaining}
                            value={quantities[item.id]}
                            onChange={e => setQuantities(p => ({ ...p, [item.id]: e.target.value }))}
                            style={inputStyle}
                          />
                          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>/ {remaining} rem.</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--border)",
                background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
                fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>Cancel</button>
              <button onClick={handleConfirm} style={{
                flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--accent-glow)",
                background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}>
                <CheckCircle size={14} /> Confirm Receipt
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── New PO Modal ──────────────────────────────────────────────────────────────

function NewPOModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (po: PurchaseOrder) => void;
}) {
  const { suppliers } = useInventory();
  const [supplier,      setSupplier]      = useState("");
  const [expectedDate,  setExpectedDate]  = useState("");
  const [notes,         setNotes]         = useState("");
  const [items,         setItems]         = useState<Omit<POLineItem, "id" | "receivedQty">[]>([
    { productCode: "", productName: "", category: "", brand: "", orderedQty: 1, unitCost: 0 },
  ]);

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
    width: "100%",
  };

  const totalCost = items.reduce((s, i) => s + (i.orderedQty * i.unitCost), 0);
  const canCreate = supplier && expectedDate && items.every(i => i.productName && i.orderedQty > 0 && i.unitCost > 0);

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleCreate = () => {
    const po: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      supplier,
      status: "Ordered",
      createdAt: new Date().toISOString().slice(0, 10),
      expectedDate,
      notes,
      totalCost,
      createdBy: "Admin",
      items: items.map((item, i) => ({ ...item, id: `li-${Date.now()}-${i}`, receivedQty: 0 })),
    };
    onCreate(po);
    onClose();
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 700, maxHeight: "90vh",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0,
          }}>
            <FileText size={17} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>New Purchase Order</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Create a new PO to restock inventory from a supplier.</p>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* PO Header fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Supplier *</label>
              <select value={supplier} onChange={e => setSupplier(e.target.value)} style={{ ...inputStyle, appearance: "none" as const, cursor: "pointer" }}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Expected Delivery *</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</label>
              <input placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Line items */}
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Line Items</p>
          <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)" }}>
                  {["Item Name", "Code", "Brand", "Category", "Qty", "Unit Cost (Rs.)", ""].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 10px" }}>
                      <input placeholder="Product name" value={item.productName} onChange={e => updateItem(idx, "productName", e.target.value)} style={{ ...inputStyle, minWidth: 140 }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input placeholder="SKU" value={item.productCode} onChange={e => updateItem(idx, "productCode", e.target.value)} style={{ ...inputStyle, width: 80 }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input placeholder="Brand" value={item.brand} onChange={e => updateItem(idx, "brand", e.target.value)} style={{ ...inputStyle, width: 90 }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input placeholder="Category" value={item.category} onChange={e => updateItem(idx, "category", e.target.value)} style={{ ...inputStyle, width: 110 }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input type="number" min="1" value={item.orderedQty} onChange={e => updateItem(idx, "orderedQty", Number(e.target.value))} style={{ ...inputStyle, width: 60, textAlign: "center" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input type="number" min="0" value={item.unitCost || ""} onChange={e => updateItem(idx, "unitCost", Number(e.target.value))} style={{ ...inputStyle, width: 90 }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {items.length > 1 && (
                        <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 4 }}>
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setItems(p => [...p, { productCode: "", productName: "", category: "", brand: "", orderedQty: 1, unitCost: 0 }])}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-secondary)", cursor: "pointer", fontSize: 12.5,
              fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 16,
            }}
          >
            <Plus size={13} /> Add Line Item
          </button>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Cost</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{Rs(totalCost)}</p>
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>Cancel</button>
          <button
            disabled={!canCreate}
            onClick={handleCreate}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 9, border: "1px solid var(--accent-glow)",
              background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
              opacity: canCreate ? 1 : 0.4,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}>
            <Truck size={14} /> Create Purchase Order
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main StockReceiving Component ────────────────────────────────────────────

export default function StockReceiving() {
  const [orders,        setOrders]        = useState<PurchaseOrder[]>(SEED_POS);
  const [showNewPO,     setShowNewPO]     = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [statusFilter,  setStatusFilter]  = useState<POStatus | "All">("All");
  const [search,        setSearch]        = useState("");

  const filtered = useMemo(() => orders.filter(po => {
    if (statusFilter !== "All" && po.status !== statusFilter) return false;
    const q = search.toLowerCase();
    if (q && !po.poNumber.toLowerCase().includes(q) && !po.supplier.toLowerCase().includes(q)) return false;
    return true;
  }), [orders, statusFilter, search]);

  const handleReceive = (poId: string, received: Record<string, number>) => {
    setOrders(prev => prev.map(po => {
      if (po.id !== poId) return po;
      const updatedItems = po.items.map(item => ({
        ...item,
        receivedQty: item.receivedQty + (received[item.id] ?? 0),
      }));
      const allReceived = updatedItems.every(i => i.receivedQty >= i.orderedQty);
      const anyReceived = updatedItems.some(i => i.receivedQty > 0);
      return {
        ...po,
        items: updatedItems,
        status: allReceived ? "Received" : anyReceived ? "Partially Received" : po.status,
        receivedAt: allReceived ? new Date().toISOString().slice(0, 10) : po.receivedAt,
      };
    }));
  };

  const handleCreate = (po: PurchaseOrder) => {
    setOrders(prev => [po, ...prev]);
  };

  const stats = {
    total:    orders.length,
    ordered:  orders.filter(p => p.status === "Ordered").length,
    partial:  orders.filter(p => p.status === "Partially Received").length,
    received: orders.filter(p => p.status === "Received").length,
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total POs",  value: stats.total,    color: "var(--text-primary)" },
          { label: "Ordered",    value: stats.ordered,  color: "#60a5fa" },
          { label: "Partial",    value: stats.partial,  color: "#fbbf24" },
          { label: "Received",   value: stats.received, color: "#4ade80" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            placeholder="Search PO number, supplier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>
        <div style={{ position: "relative" }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...inputStyle, paddingRight: 28, minWidth: 160, appearance: "none" as const, cursor: "pointer" }}>
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Ordered">Ordered</option>
            <option value="Partially Received">Partially Received</option>
            <option value="Received">Received</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>
        <button
          onClick={() => setShowNewPO(true)}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
            borderRadius: 9, border: "1px solid var(--accent-glow)", background: "var(--accent-dim)",
            color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
          <Plus size={14} /> New Purchase Order
        </button>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)" }}>
              {["PO Number", "Supplier", "Items", "Total Cost", "Expected", "Received At", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No purchase orders found.
                </td>
              </tr>
            ) : filtered.map((po, i) => {
              const cfg = STATUS_CFG[po.status];
              const canReceive = po.status === "Ordered" || po.status === "Partially Received";
              return (
                <tr key={po.id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 1 ? "var(--bg-secondary)" : "transparent" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 12 }}>{po.poNumber}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-primary)" }}>{po.supplier}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)" }}>
                    {po.items.length} item{po.items.length > 1 ? "s" : ""}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
                      ({po.items.reduce((s, i) => s + i.orderedQty, 0)} units)
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{Rs(po.totalCost)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(po.expectedDate)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {po.receivedAt ? fmtDate(po.receivedAt) : "—"}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, whiteSpace: "nowrap",
                    }}>{po.status}</span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    {canReceive && (
                      <button onClick={() => setReceiveTarget(po)} style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7,
                        border: "1px solid var(--accent-glow)", background: "var(--accent-dim)",
                        color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                        fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap",
                      }}>
                        <Truck size={12} /> Receive
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNewPO    && <NewPOModal onClose={() => setShowNewPO(false)} onCreate={handleCreate} />}
      {receiveTarget && <ReceiveModal po={receiveTarget} onReceive={handleReceive} onClose={() => setReceiveTarget(null)} />}
    </div>
  );
}
