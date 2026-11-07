"use client";

import { useCallback, useEffect, useState } from "react";
import type { SparePart } from "@/cashier/contexts/PartsContext";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import { fetchPartBatches, fetchPartMovements, type PartBatch, type PartMovement } from "@/lib/purchasing/api";
import { Badge, ErrorNote, Modal, Rs, fmtDate, label, td, th } from "./ui";

const SOURCE: Record<PartBatch["source"], string> = {
  purchase: "Supplier invoice", opening: "Opening stock", adjustment: "Stock adjustment",
};
const KIND: Record<PartMovement["kind"], string> = {
  purchase: "Received", opening: "Opening stock", job: "Issued to a job",
  adjustment_in: "Adjusted up", adjustment_out: "Adjusted down", reversal: "Purchase voided",
};

/** A repair part's batches, used oldest first, and the movements behind its stock number. */
export default function PartBatchesModal({ part, onClose }: { part: SparePart; onClose: () => void }) {
  const [batches, setBatches] = useState<PartBatch[] | null>(null);
  const [moves, setMoves] = useState<PartMovement[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, m] = await Promise.all([fetchPartBatches(part.id), fetchPartMovements(part.id)]);
      setBatches(b); setMoves(m); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [part.id]);
  useEffect(() => { (async () => { await load(); })(); }, [load]);
  useRealtimeTable(["repair_part_batches", "repair_parts"], load);

  const batchNo = (id: number | null) => (id && batches?.find(b => b.id === id)?.batchNo) || "—";

  return (
    <Modal title={`${part.name} · batches`} subtitle={`${part.sku} · ${part.stock} in stock · latest cost ${Rs(part.costPrice)}`} onClose={onClose} width={860}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ErrorNote>{error}</ErrorNote>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>Batches</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead><tr>
                <th style={th}>Batch</th><th style={th}>From</th><th style={th}>Received</th><th style={{ ...th, textAlign: "right" }}>Qty</th>
                <th style={{ ...th, textAlign: "right" }}>Left</th><th style={{ ...th, textAlign: "right" }}>Cost/unit</th><th style={th}>Status</th>
              </tr></thead>
              <tbody>
                {batches?.length === 0 && <tr><td colSpan={7} style={{ ...td, color: "var(--text-muted)" }}>No batches yet.</td></tr>}
                {batches?.map(b => (
                  <tr key={b.id} style={{ opacity: b.status === "Reversed" ? 0.55 : 1 }}>
                    <td style={{ ...td, fontFamily: "monospace" }}>{b.batchNo}</td>
                    <td style={td}>{SOURCE[b.source]}{b.supplierName && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{b.supplierName}{b.invoiceNo ? ` · ${b.invoiceNo}` : ""}</div>}</td>
                    <td style={td}>{fmtDate(b.receivedOn)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{b.qtyReceived}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{b.qtyAvailable}</td>
                    <td style={{ ...td, textAlign: "right" }}>{Rs(b.unitCost)}</td>
                    <td style={td}><Badge tone={b.status === "Active" ? "green" : b.status === "Reversed" ? "red" : "grey"}>{b.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>Stock movements</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead><tr><th style={th}>When</th><th style={th}>What</th><th style={th}>Batch</th><th style={{ ...th, textAlign: "right" }}>Qty</th><th style={{ ...th, textAlign: "right" }}>Cost/unit</th></tr></thead>
              <tbody>
                {moves.length === 0 && <tr><td colSpan={5} style={{ ...td, color: "var(--text-muted)" }}>Nothing yet.</td></tr>}
                {moves.map(m => (
                  <tr key={m.id}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(m.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td style={td}>{KIND[m.kind]}{m.note && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{m.note}</div>}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{batchNo(m.batchId)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: m.qty > 0 ? "#16a34a" : "#dc2626" }}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                    <td style={{ ...td, textAlign: "right" }}>{m.unitCost == null ? "—" : Rs(m.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
