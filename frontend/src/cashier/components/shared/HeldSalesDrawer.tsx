"use client";

import { createPortal } from "react-dom";
import { PauseCircle, X, RotateCcw, Trash2, Clock } from "lucide-react";
import { useHeldSales, type HeldSale } from "@/cashier/contexts/HeldSalesContext";

interface HeldSalesDrawerProps {
  onClose: () => void;
  onResume: (sale: HeldSale) => void;
}

function fmtTime(d: Date) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function HeldSalesDrawer({ onClose, onResume }: HeldSalesDrawerProps) {
  const { heldSales, resumeSale, removeSale } = useHeldSales();

  const handleResume = (id: string) => {
    const sale = resumeSale(id);
    if (sale) {
      onResume(sale);
      onClose();
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1050, display: "flex" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
      <div style={{
        width: 380, background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column", height: "100%",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24", flexShrink: 0,
          }}>
            <PauseCircle size={17} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Held Transactions</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{heldSales.length} sale{heldSales.length !== 1 ? "s" : ""} on hold</p>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {heldSales.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-muted)" }}>
              <PauseCircle size={40} strokeWidth={1.5} />
              <p style={{ fontSize: 13, textAlign: "center" }}>No transactions on hold.<br />Use "Hold" to pause a sale and come back later.</p>
            </div>
          ) : heldSales.map(sale => (
            <div key={sale.id} style={{
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: 11, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {sale.label || (sale.customer || "Walk-in")}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={10} />
                    Held at {fmtTime(sale.heldAt)} · {sale.category}
                  </p>
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)" }}>
                  Rs. {sale.subtotal.toLocaleString()}
                </p>
              </div>

              <div style={{ marginBottom: 12 }}>
                {sale.items.slice(0, 3).map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>
                    <span>{item.name} × {item.qty}</span>
                    <span>Rs. {(item.price * item.qty).toLocaleString()}</span>
                  </div>
                ))}
                {sale.items.length > 3 && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>+{sale.items.length - 3} more items</p>
                )}
              </div>

              {sale.note && (
                <p style={{ fontSize: 11, color: "#fbbf24", marginBottom: 10, fontStyle: "italic" }}>Note: {sale.note}</p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleResume(sale.id)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--accent-glow)",
                  background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <RotateCcw size={12} /> Resume
                </button>
                <button onClick={() => removeSale(sale.id)} style={{
                  width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(248,113,113,0.25)",
                  background: "rgba(248,113,113,0.07)", color: "#f87171", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
