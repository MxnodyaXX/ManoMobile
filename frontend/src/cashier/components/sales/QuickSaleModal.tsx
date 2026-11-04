"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Printer, ScanLine, ShieldCheck, Trash2, X, Zap } from "lucide-react";
import { useAccessories, type AccessoryProduct } from "@/cashier/contexts/AccessoriesContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useBarcodeScanner } from "@/cashier/hooks/useBarcodeScanner";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/lib/ui/toast";
import { matchScannedAccessory } from "@/lib/inventory/accessoryScan";
import { fetchNextInvoiceNo } from "@/lib/sales/invoiceNo";
import { insertSale } from "@/lib/sales/api";
import { fetchPolicies, policyFor, type WarrantyPolicy } from "@/lib/warranty/lookup";
import { fetchNextBatchCustomerWarranty } from "@/lib/purchasing/api";
import { SHOP_DETAILS } from "@/lib/shop";
import { QRCodeSVG } from "qrcode.react";
import { verifyUrl } from "@/lib/sales/verify";

/**
 * Quick Sale — an accessory sale straight from the scan popup.
 *
 * The full Accessory Sales screen asks for a customer, walks three steps and
 * lives two clicks away; with a queue at the counter that is too slow for a
 * cable and a glass. This is the same sale in one panel: scan, (optionally)
 * name the customer, pick warranties, take the money.
 *
 * Nothing here is a second sales system. Stock goes through sellStock() (one
 * transaction, fails the whole sale if anything ran short), the number from
 * next_invoice_no(), the invoice through insertSale() with the same
 * line_items/sale_items every other accessory sale writes, cash into the
 * register through addEntry(). The only addition is the per-line warranty,
 * stored on sale_items (migration 20261021000084) so the Warranty Center
 * honours what the receipt says.
 *
 * Credit is deliberately not offered: a balance has to sit on somebody's
 * account, which is the full sales screen's job.
 */

const ff = "'Plus Jakarta Sans', sans-serif";

type PayMethod = "Cash" | "Card" | "Bank Transfer";
const PAY_METHODS: PayMethod[] = ["Cash", "Card", "Bank Transfer"];

const WARRANTY_DAYS = [0, 7, 30, 90, 180, 365, 730];

export function warrantyLabel(days: number): string {
  if (days <= 0) return "No warranty";
  if (days % 365 === 0) return `${days / 365} year${days === 365 ? "" : "s"} warranty`;
  if (days % 30 === 0) return `${days / 30} month${days === 30 ? "" : "s"} warranty`;
  return `${days} day${days === 1 ? "" : "s"} warranty`;
}

interface Line {
  product: AccessoryProduct;
  qty: number;
  warrantyDays: number;
}

/** Everything the printed receipt needs, frozen at the moment of sale. */
interface ReceiptSnapshot {
  invoiceNo: string;
  when: Date;
  lines: Line[];
  customer: string;
  phone: string;
  subtotal: number;
  discount: number;
  total: number;
  method: PayMethod;
  received: number;
  change: number;
  cashier: string;
}

const Rs = (n: number) => `Rs. ${n.toLocaleString()}`;

