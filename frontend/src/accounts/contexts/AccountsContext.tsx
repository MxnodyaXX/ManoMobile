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

const makeSeedJournalEntries = (): JournalEntry[] => [
  {
    id: "JE-001", date: "2026-05-01", reference: "OB-2026", status: "Posted", createdBy: "Accounts",
    description: "Opening Balances — May 2026",
    lines: [
      { accountCode: "1010", accountName: "Cash on Hand",           debit: 45000,  credit: 0     },
      { accountCode: "1020", accountName: "Bank Account",           debit: 125000, credit: 0     },
      { accountCode: "1030", accountName: "Petty Cash",             debit: 5000,   credit: 0     },
      { accountCode: "1200", accountName: "Inventory — Parts",      debit: 85000,  credit: 0     },
      { accountCode: "1210", accountName: "Inventory — Phones",     debit: 320000, credit: 0     },
      { accountCode: "1220", accountName: "Inventory — Accessories",debit: 42000,  credit: 0     },
      { accountCode: "1500", accountName: "Equipment & Tools",      debit: 95000,  credit: 0     },
      { accountCode: "3010", accountName: "Owner's Capital",        debit: 0,      credit: 610000},
      { accountCode: "3900", accountName: "Retained Earnings",      debit: 0,      credit: 107000},
    ],
  },
  {
    id: "JE-002", date: "2026-05-03", reference: "REV-R-W1", status: "Posted", createdBy: "Accounts",
    description: "Repair services revenue — Week 1 (May 1–7)",
    lines: [
      { accountCode: "1010", accountName: "Cash on Hand",          debit: 65000, credit: 0     },
      { accountCode: "1100", accountName: "Accounts Receivable",   debit: 35000, credit: 0     },
      { accountCode: "4010", accountName: "Repair Services Revenue",debit: 0,    credit: 90000 },
      { accountCode: "2100", accountName: "VAT Payable",           debit: 0,     credit: 10000 },
    ],
  },
  {
    id: "JE-003", date: "2026-05-03", reference: "COGS-P-W1", status: "Posted", createdBy: "Accounts",
    description: "Cost of parts used — Week 1 repairs",
    lines: [
      { accountCode: "5010", accountName: "Cost of Parts",        debit: 28000, credit: 0     },
      { accountCode: "1200", accountName: "Inventory — Parts",    debit: 0,     credit: 28000 },
    ],
  },
  {
    id: "JE-004", date: "2026-05-04", reference: "REV-S-W1", status: "Posted", createdBy: "Accounts",
    description: "Phone & accessory sales — Week 1 (May 1–7)",
    lines: [
      { accountCode: "1010", accountName: "Cash on Hand",              debit: 177000, credit: 0      },
      { accountCode: "1020", accountName: "Bank Account",              debit: 80000,  credit: 0      },
      { accountCode: "4020", accountName: "Mobile Phone Sales",        debit: 0,      credit: 205000 },
      { accountCode: "4030", accountName: "Accessory Sales",           debit: 0,      credit: 29000  },
      { accountCode: "2100", accountName: "VAT Payable",               debit: 0,      credit: 23000  },
    ],
  },
  {
    id: "JE-005", date: "2026-05-04", reference: "COGS-S-W1", status: "Posted", createdBy: "Accounts",
    description: "COGS for phone & accessory sales — Week 1",
    lines: [
      { accountCode: "5020", accountName: "Cost of Phones Sold",      debit: 150000, credit: 0      },
      { accountCode: "5030", accountName: "Cost of Accessories Sold", debit: 20000,  credit: 0      },
      { accountCode: "1210", accountName: "Inventory — Phones",       debit: 0,      credit: 150000 },
      { accountCode: "1220", accountName: "Inventory — Accessories",  debit: 0,      credit: 20000  },
    ],
  },
  {
    id: "JE-006", date: "2026-05-05", reference: "EXP-MAY-01", status: "Posted", createdBy: "Accounts",
    description: "Monthly rent & salaries — May 2026",
    lines: [
      { accountCode: "6010", accountName: "Rent",               debit: 35000, credit: 0     },
      { accountCode: "6030", accountName: "Salaries & Wages",   debit: 55000, credit: 0     },
      { accountCode: "1020", accountName: "Bank Account",       debit: 0,     credit: 90000 },
    ],
  },
  {
    id: "JE-007", date: "2026-05-08", reference: "PO-001", status: "Posted", createdBy: "Accounts",
    description: "Parts purchased on credit — Sri Lanka Parts Co.",
    lines: [
      { accountCode: "1200", accountName: "Inventory — Parts",  debit: 45000, credit: 0     },
      { accountCode: "2010", accountName: "Accounts Payable",   debit: 0,     credit: 45000 },
    ],
  },
  {
    id: "JE-008", date: "2026-05-10", reference: "PO-002", status: "Posted", createdBy: "Accounts",
    description: "Phone stock purchased — Colombo Phone Traders",
    lines: [
      { accountCode: "1210", accountName: "Inventory — Phones", debit: 180000, credit: 0      },
      { accountCode: "2010", accountName: "Accounts Payable",   debit: 0,      credit: 120000 },
      { accountCode: "1020", accountName: "Bank Account",       debit: 0,      credit: 60000  },
    ],
  },
  {
    id: "JE-009", date: "2026-05-12", reference: "EXP-MAY-02", status: "Posted", createdBy: "Accounts",
    description: "Utilities & miscellaneous expenses",
    lines: [
      { accountCode: "6020", accountName: "Electricity & Utilities", debit: 8500,  credit: 0     },
      { accountCode: "6080", accountName: "Miscellaneous Expenses",  debit: 12000, credit: 0     },
      { accountCode: "1010", accountName: "Cash on Hand",            debit: 0,     credit: 15500 },
      { accountCode: "1030", accountName: "Petty Cash",              debit: 0,     credit: 5000  },
    ],
  },
  {
    id: "JE-010", date: "2026-05-10", reference: "REV-R-W2", status: "Posted", createdBy: "Accounts",
    description: "Repair services revenue — Week 2 (May 8–15)",
    lines: [
      { accountCode: "1010", accountName: "Cash on Hand",           debit: 55000, credit: 0     },
      { accountCode: "1100", accountName: "Accounts Receivable",    debit: 30000, credit: 0     },
      { accountCode: "4010", accountName: "Repair Services Revenue",debit: 0,     credit: 76000 },
      { accountCode: "2100", accountName: "VAT Payable",            debit: 0,     credit: 9000  },
    ],
  },
  {
    id: "JE-011", date: "2026-05-12", reference: "REV-S-W2", status: "Posted", createdBy: "Accounts",
    description: "Phone sales — Week 2 (May 8–15)",
    lines: [
      { accountCode: "1010", accountName: "Cash on Hand",       debit: 95000,  credit: 0      },
      { accountCode: "1020", accountName: "Bank Account",       debit: 48000,  credit: 0      },
      { accountCode: "4020", accountName: "Mobile Phone Sales", debit: 0,      credit: 130000 },
      { accountCode: "2100", accountName: "VAT Payable",        debit: 0,      credit: 13000  },
    ],
  },
  {
    id: "JE-012", date: "2026-05-12", reference: "COGS-W2", status: "Posted", createdBy: "Accounts",
    description: "COGS — Week 2 repairs & phone sales",
    lines: [
      { accountCode: "5010", accountName: "Cost of Parts",       debit: 18500,  credit: 0      },
      { accountCode: "5020", accountName: "Cost of Phones Sold", debit: 95000,  credit: 0      },
      { accountCode: "1200", accountName: "Inventory — Parts",   debit: 0,      credit: 18500  },
      { accountCode: "1210", accountName: "Inventory — Phones",  debit: 0,      credit: 95000  },
    ],
  },
  {
    id: "JE-013", date: "2026-05-20", reference: "EXP-MAY-03", status: "Posted", createdBy: "Accounts",
    description: "Telephone & marketing expenses",
    lines: [
      { accountCode: "6060", accountName: "Telephone & Internet",    debit: 4500, credit: 0    },
      { accountCode: "6040", accountName: "Marketing & Advertising", debit: 5000, credit: 0    },
      { accountCode: "1010", accountName: "Cash on Hand",            debit: 0,    credit: 9500 },
    ],
  },
  {
    id: "JE-014", date: "2026-05-20", reference: "REV-W3", status: "Posted", createdBy: "Accounts",
    description: "Revenue batch — Week 3 (May 16–22): Repair + Phones + Accessories",
    lines: [
      { accountCode: "1010", accountName: "Cash on Hand",            debit: 124000, credit: 0      },
      { accountCode: "1020", accountName: "Bank Account",            debit: 40000,  credit: 0      },
      { accountCode: "1100", accountName: "Accounts Receivable",     debit: 22500,  credit: 0      },
      { accountCode: "4010", accountName: "Repair Services Revenue", debit: 0,      credit: 49500  },
      { accountCode: "4020", accountName: "Mobile Phone Sales",      debit: 0,      credit: 100000 },
      { accountCode: "4030", accountName: "Accessory Sales",         debit: 0,      credit: 22000  },
      { accountCode: "2100", accountName: "VAT Payable",             debit: 0,      credit: 15000  },
    ],
  },
  {
    id: "JE-015", date: "2026-05-20", reference: "COGS-W3", status: "Posted", createdBy: "Accounts",
    description: "COGS — Week 3 repairs & sales",
    lines: [
      { accountCode: "5010", accountName: "Cost of Parts",               debit: 10500, credit: 0      },
      { accountCode: "5020", accountName: "Cost of Phones Sold",         debit: 72000, credit: 0      },
      { accountCode: "5030", accountName: "Cost of Accessories Sold",    debit: 18000, credit: 0      },
      { accountCode: "1200", accountName: "Inventory — Parts",           debit: 0,     credit: 10500  },
      { accountCode: "1210", accountName: "Inventory — Phones",          debit: 0,     credit: 72000  },
      { accountCode: "1220", accountName: "Inventory — Accessories",     debit: 0,     credit: 18000  },
    ],
  },
];

