"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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
  paymentMethod?: "Cash" | "Card" | "Credit" | "Split";
  cashAmount?: number;
  cardAmount?: number;
  cardRef?: string;
  discountPct?: number;
  taxPct?: number;
  taxAmount?: number;
  cashier?: string;
  shiftId?: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_SALES: SaleTx[] = [];

// ─── Context ──────────────────────────────────────────────────────────────────

interface SalesContextValue {
  sales: SaleTx[];
  addSale: (partial: Omit<SaleTx, "id">) => void;
  updateSale: (id: string, changes: Partial<SaleTx>) => void;
  returnSale: (id: string, amount: number, reason: string) => void;
}

const SalesContext = createContext<SalesContextValue>({
  sales: SEED_SALES,
  addSale: () => {},
  updateSale: () => {},
  returnSale: () => {},
});

export function SalesProvider({ children }: { children: ReactNode }) {
  const [sales, setSales] = useState<SaleTx[]>(SEED_SALES);

  const addSale = (partial: Omit<SaleTx, "id">) => {
    setSales(prev => [{ id: String(Date.now()), ...partial }, ...prev]);
  };

  const updateSale = (id: string, changes: Partial<SaleTx>) => {
    setSales(prev => prev.map(s => (s.id === id ? { ...s, ...changes } : s)));
  };

  const returnSale = (id: string, amount: number, reason: string) => {
    setSales(prev => prev.map(s =>
      s.id === id
        ? { ...s, status: "Returned" as TxStatus, returnedAmount: amount, returnReason: reason, returnDate: new Date().toISOString().slice(0, 10) }
        : s
    ));
  };

  return (
    <SalesContext.Provider value={{ sales, addSale, updateSale, returnSale }}>
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  return useContext(SalesContext);
}
