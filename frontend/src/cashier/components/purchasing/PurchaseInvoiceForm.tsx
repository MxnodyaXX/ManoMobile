"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, PackagePlus, Paperclip, Plus, Search, ShieldCheck, Trash2, Layers } from "lucide-react";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import { useInventory } from "@/cashier/contexts/InventoryContext";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useToast } from "@/lib/ui/toast";
import { matchScannedAccessory } from "@/lib/inventory/accessoryScan";
import {
  PAY_METHODS, WARRANTY_START_LABEL, finalisePurchaseInvoice, lineTotalOf, nextItemCode, savePurchaseInvoice,
  today, uploadInvoiceAttachment, warrantyText,
  type InvoiceDetail, type NewProductDraft, type PayMethod, type WarrantyStart,
} from "@/lib/purchasing/api";
import { Btn, ErrorNote, Modal, Rs, ff, input, label } from "./ui";

/**
 * New / edit-draft supplier invoice.
 *
 * One screen for the whole bill: pick the supplier, then each line is either
 * an existing product (the delivery becomes a new batch of it — never a
 * duplicate product) or a new product described right here and created when
 * the invoice is finalised. Saving never moves stock; finalising locks the
 * bill and creates the new products; receiving is what puts stock on the
 * shelf ("Finalise & receive all" does both when the goods came with the bill).
 */

const WARRANTY_PRESETS = [0, 30, 90, 180, 365, 730];

interface Line {
  key: number;
  productId: number | null;
  np: NewProductDraft | null;
  description: string;
  qty: string;
  unitCost: string;
  expectedSellPrice: string;
  discount: string;
  taxPct: string;
  updateSellingPrice: boolean;
  swDays: string;          // "" = no supplier warranty
  swStart: WarrantyStart;
  swNotes: string;
  swTerms: string;
  cwDays: string;          // "" = shop policy at the counter
  open: boolean;           // warranty panel expanded
  search: string;
}

let keySeq = 0;
const blankLine = (): Line => ({
  key: ++keySeq, productId: null, np: null, description: "", qty: "1", unitCost: "", expectedSellPrice: "",
  discount: "", taxPct: "", updateSellingPrice: false, swDays: "", swStart: "invoice_date", swNotes: "", swTerms: "",
  cwDays: "", open: false, search: "",
});

const num = (v: string) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };

