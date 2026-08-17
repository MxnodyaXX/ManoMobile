"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface CashEntry {
  id: string;
  type: "in" | "out";
  reason: string;
  amount: number;
  time: Date;
  by: string;
}

interface CashRegisterCtx {
  log: CashEntry[];
  addEntry: (type: "in" | "out", reason: string, amount: number) => void;
}

const CashRegisterContext = createContext<CashRegisterCtx>({
  log: [],
  addEntry: () => {},
});

const SEED_LOG: CashEntry[] = [];

export function CashRegisterProvider({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<CashEntry[]>(SEED_LOG);

  const addEntry = (type: "in" | "out", reason: string, amount: number) => {
    setLog(prev => [...prev, {
      id: String(Date.now()),
      type,
      reason,
      amount,
      time: new Date(),
      by: "Cashier",
    }]);
  };

  return (
    <CashRegisterContext.Provider value={{ log, addEntry }}>
      {children}
    </CashRegisterContext.Provider>
  );
}

export function useCashRegister() {
  return useContext(CashRegisterContext);
}
