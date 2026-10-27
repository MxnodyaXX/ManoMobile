"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Truck } from "lucide-react";
import { useInventory } from "@/cashier/contexts/InventoryContext";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useRealtimeTable } from "@/lib/supabase/useRealtime";
import {
  fetchInvoices, paymentStatus, receivingStatus, supplierCode,
  type InvoiceDetail, type PaymentStatus, type PurchaseInvoice,
} from "@/lib/purchasing/api";
import PurchaseInvoiceDetail from "./PurchaseInvoiceDetail";
import PurchaseInvoiceForm from "./PurchaseInvoiceForm";
import SupplierProfile from "./SupplierProfile";
import { Badge, Btn, ErrorNote, Rs, Stat, card, ff, fmtDate, input, paymentTone, receivingTone, td, th } from "./ui";

/**
 * Suppliers & Purchases — every supplier with what we owe them, and every
 * supplier invoice. Mounted as a tab in Inventory Management and as Admin ->
 * Suppliers; both read the same tables.
 */
export default function PurchasingHub() {
  const isMobile = useIsMobile();
  const { suppliers } = useInventory();
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"Suppliers" | "Invoices">("Suppliers");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | PaymentStatus>("All");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [form, setForm] = useState<null | { existing?: InvoiceDetail; supplierId?: number }>(null);

  const load = useCallback(async () => {
    try { setInvoices(await fetchInvoices()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { (async () => { await load(); })(); }, [load]);
  useRealtimeTable(["purchase_invoices", "supplier_payments"], load);

  const open = invoices.filter(i => i.status === "Open");
  const outstanding = open.reduce((s, i) => s + i.outstanding, 0);
  const overdue = open.filter(i => paymentStatus(i) === "Overdue");
  const drafts = invoices.filter(i => i.status === "Draft");
  const awaiting = open.filter(i => receivingStatus(i) !== "Received");
  const monthStart = new Date().toISOString().slice(0, 7);
  const thisMonth = open.filter(i => i.invoiceDate.startsWith(monthStart)).reduce((s, i) => s + i.total, 0);

  const supplierRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers
      .filter(s => !q || s.name.toLowerCase().includes(q) || s.phone.includes(q) || supplierCode(s.id).toLowerCase().includes(q))
      .map(s => {
        const mine = invoices.filter(i => i.supplierId === s.id && i.status === "Open");
        return {
          s,
          count: mine.length,
          purchases: mine.reduce((t, i) => t + i.total, 0),
          outstanding: mine.reduce((t, i) => t + i.outstanding, 0),
          overdue: mine.filter(i => paymentStatus(i) === "Overdue").length,
          last: mine.map(i => i.invoiceDate).sort().at(-1) ?? null,
        };
      })
      .sort((a, b) => b.outstanding - a.outstanding || (b.last ?? "").localeCompare(a.last ?? "") || a.s.name.localeCompare(b.s.name));
  }, [suppliers, invoices, search]);

  const invoiceRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter(i =>
      (filter === "All" || paymentStatus(i) === filter) &&
      (!q || i.invoiceNo.toLowerCase().includes(q) || i.supplierName.toLowerCase().includes(q) || i.ref.toLowerCase().includes(q)));
  }, [invoices, search, filter]);

  function editDraft(d: InvoiceDetail) {
    setDetailId(null);
    setForm({ existing: d });
  }

  const selected = supplierId ? suppliers.find(s => s.id === supplierId) ?? null : null;

  const overlays = (
    <>
      {detailId !== null && (
        <PurchaseInvoiceDetail invoiceId={detailId} onClose={() => setDetailId(null)} onEdit={editDraft} onChanged={() => void load()} />
      )}
      {form && (
        <PurchaseInvoiceForm
          existing={form.existing}
          presetSupplierId={form.supplierId}
          onClose={() => setForm(null)}
          onSaved={async id => { setForm(null); await load(); setDetailId(id); }}
        />
      )}
    </>
  );

  if (selected) {
    return (
      <>
        <SupplierProfile
          supplier={selected}
          invoices={invoices.filter(i => i.supplierId === selected.id)}
          onBack={() => setSupplierId(null)}
          onOpenInvoice={setDetailId}
          onNewInvoice={() => setForm({ supplierId: selected.id })}
          onChanged={() => void load()}
        />
        {overlays}
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: ff }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Truck size={18} color="var(--accent)" />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Suppliers &amp; Purchases</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Supplier invoices, deliveries, batches and what we owe.</div>
          </div>
        </div>
        <Btn kind="primary" onClick={() => setForm({})}><Plus size={14} /> New purchase invoice</Btn>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10 }}>
        <Stat label="We owe suppliers" value={Rs(outstanding)} tone={outstanding > 0 ? "#d97706" : undefined} sub={`${open.filter(i => i.outstanding > 0).length} unpaid invoice(s)`} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "#dc2626" : undefined} sub={overdue.length ? Rs(overdue.reduce((s, i) => s + i.outstanding, 0)) : "nothing overdue"} />
        <Stat label="Bought this month" value={Rs(thisMonth)} />
        <Stat label="Awaiting stock" value={awaiting.length} sub="finalised, not fully received" />
        <Stat label="Drafts" value={drafts.length} sub={drafts.length ? "not finalised yet" : undefined} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, padding: 3, ...card, borderRadius: 9 }}>
          {(["Suppliers", "Invoices"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: view === v ? "var(--accent)" : "transparent", color: view === v ? "var(--accent-fg)" : "var(--text-secondary)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: ff }}>{v}</button>
          ))}
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={view === "Suppliers" ? "Search suppliers" : "Search invoice no. or supplier"} style={{ ...input, paddingLeft: 30 }} />
        </div>
        {view === "Invoices" && (
          <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} style={{ ...input, width: "auto" }}>
            {(["All", "Unpaid", "Partially Paid", "Overdue", "Paid", "Draft", "Void"] as const).map(f => <option key={f}>{f}</option>)}
          </select>
        )}
      </div>

      {view === "Suppliers" ? (
        <div style={{ ...card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead><tr>
              <th style={th}>Supplier</th><th style={{ ...th, textAlign: "right" }}>Invoices</th><th style={{ ...th, textAlign: "right" }}>Purchases</th>
              <th style={{ ...th, textAlign: "right" }}>Outstanding</th><th style={th}>Overdue</th><th style={th}>Last purchase</th>
            </tr></thead>
            <tbody>
              {!loading && supplierRows.length === 0 && <tr><td style={{ ...td, color: "var(--text-muted)" }} colSpan={6}>No suppliers yet — create one from New purchase invoice.</td></tr>}
              {supplierRows.map(r => (
                <tr key={r.s.id} onClick={() => setSupplierId(r.s.id)} style={{ cursor: "pointer", opacity: r.s.active ? 1 : 0.6 }}>
                  <td style={td}><strong>{r.s.name}</strong><div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{supplierCode(r.s.id)}{r.s.phone && ` · ${r.s.phone}`}</div></td>
                  <td style={{ ...td, textAlign: "right" }}>{r.count}</td>
                  <td style={{ ...td, textAlign: "right" }}>{r.purchases ? Rs(r.purchases) : "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: r.outstanding > 0 ? "#d97706" : undefined }}>{r.outstanding ? Rs(r.outstanding) : "—"}</td>
                  <td style={td}>{r.overdue ? <Badge tone="red">{r.overdue} overdue</Badge> : "—"}</td>
                  <td style={td}>{fmtDate(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ ...card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead><tr>
              <th style={th}>Invoice</th><th style={th}>Supplier</th><th style={th}>Date</th><th style={{ ...th, textAlign: "right" }}>Total</th>
              <th style={{ ...th, textAlign: "right" }}>Paid</th><th style={{ ...th, textAlign: "right" }}>Outstanding</th><th style={th}>Due</th><th style={th}>Payment</th><th style={th}>Stock</th>
            </tr></thead>
            <tbody>
              {!loading && invoiceRows.length === 0 && <tr><td style={{ ...td, color: "var(--text-muted)" }} colSpan={9}>No invoices match.</td></tr>}
              {invoiceRows.map(i => {
                const ps = paymentStatus(i);
                return (
                  <tr key={i.id} onClick={() => setDetailId(i.id)} style={{ cursor: "pointer", opacity: i.status === "Void" ? 0.55 : 1 }}>
                    <td style={td}><strong>{i.invoiceNo}</strong><div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{i.ref} · {i.lineCount} line(s)</div></td>
                    <td style={td}>{i.supplierName}</td>
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
      )}

      {overlays}
    </div>
  );
}
