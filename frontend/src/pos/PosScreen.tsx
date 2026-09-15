"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccessories } from "@/cashier/contexts/AccessoriesContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useCreditAccounts, type CreditAccount } from "@/lib/credit/api";
import { fetchDealers } from "@/lib/repair/api";
import type { RepairDealer } from "@/cashier/contexts/RepairContext";
import { insertSale } from "@/lib/sales/api";
import { fetchNextInvoiceNo, useNextInvoiceNo } from "@/lib/sales/invoiceNo";
import { posOpenAccount, posPostCredit } from "@/lib/pos/api";
import { useTheme } from "@/lib/ui/theme";
import { CartPanel } from "./components/CartPanel";
import { HeldSalesModal } from "./components/HeldSalesModal";
import { PartyPicker } from "./components/PartyPicker";
import { PaymentSheet } from "./components/PaymentSheet";
import { PrintableReceipt, type ReceiptData } from "./components/PrintableReceipt";
import { ProductGrid } from "./components/ProductGrid";
import { ALL, SearchBar } from "./components/SearchBar";
import { Toast } from "./components/Toast";
import { TopBar } from "./components/TopBar";
import { useCart } from "./useCart";
import { formatCurrency } from "./format";
import type { HeldSale, Party, PartyType, PaymentMethod, Product } from "./types";

/**
 * The point-of-sale screen — iPark's, running on Mano Mobile's data.
 *
 * Products are the accessory catalogue (the same rows Inventory manages and
 * the counter's Accessory Sales sells from). Customers and dealers are credit
 * accounts, because an account is the only thing that can carry a balance,
 * plus the repair dealers who do not have one yet. A completed sale is a real
 * invoice: stock deducted in one transaction, an invoice number drawn from
 * the sequence, a row in `sales` with its lines, cash into the till, and any
 * unpaid remainder posted to the party's account as a charge.
 *
 * Held sales live in this tab only. A held sale is a cart somebody walked
 * away from for a minute, not a record; when the tab closes, it goes.
 */

const METHOD_LABEL: Record<PaymentMethod, "Cash" | "Card" | "Credit" | "Cheque"> = {
  cash: "Cash", card: "Card", credit: "Credit", check: "Cheque",
};

const today = () => new Date().toISOString().slice(0, 10);

const toParty = (a: CreditAccount): Party => ({
  id: a.id,
  type: a.holderKind === "Dealer" ? "dealer" : "customer",
  name: a.name,
  phone: a.phone ?? "",
  address: a.address ?? undefined,
  outstandingBalance: Math.max(0, a.balance),
  accountId: a.id,
  dealerId: a.dealerId,
});