export default function PurchaseInvoiceForm({ existing, presetSupplierId, onClose, onSaved }: {
  existing?: InvoiceDetail;
  presetSupplierId?: number;
  onClose: () => void;
  /** Called with the invoice id after any successful save/finalise. */
  onSaved: (id: number) => void;
}) {
  const { products, reload: reloadProducts } = useAccessories();
  const { suppliers, addSupplier, categories, subcategories, brands } = useInventory();
  const { addEntry } = useCashRegister();
  const toast = useToast();
  const isMobile = useIsMobile();

  const inv = existing?.invoice;
  const [id, setId] = useState<number | null>(inv?.id ?? null);
  const [supplierText, setSupplierText] = useState(() =>
    suppliers.find(s => s.id === (inv?.supplierId ?? presetSupplierId))?.name ?? inv?.supplierName ?? "");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(inv?.invoiceNo ?? "");
  const [invoiceDate, setInvoiceDate] = useState(inv?.invoiceDate ?? today());
  const [dueDate, setDueDate] = useState(inv?.dueDate ?? "");
  const [expenses, setExpenses] = useState(inv?.expenses ? String(inv.expenses) : "");
  const [discount, setDiscount] = useState(inv?.discount ? String(inv.discount) : "");
  const [notes, setNotes] = useState(inv?.notes ?? "");
  const [attachment, setAttachment] = useState<{ path: string; name: string } | null>(
    inv?.attachmentPath ? { path: inv.attachmentPath, name: inv.attachmentName ?? "Attachment" } : null);
  const [file, setFile] = useState<File | null>(null);
  const [payAmount, setPayAmount] = useState(inv?.initialPayment ? String(inv.initialPayment.amount) : "");
  const [payMethod, setPayMethod] = useState<PayMethod>(inv?.initialPayment?.method ?? "Cash");
  const [payDate, setPayDate] = useState(inv?.initialPayment?.paidOn ?? today());
  const [payRef, setPayRef] = useState(inv?.initialPayment?.reference ?? "");
  const [fromDrawer, setFromDrawer] = useState(true);
  const [lines, setLines] = useState<Line[]>(() => existing
    ? existing.items.map(it => ({
        ...blankLine(),
        productId: it.productId, np: it.newProduct, description: it.description,
        qty: String(it.qty), unitCost: String(it.unitCost), expectedSellPrice: it.expectedSellPrice ? String(it.expectedSellPrice) : "",
        discount: it.discount ? String(it.discount) : "", taxPct: it.taxPct ? String(it.taxPct) : "",
        updateSellingPrice: it.updateSellingPrice,
        swDays: it.supplierWarrantyDays == null ? "" : String(it.supplierWarrantyDays), swStart: it.supplierWarrantyStart,
        swNotes: it.supplierWarrantyNotes, swTerms: it.supplierWarrantyTerms,
        cwDays: it.customerWarrantyDays == null ? "" : String(it.customerWarrantyDays),
      }))
    : [blankLine()]);
  const [busy, setBusy] = useState<null | "draft" | "final" | "receive">(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const supplier = suppliers.find(s => s.name.toLowerCase() === supplierText.trim().toLowerCase()) ?? null;
  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const patch = (key: number, p: Partial<Line>) => setLines(prev => prev.map(l => l.key === key ? { ...l, ...p } : l));

  const totals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + lineTotalOf({ qty: num(l.qty), unitCost: num(l.unitCost), discount: num(l.discount), taxPct: num(l.taxPct) }), 0);
    return { sub, total: Math.max(0, sub + num(expenses) - num(discount)) };
  }, [lines, expenses, discount]);

  /** Codes the catalogue and the other new lines already hold. */
  const takenCodes = (exceptKey?: number) => [
    ...products.map(p => p.code),
    ...lines.filter(l => l.key !== exceptKey && !l.productId && l.np).map(l => l.np!.code),
  ];

  const pickProduct = (l: Line, p: AccessoryProduct) => patch(l.key, {
    productId: p.id, np: null, search: "", description: p.name,
    unitCost: l.unitCost || String(p.buyingPrice || ""),
    expectedSellPrice: l.expectedSellPrice || String(p.sellingPrice || ""),
  });

  const startNewProduct = (l: Line) => patch(l.key, {
    productId: null, search: "",
    np: { name: l.search.trim(), code: "", category: "", subcategory: "", brand: "", model: "", description: "", barcodes: /^\d{8,14}$/.test(l.search.trim()) ? [l.search.trim()] : [], minStock: 5 },
  });

  function validate(): string | null {
    if (!supplier) return supplierText.trim() ? `"${supplierText.trim()}" isn't a supplier yet — click Create supplier first.` : "Pick the supplier.";
    if (!invoiceNo.trim()) return "Enter the supplier's invoice number.";
    if (lines.length === 0) return "Add at least one item.";
    const codes = new Set<string>();
    for (const [i, l] of lines.entries()) {
      const n = `Line ${i + 1}`;
      if (!l.productId && !l.np) return `${n}: pick a product, or add it as a new product.`;
      if (num(l.qty) <= 0 || !Number.isInteger(num(l.qty))) return `${n}: quantity must be a whole number above 0.`;
      if (l.unitCost.trim() === "" || num(l.unitCost) < 0) return `${n}: enter the buying price.`;
      if (num(l.discount) > num(l.qty) * num(l.unitCost)) return `${n}: the discount is more than the line.`;
      if (l.np) {
        if (!l.np.name.trim()) return `${n}: the new product needs a name.`;
        if (!l.np.category) return `${n}: pick a category for the new product.`;
        const code = l.np.code.trim().toLowerCase();
        if (!code) return `${n}: the new product needs an item code.`;
        if (products.some(p => p.code.toLowerCase() === code) || codes.has(code)) return `${n}: item code ${l.np.code} is already used.`;
        codes.add(code);
        const dup = products.find(p =>
          p.name.trim().toLowerCase() === l.np!.name.trim().toLowerCase() &&
          p.brand.trim().toLowerCase() === l.np!.brand.trim().toLowerCase() &&
          p.model.trim().toLowerCase() === l.np!.model.trim().toLowerCase());
        if (dup) return `${n}: "${dup.name}" (${dup.code}) is already in the catalogue — select it instead, and this delivery becomes a new batch of it.`;
      }
    }
    if (num(payAmount) > totals.total + 0.005) return "The payment is more than the invoice total.";
    return null;
  }

  async function createSupplier() {
    const name = supplierText.trim();
    if (!name) return;
    try {
      await addSupplier({ name, phone: newSupplierPhone.trim(), email: "", brandIds: [] });
      toast.success("Supplier added", name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submit(mode: "draft" | "final" | "receive") {
    if (busyRef.current) return;
    const problem = validate();
    if (problem) { setError(problem); return; }
    busyRef.current = true;
    setBusy(mode);
    setError(null);
    try {
      let att = attachment;
      if (file) { att = await uploadInvoiceAttachment(file); setAttachment(att); setFile(null); }
      const savedId = await savePurchaseInvoice({
        id, supplierId: supplier!.id, invoiceNo, invoiceDate, dueDate,
        expenses: num(expenses), discount: num(discount), notes,
        attachmentPath: att?.path ?? null, attachmentName: att?.name ?? null,
        initialPayment: num(payAmount) > 0 ? { amount: num(payAmount), method: payMethod, paidOn: payDate, reference: payRef.trim(), notes: "" } : null,
        items: lines.map(l => ({
          productId: l.productId, newProduct: l.productId ? null : l.np,
          description: l.productId ? (productById.get(l.productId)?.name ?? l.description) : (l.np?.name ?? ""),
          qty: num(l.qty), unitCost: num(l.unitCost), expectedSellPrice: num(l.expectedSellPrice),
          discount: num(l.discount), taxPct: num(l.taxPct), updateSellingPrice: !!l.productId && l.updateSellingPrice,
          supplierWarrantyDays: l.swDays === "" ? null : num(l.swDays), supplierWarrantyStart: l.swStart,
          supplierWarrantyNotes: l.swNotes, supplierWarrantyTerms: l.swTerms,
          customerWarrantyDays: l.cwDays === "" ? null : num(l.cwDays),
        })),
      });
      setId(savedId);
      if (mode !== "draft") {
        await finalisePurchaseInvoice(savedId, mode === "receive");
        if (num(payAmount) > 0 && payMethod === "Cash" && fromDrawer) {
          addEntry("out", `Supplier payment — ${supplier!.name} ${invoiceNo.trim()}`, num(payAmount));
        }
        void reloadProducts();
      }
      toast.success(
        mode === "draft" ? "Draft saved" : mode === "final" ? "Invoice finalised" : "Invoice finalised and stock received",
        `${supplier!.name} · ${invoiceNo.trim()} · ${Rs(totals.total)}`,
      );
      onSaved(savedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  const grid = (cols: string): React.CSSProperties => ({ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : cols, gap: 10 });

  return (
    <Modal
      title={inv ? `Edit draft ${inv.ref}` : "New Purchase Invoice"}
      subtitle="Saving keeps it as a draft — stock only moves when it's received."
      onClose={onClose}
      width={1080}
      busy={!!busy}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ErrorNote>{error}</ErrorNote>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Btn onClick={onClose} disabled={!!busy}>Cancel</Btn>
            <Btn onClick={() => void submit("draft")} disabled={!!busy}>{busy === "draft" ? "Saving…" : "Save draft"}</Btn>
            <Btn onClick={() => void submit("final")} disabled={!!busy} title="Lock the bill, create new products and record the payment. Receive stock later.">
              {busy === "final" ? "Finalising…" : "Finalise"}
            </Btn>
            <Btn kind="primary" onClick={() => void submit("receive")} disabled={!!busy} title="The goods came with the bill: finalise and put everything in stock now.">
              {busy === "receive" ? "Working…" : `Finalise & receive all · ${Rs(totals.total)}`}
            </Btn>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Header ── */}
        <div style={grid("2fr 1.2fr 1fr 1fr")}>
          <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
            <span style={label}>Supplier</span>
            <input list="pi-suppliers" value={supplierText} onChange={e => setSupplierText(e.target.value)} placeholder="Search suppliers…" style={input} />
            <datalist id="pi-suppliers">
              {suppliers.filter(s => s.active).map(s => <option key={s.id} value={s.name} />)}
            </datalist>
            {supplierText.trim() && !supplier && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input value={newSupplierPhone} onChange={e => setNewSupplierPhone(e.target.value)} placeholder="Phone (optional)" style={{ ...input, padding: "6px 9px" }} />
                <Btn onClick={() => void createSupplier()} style={{ padding: "6px 10px" }}><Plus size={12} /> Create supplier</Btn>
              </div>
            )}
          </div>
          <div>
            <span style={label}>Supplier invoice no.</span>
            <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="e.g. MX-1001" style={input} />
          </div>
          <div>
            <span style={label}>Invoice date</span>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>Payment due (optional)</span>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={input} />
          </div>
        </div>

        {/* ── Lines ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...label, marginBottom: 0 }}>Items ({lines.length})</span>
            <Btn onClick={() => setLines(prev => [...prev, blankLine()])} style={{ padding: "6px 10px" }}><Plus size={12} /> Add item</Btn>
          </div>

          {lines.map((l, idx) => {
            const p = l.productId ? productById.get(l.productId) ?? null : null;
            const qty = num(l.qty);
            const lt = lineTotalOf({ qty, unitCost: num(l.unitCost), discount: num(l.discount), taxPct: num(l.taxPct) });
            const landed = qty > 0 ? lt / qty : 0;
            const sell = num(l.expectedSellPrice);
            const profit = sell - landed;
            const margin = sell > 0 ? (profit / sell) * 100 : null;
            const priceDiffers = !!p && sell > 0 && Math.abs(sell - p.sellingPrice) > 0.005;
            const q = l.search.trim().toLowerCase();
            const hits = !q ? [] : (() => {
              const exact = matchScannedAccessory(products, l.search);
              if (exact.length) return exact;
              return products.filter(x =>
                x.name.toLowerCase().includes(q) || x.code.toLowerCase().includes(q) || x.brand.toLowerCase().includes(q) ||
                x.category.toLowerCase().includes(q) || x.model.toLowerCase().includes(q) || x.labelBarcode.includes(q) ||
                x.barcodes.some(b => b.toLowerCase().includes(q))).slice(0, 8);
            })();

            return (
              <div key={l.key} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>#{idx + 1}</span>
                  <button onClick={() => setLines(prev => prev.length > 1 ? prev.filter(x => x.key !== l.key) : prev)} title="Remove line" disabled={lines.length === 1}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: lines.length === 1 ? "not-allowed" : "pointer", opacity: lines.length === 1 ? 0.4 : 1 }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Product: existing, new, or not chosen yet */}
                {p ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(37,99,235,0.35)", background: "rgba(37,99,235,0.06)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#2563eb" }}>
                        <Layers size={12} /> Existing product found — new batch will be created
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginTop: 3 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {p.code} · {[p.brand, p.category, p.model].filter(Boolean).join(" · ")} · {p.stock} in stock · now selling at {Rs(p.sellingPrice)}
                      </div>
                    </div>
                    <Btn onClick={() => patch(l.key, { productId: null })} style={{ padding: "5px 9px", fontSize: 11.5 }}>Change</Btn>
                  </div>
                ) : l.np ? (
                  <NewProductFields
                    np={l.np}
                    onChange={np => patch(l.key, { np })}
                    onCancel={() => patch(l.key, { np: null })}
                    categories={categories.filter(c => c.active).map(c => c.name)}
                    subcategories={subcategories.filter(sc => sc.active && sc.categoryId === categories.find(c => c.name === l.np!.category)?.id).map(sc => sc.name)}
                    brands={brands.filter(b => b.active && b.type !== "device").map(b => b.name)}
                    suggestCode={cat => nextItemCode(cat, takenCodes(l.key))}
                    isMobile={isMobile}
                  />
                ) : (
                  <div style={{ position: "relative" }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
                    <input
                      value={l.search}
                      onChange={e => patch(l.key, { search: e.target.value })}
                      onKeyDown={e => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const exact = matchScannedAccessory(products, e.currentTarget.value);
                        if (exact.length === 1) pickProduct(l, exact[0]);
                      }}
                      placeholder="Search our products by name, barcode, item code, brand or category — or scan the box"
                      style={{ ...input, paddingLeft: 30 }}
                    />
                    {q && (
                      <div style={{ marginTop: 6, border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden", background: "var(--bg-card)" }}>
                        {hits.map(x => (
                          <button key={x.id} onClick={() => pickProduct(l, x)}
                            style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10, padding: "8px 12px", border: "none", borderBottom: "1px solid var(--border)", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: ff }}>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{x.name}</span>
                              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{x.code} · {[x.brand, x.category, x.model].filter(Boolean).join(" · ")}</span>
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{x.stock} in stock · {Rs(x.sellingPrice)}</span>
                          </button>
                        ))}
                        <button onClick={() => startNewProduct(l)}
                          style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", color: "var(--accent)", fontSize: 12.5, fontWeight: 700, fontFamily: ff }}>
                          <PackagePlus size={14} /> {hits.length ? "Not listed? " : "No match — "}Add &quot;{l.search.trim()}&quot; as a new product
                        </button>
                      </div>
                    )}
                    {!q && (
                      <button onClick={() => startNewProduct(l)}
                        style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, fontWeight: 600, fontFamily: ff }}>
                        <PackagePlus size={13} /> + Add New Product
                      </button>
                    )}
                  </div>
                )}

                {/* Quantities and prices */}
                <div style={grid("0.7fr 1fr 1fr 0.9fr 0.7fr 1fr")}>
                  <div><span style={label}>Qty</span><input value={l.qty} onChange={e => patch(l.key, { qty: e.target.value })} inputMode="numeric" style={input} /></div>
                  <div><span style={label}>Buying price / unit</span><input value={l.unitCost} onChange={e => patch(l.key, { unitCost: e.target.value })} inputMode="decimal" placeholder="0" style={input} /></div>
                  <div><span style={label}>Expected selling</span><input value={l.expectedSellPrice} onChange={e => patch(l.key, { expectedSellPrice: e.target.value })} inputMode="decimal" placeholder="0" style={input} /></div>
                  <div><span style={label}>Line discount</span><input value={l.discount} onChange={e => patch(l.key, { discount: e.target.value })} inputMode="decimal" placeholder="0" style={input} /></div>
                  <div><span style={label}>Tax %</span><input value={l.taxPct} onChange={e => patch(l.key, { taxPct: e.target.value })} inputMode="decimal" placeholder="0" style={input} /></div>
                  <div>
                    <span style={label}>Line total</span>
                    <div style={{ ...input, background: "transparent", border: "1px dashed var(--border)", fontWeight: 700 }}>{Rs(lt)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 11.5, color: "var(--text-muted)" }}>
                  {qty > 0 && <span>Cost/unit {Rs(Math.round(landed * 100) / 100)}</span>}
                  {sell > 0 && qty > 0 && (
                    <span style={{ color: profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      Profit/unit {Rs(Math.round(profit * 100) / 100)}{margin !== null && ` · margin ${margin.toFixed(1)}% · markup ${landed > 0 ? ((profit / landed) * 100).toFixed(1) : "—"}%`}
                    </span>
                  )}
                  {priceDiffers && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", cursor: "pointer" }}>
                      <input type="checkbox" checked={l.updateSellingPrice} onChange={e => patch(l.key, { updateSellingPrice: e.target.checked })} />
                      Selling now at <strong>{Rs(p!.sellingPrice)}</strong> → change to <strong>{Rs(sell)}</strong> when received
                    </label>
                  )}
                </div>

                {/* Warranty */}
                <button onClick={() => patch(l.key, { open: !l.open })}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, fontFamily: ff, alignSelf: "flex-start" }}>
                  {l.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <ShieldCheck size={13} /> Warranty — supplier: {l.swDays === "" ? "none" : warrantyText(num(l.swDays))} · customer: {l.cwDays === "" ? "shop policy" : warrantyText(num(l.cwDays))}
                </button>
                {l.open && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 4 }}>
                    <div style={grid("1fr 1.3fr 1fr")}>
                      <div>
                        <span style={label}>Supplier warranty (to us)</span>
                        <WarrantySelect value={l.swDays} onChange={v => patch(l.key, { swDays: v })} emptyLabel="No warranty" />
                      </div>
                      <div>
                        <span style={label}>Starts</span>
                        <select value={l.swStart} onChange={e => patch(l.key, { swStart: e.target.value as WarrantyStart })} style={input} disabled={l.swDays === ""}>
                          {(Object.keys(WARRANTY_START_LABEL) as WarrantyStart[]).map(k => <option key={k} value={k}>{WARRANTY_START_LABEL[k]}</option>)}
                        </select>
                      </div>
                      <div>
                        <span style={label}>Customer warranty (from us)</span>
                        <WarrantySelect value={l.cwDays} onChange={v => patch(l.key, { cwDays: v })} emptyLabel="Shop policy" />
                      </div>
                    </div>
                    <div style={grid("1fr 1fr")}>
                      <div><span style={label}>Supplier warranty notes</span><input value={l.swNotes} onChange={e => patch(l.key, { swNotes: e.target.value })} placeholder="e.g. Replace only, bring box" style={input} /></div>
                      <div><span style={label}>Supplier terms</span><input value={l.swTerms} onChange={e => patch(l.key, { swTerms: e.target.value })} placeholder="e.g. No physical damage" style={input} /></div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      The supplier warranty is what the supplier gives the shop. The customer warranty is what the counter offers when it sells from this batch — they are kept separate.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Totals + payment + notes ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={grid("1fr 1fr")}>
              <div><span style={label}>Extra expenses (transport…)</span><input value={expenses} onChange={e => setExpenses(e.target.value)} inputMode="decimal" placeholder="0" style={input} /></div>
              <div><span style={label}>Invoice discount</span><input value={discount} onChange={e => setDiscount(e.target.value)} inputMode="decimal" placeholder="0" style={input} /></div>
            </div>
            <div>
              <span style={label}>Notes</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...input, resize: "vertical" }} />
            </div>
            <div>
              <span style={label}>Invoice copy (photo or PDF)</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, color: "var(--text-secondary)" }}>
                <Paperclip size={14} />
                <span>{file ? file.name : attachment ? `${attachment.name} (attached)` : "Attach a file…"}</span>
                <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}><span>Items</span><span>{Rs(totals.sub)}</span></div>
              {num(expenses) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}><span>Expenses</span><span>+ {Rs(num(expenses))}</span></div>}
              {num(discount) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}><span>Discount</span><span>− {Rs(num(discount))}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "var(--text-primary)", borderTop: "1px dashed var(--border)", paddingTop: 6 }}><span>Invoice total</span><span>{Rs(totals.total)}</span></div>
              {num(payAmount) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: totals.total - num(payAmount) > 0 ? "#d97706" : "#16a34a" }}>
                  <span>Outstanding after payment</span><span>{Rs(Math.max(0, totals.total - num(payAmount)))}</span>
                </div>
              )}
            </div>
            <div>
              <span style={label}>Paid now (recorded when finalised)</span>
              <div style={grid("1fr 1fr")}>
                <input value={payAmount} onChange={e => setPayAmount(e.target.value)} inputMode="decimal" placeholder="0" style={input} />
                <select value={payMethod} onChange={e => setPayMethod(e.target.value as PayMethod)} style={input}>
                  {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={input} />
                <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Reference / cheque no." style={input} />
              </div>
              {num(payAmount) > 0 && payMethod === "Cash" && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11.5, color: "var(--text-secondary)", cursor: "pointer" }}>
                  <input type="checkbox" checked={fromDrawer} onChange={e => setFromDrawer(e.target.checked)} /> Paid from the cash drawer (records a cash-out)
                </label>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function WarrantySelect({ value, onChange, emptyLabel }: { value: string; onChange: (v: string) => void; emptyLabel: string }) {
  const presets = WARRANTY_PRESETS.map(String);
  const custom = value !== "" && !presets.includes(value);
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select value={custom ? "custom" : value} onChange={e => onChange(e.target.value === "custom" ? "45" : e.target.value)} style={input}>
        <option value="">{emptyLabel}</option>
        {WARRANTY_PRESETS.map(d => <option key={d} value={String(d)}>{d === 0 ? "No warranty (0)" : warrantyText(d)}</option>)}
        <option value="custom">Custom days…</option>
      </select>
      {custom && <input value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ""))} inputMode="numeric" style={{ ...input, width: 80 }} title="Days" />}
    </div>
  );
}

