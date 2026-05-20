"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SplitSquareHorizontal, X, CheckCircle, AlertTriangle, CreditCard, Banknote } from "lucide-react";

export interface SplitPaymentResult {
  cashAmount: number;
  cardAmount: number;
  cardRef: string;
}

interface SplitPaymentModalProps {
  total: number;
  onConfirm: (result: SplitPaymentResult) => void;
  onClose: () => void;
}

export default function SplitPaymentModal({ total, onConfirm, onClose }: SplitPaymentModalProps) {
  const [cashAmount, setCashAmount] = useState(String(Math.floor(total / 2)));
  const [cardRef,    setCardRef]    = useState("");

  const cash    = Math.max(0, Number(cashAmount) || 0);
  const card    = Math.max(0, total - cash);
  const balance = cash + card - total;
  const valid   = cash >= 0 && card >= 0 && cash + card === total && (card === 0 || cardRef.trim().length > 0);

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 9, padding: "10px 12px", fontSize: 14, fontWeight: 700,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };

  const fmtRs = (n: number) => `Rs. ${n.toLocaleString()}`;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 420,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0,
          }}>
            <SplitSquareHorizontal size={18} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Split Payment</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Total: {fmtRs(total)}</p>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        {/* Summary bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Cash",  value: fmtRs(cash),  color: "#4ade80",   icon: Banknote },
            { label: "Card",  value: fmtRs(card),  color: "#60a5fa",   icon: CreditCard },
            { label: "Total", value: fmtRs(total), color: "var(--text-primary)", icon: CheckCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{
              background: "var(--bg-secondary)", borderRadius: 9, padding: "10px 12px", textAlign: "center",
            }}>
              <Icon size={14} color={color} style={{ marginBottom: 5 }} />
              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 800, color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Split bar visualization */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ height: 8, borderRadius: 6, background: "var(--border)", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${total > 0 ? (cash / total) * 100 : 0}%`, background: "#4ade80", transition: "width 0.25s" }} />
            <div style={{ flex: 1, background: "#60a5fa" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            <span>Cash {total > 0 ? Math.round((cash / total) * 100) : 0}%</span>
            <span>Card {total > 0 ? Math.round((card / total) * 100) : 0}%</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Cash Amount (Rs.)
            </label>
            <input
              type="number" min="0" max={total}
              value={cashAmount}
              onChange={e => setCashAmount(e.target.value)}
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Remaining on card: <strong style={{ color: card > 0 ? "#60a5fa" : "var(--text-muted)" }}>{fmtRs(card)}</strong>
            </p>
          </div>

          {card > 0 && (
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Card Reference No. *
              </label>
              <input
                placeholder="Bank approval code / last 4 digits"
                value={cardRef}
                onChange={e => setCardRef(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {cash > total && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "8px 12px" }}>
            <AlertTriangle size={13} color="#f87171" />
            <p style={{ fontSize: 12, color: "#f87171" }}>Cash amount exceeds total.</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", borderRadius: 9, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>Cancel</button>
          <button
            disabled={!valid}
            onClick={() => onConfirm({ cashAmount: cash, cardAmount: card, cardRef: cardRef.trim() })}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 9, border: "1px solid var(--accent-glow)",
              background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
              opacity: valid ? 1 : 0.4,
            }}>
            Confirm Split Payment
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
