"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type AuditAction =
  | "sale_created"
  | "sale_voided"
  | "sale_returned"
  | "repair_created"
  | "repair_updated"
  | "stock_received"
  | "stock_adjusted"
  | "shift_opened"
  | "shift_closed"
  | "discount_authorized"
  | "credit_sale"
  | "po_created"
  | "customer_added"
  | "price_changed"
  | "login"
  | "logout";

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  entity: string;
  detail: string;
  user: string;
  amount?: number;
}

interface AuditContextValue {
  log: AuditEntry[];
  addAudit: (action: AuditAction, entity: string, detail: string, user?: string, amount?: number) => void;
}

const AuditContext = createContext<AuditContextValue>({
  log: [],
  addAudit: () => {},
});

const SEED_AUDIT: AuditEntry[] = [
  { id: "a1", timestamp: new Date("2026-05-19T08:01"), action: "shift_opened",    entity: "Shift",       detail: "Shift opened with float Rs. 5,000",                user: "Kamal",   amount: 5000  },
  { id: "a2", timestamp: new Date("2026-05-19T09:15"), action: "sale_created",    entity: "INV-2401",    detail: "Accessories sale — Screen Protector × 2, Case",    user: "Kamal",   amount: 1850  },
  { id: "a3", timestamp: new Date("2026-05-19T10:30"), action: "sale_created",    entity: "INV-2400",    detail: "Mobile sale — Samsung A15 (Black)",                 user: "Kamal",   amount: 42500 },
  { id: "a4", timestamp: new Date("2026-05-19T11:00"), action: "repair_created",  entity: "RM-010",      detail: "New repair — iPhone 14 Pro, Screen Damage",         user: "Kamal"                 },
  { id: "a5", timestamp: new Date("2026-05-19T12:45"), action: "discount_authorized", entity: "INV-2399", detail: "20% discount approved by manager",                user: "Manager"               },
  { id: "a6", timestamp: new Date("2026-05-19T14:00"), action: "sale_voided",     entity: "INV-2398",    detail: "Transaction voided — duplicate entry",             user: "Kamal"                 },
  { id: "a7", timestamp: new Date("2026-05-19T15:20"), action: "stock_received",  entity: "PO-001",      detail: "Received 20× Tempered Glass from AccessoryHub",     user: "Admin"                 },
  { id: "a8", timestamp: new Date("2026-05-19T17:45"), action: "shift_closed",    entity: "Shift",       detail: "Shift closed. Variance: Rs. 0",                    user: "Kamal"                 },
];

export function AuditProvider({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<AuditEntry[]>(SEED_AUDIT);

  const addAudit = (
    action: AuditAction,
    entity: string,
    detail: string,
    user: string = "Cashier",
    amount?: number,
  ) => {
    setLog(prev => [{
      id: String(Date.now()),
      timestamp: new Date(),
      action,
      entity,
      detail,
      user,
      amount,
    }, ...prev]);
  };

  return (
    <AuditContext.Provider value={{ log, addAudit }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  return useContext(AuditContext);
}