export default function QuickSaleModal({ initial, onClose }: {
  /** The product scanned in the popup — already on the bill when this opens. */
  initial: AccessoryProduct[];
  onClose: () => void;
}) {
  const { products, sellStock, reload: reloadProducts } = useAccessories();
  const { reload: reloadSales } = useSales();
  const { addEntry } = useCashRegister();
  const { profile } = useAuth();
  const toast = useToast();
  const isMobile = useIsMobile();

  const [policies, setPolicies] = useState<WarrantyPolicy[]>([]);
  // The scanned product starts on the bill. Warranty 0 until the policies
  // load — the effect below then moves it to the shop's period.
  const [lines, setLines] = useState<Line[]>(() =>
    initial.filter(p => p.stock > 0).map(p => ({ product: p, qty: 1, warrantyDays: 0 })));
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState<PayMethod>("Cash");
  const [received, setReceived] = useState("");
  const [cardRef, setCardRef] = useState("");
  const [printAfter, setPrintAfter] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State alone doesn't stop a double-click: both clicks land before the
  // re-render that disables the button. A ref is read synchronously.
  const busy = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);

  // The customer warranty set on the batch each product sells from next
  // (FIFO), from its supplier invoice. Wins over the shop policy.
  const [batchWarranty, setBatchWarranty] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    let active = true;
    fetchPolicies().then(p => { if (active) setPolicies(p); }).catch(() => { /* no policy: default "none" */ });
    fetchNextBatchCustomerWarranty(products.map(p => p.id)).then(m => { if (active) setBatchWarranty(m); });
    return () => { active = false; };
    // Once per open: the catalogue is already loaded when a scan opens this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultWarranty = (p: AccessoryProduct) =>
    batchWarranty.get(p.id) ?? policyFor(policies, "accessory", p.category)?.durationDays ?? 0;

  // Once policies/batches arrive, lines still on their untouched default pick
  // up the right period. Tracked per product so a cashier's own choice is kept.
  const touchedWarranty = useRef(new Set<number>());
  useEffect(() => {
    if (policies.length === 0 && batchWarranty.size === 0) return;
    setLines(prev => prev.map(l => touchedWarranty.current.has(l.product.id) ? l : { ...l, warrantyDays: defaultWarranty(l.product) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies, batchWarranty]);

  /** Live stock for a product — the catalogue moves while this is open. */
  const stockOf = (id: number) => products.find(p => p.id === id)?.stock ?? 0;

  const add = (p: AccessoryProduct): boolean => {
    const inBill = lines.find(l => l.product.id === p.id)?.qty ?? 0;
    if (inBill + 1 > stockOf(p.id)) {
      toast.error(stockOf(p.id) === 0 ? `${p.name} is out of stock` : `Only ${stockOf(p.id)} of ${p.name} in stock`);
      return false;
    }
    setLines(prev => prev.some(l => l.product.id === p.id)
      ? prev.map(l => l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l)
      : [...prev, { product: p, qty: 1, warrantyDays: defaultWarranty(p) }]);
    return true;
  };

  const focusSearch = () => setTimeout(() => searchRef.current?.focus(), 0);
  useEffect(() => { if (!isMobile) focusSearch(); }, [isMobile]);

  /** A scanned or typed code. Same rules as the sales screen's scan box. */
  const addByCode = (code: string): boolean => {
    const matches = matchScannedAccessory(products, code);
    if (matches.length === 0) return false;
    const inStock = matches.filter(p => p.stock > 0);
    if (matches.length === 1) add(matches[0]);
    else if (inStock.length === 1) add(inStock[0]);
    else { setSearch(code.trim()); return true; } // several in stock: list them below to pick
    setSearch("");
    return true;
  };

  // A scan while focus is on a button or the backdrop still lands here. The
  // popup's own scanner is paused while this is open (see CashierScan).
  useBarcodeScanner(code => { if (!addByCode(code)) toast.error(`No product for ${code}`); }, !completing);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const exact = matchScannedAccessory(products, search);
    if (exact.length > 1) return exact;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) || p.model.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [products, search]);

  const subtotal = lines.reduce((s, l) => s + l.product.sellingPrice * l.qty, 0);
  const discountAmt = Math.max(0, parseFloat(discount) || 0);
  const total = Math.max(0, subtotal - discountAmt);
  const receivedAmt = parseFloat(received) || 0;
  const change = method === "Cash" && receivedAmt > 0 ? receivedAmt - total : 0;

  const problem =
    lines.length === 0 ? "Scan or search a product to start."
    : discountAmt > subtotal ? "The discount is more than the bill."
    : lines.some(l => l.qty > stockOf(l.product.id)) ? "A line asks for more than is in stock."
    : method === "Cash" && received.trim() !== "" && receivedAmt < total ? "Cash received is less than the total."
    : null;

  const setQty = (id: number, qty: number) => {
    if (qty < 1) return;
    if (qty > stockOf(id)) { toast.error(`Only ${stockOf(id)} in stock`); return; }
    setLines(prev => prev.map(l => l.product.id === id ? { ...l, qty } : l));
  };

  function printReceipt() {
    const node = receiptRef.current;
    if (!node) return;
    document.getElementById("__qs_print__")?.remove();
    document.getElementById("__qs_print_style__")?.remove();
    const holder = document.createElement("div");
    holder.id = "__qs_print__";
    holder.innerHTML = node.outerHTML;
    document.body.appendChild(holder);
    const style = document.createElement("style");
    style.id = "__qs_print_style__";
    style.textContent = `
      @page { size: 80mm auto; margin: 0; }
      #__qs_print__ { display: none; }
      @media print {
        body { visibility: hidden; }
        #__qs_print__ { display: block !important; visibility: visible; position: fixed; top: 0; left: 0; width: 80mm; }
        #__qs_print__ * { visibility: visible; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => { holder.remove(); style.remove(); }, 500);
  }

  // Print once the receipt for the sale just completed has rendered.
  useEffect(() => {
    if (!receipt || !printAfter) return;
    const t = setTimeout(printReceipt, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt]);

  async function complete() {
    if (busy.current || problem) return;
    busy.current = true;
    setCompleting(true);
    setError(null);
    const sold = lines;
    const name = customer.trim();
    const tel = phone.trim();
    let stockTaken = false;
    try {
      // Stock first, atomically: if another till sold the last one since it
      // was scanned, this throws and no invoice is raised for it.
      const saleKey = crypto.randomUUID();
      await sellStock(sold.map(l => ({ id: l.product.id, qty: l.qty })), saleKey);
      stockTaken = true;
      const invoiceNo = await fetchNextInvoiceNo();
      const cashier = profile?.fullName ?? "";

      await insertSale({
        invoiceNo,
        date: new Date().toISOString().slice(0, 10),
        customer: name || "Walk-in",
        category: "Accessories",
        items: sold.map(l => `${l.product.name} ×${l.qty}`).join(", "),
        subtotal,
        discountAmount: discountAmt,
        total,
        paid: total,
        paymentMethod: method,
        cashAmount: method === "Cash" ? total : undefined,
        cardAmount: method === "Card" ? total : undefined,
        cardRef: method === "Card" && cardRef.trim() ? cardRef.trim() : undefined,
        status: "Paid",
        cashier: cashier || undefined,
      }, {
        customerPhone: tel || null,
        saleKey,
        lineItems: sold.map(l => ({ type: "accessory" as const, id: l.product.id, qty: l.qty })),
        saleItems: sold.map(l => ({
          kind: "accessory" as const,
          referenceId: l.product.id,
          description: l.product.name,
          qty: l.qty,
          unitPrice: l.product.sellingPrice,
          lineTotal: l.product.sellingPrice * l.qty,
          warrantyDays: l.warrantyDays,
          warrantyLabel: warrantyLabel(l.warrantyDays),
        })),
      });

      if (method === "Cash") addEntry("in", `Cash Sale — Quick Sale ${invoiceNo}`, total);
      void reloadSales();

      setReceipt({
        invoiceNo, when: new Date(), lines: sold, customer: name, phone: tel,
        subtotal, discount: discountAmt, total, method,
        received: method === "Cash" ? (receivedAmt || total) : total,
        change: Math.max(0, change), cashier,
      });
      toast.success(`${invoiceNo} — ${Rs(total)}`, method === "Cash" && change > 0 ? `Change ${Rs(change)}` : undefined);

      // Ready for the next customer.
      setLines([]); setCustomer(""); setPhone(""); setDiscount(""); setReceived(""); setCardRef("");
      setMethod("Cash"); setSearch("");
      touchedWarranty.current.clear();
      focusSearch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(stockTaken
        ? `Stock was taken off, but the invoice was not saved: ${msg}. Tell an admin before selling again.`
        : msg);
      void reloadProducts();
    } finally {
      busy.current = false;
      setCompleting(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)",
    fontSize: 13, fontFamily: ff, outline: "none",
  };
  const label: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase",
    letterSpacing: "0.06em", marginBottom: 5, display: "block", fontFamily: ff,
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1020, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 8 : 20 }}
      onClick={e => { if (e.target === e.currentTarget && !completing) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(860px, calc(100vw - 16px))", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)", fontFamily: ff }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={15} color="var(--accent)" />
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>Quick Sale</p>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Accessories · scan to add more</span>
          </div>
          <button onClick={onClose} disabled={completing} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, flex: 1, overflowY: isMobile ? "auto" : "hidden" }}>

          {/* ── Left: the bill ── */}
          <div style={{ flex: 1.4, display: "flex", flexDirection: "column", minHeight: 0, padding: 16, gap: 12, borderRight: isMobile ? "none" : "1px solid var(--border)" }}>
            <div style={{ position: "relative" }}>
              <ScanLine size={14} style={{ position: "absolute", left: 11, top: 12, color: "var(--text-muted)" }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const code = e.currentTarget.value.trim();
                  if (!code) return;
                  // An exact code/barcode adds; otherwise a single search hit
                  // adds; otherwise the list below is there to pick from.
                  if (addByCode(code)) return;
                  if (suggestions.length === 1) { if (add(suggestions[0])) setSearch(""); }
                  else if (suggestions.length === 0) toast.error(`No product for ${code}`);
                }}
                placeholder="Scan another item, or search by name / code"
                style={{ ...input, paddingLeft: 32 }}
              />
              {suggestions.length > 0 && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 5, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 9, boxShadow: "0 12px 32px rgba(0,0,0,0.35)", overflow: "hidden" }}>
                  {suggestions.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { if (add(p)) setSearch(""); focusSearch(); }}
                      disabled={p.stock <= 0}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", border: "none", borderBottom: "1px solid var(--border)", background: "transparent", cursor: p.stock > 0 ? "pointer" : "not-allowed", opacity: p.stock > 0 ? 1 : 0.5, textAlign: "left", fontFamily: ff }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{p.code} · {p.brand}{p.addedDate ? ` · added ${p.addedDate}` : ""}</span>
                      </span>
                      <span style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{Rs(p.sellingPrice)}</span>
                        <span style={{ display: "block", fontSize: 11, color: p.stock > 0 ? "var(--text-muted)" : "#ef4444" }}>{p.stock} in stock</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, minHeight: isMobile ? undefined : 0 }}>
              {lines.length === 0 && (
                <div style={{ padding: "28px 0", textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>Nothing on the bill yet — scan an item.</div>
              )}
              {lines.map(l => {
                const options = WARRANTY_DAYS.includes(l.warrantyDays) ? WARRANTY_DAYS : [...WARRANTY_DAYS, l.warrantyDays].sort((a, b) => a - b);
                return (
                  <div key={l.product.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, background: "var(--bg-surface)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{l.product.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{l.product.code} · {Rs(l.product.sellingPrice)} each · {stockOf(l.product.id)} in stock</div>
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{Rs(l.product.sellingPrice * l.qty)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
                        <button onClick={() => setQty(l.product.id, l.qty - 1)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={12} /></button>
                        <span style={{ minWidth: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{l.qty}</span>
                        <button onClick={() => setQty(l.product.id, l.qty + 1)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={12} /></button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 150 }}>
                        <ShieldCheck size={13} color={l.warrantyDays > 0 ? "var(--accent)" : "var(--text-muted)"} />
                        <select
                          value={l.warrantyDays}
                          onChange={e => {
                            const days = Number(e.target.value);
                            touchedWarranty.current.add(l.product.id);
                            setLines(prev => prev.map(x => x.product.id === l.product.id ? { ...x, warrantyDays: days } : x));
                          }}
                          style={{ ...input, padding: "5px 8px", fontSize: 12, width: "auto", flex: 1 }}
                        >
                          {options.map(d => <option key={d} value={d}>{warrantyLabel(d)}</option>)}
                        </select>
                      </div>
                      <button onClick={() => setLines(prev => prev.filter(x => x.product.id !== l.product.id))} title="Remove" style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: customer + payment ── */}
          <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12, overflowY: isMobile ? "visible" : "auto" }}>
            <div>
              <span style={label}>Customer (optional)</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Name" style={input} />
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" style={input} />
              </div>
            </div>

            <div>
              <span style={label}>Payment</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {PAY_METHODS.map(m => (
                  <button key={m} onClick={() => setMethod(m)} style={{ padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff, border: `1px solid ${method === m ? "var(--accent)" : "var(--border)"}`, background: method === m ? "var(--accent)" : "transparent", color: method === m ? "var(--accent-fg)" : "var(--text-secondary)" }}>
                    {m}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 5 }}>Selling on credit? Use Sales Management — a balance needs a customer account.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <span style={label}>Discount (Rs.)</span>
                <input value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" inputMode="decimal" style={input} />
              </div>
              {method === "Cash" ? (
                <div>
                  <span style={label}>Cash received</span>
                  <input value={received} onChange={e => setReceived(e.target.value)} placeholder={total ? String(total) : "0"} inputMode="decimal" style={input} />
                </div>
              ) : method === "Card" ? (
                <div>
                  <span style={label}>Card ref (optional)</span>
                  <input value={cardRef} onChange={e => setCardRef(e.target.value)} placeholder="Last 4 / approval" style={input} />
                </div>
              ) : <div />}
            </div>

            <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}><span>Subtotal</span><span>{Rs(subtotal)}</span></div>
              {discountAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}><span>Discount</span><span>− {Rs(discountAmt)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "var(--text-primary)", borderTop: "1px dashed var(--border)", paddingTop: 6 }}><span>Payable</span><span>{Rs(total)}</span></div>
              {method === "Cash" && receivedAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: change >= 0 ? "var(--accent)" : "#dc2626" }}>
                  <span>{change >= 0 ? "Change" : "Short"}</span><span>{Rs(Math.abs(change))}</span>
                </div>
              )}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={printAfter} onChange={e => setPrintAfter(e.target.checked)} />
              <Printer size={13} /> Print receipt
            </label>

            {(error || problem) && (
              <div style={{ fontSize: 12, color: error ? "#dc2626" : "var(--text-muted)", lineHeight: 1.45 }}>{error ?? problem}</div>
            )}

            <button
              onClick={() => void complete()}
              disabled={completing || !!problem}
              style={{ marginTop: "auto", padding: "13px 16px", borderRadius: 10, border: "none", background: completing || problem ? "var(--border)" : "var(--accent)", color: completing || problem ? "var(--text-muted)" : "var(--accent-fg)", fontSize: 14, fontWeight: 800, cursor: completing || problem ? "not-allowed" : "pointer", fontFamily: ff }}
            >
              {completing ? "Completing…" : `Complete Quick Sale · ${Rs(total)}`}
            </button>
            {receipt && (
              <button onClick={printReceipt} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: ff, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Printer size={13} /> Reprint {receipt.invoiceNo}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* The receipt of the last completed sale, off-screen: printReceipt copies it. */}
      {receipt && (
        <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden>
          <QuickSaleReceipt ref={receiptRef} r={receipt} />
        </div>
      )}
    </div>,
    document.body,
  );
}

function QuickSaleReceipt({ r, ref }: { r: ReceiptSnapshot; ref: React.Ref<HTMLDivElement> }) {
  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8 };
  const rule = <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />;
  return (
    <div ref={ref} style={{ width: "80mm", boxSizing: "border-box", padding: "4mm 4mm 6mm", background: "#fff", color: "#111", fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.35 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "Arial, sans-serif" }}>{SHOP_DETAILS.name.toUpperCase()}</div>
        <div style={{ fontSize: 10 }}>{SHOP_DETAILS.address}</div>
        <div style={{ fontSize: 10 }}>{SHOP_DETAILS.phone}</div>
      </div>
      {rule}
      <div style={row}><span>Invoice</span><strong>{r.invoiceNo}</strong></div>
      <div style={row}><span>Date</span><span>{r.when.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span></div>
      {r.customer && <div style={row}><span>Customer</span><span>{r.customer}</span></div>}
      {r.phone && <div style={row}><span>Phone</span><span>{r.phone}</span></div>}
      {rule}
      {r.lines.map(l => (
        <div key={l.product.id} style={{ marginBottom: 5 }}>
          <div style={{ fontWeight: 700 }}>{l.product.name}</div>
          <div style={row}><span>{l.qty} × {l.product.sellingPrice.toLocaleString()}</span><span>{(l.qty * l.product.sellingPrice).toLocaleString()}</span></div>
          {l.warrantyDays > 0 && <div style={{ fontSize: 10 }}>Warranty: {warrantyLabel(l.warrantyDays).replace(/ warranty$/, "")}</div>}
        </div>
      ))}
      {rule}
      <div style={row}><span>Subtotal</span><span>{r.subtotal.toLocaleString()}</span></div>
      {r.discount > 0 && <div style={row}><span>Discount</span><span>-{r.discount.toLocaleString()}</span></div>}
      <div style={{ ...row, fontSize: 13, fontWeight: 900 }}><span>TOTAL</span><span>Rs. {r.total.toLocaleString()}</span></div>
      <div style={row}><span>Paid ({r.method})</span><span>{r.received.toLocaleString()}</span></div>
      {r.change > 0 && <div style={row}><span>Change</span><span>{r.change.toLocaleString()}</span></div>}
      {rule}
      {r.lines.some(l => l.warrantyDays > 0) && (
        <div style={{ fontSize: 9.5 }}>Warranty valid only with this receipt. Physical damage not covered.</div>
      )}
      {r.cashier && <div style={{ fontSize: 9.5 }}>Cashier: {r.cashier}</div>}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 8 }}>
        <QRCodeSVG value={verifyUrl(r.invoiceNo)} size={128} level="M" marginSize={0} style={{ width: "24mm", height: "24mm" }} />
        <div style={{ fontSize: 9, marginTop: 3, fontFamily: "Arial, sans-serif" }}>Scan to check your product &amp; warranty</div>
      </div>
      <div style={{ textAlign: "center", marginTop: 6, fontSize: 10 }}>Thank you — come again!</div>
    </div>
  );
}
