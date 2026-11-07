"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Save, Wallet } from "lucide-react";
import { useAccessories } from "@/cashier/contexts/AccessoriesContext";
import type { Supplier } from "@/cashier/contexts/InventoryContext";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import { useToast } from "@/lib/ui/toast";
import {
  fetchBatchesForSupplier, fetchSuppliedLines, fetchSupplierDetails, fetchSupplierPayments, paymentStatus,
  receivingStatus, saveSupplierDetails, supplierCode, voidSupplierPayment, warrantyText,
  type Batch, type PurchaseInvoice, type SuppliedLine, type SupplierDetails, type SupplierPayment,
} from "@/lib/purchasing/api";
import SupplierPaymentModal from "./SupplierPaymentModal";
import { Badge, Btn, ErrorNote, Rs, Stat, card, ff, fmtDate, input, label, paymentTone, receivingTone, td, th } from "./ui";

type Tab = "Overview" | "Invoices" | "Products supplied" | "Payments";

export default function SupplierProfile({ supplier, invoices, onBack, onOpenInvoice, onNewInvoice, onChanged }: {
  supplier: Supplier;
  /** This supplier's invoices (all statuses). */
  invoices: PurchaseInvoice[];
  onBack: () => void;
  onOpenInvoice: (id: number) => void;
  onNewInvoice: () => void;
  onChanged: () => void;
}) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const { products } = useAccessories();
  const [tab, setTab] = useState<Tab>("Overview");
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [lines, setLines] = useState<SuppliedLine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [details, setDetails] = useState<SupplierDetails | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openProduct, setOpenProduct] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, l, b, dt] = await Promise.all([
        fetchSupplierPayments(supplier.id), fetchSuppliedLines(supplier.id), fetchBatchesForSupplier(supplier.id), fetchSupplierDetails(supplier.id),
      ]);
      setPayments(p); setLines(l); setBatches(b);
      setDetails(prev => prev ?? dt);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [supplier.id]);
  useEffect(() => { (async () => { await load(); })(); }, [load]);
  useRealtimeTable(["supplier_payments", "purchase_invoices", "accessory_batches"], load);

  const live = useMemo(() => invoices.filter(i => i.status === "Open"), [invoices]);
  const totalPurchased = live.reduce((s, i) => s + i.total, 0);
  const totalPaid = payments.filter(p => p.status === "Valid").reduce((s, p) => s + p.amount, 0);
  const outstanding = live.reduce((s, i) => s + i.outstanding, 0);
  const overdue = live.filter(i => paymentStatus(i) === "Overdue");
  const lastPurchase = live.map(i => i.invoiceDate).sort().at(-1) ?? null;

  /** Lines grouped by product, newest purchase first. */
  const supplied = useMemo(() => {
    const byKey = new Map<string, SuppliedLine[]>();
    for (const l of lines.filter(x => x.invoiceStatus === "Open")) {
      const key = l.partId ? `r${l.partId}` : l.productId ? `p${l.productId}` : `n${l.newProduct?.code ?? l.id}`;
      byKey.set(key, [...(byKey.get(key) ?? []), l]);
    }
    return [...byKey.entries()].map(([key, ls]) => {
      const sorted = [...ls].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || b.id - a.id);
      const pid = sorted[0].productId;
      const product = pid ? products.find(p => p.id === pid) : undefined;
      return {
        key, productId: pid, name: product?.name ?? sorted[0].newProduct?.name ?? sorted[0].description,
        code: product?.code ?? sorted[0].newProduct?.code ?? "",
        qty: sorted.reduce((s, l) => s + l.qty, 0),
        latest: sorted[0].unitCost, lines: sorted,
        batches: pid ? batches.filter(b => b.productId === pid) : [],
      };
    }).sort((a, b) => b.lines[0].invoiceDate.localeCompare(a.lines[0].invoiceDate));
  }, [lines, batches, products]);

  /** Running balance: finalised invoices owe, valid payments pay. */
  const ledger = useMemo(() => {
    type Entry = { key: string; date: string; text: string; debit: number; credit: number; voided?: boolean; payment?: SupplierPayment; invoiceId?: number };
    const entries: Entry[] = [
      ...live.map(i => ({ key: `i${i.id}`, date: i.invoiceDate, text: `Invoice ${i.invoiceNo}`, debit: i.total, credit: 0, invoiceId: i.id })),
      ...payments.map(p => ({
        key: `p${p.id}`, date: p.paidOn, payment: p, voided: p.status === "Voided",
        text: `${p.ref} · ${p.method}${p.reference ? ` ${p.reference}` : ""} → ${p.allocations.map(a => invoices.find(i => i.id === a.invoiceId)?.invoiceNo ?? "?").join(", ")}`,
        debit: 0, credit: p.amount,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.debit ? -1 : 1));
    const withBalance = entries.reduce<(Entry & { balance: number })[]>((acc, e) => {
      const prev = acc.length ? acc[acc.length - 1].balance : 0;
      return [...acc, { ...e, balance: e.voided ? prev : prev + e.debit - e.credit }];
    }, []);
    return withBalance.reverse();
  }, [live, payments, invoices]);

  async function saveDetails() {
    if (!details) return;
    setSavingDetails(true);
    try { await saveSupplierDetails(supplier.id, details); toast.success("Supplier details saved"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSavingDetails(false); }
  }

  const invoiceTable = (rows: PurchaseInvoice[]) => (
    <div style={{ ...card, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <thead><tr>
          <th style={th}>Invoice</th><th style={th}>Date</th><th style={{ ...th, textAlign: "right" }}>Total</th><th style={{ ...th, textAlign: "right" }}>Paid</th>
          <th style={{ ...th, textAlign: "right" }}>Outstanding</th><th style={th}>Due</th><th style={th}>Payment</th><th style={th}>Stock</th>
        </tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td style={{ ...td, color: "var(--text-muted)" }} colSpan={8}>No invoices yet.</td></tr>}
          {rows.map(i => {
            const ps = paymentStatus(i);
            return (
              <tr key={i.id} onClick={() => onOpenInvoice(i.id)} style={{ cursor: "pointer", opacity: i.status === "Void" ? 0.55 : 1 }}>
                <td style={td}><strong>{i.invoiceNo}</strong><div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{i.ref}</div></td>
                <td style={td}>{fmtDate(i.invoiceDate)}</td>
                <td style={{ ...td, textAlign: "right" }}>{Rs(i.total)}</td>
                <td style={{ ...td, textAlign: "right" }}>{Rs(i.paid)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{i.status === "Open" ? Rs(i.outstanding) : "—"}</td>
                <td style={td}>{fmtDate(i.dueDate)}</td>
                <td style={td}><Badge tone={paymentTone(ps)}>{ps}</Badge></td>
                <td style={td}>{i.status === "Open" ? <Badge tone={receivingTone(receivingStatus(i))}>{receivingStatus(i)}</Badge> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: ff }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Btn onClick={onBack} style={{ padding: "6px 9px" }}><ArrowLeft size={14} /></Btn>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{supplier.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{supplierCode(supplier.id)}{supplier.phone && ` · ${supplier.phone}`}{supplier.email && ` · ${supplier.email}`}{!supplier.active && " · inactive"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {outstanding > 0 && <Btn onClick={() => setPaying(true)}><Wallet size={13} /> Record payment</Btn>}
          <Btn kind="primary" onClick={onNewInvoice}><Plus size={13} /> New purchase invoice</Btn>
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10 }}>
        <Stat label="Total purchases" value={Rs(totalPurchased)} sub={`${live.length} invoice${live.length === 1 ? "" : "s"}`} />
        <Stat label="Total paid" value={Rs(totalPaid)} tone="#16a34a" />
        <Stat label="Outstanding" value={Rs(outstanding)} tone={outstanding > 0 ? "#d97706" : undefined} />
        <Stat label="Overdue invoices" value={overdue.length} tone={overdue.length ? "#dc2626" : undefined} sub={overdue.length ? Rs(overdue.reduce((s, i) => s + i.outstanding, 0)) : undefined} />
        <Stat label="Last purchase" value={fmtDate(lastPurchase)} />
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {(["Overview", "Invoices", "Products supplied", "Payments"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 14px", border: "none", borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`, background: "none", color: tab === t ? "var(--text-primary)" : "var(--text-muted)", fontWeight: tab === t ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap" }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.6fr", gap: 14, alignItems: "start" }}>
          <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={label}>Contact details</div>
            {details ? <>
              <div><span style={label}>Contact person</span><input value={details.contactPerson} onChange={e => setDetails({ ...details, contactPerson: e.target.value })} style={input} /></div>
              <div><span style={label}>Address</span><input value={details.address} onChange={e => setDetails({ ...details, address: e.target.value })} style={input} /></div>
              <div><span style={label}>Notes</span><textarea value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} rows={3} style={{ ...input, resize: "vertical" }} /></div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Name, phone and email are edited in Admin Control → Inventory → Suppliers.</div>
              <Btn onClick={() => void saveDetails()} disabled={savingDetails} style={{ alignSelf: "flex-start" }}><Save size={13} /> {savingDetails ? "Saving…" : "Save details"}</Btn>
            </> : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={label}>Recent invoices</div>
            {invoiceTable(invoices.slice(0, 5))}
          </div>
        </div>
      )}

      {tab === "Invoices" && invoiceTable(invoices)}

      {tab === "Products supplied" && (
        <div style={{ ...card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead><tr>
              <th style={th} /><th style={th}>Product</th><th style={{ ...th, textAlign: "right" }}>Total bought</th>
              <th style={{ ...th, textAlign: "right" }}>Latest price</th><th style={th}>Previous prices</th><th style={{ ...th, textAlign: "right" }}>Batches</th>
            </tr></thead>
            <tbody>
              {supplied.length === 0 && <tr><td style={{ ...td, color: "var(--text-muted)" }} colSpan={6}>Nothing bought from {supplier.name} on a finalised invoice yet.</td></tr>}
              {supplied.map(row => {
                const prev = [...new Set(row.lines.slice(1).map(l => l.unitCost))].slice(0, 4);
                const open = openProduct === row.key;
                return (
                  <Fragment key={row.key}>
                    <tr onClick={() => setOpenProduct(open ? null : row.key)} style={{ cursor: "pointer" }}>
                      <td style={{ ...td, width: 24 }}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                      <td style={td}><strong>{row.name}</strong><div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{row.code}</div></td>
                      <td style={{ ...td, textAlign: "right" }}>{row.qty}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{Rs(row.latest)}</td>
                      <td style={td}>{prev.length ? prev.map(Rs).join(", ") : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{row.batches.length}</td>
                    </tr>
                    {open && (
                      <tr><td colSpan={6} style={{ ...td, background: "var(--bg-surface)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                          {row.lines.map(l => {
                            const b = row.batches.filter(x => x.invoiceItemId === l.id);
                            return (
                              <div key={l.id} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                <button onClick={() => onOpenInvoice(l.invoiceId)} style={{ border: "none", background: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontWeight: 600, fontFamily: ff }}>{l.invoiceNo}</button>
                                <span>{fmtDate(l.invoiceDate)}</span>
                                <span>{l.qty} × {Rs(l.unitCost)}</span>
                                <span style={{ color: "var(--text-muted)" }}>Supplier warranty {warrantyText(l.supplierWarrantyDays)}{l.supplierWarrantyNotes && ` (${l.supplierWarrantyNotes})`}</span>
                                {b.length > 0 && <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{b.map(x => `${x.batchNo} (${x.qtyAvailable} left)`).join(", ")}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Payments" && (
        <div style={{ ...card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead><tr>
              <th style={th}>Date</th><th style={th}>Entry</th><th style={{ ...th, textAlign: "right" }}>Billed</th>
              <th style={{ ...th, textAlign: "right" }}>Paid</th><th style={{ ...th, textAlign: "right" }}>Balance</th><th style={th} />
            </tr></thead>
            <tbody>
              {ledger.length === 0 && <tr><td style={{ ...td, color: "var(--text-muted)" }} colSpan={6}>No invoices or payments yet.</td></tr>}
              {ledger.map(e => (
                <tr key={e.key} style={{ opacity: e.voided ? 0.5 : 1 }}>
                  <td style={td}>{fmtDate(e.date)}</td>
                  <td style={td}>
                    {e.invoiceId ? <button onClick={() => onOpenInvoice(e.invoiceId!)} style={{ border: "none", background: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontWeight: 600, fontFamily: ff }}>{e.text}</button> : e.text}
                    {e.voided && <> <Badge tone="red">Voided</Badge> <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.payment?.voidReason}</span></>}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{e.debit ? Rs(e.debit) : ""}</td>
                  <td style={{ ...td, textAlign: "right", color: "#16a34a" }}>{e.credit ? Rs(e.credit) : ""}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{Rs(e.balance)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {e.payment && !e.voided && (
                      <Btn kind="danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={async () => {
                        const reason = prompt(`Void payment ${e.payment!.ref} (${Rs(e.payment!.amount)})? Reason:`);
                        if (!reason?.trim()) return;
                        try { await voidSupplierPayment(e.payment!.id, reason.trim()); toast.success("Payment voided"); void load(); onChanged(); }
                        catch (err) { setError(err instanceof Error ? err.message : String(err)); }
                      }}>Void</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paying && (
        <SupplierPaymentModal
          supplierId={supplier.id} supplierName={supplier.name} invoices={invoices}
          onClose={() => setPaying(false)} onDone={() => { setPaying(false); void load(); onChanged(); }}
        />
      )}
    </div>
  );
}
