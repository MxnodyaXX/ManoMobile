"use client";

import React, { useState } from "react";
import { Search, Package, X, Plus, Minus, CheckCircle } from "lucide-react";
import { useTech } from "@/technician/contexts/TechContext";
import { SPARE_PARTS, type SparePart } from "@/technician/data/partsData";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

export default function PartRequestModal({ job, onClose }: { job: RepairJob; onClose: () => void }) {
  const { requestPart } = useTech();
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<SparePart | null>(null);
  const [qty, setQty]           = useState(1);
  const [note, setNote]         = useState("");
  const [done, setDone]         = useState(false);

  const filtered = SPARE_PARTS.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.compatibleWith.some(c => c.toLowerCase().includes(q))
    );
  });

  const submit = () => {
    if (!selected) return;
    requestPart({
      jobId: job.id,
      jobDevice: `${job.brand} ${job.model}`,
      partName: selected.name,
      partSku: selected.sku,
      quantity: qty,
      note: note || undefined,
    });
    setDone(true);
  };

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }}
        onClick={onClose}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 520, maxHeight: "85vh", background: "var(--bg-card)",
        borderRadius: 16, border: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        zIndex: 61, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
      }}>

        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Package size={16} color={TA} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Request Parts</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.brand} {job.model}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {done ? (
          /* ── Success ── */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 40 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${TA}14`, border: `1px solid ${TA}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={24} color={TA} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Request Submitted</p>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, textAlign: "center" }}>
              Your part request has been sent for approval.
            </p>
            <button onClick={onClose} style={{ marginTop: 8, padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: TA, border: "none", color: "#000", cursor: "pointer", fontFamily: ff }}>
              Done
            </button>
          </div>

        ) : selected ? (
          /* ── Step 2: qty + note ── */
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
              <button
                onClick={() => setSelected(null)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, fontFamily: ff, marginBottom: 16, padding: 0 }}
              >
                ← Back to parts list
              </button>

              <div style={{ padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: `1px solid ${TA}30`, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{selected.name}</p>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, flexShrink: 0, marginLeft: 8,
                    color: selected.stock > selected.reorderLevel ? TA : "#fbbf24",
                    background: selected.stock > selected.reorderLevel ? `${TA}14` : "rgba(251,191,36,0.1)",
                    fontFamily: ff,
                  }}>
                    {selected.stock} in stock
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>SKU: {selected.sku} · {selected.category} · {selected.location}</p>
              </div>

              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Quantity</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}
                  >
                    <Minus size={13} />
                  </button>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, minWidth: 24, textAlign: "center" }}>{qty}</span>
                  <button
                    onClick={() => setQty(q => Math.min(selected.stock, q + 1))}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Note (optional)</p>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Any additional details…"
                  rows={3}
                  style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none", resize: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
              <button
                onClick={submit}
                style={{ width: "100%", padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: TA, border: "none", color: "#000", cursor: "pointer", fontFamily: ff }}
              >
                Submit Request
              </button>
            </div>
          </>

        ) : (
          /* ── Step 1: browse parts ── */
          <>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  autoFocus
                  placeholder="Search by name, SKU, category or device…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px 8px 32px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12.5, fontFamily: ff, padding: "32px 0" }}>No parts found.</p>
              ) : filtered.map(part => (
                <button
                  key={part.id}
                  onClick={() => { setSelected(part); setQty(1); setNote(""); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", transition: "border-color 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = TA)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{part.name}</p>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, flexShrink: 0, marginLeft: 8,
                      color: part.stock > part.reorderLevel ? TA : "#fbbf24",
                      background: part.stock > part.reorderLevel ? `${TA}14` : "rgba(251,191,36,0.1)",
                      fontFamily: ff,
                    }}>
                      {part.stock} in stock
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{part.sku} · {part.category}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
