"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchSales, insertSale, updateSale as persistSale, type SaleExtras } from "@/lib/sales/api";
import { isSupabaseConfigured } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxCategory = "Accessories" | "Mobile" | "Repair" | "Others";
export type TxStatus   = "Paid" | "Voided" | "Returned";

export interface SaleTx {
  id: string;
  invoiceNo: string;
  date: string;
  customer: string;
  category: TxCategory;
  items: string;
  total: number;
  status: TxStatus;
  returnedAmount?: number;
  returnReason?: string;
  returnDate?: string;
  paymentMethod?: "Cash" | "Card" | "Bank Transfer" | "Credit" | "Split";
  cashAmount?: number;
  cardAmount?: number;
  cardRef?: string;
  /** The bill before any discount. Absent on older rows; total + discount. */
  subtotal?: number;
  /** Rupees off the bill. */
  discountAmount?: number;
  /** How much of it has been settled. Absent means never recorded — read the
   *  status instead, never assume zero. */
  paid?: number;
  /** Written off as uncollectable. Derived from credit write-offs that name
   *  this invoice — never entered by hand, so it cannot drift from the ledger
   *  it summarises. */
  badDebt?: number;
  discountPct?: number;
  taxPct?: number;
  taxAmount?: number;
  cashier?: string;
  shiftId?: string;
  /** The repair dealer this was billed to, when it was one. */
  dealerId?: number | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SalesContextValue {
  sales: SaleTx[];
  /** Records the sale. `extras` carries what the printed invoice does not —
   *  which dealer, which credit account, which repair jobs — so the invoice
   *  number can be traced in both directions. */
  addSale: (partial: Omit<SaleTx, "id">, extras?: SaleExtras) => void;
  updateSale: (id: string, changes: Partial<SaleTx>) => void;
  returnSale: (id: string, amount: number, reason: string) => void;
  loading: boolean;
  /** Set when the ledger could not be read or a sale could not be stored. The
   *  sale still shows on screen; this says it is not safe yet. */
  error: string | null;
}

const SalesContext = createContext<SalesContextValue>({
  sales: [],
  addSale: () => {},
  updateSale: () => {},
  returnSale: () => {},
  loading: false,
  error: null,
});

/**
 * The shop's sales, stored.
 *
 * This used to be useState([]) and nothing else: invoice numbers were drawn
 * from a real Postgres sequence, printed, handed to customers — and forgotten
 * the moment the page reloaded. Sales History, Invoice History and the Daily
 * Summary were reading that empty array, which is why they were always empty.
 *
 * The interface is unchanged, so those screens did not need touching. What
 * changed is that addSale now writes through to the sales table.
 *
 * Writes are optimistic: the sale appears immediately and is reconciled with
 * the stored row when the insert returns. A cashier should never wait on the
 * network with a customer at the counter, and the invoice number was already
 * issued by the time addSale is called — the sale is a fact, storing it is
 * bookkeeping that catches up.
 */
export function SalesProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [sales, setSales] = useState<SaleTx[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    (async () => {
      try {
        const rows = await fetchSales();
        if (active) { setSales(rows); setError(null); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [configured]);

  const addSale = (partial: Omit<SaleTx, "id">, extras?: SaleExtras) => {
    // A temporary id so the row can be rendered now and swapped for the stored
    // one when it lands. Prefixed so anything that leaks it is obvious.
    const tempId = `pending-${partial.invoiceNo}`;
    setSales(prev => [{ id: tempId, ...partial }, ...prev]);
    if (!configured) return;

    void (async () => {
      try {
        const stored = await insertSale(partial, extras);
        setSales(prev => prev.map(s => (s.id === tempId ? stored : s)));
        setError(null);
      } catch (e) {
        // The row stays on screen — the invoice exists and the customer has it.
        // The message is what tells somebody the books need fixing.
        setError(
          `${partial.invoiceNo} could not be saved: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    })();
  };

  const updateSale = (id: string, changes: Partial<SaleTx>) => {
    setSales(prev => prev.map(s => (s.id === id ? { ...s, ...changes } : s)));
    if (!configured || id.startsWith("pending-")) return;
    void persistSale(id, changes).catch(e => {
      setError(`That change could not be saved: ${e instanceof Error ? e.message : String(e)}`);
    });
  };

  const returnSale = (id: string, amount: number, reason: string) => {
    updateSale(id, {
      status: "Returned",
      returnedAmount: amount,
      returnReason: reason,
      returnDate: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <SalesContext.Provider value={{ sales, addSale, updateSale, returnSale, loading, error }}>
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  return useContext(SalesContext);
}
