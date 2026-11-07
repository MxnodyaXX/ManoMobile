"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, CheckCircle2, Edit2, PackageCheck, Paperclip, Printer, Wallet } from "lucide-react";
import { useAccessories } from "@/cashier/contexts/AccessoriesContext";
import { useParts } from "@/cashier/contexts/PartsContext";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import { useToast } from "@/lib/ui/toast";
import {
  WARRANTY_START_LABEL, attachmentUrl, fetchInvoiceDetail, finalisePurchaseInvoice, paymentStatus, receivePurchaseInvoice,
  receivingStatus, today, voidPurchaseInvoice, voidSupplierPayment, warrantyText, type InvoiceDetail,
} from "@/lib/purchasing/api";
import InvoiceLabelsModal from "./InvoiceLabelsModal";
import SupplierPaymentModal from "./SupplierPaymentModal";
import { Badge, Btn, ErrorNote, Modal, Rs, Stat, fmtDate, input, label, paymentTone, receivingTone, td, th } from "./ui";

/** One supplier invoice: what was bought, what came in, what was paid, and every action on it. */
export default function PurchaseInvoiceDetail({ invoiceId, onClose, onEdit, onChanged }: {
  invoiceId: number;
  onClose: () => void;
  /** Open the draft in the form. */
  onEdit: (d: InvoiceDetail) => void;
  /** Something about it changed — lists should reload. */
  onChanged: () => void;
}) {
  const { products, reload: reloadProducts } = useAccessories();
  const { parts, reload: reloadParts } = useParts();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [d, setD] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [printingLabels, setPrintingLabels] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try { setD(await fetchInvoiceDetail(invoiceId)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [invoiceId]);
  useEffect(() => { (async () => { await load(); })(); }, [load]);
  useRealtimeTable(["purchase_invoices", "supplier_payments", "accessory_batches", "repair_part_batches"], load);

  const changed = () => { void load(); onChanged(); void reloadProducts(); void reloadParts(); };

  async function run(action: () => Promise<void>, ok: string): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try { await action(); toast.success(ok); changed(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function openAttachment() {
    if (!d?.invoice.attachmentPath) return;
    const url = await attachmentUrl(d.invoice.attachmentPath);
    if (url) window.open(url, "_blank", "noopener"); else setError("Could not open the attachment.");
  }

  if (!d) {
    return (
      <Modal title="Purchase invoice" onClose={onClose}>
        {error ? <ErrorNote>{error}</ErrorNote> : <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>}
      </Modal>
    );
  }

  const inv = d.invoice;
  const ps = paymentStatus(inv);
  const rs = receivingStatus(inv);
  const productName = (id: number | null, fallback: string) => (id && products.find(p => p.id === id)?.name) || fallback;
  const remaining = inv.qtyOrdered - inv.qtyReceived;

  return (
    <Modal
      title={<span>{inv.supplierName} · {inv.invoiceNo} <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{inv.ref}</span></span>}
      subtitle={<span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {fmtDate(inv.invoiceDate)}{inv.dueDate && ` · due ${fmtDate(inv.dueDate)}`}{inv.tripName && ` · trip: ${inv.tripName}`}
        {inv.status === "Draft" ? <Badge>Draft</Badge> : inv.status === "Void" ? <Badge tone="red">Void</Badge> : <>
          <Badge tone={paymentTone(ps)}>{ps}</Badge><Badge tone={receivingTone(rs)}>{rs}</Badge>
        </>}
      </span>}
      onClose={onClose}
      width={1000}
      busy={busy}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ErrorNote>{error}</ErrorNote>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {inv.attachmentPath && <Btn onClick={() => void openAttachment()}><Paperclip size={13} /> {inv.attachmentName ?? "Attachment"}</Btn>}
            {inv.status === "Draft" && <>
              <Btn kind="danger" onClick={() => { if (confirm("Delete this draft? Nothing has been received or paid on it.")) void run(() => voidPurchaseInvoice(inv.id, "Draft deleted"), "Draft deleted").then(ok => { if (ok) onClose(); }); }} disabled={busy}>Delete draft</Btn>
              <Btn onClick={() => onEdit(d)} disabled={busy}><Edit2 size={13} /> Edit</Btn>
              <Btn onClick={() => void run(() => finalisePurchaseInvoice(inv.id, false), "Invoice finalised")} disabled={busy}>Finalise</Btn>
              <Btn kind="primary" onClick={() => void run(() => finalisePurchaseInvoice(inv.id, true), "Finalised and received")} disabled={busy}>Finalise & receive all</Btn>
            </>}
            {inv.status === "Open" && <>
              <Btn kind="danger" onClick={() => setVoiding(true)} disabled={busy}><Ban size={13} /> Void</Btn>
              <Btn onClick={() => setPrintingLabels(true)} disabled={busy}><Printer size={13} /> Print labels</Btn>
              {inv.outstanding > 0.005 && <Btn onClick={() => setPaying(true)} disabled={busy}><Wallet size={13} /> Record payment</Btn>}
              {remaining > 0 && <Btn kind="primary" onClick={() => setReceiving(true)} disabled={busy}><PackageCheck size={13} /> Receive stock</Btn>}
            </>}
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
          <Stat label="Invoice total" value={Rs(inv.total)} sub={`${Rs(inv.itemsSubtotal)} items${inv.expenses ? ` + ${Rs(inv.expenses)}` : ""}${inv.discount ? ` − ${Rs(inv.discount)}` : ""}`} />
          <Stat label="Paid" value={Rs(inv.paid)} tone="#16a34a" />
          <Stat label="Outstanding" value={Rs(inv.outstanding)} tone={inv.outstanding > 0 ? (ps === "Overdue" ? "#dc2626" : "#d97706") : undefined} />
          <Stat label="Received" value={`${inv.qtyReceived} / ${inv.qtyOrdered}`} sub={rs} />
        </div>

        {inv.status === "Void" && <ErrorNote>Voided{inv.voidReason ? `: ${inv.voidReason}` : ""}. Its stock was taken back out.</ErrorNote>}
        {inv.status === "Draft" && inv.initialPayment && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>A payment of {Rs(inv.initialPayment.amount)} ({inv.initialPayment.method}) will be recorded when this is finalised.</div>
        )}

        <Section title="Items">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead><tr>
              <th style={th}>Product</th><th style={{ ...th, textAlign: "right" }}>Qty</th><th style={{ ...th, textAlign: "right" }}>Received</th>
              <th style={{ ...th, textAlign: "right" }}>Buying</th><th style={{ ...th, textAlign: "right" }}>Expected sell</th>
              <th style={{ ...th, textAlign: "right" }}>Line total</th><th style={th}>Warranty</th>
            </tr></thead>
            <tbody>
              {d.items.map(it => (
                <tr key={it.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{productName(it.productId, it.newProduct?.name ?? it.description)}</div>
                    {!it.productId && it.newProduct && <Badge tone="green">New product · {it.newProduct.code}</Badge>}
                    {!it.partId && it.newPart && <Badge tone="green">New repair part · {it.newPart.sku}</Badge>}
                    {it.partId && <Badge>Repair part</Badge>}
                    {it.updateSellingPrice && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Updates the selling price on receipt</div>}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{it.qty}</td>
                  <td style={{ ...td, textAlign: "right", color: it.receivedQty < it.qty ? "#d97706" : "#16a34a" }}>{it.receivedQty}</td>
                  <td style={{ ...td, textAlign: "right" }}>{Rs(it.unitCost)}{(it.discount > 0 || it.taxPct > 0) && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{it.discount > 0 && `−${Rs(it.discount)}`}{it.taxPct > 0 && ` +${it.taxPct}% tax`}</div>}</td>
                  <td style={{ ...td, textAlign: "right" }}>{it.expectedSellPrice ? Rs(it.expectedSellPrice) : "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{Rs(it.lineTotal)}</td>
                  <td style={{ ...td, fontSize: 11.5 }}>
                    <div>Supplier: {it.supplierWarrantyDays == null ? "none" : warrantyText(it.supplierWarrantyDays)}{it.supplierWarrantyDays ? ` · ${WARRANTY_START_LABEL[it.supplierWarrantyStart].toLowerCase()}` : ""}</div>
                    <div>Customer: {it.customerWarrantyDays == null ? "shop policy" : warrantyText(it.customerWarrantyDays)}</div>
                    {(it.supplierWarrantyNotes || it.supplierWarrantyTerms) && <div style={{ color: "var(--text-muted)" }}>{[it.supplierWarrantyNotes, it.supplierWarrantyTerms].filter(Boolean).join(" · ")}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {d.batches.length + d.partBatches.length > 0 && (
          <Section title="Batches created">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead><tr><th style={th}>Batch</th><th style={th}>Product</th><th style={th}>Received</th><th style={{ ...th, textAlign: "right" }}>Qty</th><th style={{ ...th, textAlign: "right" }}>Left</th><th style={{ ...th, textAlign: "right" }}>Cost/unit</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {d.batches.map(b => (
                  <tr key={b.id}>
                    <td style={{ ...td, fontFamily: "monospace" }}>{b.batchNo}</td>
                    <td style={td}>{productName(b.productId, `#${b.productId}`)}</td>
                    <td style={td}>{fmtDate(b.receivedOn)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{b.qtyReceived}</td>
                    <td style={{ ...td, textAlign: "right" }}>{b.qtyAvailable}</td>
                    <td style={{ ...td, textAlign: "right" }}>{Rs(b.unitCost)}</td>
                    <td style={td}><Badge tone={b.status === "Active" ? "green" : b.status === "Reversed" ? "red" : "grey"}>{b.status}</Badge></td>
                  </tr>
                ))}
                {d.partBatches.map(b => (
                  <tr key={`part-${b.id}`}>
                    <td style={{ ...td, fontFamily: "monospace" }}>{b.batchNo}</td>
                    <td style={td}>{parts.find(p => Number(p.id) === b.partId)?.name ?? `Part #${b.partId}`}</td>
                    <td style={td}>{fmtDate(b.receivedOn)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{b.qtyReceived}</td>
                    <td style={{ ...td, textAlign: "right" }}>{b.qtyAvailable}</td>
                    <td style={{ ...td, textAlign: "right" }}>{Rs(b.unitCost)}</td>
                    <td style={td}><Badge tone={b.status === "Active" ? "green" : b.status === "Reversed" ? "red" : "grey"}>{b.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <Section title="Payments">
          {d.payments.length === 0 ? <Empty>No payments yet.</Empty> : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead><tr><th style={th}>Ref</th><th style={th}>Date</th><th style={th}>Method</th><th style={{ ...th, textAlign: "right" }}>On this invoice</th><th style={th}>Status</th><th style={th} /></tr></thead>
              <tbody>
                {d.payments.map(p => {
                  const here = p.allocations.find(a => a.invoiceId === inv.id)?.amount ?? 0;
                  return (
                    <tr key={p.id} style={{ opacity: p.status === "Voided" ? 0.55 : 1 }}>
                      <td style={{ ...td, fontFamily: "monospace" }}>{p.ref}</td>
                      <td style={td}>{fmtDate(p.paidOn)}</td>
                      <td style={td}>{p.method}{p.reference && <span style={{ color: "var(--text-muted)" }}> · {p.reference}</span>}{p.allocations.length > 1 && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Part of {Rs(p.amount)} across {p.allocations.length} invoices</div>}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{Rs(here)}</td>
                      <td style={td}>{p.status === "Voided" ? <Badge tone="red">Voided</Badge> : <Badge tone="green">Valid</Badge>}{p.voidReason && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{p.voidReason}</div>}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {p.status === "Valid" && (
                          <Btn kind="danger" style={{ padding: "4px 8px", fontSize: 11 }} disabled={busy} onClick={() => {
                            const reason = prompt(`Void payment ${p.ref} (${Rs(p.amount)})? Reason:`);
                            if (reason?.trim()) void run(() => voidSupplierPayment(p.id, reason.trim()), "Payment voided");
                          }}>Void</Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        {inv.notes && <Section title="Notes"><p style={{ padding: 12, fontSize: 13, color: "var(--text-secondary)" }}>{inv.notes}</p></Section>}

        <Section title="History">
          <div style={{ padding: "6px 12px" }}>
            {d.events.map(e => (
              <div key={e.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                <CheckCircle2 size={13} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                <span style={{ color: "var(--text-primary)" }}>{e.detail || e.action}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {receiving && <ReceiveModal d={d} productName={productName} onClose={() => setReceiving(false)} onDone={() => { setReceiving(false); changed(); }} />}
      {printingLabels && <InvoiceLabelsModal detail={d} onClose={() => setPrintingLabels(false)} />}
      {paying && (
        <SupplierPaymentModal
          supplierId={inv.supplierId} supplierName={inv.supplierName} invoices={[inv]} onlyInvoiceId={inv.id}
          onClose={() => setPaying(false)} onDone={() => { setPaying(false); changed(); }}
        />
      )}
      {voiding && (
        <VoidModal
          title={`Void ${inv.invoiceNo}?`}
          body="Stock this invoice brought in is taken back out and its batches are marked Reversed. Only possible while none of that stock has been sold or issued to a job, and no payment stands against it."
          onClose={() => setVoiding(false)}
          onConfirm={reason => run(() => voidPurchaseInvoice(inv.id, reason), "Invoice voided").then(() => setVoiding(false))}
        />
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...label, marginBottom: 6 }}>{title}</div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>{children}</div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) =>
  <p style={{ padding: 12, fontSize: 12.5, color: "var(--text-muted)" }}>{children}</p>;

function ReceiveModal({ d, productName, onClose, onDone }: {
  d: InvoiceDetail; productName: (id: number | null, fallback: string) => string; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const pending = d.items.filter(i => i.receivedQty < i.qty);
  const [qty, setQty] = useState<Record<number, string>>(() => Object.fromEntries(pending.map(i => [i.id, String(i.qty - i.receivedQty)])));
  const [receivedOn, setReceivedOn] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function submit() {
    if (busyRef.current) return;
    const lines = pending.map(i => ({ itemId: i.id, qty: parseInt(qty[i.id] || "0", 10) || 0 }));
    const bad = pending.find(i => { const q = parseInt(qty[i.id] || "0", 10) || 0; return q < 0 || q > i.qty - i.receivedQty; });
    if (bad) { setError(`${productName(bad.productId, bad.description)}: at most ${bad.qty - bad.receivedQty} can still be received.`); return; }
    if (lines.every(l => l.qty === 0)) { setError("Enter a quantity on at least one line."); return; }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await receivePurchaseInvoice(d.invoice.id, lines, receivedOn, note.trim());
      toast.success("Stock received", `${lines.reduce((s, l) => s + l.qty, 0)} unit(s) added to inventory`);
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
      title="Receive stock"
      subtitle="Enter what actually arrived. The rest can be received later."
      onClose={onClose}
      busy={busy}
      width={620}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ErrorNote>{error}</ErrorNote>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
            <Btn kind="primary" onClick={() => void submit()} disabled={busy}>{busy ? "Receiving…" : "Confirm received"}</Btn>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Product</th><th style={{ ...th, textAlign: "right" }}>Still to come</th><th style={{ ...th, textAlign: "right" }}>Received now</th></tr></thead>
          <tbody>
            {pending.map(i => (
              <tr key={i.id}>
                <td style={td}>{productName(i.productId, i.description)}</td>
                <td style={{ ...td, textAlign: "right" }}>{i.qty - i.receivedQty}</td>
                <td style={{ ...td, textAlign: "right", width: 110 }}>
                  <input value={qty[i.id] ?? ""} onChange={e => setQty(q => ({ ...q, [i.id]: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" style={{ ...input, textAlign: "right", padding: "6px 8px" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <div><span style={label}>Received on</span><input type="date" value={receivedOn} onChange={e => setReceivedOn(e.target.value)} style={input} /></div>
          <div><span style={label}>Note</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. first box, 5 short" style={input} /></div>
        </div>
      </div>
    </Modal>
  );
}

export function VoidModal({ title, body, onClose, onConfirm }: {
  title: string; body: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={title} onClose={onClose} width={480}
      footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn kind="danger" disabled={!reason.trim()} onClick={() => void onConfirm(reason.trim())}>Void</Btn>
      </div>}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>{body}</p>
      <span style={label}>Reason</span>
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. entered twice" style={input} autoFocus />
    </Modal>
  );
}
