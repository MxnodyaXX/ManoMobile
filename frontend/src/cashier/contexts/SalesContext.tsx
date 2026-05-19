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
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_SALES: SaleTx[] = [
  { id: "1", invoiceNo: "INV-2401", date: "2026-05-19", customer: "Amal Perera",         category: "Accessories", items: "Screen Protector × 2, Case",       total: 1850,  status: "Paid" },
  { id: "2", invoiceNo: "INV-2400", date: "2026-05-19", customer: "Nalini Silva",         category: "Mobile",      items: "Samsung A15 (Black)",               total: 42500, status: "Paid" },
  { id: "3", invoiceNo: "INV-2399", date: "2026-05-18", customer: "Kasun Fernando",       category: "Repair",      items: "Screen Replacement — iPhone 13",    total: 9500,  status: "Paid" },
  { id: "4", invoiceNo: "INV-2398", date: "2026-05-18", customer: "Walk-in",              category: "Others",      items: "Photocopy × 5, Lamination",        total: 320,   status: "Voided" },
  { id: "5", invoiceNo: "INV-2397", date: "2026-05-17", customer: "Dinesh Ratnam",        category: "Accessories", items: "Charger (Type-C), Earphones",      total: 2100,  status: "Returned" },
  { id: "6", invoiceNo: "INV-2396", date: "2026-05-17", customer: "Priya Nair",           category: "Mobile",      items: "Redmi Note 13",                    total: 38000, status: "Paid" },
  { id: "7", invoiceNo: "INV-2395", date: "2026-05-16", customer: "Ruwan Jayasinghe",     category: "Repair",      items: "Battery Replacement — Oppo A57",   total: 4200,  status: "Paid" },
  { id: "8", invoiceNo: "INV-2394", date: "2026-05-15", customer: "Walk-in",              category: "Accessories", items: "Tempered Glass",                   total: 450,   status: "Paid" },
  { id: "9", invoiceNo: "INV-2393", date: "2026-05-15", customer: "Madhu Weerasinghe",    category: "Others",      items: "Memory Card 64GB",                 total: 1600,  status: "Paid" },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface SalesContextValue {
  sales: SaleTx[];
  addSale: (partial: Omit<SaleTx, "id">) => void;
  updateSale: (id: string, changes: Partial<SaleTx>) => void;
}

const SalesContext = createContext<SalesContextValue>({
  sales: SEED_SALES,
  addSale: () => {},
  updateSale: () => {},
});

export function SalesProvider({ children }: { children: ReactNode }) {
  const [sales, setSales] = useState<SaleTx[]>(SEED_SALES);

  const addSale = (partial: Omit<SaleTx, "id">) => {
    setSales(prev => [{ id: String(Date.now()), ...partial }, ...prev]);
  };

  const updateSale = (id: string, changes: Partial<SaleTx>) => {
    setSales(prev => prev.map(s => (s.id === id ? { ...s, ...changes } : s)));
  };

  return (
    <SalesContext.Provider value={{ sales, addSale, updateSale }}>
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  return useContext(SalesContext);
}
