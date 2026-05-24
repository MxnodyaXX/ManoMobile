"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, Trash2, X, Check, Package } from "lucide-react";
import { useAdmin, type PurchaseOrder, type POStatus, type POItem } from "@/admin/contexts/AdminContext";

const AA = "#a78bfa";
const ff = "'Plus Jakarta Sans', sans-serif";

const STATUS_CFG: Record<POStatus, { color: string; bg: string; border: string }> = {
  Draft:               { color: "#9ca3af", bg: "rgba(107,114,128,0.1)",  border: "rgba(107,114,128,0.2)"  },
  Approved:            { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",   border: "rgba(96,165,250,0.2)"   },
  Sent:                { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   border: "rgba(251,191,36,0.2)"   },
  "Partially Received":{ color: "#f97316", bg: "rgba(249,115,22,0.1)",   border: "rgba(249,115,22,0.2)"   },
  Received:            { color: "#34d399", bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.2)"   },
  Cancelled:           { color: "#f87171", bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.2)"  },
};

const NEXT_STATUS: Partial<Record<POStatus, POStatus[]>> = {
  Draft:    ["Approved", "Cancelled"],
  Approved: ["Sent", "Cancelled"],
  Sent:     ["Partially Received", "Received", "Cancelled"],
  "Partially Received": ["Received", "Cancelled"],
};

const inp: React.CSSProperties = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 11px", fontSize: 12.5,
  color: "var(--text-primary)", fontFamily: ff, outline: "none",
  width: "100%", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em",
  fontFamily: ff, marginBottom: 5, display: "block",
};

let itemSeq = 20;

