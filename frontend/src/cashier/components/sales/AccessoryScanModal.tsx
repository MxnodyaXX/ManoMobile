"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, Search, X } from "lucide-react";
import type { AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";

/**
 * What the counter does with a scan that didn't resolve to exactly one product.
 *
 *   "pick" — the barcode is on several products (unbranded stock often shares
 *            one across colours/models): choose which one is in hand.
 *   "link" — the barcode isn't on any product yet: find the product and link
 *            it, so the next scan of this box just works.
 *
 * `products` carries each product's *available* stock (catalogue stock minus
 * what's already in this cart), so out-of-stock lines can't be chosen.
 */
export default function AccessoryScanModal({ mode, barcode, products, onChoose, onLink, onClose }: {
  mode: "pick" | "link";
  barcode: string;
  products: AccessoryProduct[];
  onChoose: (p: AccessoryProduct) => void;
  /** Links the barcode, then adds the product. Throws to keep the modal open. */
  onLink: (p: AccessoryProduct) => Promise<void>;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [linking, setLinking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (mode === "pick" || !s) return products.slice(0, 50);
    return products.filter(p =>
      p.name.toLowerCase().includes(s) ||
      p.code.toLowerCase().includes(s) ||
      p.brand.toLowerCase().includes(s) ||
      p.category.toLowerCase().includes(s) ||
      p.model.toLowerCase().includes(s),
    ).slice(0, 50);
  }, [products, q, mode]);

  async function choose(p: AccessoryProduct) {
    if (mode === "pick") { onChoose(p); return; }
    if (linking !== null) return;
    setLinking(p.id);
    setError(null);
    try {
      await onLink(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLinking(null);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 480, maxHeight: "85vh", display: "flex", flexDirection: "column", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {mode === "pick" ? "Which product is this?" : "Barcode not linked yet"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {mode === "pick"
                ? <>Barcode <code>{barcode}</code> is on {products.length} products.</>
                : <>Pick the product for <code>{barcode}</code>. It will scan straight to it from now on.</>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}><X size={18} /></button>
        </div>

        {mode === "link" && (
          <div style={{ padding: "12px 20px 0", position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 31, top: 23, color: "var(--text-muted)" }} />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, code, brand or model"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
            />
          </div>
        )}

        {error && <div style={{ padding: "10px 20px 0", fontSize: 12, color: "#dc2626" }}>{error}</div>}

        <div style={{ padding: "12px 20px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {list.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>No products found</div>
          )}
          {list.map(p => {
            // Linking an out-of-stock product is still worth doing; only adding it isn't.
            const disabled = (mode === "pick" && p.stock <= 0) || linking !== null;
            return (
              <button
                key={p.id}
                onClick={() => void choose(p)}
                disabled={disabled}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)",
                  background: "var(--bg-primary)", cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled && linking !== p.id ? 0.5 : 1, textAlign: "left", fontFamily: "inherit",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {p.code} · {p.brand}{p.model ? ` · ${p.model}` : ""}{p.addedDate ? ` · added ${p.addedDate}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Rs. {p.sellingPrice.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: p.stock > 0 ? "var(--text-muted)" : "#ef4444", marginTop: 2, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    {linking === p.id ? "Linking…" : mode === "link" ? <><Link2 size={11} /> {p.stock} in stock</> : `${p.stock} in stock`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