const makeSeedARRecords = (): ARRecord[] => [
  { id: "AR-001", invoiceNo: "REP-1041", customerName: "Amila Silva",    phone: "0771234567", invoiceDate: "2026-04-07", dueDate: "2026-04-22", type: "Repair", amount: 18500, paid: 0,     status: "Overdue"     },
  { id: "AR-002", invoiceNo: "REP-1045", customerName: "Nilufar Hassan", phone: "0759876543", invoiceDate: "2026-04-22", dueDate: "2026-05-07", type: "Repair", amount: 16500, paid: 0,     status: "Overdue"     },
  { id: "AR-003", invoiceNo: "REP-1052", customerName: "Rasheed Ahmad",  phone: "0712345678", invoiceDate: "2026-05-04", dueDate: "2026-05-22", type: "Repair", amount: 22000, paid: 5000,  status: "Partial"     },
  { id: "AR-004", invoiceNo: "INV-2405", customerName: "Priya Fernando", phone: "0768765432", invoiceDate: "2026-05-15", dueDate: "2026-05-29", type: "Sales",  amount: 8000,  paid: 0,     status: "Outstanding" },
  { id: "AR-005", invoiceNo: "REP-1058", customerName: "Kumara Bandara", phone: "0704561234", invoiceDate: "2026-05-17", dueDate: "2026-06-01", type: "Repair", amount: 22500, paid: 0,     status: "Outstanding" },
];

