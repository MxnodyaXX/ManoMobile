"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface HeldSale {
  id: string;
  label: string;
  heldAt: Date;
  customer: string;
  items: HeldItem[];
  subtotal: number;
  category: "Accessories" | "Mobile" | "Others";
  note?: string;
}

export interface HeldItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  discount: number;
}

interface HeldSalesContextValue {
  heldSales: HeldSale[];
  holdSale: (sale: Omit<HeldSale, "id" | "heldAt">) => string;
  resumeSale: (id: string) => HeldSale | null;
  removeSale: (id: string) => void;
}

const HeldSalesContext = createContext<HeldSalesContextValue>({
  heldSales: [],
  holdSale: () => "",
  resumeSale: () => null,
  removeSale: () => {},
});

export function HeldSalesProvider({ children }: { children: ReactNode }) {
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);

  const holdSale = (sale: Omit<HeldSale, "id" | "heldAt">): string => {
    const id = `hold-${Date.now()}`;
    setHeldSales(prev => [...prev, { ...sale, id, heldAt: new Date() }]);
    return id;
  };

  const resumeSale = (id: string): HeldSale | null => {
    const found = heldSales.find(s => s.id === id) ?? null;
    if (found) setHeldSales(prev => prev.filter(s => s.id !== id));
    return found;
  };

  const removeSale = (id: string) => {
    setHeldSales(prev => prev.filter(s => s.id !== id));
  };

  return (
    <HeldSalesContext.Provider value={{ heldSales, holdSale, resumeSale, removeSale }}>
      {children}
    </HeldSalesContext.Provider>
  );
}

export function useHeldSales() {
  return useContext(HeldSalesContext);
}
