"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, Minus, ShoppingBag, Check, AlertCircle } from "lucide-react";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;

/**
 * One product the customer is taking away with the repair.
 *
 * Held in the checkout's own state until Complete Sale — nothing is written
 * and no stock moves while it sits here. Removing a line before checkout is
 * therefore just removing it. Stock is deducted once, at commit, by the same
 * function the accessory counter uses, so a short shelf aborts the whole sale
 * rather than selling the phone and half the accessories.
 */
export interface ExtraLine {
  productId: number;
  code: string;
  name: string;
  qty: number;
  unitPrice: number;
  discount: number;
  /** What the shelf held when it was added — a warning, not a reservation. */
  stock: number;
}

export const extraLineTotal = (l: ExtraLine) => Math.max(0, l.qty * l.unitPrice - l.discount);

/**
 * Pick products from the accessory catalogue to add to a repair invoice.
 *
 * The same catalogue the Accessories counter sells from, searched the way a
 * cashier has the thing in their hand: by name, by code off the label, by
 * brand or by category. Quantities and the price are settled here; the line
 * discount is edited on the checkout, beside the repair discounts, so all the
 * concessions on one bill are in one place.
 */
export default function AddProductsModal({ existing, onAdd, onClose }: {
  /** Lines already on the checkout, so a second add of the same product bumps the quantity. */
  existing: ExtraLine[];
  onAdd: (lines: ExtraLine[]) => void;
  onClose: () => void;
}) {
  const { products, loading } = useAccessories();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<number, number>>({}); // productId → qty

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = products.filter(p => p.stock > 0 || picked[p.id]);
    if (!s) return list.slice(0, 40);
    return list.filter(p =>
      p.name.toLowerCase().includes(s) ||
      p.code.toLowerCase().includes(s) ||
      p.brand.toLowerCase().includes(s) ||
      p.category.toLowerCase().includes(s) ||
      p.subcategory.toLowerCase().includes(s) ||
      p.model.toLowerCase().includes(s),
    ).slice(0, 40);
  }, [products, q, picked]);

  const alreadyOn = (id: number) => existing.find(l => l.productId === id)?.qty ?? 0;
  const bump = (p: AccessoryProduct, by: number) =>
    setPicked(prev => {
      const next = Math.max(0, Math.min(p.stock - alreadyOn(p.id), (prev[p.id] ?? 0) + by));
      const copy = { ...prev };
      if (next === 0) delete copy[p.id]; else copy[p.id] = next;
      return copy;
    });

  const chosen = products.filter(p => picked[p.id]);
  const chosenTotal = chosen.reduce((s, p) => s + p.sellingPrice * picked[p.id], 0);

  const confirm = () => {
    onAdd(chosen.map(p => ({
      productId: p.id, code: p.code, name: p.name,
      qty: picked[p.id], unitPrice: p.sellingPrice, discount: 0, stock: p.stock,
    })));
    onClose();
  };

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px 10px 34px", borderRadius: 9,
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: 13.5, fontFamily: ff, outline: "none", boxSizing: "border-box",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{
        width: "min(720px, calc(100vw - 24px))", maxHeight: "88vh", display: "flex", flexDirection: "column",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff, overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <ShoppingBag size={16} color="var(--accent)" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Add products to this invoice</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>From the accessory shelf. Nothing leaves stock until the sale is completed.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, width: 28, height: 28, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "14px 20px 0", position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 32, top: 26, color: "var(--text-muted)" }} />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, code, brand or category — tempered glass, cover, charger, SIM…"
            style={input}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 20px" }}>
          {loading ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Loading the shelf…</p>
          ) : matches.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>
              {q.trim() ? "Nothing on the shelf matches that." : "Nothing in stock to add."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {matches.map(p => {
                const n = picked[p.id] ?? 0;
                const onBill = alreadyOn(p.id);
                const left = p.stock - onBill - n;
                return (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10,
                    background: n > 0 ? "var(--accent-dim)" : "var(--bg-secondary)",
                    border: `1px solid ${n > 0 ? "var(--accent-glow)" : "var(--border)"}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {p.code} · {p.category}{p.brand ? ` · ${p.brand}` : ""}
                        {" · "}
                        <span style={{ color: left <= 2 ? "#fbbf24" : "var(--text-muted)" }}>{left} in stock</span>
                        {onBill > 0 && <span style={{ color: "var(--accent)" }}> · {onBill} already on this bill</span>}
                      </p>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{rs(p.sellingPrice)}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => bump(p, -1)} disabled={n === 0} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: n === 0 ? "var(--text-muted)" : "var(--text-primary)", cursor: n === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: n === 0 ? 0.4 : 1 }}>
                        <Minus size={13} />
                      </button>
                      <span style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: n > 0 ? "var(--accent)" : "var(--text-muted)" }}>{n}</span>
                      <button onClick={() => bump(p, 1)} disabled={left <= 0} title={left <= 0 ? "No more on the shelf" : "Add one"} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${left <= 0 ? "var(--border)" : "var(--accent-glow)"}`, background: left <= 0 ? "transparent" : "var(--accent-dim)", color: left <= 0 ? "var(--text-muted)" : "var(--accent)", cursor: left <= 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: left <= 0 ? 0.4 : 1 }}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", gap: 8 }}>
            {chosen.length > 0 ? (
              <>
                <Check size={13} color="var(--accent)" />
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                  {chosen.reduce((s, p) => s + picked[p.id], 0)} item{chosen.reduce((s, p) => s + picked[p.id], 0) === 1 ? "" : "s"} ·{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{rs(chosenTotal)}</strong>
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nothing picked yet.</span>
              </>
            )}
          </div>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={chosen.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 13, fontWeight: 700, fontFamily: ff, cursor: chosen.length === 0 ? "not-allowed" : "pointer", opacity: chosen.length === 0 ? 0.5 : 1 }}
          >
            <Plus size={13} /> Add to invoice
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
