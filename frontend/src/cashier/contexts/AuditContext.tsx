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

const SEED_AUDIT: AuditEntry[] = [];

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
