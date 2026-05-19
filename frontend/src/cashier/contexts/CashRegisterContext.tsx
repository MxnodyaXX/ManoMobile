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

const SEED_LOG: CashEntry[] = [
  { id: "seed-1", type: "in",  reason: "Opening Float",              amount: 5000,  time: new Date("2026-05-19T08:00"), by: "Admin" },
  { id: "seed-2", type: "in",  reason: "Cash Sale (INV-2400)",       amount: 42500, time: new Date("2026-05-19T13:18"), by: "Cashier" },
  { id: "seed-3", type: "out", reason: "Petty Cash — Lunch",         amount: 800,   time: new Date("2026-05-19T13:00"), by: "Admin" },
  { id: "seed-4", type: "in",  reason: "Repair Payment (JOB-1037)",  amount: 12000, time: new Date("2026-05-19T14:05"), by: "Cashier" },
];

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
