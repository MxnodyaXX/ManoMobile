"use client";

import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";

/**
 * The pieces the admin reference screens share.
 *
 * Pulled out of AdminControl when Repair Parts moved to Inventory Management:
 * two screens now render the same manager, and a second copy of these styles
 * would have drifted the moment either was touched. Nothing here is clever — it
 * is the table, form and confirm-dialog look every reference list in this app
 * already had, in one place instead of two.
 */

export const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)",
  fontSize: 13, width: "100%", outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, display: "block",
};

export const thStyle: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
  background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
};

export const tdStyle: React.CSSProperties = {
  padding: "12px 16px", fontSize: 13, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)", fontFamily: "'Plus Jakarta Sans', sans-serif",
};

export const btnAccent: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
  borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
  cursor: "pointer", fontSize: 12, fontWeight: 600,
  fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap",
};

export function DeleteConfirm({ name, message, onConfirm, onClose }: { name: string; message?: string; onConfirm: () => void; onClose: () => void }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: 360, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={16} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Remove Entry</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Cannot be undone</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
          Remove <strong style={{ color: "var(--text-primary)" }}>{name}</strong>? {message ?? "This won't affect existing inventory items."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Remove</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