function NewProductFields({ np, onChange, onCancel, categories, subcategories, brands, suggestCode, isMobile }: {
  np: NewProductDraft;
  onChange: (np: NewProductDraft) => void;
  onCancel: () => void;
  categories: string[];
  subcategories: string[];
  brands: string[];
  suggestCode: (category: string) => string;
  isMobile: boolean;
}) {
  const set = (p: Partial<NewProductDraft>) => onChange({ ...np, ...p });
  const g = (cols: string): React.CSSProperties => ({ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : cols, gap: 10 });
  return (
    <div style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#16a34a" }}>
          <PackagePlus size={12} /> New product — added to the catalogue when this invoice is finalised
        </span>
        <Btn onClick={onCancel} style={{ padding: "4px 8px", fontSize: 11 }}>Pick existing instead</Btn>
      </div>
      <div style={g("2fr 1.2fr 1.2fr 1fr")}>
        <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}><span style={label}>Product name</span><input value={np.name} onChange={e => set({ name: e.target.value })} style={input} /></div>
        <div>
          <span style={label}>Category</span>
          <select value={np.category} onChange={e => set({ category: e.target.value, subcategory: "", code: np.code && np.category === e.target.value ? np.code : suggestCode(e.target.value) })} style={input}>
            <option value="">Choose…</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Subcategory</span>
          <select value={np.subcategory} onChange={e => set({ subcategory: e.target.value })} style={input} disabled={subcategories.length === 0}>
            <option value="">{subcategories.length ? "Choose…" : "—"}</option>
            {subcategories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><span style={label}>Item code</span><input value={np.code} onChange={e => set({ code: e.target.value })} placeholder="auto" style={input} /></div>
      </div>
      <div style={g("1fr 1fr 1.5fr 0.6fr")}>
        <div>
          <span style={label}>Brand</span>
          <input list="pi-brands" value={np.brand} onChange={e => set({ brand: e.target.value })} style={input} />
          <datalist id="pi-brands">{brands.map(b => <option key={b} value={b} />)}</datalist>
        </div>
        <div><span style={label}>Compatible model</span><input value={np.model} onChange={e => set({ model: e.target.value })} placeholder="e.g. Universal" style={input} /></div>
        <div>
          <span style={label}>Packaging barcode(s)</span>
          <input value={np.barcodes.join(", ")} onChange={e => set({ barcodes: e.target.value.split(/[,\s]+/).filter(Boolean) })} placeholder="Scan the box — comma between several" style={input} />
        </div>
        <div><span style={label}>Min stock</span><input value={String(np.minStock)} onChange={e => set({ minStock: Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)) })} inputMode="numeric" style={input} /></div>
      </div>
      <div><span style={label}>Description (optional)</span><input value={np.description} onChange={e => set({ description: e.target.value })} style={input} /></div>
    </div>
  );
}
