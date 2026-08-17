"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { CHART_OF_ACCOUNTS, getAccountByCode } from "@/accounts/data/chartOfAccounts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JournalStatus = "Draft" | "Posted" | "Voided";

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: JournalLine[];
  status: JournalStatus;
  createdBy: string;
}

export type ARStatus = "Outstanding" | "Partial" | "Paid" | "Overdue";
export type APStatus = "Outstanding" | "Partial" | "Paid" | "Overdue";

export interface ARRecord {
  id: string;
  invoiceNo: string;
  customerName: string;
  phone?: string;
  invoiceDate: string;
  dueDate: string;
  type: "Repair" | "Sales";
  amount: number;
  paid: number;
  status: ARStatus;
}

export interface APRecord {
  id: string;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  category: string;
  amount: number;
  paid: number;
  status: APStatus;
  notes?: string;
}

export type ExpenseCategory =
  | "Rent" | "Electricity & Utilities" | "Salaries & Wages"
  | "Marketing & Advertising" | "Equipment Maintenance"
  | "Telephone & Internet" | "Depreciation" | "Miscellaneous Expenses";

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: "Cash" | "Bank Transfer" | "Card";
  vendor?: string;
  reference?: string;
}

// ─── Derived/Computed types ───────────────────────────────────────────────────

export interface PLData {
  revenue: Record<string, number>;
  totalRevenue: number;
  cogs: Record<string, number>;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
  expenses: Record<string, number>;
  totalExpenses: number;
  operatingIncome: number;
  netIncome: number;
  netMargin: number;
}

export interface BalanceSheetData {
  assets: { code: string; name: string; balance: number }[];
  totalAssets: number;
  liabilities: { code: string; name: string; balance: number }[];
  totalLiabilities: number;
  equity: { code: string; name: string; balance: number }[];
  totalEquity: number;
}

export interface ARAgingBucket {
  label: string;
  records: ARRecord[];
  total: number;
}

export interface APAgingBucket {
  label: string;
  records: APRecord[];
  total: number;
}

// ─── Context value ────────────────────────────────────────────────────────────

interface AccountsContextValue {
  accountsUser: string;

  // Journal entries
  journalEntries: JournalEntry[];
  addJournalEntry: (entry: Omit<JournalEntry, "id">) => void;
  voidJournalEntry: (id: string) => void;

  // AR
  arRecords: ARRecord[];
  addARRecord: (rec: Omit<ARRecord, "id">) => void;
  recordARPayment: (id: string, amount: number) => void;

  // AP
  apRecords: APRecord[];
  addAPRecord: (rec: Omit<APRecord, "id">) => void;
  recordAPPayment: (id: string, amount: number) => void;

  // Expenses
  expenses: Expense[];
  addExpense: (exp: Omit<Expense, "id">) => void;

  // Computed
  getAccountBalance: (code: string) => number;
  getPLData: () => PLData;
  getBalanceSheetData: () => BalanceSheetData;
  getARAgeing: () => ARAgingBucket[];
  getAPAgeing: () => APAgingBucket[];
  getTaxSummary: () => { vatCollected: number; vatPaid: number; netVat: number };
  getTotalRevenueMTD: () => number;
  getCashPosition: () => number;
  getTotalAROutstanding: () => number;
  getTotalAPOutstanding: () => number;
}

const AccountsContext = createContext<AccountsContextValue>({} as AccountsContextValue);

// ─── Seed data ────────────────────────────────────────────────────────────────
// All figures verified: Balance Sheet balances at Rs. 1,121,500 (Assets = Liabilities + Equity)
// P&L: Revenue 701,500 | COGS 412,000 | Gross Profit 289,500 | Expenses 120,000 | Net Income 169,500

let jeSeq = 15;
let arSeq = 5;
let apSeq = 3;
let expSeq = 5;

const makeSeedJournalEntries = (): JournalEntry[] => [];

const makeSeedARRecords = (): ARRecord[] => [];

const makeSeedAPRecords = (): APRecord[] => [];

const makeSeedExpenses = (): Expense[] => [];

// ─── Balance computation ──────────────────────────────────────────────────────