const makeSeedAPRecords = (): APRecord[] => [
  { id: "AP-001", supplierName: "Sri Lanka Parts Co.",   invoiceNo: "SLPC-4421", invoiceDate: "2026-05-08", dueDate: "2026-05-27", category: "Inventory",  amount: 45000,  paid: 0,     status: "Outstanding", notes: "Repair parts batch" },
  { id: "AP-002", supplierName: "Colombo Phone Traders", invoiceNo: "CPT-8820",  invoiceDate: "2026-05-10", dueDate: "2026-06-01", category: "Inventory",  amount: 120000, paid: 0,     status: "Outstanding", notes: "Samsung & Redmi batch" },
  { id: "AP-003", supplierName: "Telecom Parts Ltd.",    invoiceNo: "TPL-1192",  invoiceDate: "2026-05-01", dueDate: "2026-05-15", category: "Inventory",  amount: 35000,  paid: 0,     status: "Overdue",     notes: "USB-C ports & screens" },
];

const makeSeedExpenses = (): Expense[] => [
  { id: "EXP-001", date: "2026-05-05", category: "Rent",                 description: "Shop rent — May 2026",          amount: 35000, paymentMethod: "Bank Transfer", vendor: "Building Owner" },
  { id: "EXP-002", date: "2026-05-05", category: "Salaries & Wages",     description: "Staff salaries advance — May",   amount: 55000, paymentMethod: "Bank Transfer", vendor: "Payroll" },
  { id: "EXP-003", date: "2026-05-12", category: "Electricity & Utilities", description: "Electricity bill — May",       amount: 8500,  paymentMethod: "Cash",          vendor: "CEB" },
  { id: "EXP-004", date: "2026-05-12", category: "Miscellaneous Expenses",description: "Office supplies & cleaning",     amount: 12000, paymentMethod: "Cash",          vendor: "Various" },
  { id: "EXP-005", date: "2026-05-20", category: "Telephone & Internet",  description: "Monthly internet + mobile plan", amount: 4500,  paymentMethod: "Cash",          vendor: "Dialog" },
];

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
