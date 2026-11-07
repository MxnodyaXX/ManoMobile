"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import { useToast } from "@/lib/ui/toast";
import { batchDate, batchDifferences, batchLabel, orderBatches, type BatchKind, type StockBatch } from "@/lib/purchasing/batchRows";
import { addOldStock, fetchActiveBatches, removeOldStock, today, warrantyText } from "@/lib/purchasing/api";
import { Btn, ErrorNote, Modal, Rs, ff, input, label } from "./ui";

/** Every item's batches with stock left, and which rows are open. */
export function useStockBatches(kind: BatchKind) {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => { setBatches(await fetchActiveBatches(kind)); }, [kind]);
  useEffect(() => { (async () => { await reload(); })(); }, [reload]);
  useRealtimeTable([kind === "part" ? "repair_part_batches" : "accessory_batches"], reload);

  const byItem = useMemo(() => {
    const m = new Map<string, StockBatch[]>();
    for (const b of batches) m.set(b.itemId, [...(m.get(b.itemId) ?? []), b]);
    for (const [id, list] of m) m.set(id, orderBatches(list, kind));
    return m;
  }, [batches, kind]);

  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return { of: (id: string | number) => byItem.get(String(id)) ?? [], isOpen: (id: string | number) => open.has(String(id)), toggle: (id: string | number) => toggle(String(id)), reload };
}

/** Beside an item's name when it holds more than one batch. */
export function BatchToggle({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  if (count < 2) return null;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-expanded={open}
      title={open ? "Hide batches" : "Show batches"}
      style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 8, padding: "2px 7px 2px 4px", borderRadius: 10, border: "1px solid var(--border)", background: open ? "var(--accent-dim)" : "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 10.5, fontWeight: 700, fontFamily: ff, whiteSpace: "nowrap", verticalAlign: "middle" }}
    >
      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {count} batches
    </button>
  );
}

const cell: React.CSSProperties = { padding: "8px 10px", fontSize: 12, color: "var(--text-primary)", borderTop: "1px solid var(--border)", verticalAlign: "top", fontFamily: ff };
const head: React.CSSProperties = { padding: "6px 10px", fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left", whiteSpace: "nowrap", fontFamily: ff };

/** The batches behind one row, soonest to be used first. Goes inside a full-width table cell. */
export function BatchPanel({ kind, batches, onChanged }: { kind: BatchKind; batches: StockBatch[]; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function remove(b: StockBatch) {
    if (busy || !confirm(`Remove this old stock batch of ${b.qtyAvailable}? Stock goes down by ${b.qtyAvailable}.`)) return;
    setBusy(true);
    try { await removeOldStock(kind, b.id); toast.success("Old stock removed"); onChanged(); }
    catch (e) { toast.dialog("error", "Could not remove it", e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ margin: "2px 0 6px 22px", border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto", background: "var(--bg-card)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
        <thead><tr>
          <th style={head}>Batch</th><th style={head}>Received</th><th style={{ ...head, textAlign: "right" }}>Left</th>
          <th style={{ ...head, textAlign: "right" }}>Cost each</th><th style={head}>What&apos;s different</th><th style={head} />
        </tr></thead>
        <tbody>
          {batches.map((b, i) => (
            <tr key={b.id}>
              <td style={cell}>
                <div style={{ fontWeight: 700 }}>{batchLabel(b)}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{b.batchNo}{b.invoiceNo ? ` · ${b.invoiceNo}` : ""}</div>
                {i === 0 && <span style={{ display: "inline-block", marginTop: 3, padding: "1px 6px", borderRadius: 5, fontSize: 9.5, fontWeight: 700, background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>Used next</span>}
              </td>
              <td style={{ ...cell, whiteSpace: "nowrap" }}>{b.dateUnknown ? <span style={{ color: "var(--text-muted)" }}>Not recorded</span> : batchDate(b.receivedOn)}</td>
              <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}><strong>{b.qtyAvailable}</strong><span style={{ color: "var(--text-muted)" }}> of {b.qtyReceived}</span></td>
              <td style={{ ...cell, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{Rs(b.unitCost)}</td>
              <td style={cell}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {batchDifferences(b, batches, warrantyText).map(d => (
                    <span key={d} style={{ padding: "2px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 11 }}>{d}</span>
                  ))}
                </div>
              </td>
              <td style={{ ...cell, textAlign: "right" }}>
                {b.manual && b.qtyAvailable === b.qtyReceived && (
                  <Btn kind="danger" onClick={() => void remove(b)} disabled={busy} style={{ padding: "3px 8px", fontSize: 11 }}>Remove</Btn>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stock that was already on the shelf: its own batch, no bill, nobody owed. */
export function AddOldStockModal({ kind, itemId, name, stock, onClose, onDone }: {
  kind: BatchKind;
  itemId: string | number;
  name: string;
  stock: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const count = parseInt(qty, 10) || 0;
  const unitCost = cost.trim() === "" ? NaN : Number(cost);
  const ready = count > 0 && Number.isFinite(unitCost) && unitCost >= 0;

  async function save() {
    if (busyRef.current || !ready) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await addOldStock(kind, itemId, count, unitCost, date || null, note);
      toast.success("Old stock added", `${name}: ${stock + count} in stock`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add old stock"
      subtitle={name}
      onClose={onClose}
      width={460}
      busy={busy}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ErrorNote>{error}</ErrorNote>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
            <Btn kind="primary" onClick={() => void save()} disabled={busy || !ready}>{busy ? "Adding…" : "Add stock"}</Btn>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><span style={label}>How many</span><input value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoFocus style={input} /></div>
          <div><span style={label}>What each one cost (Rs.)</span><input value={cost} onChange={e => setCost(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" style={input} /></div>
        </div>
        <div><span style={label}>Date bought, if you know it</span><input type="date" max={today()} value={date} onChange={e => setDate(e.target.value)} style={input} /></div>
        <div><span style={label}>Note (optional)</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. from the back shelf" style={input} /></div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {count > 0 ? `This item will show ${stock + count} in stock, with these as a separate batch.` : "These go in as a separate batch of this item."}
          {" "}Its latest cost and supplier stay as they are, and no supplier is owed anything.
        </p>
      </div>
    </Modal>
  );
}