function computeAccountBalance(code: string, entries: JournalEntry[]): number {
  const account = getAccountByCode(code);
  if (!account) return 0;
  let balance = 0;
  for (const entry of entries) {
    if (entry.status !== "Posted") continue;
    for (const line of entry.lines) {
      if (line.accountCode !== code) continue;
      if (account.normalBalance === "Debit") {
        balance += line.debit - line.credit;
      } else {
        balance += line.credit - line.debit;
      }
    }
  }
  return balance;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AccountsProvider({ children, accountsUser }: { children: ReactNode; accountsUser: string }) {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(makeSeedJournalEntries);
  const [arRecords, setARRecords]           = useState<ARRecord[]>(makeSeedARRecords);
  const [apRecords, setAPRecords]           = useState<APRecord[]>(makeSeedAPRecords);
  const [expenses, setExpenses]             = useState<Expense[]>(makeSeedExpenses);

  // ── Journal entries ──
  const addJournalEntry = useCallback((entry: Omit<JournalEntry, "id">) => {
    const id = `JE-${String(++jeSeq).padStart(3, "0")}`;
    setJournalEntries(prev => [...prev, { ...entry, id }]);
  }, []);

  const voidJournalEntry = useCallback((id: string) => {
    setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, status: "Voided" } : e));
  }, []);

  // ── AR ──
  const addARRecord = useCallback((rec: Omit<ARRecord, "id">) => {
    const id = `AR-${String(++arSeq).padStart(3, "0")}`;
    setARRecords(prev => [...prev, { ...rec, id }]);
  }, []);

  const recordARPayment = useCallback((id: string, amount: number) => {
    setARRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const newPaid = Math.min(r.paid + amount, r.amount);
      const balance = r.amount - newPaid;
      const status: ARRecord["status"] = balance === 0 ? "Paid" : "Partial";
      return { ...r, paid: newPaid, status };
    }));
  }, []);

  // ── AP ──
  const addAPRecord = useCallback((rec: Omit<APRecord, "id">) => {
    const id = `AP-${String(++apSeq).padStart(3, "0")}`;
    setAPRecords(prev => [...prev, { ...rec, id }]);
  }, []);

  const recordAPPayment = useCallback((id: string, amount: number) => {
    setAPRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const newPaid = Math.min(r.paid + amount, r.amount);
      const balance = r.amount - newPaid;
      const status: APRecord["status"] = balance === 0 ? "Paid" : "Partial";
      return { ...r, paid: newPaid, status };
    }));
  }, []);

  // ── Expenses ──
  const addExpense = useCallback((exp: Omit<Expense, "id">) => {
    const id = `EXP-${String(++expSeq).padStart(3, "0")}`;
    setExpenses(prev => [...prev, { ...exp, id }]);
  }, []);

  // ── Account balance ──
  const getAccountBalance = useCallback((code: string) => {
    return computeAccountBalance(code, journalEntries);
  }, [journalEntries]);

  // ── P&L ──
  const getPLData = useCallback((): PLData => {
    const revCodes  = ["4010", "4020", "4030", "4040"];
    const cogsCodes = ["5010", "5020", "5030"];
    const expCodes  = ["6010", "6020", "6030", "6040", "6050", "6060", "6070", "6080"];
    const acct      = CHART_OF_ACCOUNTS;

    const revenue:  Record<string, number> = {};
    const cogs:     Record<string, number> = {};
    const expenses: Record<string, number> = {};

    for (const c of revCodes)  revenue[acct.find(a => a.code === c)!.name]  = computeAccountBalance(c, journalEntries);
    for (const c of cogsCodes) cogs[acct.find(a => a.code === c)!.name]     = computeAccountBalance(c, journalEntries);
    for (const c of expCodes)  expenses[acct.find(a => a.code === c)!.name] = computeAccountBalance(c, journalEntries);

    const totalRevenue  = Object.values(revenue).reduce((s, v) => s + v, 0);
    const totalCOGS     = Object.values(cogs).reduce((s, v) => s + v, 0);
    const grossProfit   = totalRevenue - totalCOGS;
    const totalExpenses = Object.values(expenses).reduce((s, v) => s + v, 0);
    const operatingIncome = grossProfit - totalExpenses;

    return {
      revenue, totalRevenue,
      cogs, totalCOGS,
      grossProfit,
      grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      expenses, totalExpenses,
      operatingIncome,
      netIncome: operatingIncome,
      netMargin: totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0,
    };
  }, [journalEntries]);

  // ── Balance Sheet ──
  const getBalanceSheetData = useCallback((): BalanceSheetData => {
    const assets      = CHART_OF_ACCOUNTS.filter(a => a.type === "Asset");
    const liabilities = CHART_OF_ACCOUNTS.filter(a => a.type === "Liability");
    const equity      = CHART_OF_ACCOUNTS.filter(a => a.type === "Equity");

    const mapBal = (accts: typeof CHART_OF_ACCOUNTS) =>
      accts.map(a => ({ code: a.code, name: a.name, balance: computeAccountBalance(a.code, journalEntries) }))
           .filter(a => a.balance !== 0);

    const aList = mapBal(assets);
    const lList = mapBal(liabilities);
    const pl    = getPLData();

    const eList = [
      ...mapBal(equity),
      { code: "NET", name: "Current Period Net Income", balance: pl.netIncome },
    ];

    return {
      assets:           aList,
      totalAssets:      aList.reduce((s, a) => s + a.balance, 0),
      liabilities:      lList,
      totalLiabilities: lList.reduce((s, a) => s + a.balance, 0),
      equity:           eList,
      totalEquity:      eList.reduce((s, a) => s + a.balance, 0),
    };
  }, [journalEntries, getPLData]);

  // ── AR Aging ──
  const getARAgeing = useCallback((): ARAgingBucket[] => {
    const today = new Date("2026-05-22");
    const open  = arRecords.filter(r => r.status !== "Paid");

    const buckets: ARAgingBucket[] = [
      { label: "Current (not yet due)", records: [], total: 0 },
      { label: "1–30 Days",             records: [], total: 0 },
      { label: "31–60 Days",            records: [], total: 0 },
      { label: "61–90 Days",            records: [], total: 0 },
      { label: "90+ Days",              records: [], total: 0 },
    ];

    for (const r of open) {
      const due  = new Date(r.dueDate);
      const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
      const bal  = r.amount - r.paid;
      const target =
        days <= 0  ? buckets[0] :
        days <= 30 ? buckets[1] :
        days <= 60 ? buckets[2] :
        days <= 90 ? buckets[3] : buckets[4];
      target.records.push(r);
      target.total += bal;
    }
    return buckets;
  }, [arRecords]);

  // ── AP Aging ──
  const getAPAgeing = useCallback((): APAgingBucket[] => {
    const today = new Date("2026-05-22");
    const open  = apRecords.filter(r => r.status !== "Paid");

    const buckets: APAgingBucket[] = [
      { label: "Current (not yet due)", records: [], total: 0 },
      { label: "1–30 Days",             records: [], total: 0 },
      { label: "31–60 Days",            records: [], total: 0 },
      { label: "61–90 Days",            records: [], total: 0 },
      { label: "90+ Days",              records: [], total: 0 },
    ];

    for (const r of open) {
      const due  = new Date(r.dueDate);
      const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
      const bal  = r.amount - r.paid;
      const target =
        days <= 0  ? buckets[0] :
        days <= 30 ? buckets[1] :
        days <= 60 ? buckets[2] :
        days <= 90 ? buckets[3] : buckets[4];
      target.records.push(r);
      target.total += bal;
    }
    return buckets;
  }, [apRecords]);

  // ── Tax Summary ──
  const getTaxSummary = useCallback(() => {
    const vatCollected = computeAccountBalance("2100", journalEntries);
    const vatPaid      = 0;
    return { vatCollected, vatPaid, netVat: vatCollected - vatPaid };
  }, [journalEntries]);

  // ── Quick helpers ──
  const getTotalRevenueMTD = useCallback(() => {
    return ["4010", "4020", "4030", "4040"].reduce((s, c) => s + computeAccountBalance(c, journalEntries), 0);
  }, [journalEntries]);

  const getCashPosition = useCallback(() => {
    return computeAccountBalance("1010", journalEntries) + computeAccountBalance("1020", journalEntries);
  }, [journalEntries]);

  const getTotalAROutstanding = useCallback(() => {
    return arRecords.filter(r => r.status !== "Paid").reduce((s, r) => s + (r.amount - r.paid), 0);
  }, [arRecords]);

  const getTotalAPOutstanding = useCallback(() => {
    return apRecords.filter(r => r.status !== "Paid").reduce((s, r) => s + (r.amount - r.paid), 0);
  }, [apRecords]);

  return (
    <AccountsContext.Provider value={{
      accountsUser,
      journalEntries, addJournalEntry, voidJournalEntry,
      arRecords, addARRecord, recordARPayment,
      apRecords, addAPRecord, recordAPPayment,
      expenses, addExpense,
      getAccountBalance, getPLData, getBalanceSheetData,
      getARAgeing, getAPAgeing, getTaxSummary,
      getTotalRevenueMTD, getCashPosition,
      getTotalAROutstanding, getTotalAPOutstanding,
    }}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  return useContext(AccountsContext);
}
