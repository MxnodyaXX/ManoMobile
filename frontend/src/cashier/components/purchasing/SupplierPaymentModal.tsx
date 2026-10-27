"use client";

import { useMemo, useRef, useState } from "react";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useToast } from "@/lib/ui/toast";
import { PAY_METHODS, paymentStatus, recordSupplierPayment, today, type PayMethod, type PurchaseInvoice } from "@/lib/purchasing/api";
import { Badge, Btn, ErrorNote, Modal, Rs, fmtDate, input, label, paymentTone, td, th } from "./ui";

/**
 * Pay a supplier, against one invoice or several. Typing a total spreads it
 * over the open invoices oldest-due first; each line can then be changed by
 * hand. The database refuses more than an invoice still owes.
 */
export default function SupplierPaymentModal({ supplierId, supplierName, invoices, onlyInvoiceId, onClose, onDone }: {
  supplierId: number;
  supplierName: string;
  /** This supplier's invoices — only open ones with a balance are offered. */
  invoices: PurchaseInvoice[];
  /** Paying one invoice from its own page. */
  onlyInvoiceId?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { addEntry } = useCashRegister();
  const toast = useToast();
  const open = useMemo(() => invoices
    .filter(i => i.status === "Open" && i.outstanding > 0.005 && (!onlyInvoiceId || i.id === onlyInvoiceId))
    .sort((a, b) => (a.dueDate ?? a.invoiceDate).localeCompare(b.dueDate ?? b.invoiceDate) || a.id - b.id), [invoices, onlyInvoiceId]);

  const [alloc, setAlloc] = useState<Record<number, string>>(() =>
    onlyInvoiceId && open[0] ? { [open[0].id]: String(open[0].outstanding) } : {});
  const [method, setMethod] = useState<PayMethod>("Cash");
  const [paidOn, setPaidOn] = useState(today());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [fromDrawer, setFromDrawer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const amountOf = (id: number) => { const v = parseFloat(alloc[id] ?? ""); return Number.isFinite(v) ? v : 0; };
  const total = open.reduce((s, i) => s + amountOf(i.id), 0);
  const owed = open.reduce((s, i) => s + i.outstanding, 0);

  /** Spread a total across the invoices, oldest due first. */
  function spread(v: string) {
    let left = parseFloat(v) || 0;
    const next: Record<number, string> = {};
    for (const i of open) {
      const take = Math.min(left, i.outstanding);
      next[i.id] = take > 0 ? String(Math.round(take * 100) / 100) : "";
      left -= take;
    }
    setAlloc(next);
  }

  async function submit() {
    if (busyRef.current) return;
    const over = open.find(i => amountOf(i.id) > i.outstanding + 0.005);
    if (over) { setError(`${Rs(amountOf(over.id))} is more than the ${Rs(over.outstanding)} still owed on ${over.invoiceNo}.`); return; }
    if (total <= 0) { setError("Enter how much was paid."); return; }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await recordSupplierPayment({
        supplierId, paidOn, method, reference: reference.trim(), notes: notes.trim(),
        allocations: open.map(i => ({ invoiceId: i.id, amount: amountOf(i.id) })),
      });
      if (method === "Cash" && fromDrawer) addEntry("out", `Supplier payment — ${supplierName}`, total);
      toast.success("Payment recorded", `${Rs(total)} to ${supplierName}`);
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
      title={`Pay ${supplierName}`}
      subtitle={`${open.length} open invoice${open.length === 1 ? "" : "s"} · ${Rs(owed)} outstanding`}
      onClose={onClose}
      busy={busy}
      width={680}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ErrorNote>{error}</ErrorNote>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
            <Btn kind="primary" onClick={() => void submit()} disabled={busy || total <= 0}>{busy ? "Saving…" : `Record payment · ${Rs(total)}`}</Btn>
          </div>
        </div>
      }
    >
      {open.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nothing is owed to {supplierName} on a finalised invoice.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!onlyInvoiceId && (
            <div>
              <span style={label}>Amount paid — spread over the oldest invoices first</span>
              <input onChange={e => spread(e.target.value)} inputMode="decimal" placeholder={String(owed)} style={input} />
            </div>
          )}
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Invoice</th><th style={th}>Due</th><th style={{ ...th, textAlign: "right" }}>Owed</th><th style={{ ...th, textAlign: "right" }}>Pay</th></tr></thead>
              <tbody>
                {open.map(i => (
                  <tr key={i.id}>
                    <td style={td}><strong>{i.invoiceNo}</strong> <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{fmtDate(i.invoiceDate)}</span> <Badge tone={paymentTone(paymentStatus(i))}>{paymentStatus(i)}</Badge></td>
                    <td style={td}>{fmtDate(i.dueDate)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{Rs(i.outstanding)}</td>
                    <td style={{ ...td, textAlign: "right", width: 130 }}>
                      <input value={alloc[i.id] ?? ""} onChange={e => setAlloc(a => ({ ...a, [i.id]: e.target.value }))} inputMode="decimal" placeholder="0" style={{ ...input, textAlign: "right", padding: "6px 8px" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><span style={label}>Method</span><select value={method} onChange={e => setMethod(e.target.value as PayMethod)} style={input}>{PAY_METHODS.map(m => <option key={m}>{m}</option>)}</select></div>
            <div><span style={label}>Date</span><input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} style={input} /></div>
            <div><span style={label}>Reference</span><input value={reference} onChange={e => setReference(e.target.value)} placeholder="Cheque no. / transfer ref" style={input} /></div>
            <div><span style={label}>Notes</span><input value={notes} onChange={e => setNotes(e.target.value)} style={input} /></div>
          </div>
          {method === "Cash" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={fromDrawer} onChange={e => setFromDrawer(e.target.checked)} /> Paid from the cash drawer (records a cash-out)
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}
