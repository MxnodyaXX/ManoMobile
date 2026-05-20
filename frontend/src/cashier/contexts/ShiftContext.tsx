"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface Shift {
  id: string;
  cashier: string;
  openedAt: Date;
  openingFloat: number;
  closedAt?: Date;
  closingBalance?: number;
  variance?: number;
  status: "open" | "closed";
}

interface ShiftContextValue {
  currentShift: Shift | null;
  shiftHistory: Shift[];
  openShift: (cashier: string, openingFloat: number) => void;
  closeShift: (closingBalance: number) => void;
}

const ShiftContext = createContext<ShiftContextValue>({
  currentShift: null,
  shiftHistory: [],
  openShift: () => {},
  closeShift: () => {},
});

const SEED_HISTORY: Shift[] = [
  {
    id: "shift-001",
    cashier: "Kamal Perera",
    openedAt: new Date("2026-05-18T08:00"),
    closedAt: new Date("2026-05-18T18:30"),
    openingFloat: 5000,
    closingBalance: 62300,
    variance: 0,
    status: "closed",
  },
  {
    id: "shift-002",
    cashier: "Nimal Silva",
    openedAt: new Date("2026-05-19T08:00"),
    closedAt: new Date("2026-05-19T17:45"),
    openingFloat: 5000,
    closingBalance: 48200,
    variance: -200,
    status: "closed",
  },
];

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>(SEED_HISTORY);

  const openShift = (cashier: string, openingFloat: number) => {
    const shift: Shift = {
      id: `shift-${Date.now()}`,
      cashier,
      openedAt: new Date(),
      openingFloat,
      status: "open",
    };
    setCurrentShift(shift);
  };

  const closeShift = (closingBalance: number) => {
    if (!currentShift) return;
    const closed: Shift = {
      ...currentShift,
      closedAt: new Date(),
      closingBalance,
      variance: closingBalance - currentShift.openingFloat,
      status: "closed",
    };
    setShiftHistory(prev => [closed, ...prev]);
    setCurrentShift(null);
  };

  return (
    <ShiftContext.Provider value={{ currentShift, shiftHistory, openShift, closeShift }}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  return useContext(ShiftContext);
}