export default function PosScreen({ cashierName, onLogout }: { cashierName: string; onLogout: () => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const cart = useCart();

  const accessories = useAccessories();
  const { sales, reload: reloadSales } = useSales();
  const { addEntry } = useCashRegister();
  const credit = useCreditAccounts();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);
  const [partyPickerType, setPartyPickerType] = useState<PartyType | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  // Bumped after each sale so the previewed invoice number moves on.
  const [salesDone, setSalesDone] = useState(0);
  const billNo = useNextInvoiceNo(salesDone);

  /* ── Products ────────────────────────────────────────────────────────── */

  const products = useMemo<Product[]>(
    () => accessories.products.map(p => ({
      id: p.id,
      name: p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name,
      sku: p.code,
      price: p.sellingPrice,
      category: p.category || "Accessories",
      stock: p.stock,
    })),
    [accessories.products],
  );

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category))).sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(p => {
      const matchesCategory = category === ALL || p.category === category;
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [products, query, category]);

  /* ── Parties ─────────────────────────────────────────────────────────── */

  const [dealers, setDealers] = useState<RepairDealer[]>([]);
  useEffect(() => {
    let active = true;
    fetchDealers().then(rows => { if (active) setDealers(rows); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const customers = useMemo<Party[]>(
    () => credit.accounts.filter(a => a.holderKind === "Customer").map(toParty),
    [credit.accounts],
  );
  const dealerParties = useMemo<Party[]>(() => {
    const withAccount = credit.accounts.filter(a => a.holderKind === "Dealer").map(toParty);
    const covered = new Set(withAccount.map(p => p.dealerId).filter((d): d is number => d != null));
    // The in-house entry is the shop itself; it does not buy from its own till.
    const rest: Party[] = dealers
      .filter(d => !d.inHouse && !covered.has(d.id))
      .map(d => ({
        id: `dealer:${d.id}`, type: "dealer", name: d.name, phone: d.contact ?? "",
        address: d.address || undefined, outstandingBalance: 0, accountId: null, dealerId: d.id,
      }));
    return [...withAccount, ...rest].sort((a, b) => a.name.localeCompare(b.name));
  }, [credit.accounts, dealers]);

  /* ── Today ───────────────────────────────────────────────────────────── */

  const todaySales = useMemo(() => {
    const d = today();
    return sales.filter(s => s.date === d && s.status !== "Voided");
  }, [sales]);
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);

  /* ── Helpers ─────────────────────────────────────────────────────────── */

  const showToast = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), tone === "error" ? 4200 : 2600);
  }, []);

  function snapshotReceipt(billNoUsed: string, paid: number, draft: boolean): ReceiptData {
    return {
      billNo: billNoUsed, when: new Date(), lines: cart.lines, party: cart.party,
      subtotal: cart.subtotal, discountAmount: cart.discountAmount, writeOffAmount: cart.writeOffAmount,
      total: cart.total, paid, draft,
    };
  }

  function printReceipt(data: ReceiptData) {
    setReceipt(data);
    // Let React paint the receipt before the print dialog freezes the page.
    window.setTimeout(() => window.print(), 80);
  }

  function handleHold() {
    if (cart.lines.length === 0) return;
    setHeldSales(prev => [{ id: crypto.randomUUID(), heldAt: Date.now(), ...cart.snapshot }, ...prev]);
    cart.clear();
    showToast("Sale held");
  }

  function handleResume(sale: HeldSale) {
    cart.restore(sale);
    setHeldSales(prev => prev.filter(s => s.id !== sale.id));
    setHeldOpen(false);
  }

  function handleSelectParty(party: Party) {
    cart.setParty(party);
    setPartyPickerType(null);
  }

  async function handleAddParty(draft: { name: string; phone: string; address: string }) {
    const type = partyPickerType ?? "customer";
    const accountId = await posOpenAccount({ kind: type, name: draft.name, phone: draft.phone || null, address: draft.address || null });
    await credit.reload();
    cart.setParty({
      id: accountId, type, name: draft.name, phone: draft.phone, address: draft.address || undefined,
      outstandingBalance: 0, accountId, dealerId: null,
    });
    setPartyPickerType(null);
  }

  /**
   * Why the sale cannot be completed as it stands, or null. A balance has to
   * belong to somebody: the till cannot record "Rs. 500 owed by nobody".
   */
  const dueWarning =
    cart.due > 0.005 && !cart.party
      ? `${formatCurrency(cart.due)} is unpaid. Pick a customer or dealer to put it on their account, or take the full amount.`
      : null;

  async function handleComplete(method: PaymentMethod, withBill: boolean) {
    if (completing || cart.lines.length === 0 || dueWarning) return;
    setCompleting(true);
    setCompleteError(null);

    const lines = cart.lines;
    const party = cart.party;
    const total = cart.total;
    // Change is handed back, so what the sale received is at most the bill.
    const paid = Math.min(cart.paidAmount, total);
    const due = Math.max(0, total - paid);

    try {
      // Stock first, in one transaction. If anything ran out since it was
      // added (another till sold it), this throws and nothing below runs.
      await accessories.sellStock(lines.map(l => ({ id: l.product.id, qty: l.qty })));
      const invoiceNo = await fetchNextInvoiceNo();

      if (method === "cash" && paid > 0) addEntry("in", "Cash Sale — POS", paid);

      await insertSale({
        invoiceNo,
        date: today(),
        customer: party?.name || "Walk-in",
        category: "Accessories",
        items: lines.map(l => `${l.product.name} ×${l.qty}`).join(", "),
        subtotal: cart.subtotal,
        discountAmount: cart.discountAmount + cart.writeOffAmount,
        total,
        paid,
        paymentMethod: due > 0 ? "Credit" : METHOD_LABEL[method],
        status: "Paid",
        cashier: cashierName,
      }, {
        customerPhone: party?.phone || null,
        dealerId: party?.dealerId ?? null,
        creditAccountId: party?.accountId ?? null,
        lineItems: lines.map(l => ({ type: "accessory" as const, id: l.product.id, qty: l.qty })),
        saleItems: lines.map(l => ({
          kind: "accessory" as const, referenceId: l.product.id, description: l.product.name,
          qty: l.qty, unitPrice: l.product.price, lineTotal: l.product.price * l.qty,
        })),
      });

      // The unpaid part goes on the party's account. A dealer picked from the
      // repair list may not have one yet; it is opened on the spot.
      if (due > 0.005 && party) {
        const accountId = party.accountId ?? await posOpenAccount({
          kind: party.type, name: party.name, phone: party.phone || null,
          address: party.address ?? null, dealerId: party.dealerId,
        });
        await posPostCredit(invoiceNo, accountId);
        void credit.reload();
      }

      void reloadSales();
      setSalesDone(n => n + 1);
      if (withBill) printReceipt(snapshotReceipt(invoiceNo, paid, false));
      cart.clear();
      setPaymentOpen(false);
      showToast(`${invoiceNo} — ${formatCurrency(total)}${due > 0 ? ` (${formatCurrency(due)} on account)` : ""}`);
    } catch (e) {
      // Stock may have moved even if a later step failed; re-read so the grid
      // does not offer what was just sold.
      void accessories.reload();
      setCompleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="pos-shell flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <TopBar
        dark={dark}
        onToggleDark={() => setTheme(dark ? "light" : "dark")}
        todayTotal={todayTotal}
        todayCount={todaySales.length}
        cashierName={cashierName}
        onLogout={onLogout}
      />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            categories={categories}
            activeCategory={category}
            onCategoryChange={setCategory}
          />
          <ProductGrid
            products={filteredProducts}
            onAdd={cart.addProduct}
            loading={accessories.loading}
            error={accessories.configured ? accessories.error : "Not connected to the database."}
          />
        </main>

        <CartPanel
          cart={cart}
          billNo={billNo}
          heldCount={heldSales.length}
          onOpenHeld={() => setHeldOpen(true)}
          onPickParty={type => setPartyPickerType(type)}
          onHold={handleHold}
          onNewSale={() => {
            cart.clear();
            showToast("Started a new sale");
          }}
          onVoid={() => {
            cart.clear();
            showToast("Order voided");
          }}
          onCharge={() => { setCompleteError(null); setPaymentOpen(true); }}
          onPrint={() => printReceipt(snapshotReceipt(billNo ?? "—", cart.paidAmount, true))}
        />
      </div>

      {paymentOpen && (
        <PaymentSheet
          total={cart.total}
          paid={cart.paidAmount}
          due={cart.due}
          warning={dueWarning}
          busy={completing}
          error={completeError}
          onClose={() => { if (!completing) setPaymentOpen(false); }}
          onComplete={handleComplete}
        />
      )}

      {heldOpen && (
        <HeldSalesModal
          sales={heldSales}
          onClose={() => setHeldOpen(false)}
          onResume={handleResume}
          onDelete={id => setHeldSales(prev => prev.filter(s => s.id !== id))}
        />
      )}

      {partyPickerType && (
        <PartyPicker
          type={partyPickerType}
          parties={partyPickerType === "customer" ? customers : dealerParties}
          loading={credit.loading}
          onSelect={handleSelectParty}
          onAdd={handleAddParty}
          onClose={() => setPartyPickerType(null)}
        />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <PrintableReceipt receipt={receipt} />
    </div>
  );
}
