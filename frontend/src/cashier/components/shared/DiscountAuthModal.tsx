"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X, Eye, EyeOff, AlertTriangle, CheckCircle } from "lucide-react";

const MANAGER_PIN = "1234";

interface DiscountAuthModalProps {
  discountPct: number;
  itemName: string;
  onApproved: () => void;
  onClose: () => void;
}

export default function DiscountAuthModal({ discountPct, itemName, onApproved, onClose }: DiscountAuthModalProps) {
  const [pin,      setPin]      = useState("");
  const [showPin,  setShowPin]  = useState(false);
  const [error,    setError]    = useState("");
  const [approved, setApproved] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 9, padding: "11px 40px 11px 14px", fontSize: 20, fontWeight: 700,
    color: "var(--text-primary)", fontFamily: "monospace", outline: "none",
    letterSpacing: "0.3em", textAlign: "center",
  };

  const handleSubmit = () => {
    if (pin === MANAGER_PIN) {
      setError("");
      setApproved(true);
      setTimeout(() => {
        onApproved();
        onClose();
      }, 800);
    } else {
      setError("Incorrect PIN. Try again.");
      setPin("");
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 380,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28, textAlign: "center",
      }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
          <X size={15} />
        </button>

        {approved ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "10px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80",
            }}>
              <CheckCircle size={26} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Discount Approved</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{discountPct}% discount authorized by manager.</p>
          </div>
        ) : (
          <>
            <div style={{
              width: 52, height: 52, borderRadius: 15, margin: "0 auto 16px",
              background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24",
            }}>
              <ShieldCheck size={24} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Manager Authorization</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
              A <strong style={{ color: "#fbbf24" }}>{discountPct}% discount</strong> on <em>{itemName}</em> requires manager approval.
              Enter the manager PIN to continue.
            </p>

            <div style={{ position: "relative", marginBottom: error ? 8 : 20 }}>
              <input
                type={showPin ? "text" : "password"}
                maxLength={6}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                onKeyDown={e => e.key === "Enter" && pin.length >= 4 && handleSubmit()}
                placeholder="• • • •"
                style={inputStyle}
                autoFocus
              />
              <button
                onClick={() => setShowPin(v => !v)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, justifyContent: "center" }}>
                <AlertTriangle size={13} color="#f87171" />
                <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>
              </div>
            )}

            {/* PIN pad */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => setPin(p => p.length < 6 ? p + n : p)} style={{
                  padding: "13px 0", borderRadius: 9, border: "1px solid var(--border)",
                  background: "var(--bg-secondary)", color: "var(--text-primary)",
                  fontSize: 16, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: "background 0.1s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--border)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)"}
                >{n}</button>
              ))}
              <button onClick={() => setPin("")} style={{
                padding: "13px 0", borderRadius: 9, border: "1px solid var(--border)",
                background: "var(--bg-secondary)", color: "#f87171",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>CLR</button>
              <button onClick={() => setPin(p => p.length < 6 ? p + "0" : p)} style={{
                padding: "13px 0", borderRadius: 9, border: "1px solid var(--border)",
                background: "var(--bg-secondary)", color: "var(--text-primary)",
                fontSize: 16, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>0</button>
              <button onClick={() => setPin(p => p.slice(0, -1))} style={{
                padding: "13px 0", borderRadius: 9, border: "1px solid var(--border)",
                background: "var(--bg-secondary)", color: "var(--text-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>⌫</button>
            </div>

            <button
              disabled={pin.length < 4}
              onClick={handleSubmit}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10,
                border: "1px solid var(--accent-glow)", background: "var(--accent-dim)",
                color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 700,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: pin.length < 4 ? 0.4 : 1,
              }}>
              Authorize Discount
            </button>

            <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10 }}>
              Default PIN: 1234 (change in Admin Control)
            </p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