function NewPOModal({ onSave, onClose }: { onSave: (po: Omit<PurchaseOrder, "id">) => void; onClose: () => void }) {
  const { suppliers } = useAdmin();
  const [supplierId, setSupplierId]   = useState(suppliers[0]?.id ?? "");
  const [delivery, setDelivery]       = useState(new Date(Date.now() + 7*86400_000).toISOString().slice(0, 10));
  const [notes, setNotes]             = useState("");
  const [items, setItems]             = useState<POItem[]>([
    { id: `i${++itemSeq}`, description: "", sku: "", quantity: 1, unitPrice: 0, receivedQty: 0 },
  ]);

  const setItem = (idx: number, k: keyof POItem, v: any) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, [k]: v } : it));

  const addItem    = () => setItems(p => [...p, { id: `i${++itemSeq}`, description: "", sku: "", quantity: 1, unitPrice: 0, receivedQty: 0 }]);
  const removeItem = (idx: number) => setItems(p => p.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const tax      = Math.round(subtotal * 0.18);
  const total    = subtotal + tax;

  const supplier = suppliers.find(s => s.id === supplierId);
  const valid    = supplierId && delivery && items.every(it => it.description.trim() && it.quantity > 0 && it.unitPrice > 0);

  const submit = () => {
    if (!valid || !supplier) return;
    onSave({
      supplierId, supplierName: supplier.name, status: "Draft",
      items, subtotal, tax, total,
      expectedDelivery: delivery, createdAt: new Date().toISOString().slice(0, 10), notes,
    });
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70 }} onClick={onClose} />
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 71, padding: 20 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "26px 26px 22px", width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 18, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Create Purchase Order</p>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
          </div>

          {/* Header fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={lbl}>Supplier *</label>
              <select style={{ ...inp }} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                {suppliers.filter(s => s.status === "Active").map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Expected Delivery</label>
              <input style={inp} type="date" value={delivery} onChange={e => setDelivery(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Notes</label>
              <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Line Items *</label>
              <button onClick={addItem} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: AA, background: `${AA}12`, border: `1px solid ${AA}30`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontFamily: ff }}>
                <Plus size={11} /> Add Item
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((it, idx) => (
                <div key={it.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "center", padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
                  <input style={{ ...inp, padding: "7px 10px" }} value={it.description} onChange={e => setItem(idx, "description", e.target.value)} placeholder="Description *" />
                  <input style={{ ...inp, padding: "7px 10px" }} value={it.sku ?? ""} onChange={e => setItem(idx, "sku", e.target.value)} placeholder="SKU" />
                  <input style={{ ...inp, padding: "7px 10px" }} type="number" min={1} value={it.quantity} onChange={e => setItem(idx, "quantity", Number(e.target.value))} placeholder="Qty" />
                  <input style={{ ...inp, padding: "7px 10px" }} type="number" min={0} value={it.unitPrice} onChange={e => setItem(idx, "unitPrice", Number(e.target.value))} placeholder="Unit Price" />
                  <button onClick={() => removeItem(idx)} disabled={items.length === 1} style={{ background: "none", border: "none", cursor: items.length === 1 ? "not-allowed" : "pointer", color: "var(--text-muted)", padding: 4, opacity: items.length === 1 ? 0.3 : 1 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div style={{ padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
            {[["Subtotal", subtotal], ["VAT (18%)", tax], ["Total", total]].map(([label, amt]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff, fontWeight: label === "Total" ? 700 : 400 }}>{label as string}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: label === "Total" ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: ff }}>Rs. {(amt as number).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "var(--bg-secondary)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff }}>Cancel</button>
            <button disabled={!valid} onClick={submit} style={{ padding: "9px 20px", borderRadius: 9, background: valid ? `${AA}18` : "var(--bg-secondary)", border: `1px solid ${valid ? AA + "50" : "var(--border)"}`, cursor: valid ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 700, color: valid ? AA : "var(--text-muted)", fontFamily: ff }}>
              Create PO (Draft)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PurchaseOrders() {
  const { purchaseOrders, addPurchaseOrder, updatePOStatus } = useAdmin();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNew, setShowNew]   = useState(false);
  const [statusFilter, setFilt] = useState<POStatus | "All">("All");

  const filtered = statusFilter === "All" ? purchaseOrders : purchaseOrders.filter(p => p.status === statusFilter);
  const sorted   = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const stats = {
    total:    purchaseOrders.length,
    open:     purchaseOrders.filter(p => ["Draft","Approved","Sent","Partially Received"].includes(p.status)).length,
    pipeline: purchaseOrders.filter(p => !["Received","Cancelled"].includes(p.status)).reduce((s, p) => s + p.total, 0),
  };

  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding: "5px 11px", borderRadius: 7, fontSize: 11.5, fontWeight: active ? 700 : 500,
    color: active ? AA : "var(--text-secondary)", background: active ? `${AA}12` : "var(--bg-card)",
    border: `1px solid ${active ? AA + "45" : "var(--border)"}`, cursor: "pointer", fontFamily: ff,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Purchase Orders</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>{stats.open} open · Rs. {stats.pipeline.toLocaleString()} pipeline value</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, background: `${AA}18`, border: `1px solid ${AA}40`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: AA, fontFamily: ff }}>
          <Plus size={14} /> New PO
        </button>
      </div>

      {/* Status filter */}
      <div className="fade-up" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => setFilt("All")} style={filterBtn(statusFilter === "All")}>All ({purchaseOrders.length})</button>
        {(Object.keys(STATUS_CFG) as POStatus[]).map(s => {
          const count = purchaseOrders.filter(p => p.status === s).length;
          if (count === 0) return null;
          return <button key={s} onClick={() => setFilt(s)} style={filterBtn(statusFilter === s)}>{s} ({count})</button>;
        })}
      </div>

      {/* PO list */}
      <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: ff }}>No purchase orders</div>
        ) : sorted.map(po => {
          const cfg    = STATUS_CFG[po.status];
          const isOpen = expanded === po.id;
          const nexts  = NEXT_STATUS[po.status] ?? [];
          return (
            <div key={po.id} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : po.id)}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${cfg.color}14`, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Package size={14} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{po.id}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: ff }}>{po.status}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>{po.supplierName} · {po.items.length} item{po.items.length !== 1 ? "s" : ""} · Expected {po.expectedDelivery}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: ff }}>Rs. {po.total.toLocaleString()}</p>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>incl. VAT</p>
                </div>
                {isOpen ? <ChevronDown size={15} color="var(--text-muted)" /> : <ChevronRight size={15} color="var(--text-muted)" />}
              </div>

              {/* Expanded */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Items table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)" }}>
                        {["Description", "SKU", "Qty", "Unit Price", "Received", "Line Total"].map(h => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: ff }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map(it => (
                        <tr key={it.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 10px", color: "var(--text-primary)", fontFamily: ff, fontWeight: 600 }}>{it.description}</td>
                          <td style={{ padding: "8px 10px", color: "var(--text-muted)", fontFamily: ff }}>{it.sku ?? "—"}</td>
                          <td style={{ padding: "8px 10px", color: "var(--text-primary)", fontFamily: ff }}>{it.quantity}</td>
                          <td style={{ padding: "8px 10px", color: "var(--text-secondary)", fontFamily: ff }}>Rs. {it.unitPrice.toLocaleString()}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: ff, color: it.receivedQty >= it.quantity ? "#34d399" : it.receivedQty > 0 ? "#f59e0b" : "var(--text-muted)" }}>
                              {it.receivedQty}/{it.quantity}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Rs. {(it.quantity * it.unitPrice).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Footer: totals + actions */}
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {nexts.map(next => (
                        <button key={next} onClick={() => updatePOStatus(po.id, next)} style={{
                          padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: ff, cursor: "pointer",
                          background: next === "Cancelled" ? "rgba(248,113,113,0.1)" : `${AA}14`,
                          border: `1px solid ${next === "Cancelled" ? "rgba(248,113,113,0.3)" : AA + "35"}`,
                          color: next === "Cancelled" ? "#f87171" : AA,
                        }}>
                          {next === "Cancelled" ? "Cancel PO" : `Mark ${next}`}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      {[["Subtotal", po.subtotal], ["VAT (18%)", po.tax], ["Total", po.total]].map(([l, v]) => (
                        <div key={l as string} style={{ display: "flex", gap: 14 }}>
                          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{l as string}</span>
                          <span style={{ fontSize: 12, fontWeight: l === "Total" ? 700 : 500, color: l === "Total" ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: ff, minWidth: 100, textAlign: "right" }}>Rs. {(v as number).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {po.notes && <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 8 }}>Note: {po.notes}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNew && <NewPOModal onSave={po => { addPurchaseOrder(po); setShowNew(false); }} onClose={() => setShowNew(false)} />}
    </div>
  );
}
