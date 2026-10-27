"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import { fetchProductBatches, fetchProductMovements, warrantyText, type Batch, type StockMovement } from "@/lib/purchasing/api";
import PurchaseInvoiceDetail from "./PurchaseInvoiceDetail";
import { Badge, ErrorNote, Modal, Rs, fmtDate, label, td, th } from "./ui";

const SOURCE: Record<Batch["source"], string> = {
  purchase: "Supplier invoice", opening: "Opening stock", adjustment: "Stock adjustment", return: "Returned (voided sale)",
};
const KIND: Record<StockMovement["kind"], string> = {
  purchase: "Received", opening: "Opening stock", sale: "Sold", void_return: "Sale voided — back in stock",
  adjustment_in: "Adjusted up", adjustment_out: "Adjusted down", reversal: "Purchase voided",
};

/**
 * A product's purchase batches — every lot it came in, from whom, at what
 * cost, under what warranty, and how much of each is left (sold FIFO) — plus
 * the movement history behind its stock number.
 */
export default function ProductBatchesModal({ product, onClose }: { product: AccessoryProduct; onClose: () => void }) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, m] = await Promise.all([fetchProductBatches(product.id), fetchProductMovements(product.id)]);
      setBatches(b); setMoves(m); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [product.id]);
  useEffect(() => { (async () => { await load(); })(); }, [load]);
  useRealtimeTable(["accessory_batches", "accessory_products"], load);

  const batchNo = (id: number | null) => (id && batches?.find(b => b.id === id)?.batchNo) || "—";
  const inBatches = (batches ?? []).filter(b => b.status !== "Reversed").reduce((s, b) => s + b.qtyAvailable, 0);

  return (
    <Modal
      title={`Purchase batches — ${product.name}`}
      subtitle={`${product.code}${product.labelBarcode ? ` · ${product.labelBarcode}` : ""} · ${product.stock} in stock${batches && inBatches !== product.stock ? ` (${inBatches} traced to batches)` : ""}`}
      onClose={onClose}
      width={1000}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ErrorNote>{error}</ErrorNote>
        {!batches && !error && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>}

        {batches && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr>
                <th style={th}>Batch</th><th style={th}>Supplier · invoice</th><th style={th}>Received</th>
                <th style={{ ...th, textAlign: "right" }}>Qty in</th><th style={{ ...th, textAlign: "right" }}>Left</th>
                <th style={{ ...th, textAlign: "right" }}>Cost/unit</th><th style={{ ...th, textAlign: "right" }}>Expected sell</th>
                <th style={th}>Warranty</th><th style={th}>Status</th>
              </tr></thead>
              <tbody>
                {batches.length === 0 && <tr><td colSpan={9} style={{ ...td, color: "var(--text-muted)" }}>No batches yet — stock comes in as a batch when a supplier invoice is received.</td></tr>}
                {batches.map(b => (
                  <tr key={b.id} style={{ opacity: b.status === "Reversed" ? 0.5 : 1 }}>
                    <td style={{ ...td, fontFamily: "monospace" }}>{b.batchNo}<div style={{ fontFamily: "inherit", fontSize: 10.5, color: "var(--text-muted)" }}>{SOURCE[b.source]}</div></td>
                    <td style={td}>
                      {b.supplierName || "—"}
                      {b.invoiceId && (
                        <div><button onClick={() => setInvoiceId(b.invoiceId)} style={{ border: "none", background: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>{b.invoiceNo ?? "Invoice"}</button></div>
                      )}
                    </td>
                    <td style={td}>{fmtDate(b.receivedOn)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{b.qtyReceived}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{b.qtyAvailable}</td>
                    <td style={{ ...td, textAlign: "right" }}>{Rs(b.unitCost)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{b.expectedSellPrice ? Rs(b.expectedSellPrice) : "—"}</td>
                    <td style={{ ...td, fontSize: 11.5 }}>
                      <div>Supplier: {b.supplierWarrantyDays == null ? "none" : warrantyText(b.supplierWarrantyDays)}</div>
                      <div>Customer: {b.customerWarrantyDays == null ? "shop policy" : warrantyText(b.customerWarrantyDays)}</div>
                    </td>
                    <td style={td}><Badge tone={b.status === "Active" ? "green" : b.status === "Reversed" ? "red" : "grey"}>{b.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {moves.length > 0 && (
          <div>
            <div style={{ ...label, marginBottom: 6 }}>Stock movements (latest {moves.length})</div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={th}>When</th><th style={th}>What</th><th style={{ ...th, textAlign: "right" }}>Qty</th><th style={th}>Batch</th><th style={{ ...th, textAlign: "right" }}>Cost</th><th style={th}>Ref</th></tr></thead>
                <tbody>
                  {moves.map(m => (
                    <tr key={m.id}>
                      <td style={td}>{new Date(m.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td style={td}>{KIND[m.kind]}{m.note && <span style={{ color: "var(--text-muted)" }}> · {m.note}</span>}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: m.qty > 0 ? "#16a34a" : "#dc2626" }}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{batchNo(m.batchId)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{m.unitCost == null ? "—" : Rs(m.unitCost)}</td>
                      <td style={td}>{m.invoiceNo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {invoiceId !== null && (
        <PurchaseInvoiceDetail invoiceId={invoiceId} onClose={() => setInvoiceId(null)} onEdit={() => setInvoiceId(null)} onChanged={() => void load()} />
      )}
    </Modal>
  );
}
