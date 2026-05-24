export type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "COGS" | "Expense";
export type NormalBalance = "Debit" | "Credit";

export interface COAAccount {
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  normalBalance: NormalBalance;
  isActive: boolean;
}

export const CHART_OF_ACCOUNTS: COAAccount[] = [
  // ─── ASSETS ──────────────────────────────────────────────────────────────────
  { code: "1010", name: "Cash on Hand",              type: "Asset",    subtype: "Current Asset",      normalBalance: "Debit",  isActive: true },
  { code: "1020", name: "Bank Account",              type: "Asset",    subtype: "Current Asset",      normalBalance: "Debit",  isActive: true },
  { code: "1030", name: "Petty Cash",                type: "Asset",    subtype: "Current Asset",      normalBalance: "Debit",  isActive: true },
  { code: "1100", name: "Accounts Receivable",       type: "Asset",    subtype: "Current Asset",      normalBalance: "Debit",  isActive: true },
  { code: "1200", name: "Inventory — Parts",         type: "Asset",    subtype: "Current Asset",      normalBalance: "Debit",  isActive: true },
  { code: "1210", name: "Inventory — Phones",        type: "Asset",    subtype: "Current Asset",      normalBalance: "Debit",  isActive: true },
  { code: "1220", name: "Inventory — Accessories",   type: "Asset",    subtype: "Current Asset",      normalBalance: "Debit",  isActive: true },
  { code: "1300", name: "Prepaid Expenses",          type: "Asset",    subtype: "Current Asset",      normalBalance: "Debit",  isActive: true },
  { code: "1500", name: "Equipment & Tools",         type: "Asset",    subtype: "Fixed Asset",        normalBalance: "Debit",  isActive: true },
  { code: "1510", name: "Accumulated Depreciation",  type: "Asset",    subtype: "Contra Asset",       normalBalance: "Credit", isActive: true },

  // ─── LIABILITIES ─────────────────────────────────────────────────────────────
  { code: "2010", name: "Accounts Payable",          type: "Liability",subtype: "Current Liability",  normalBalance: "Credit", isActive: true },
  { code: "2100", name: "VAT Payable",               type: "Liability",subtype: "Current Liability",  normalBalance: "Credit", isActive: true },
  { code: "2200", name: "Accrued Expenses",          type: "Liability",subtype: "Current Liability",  normalBalance: "Credit", isActive: true },
  { code: "2300", name: "Loans Payable",             type: "Liability",subtype: "Long-term Liability", normalBalance: "Credit", isActive: true },

  // ─── EQUITY ──────────────────────────────────────────────────────────────────
  { code: "3010", name: "Owner's Capital",           type: "Equity",   subtype: "Capital",            normalBalance: "Credit", isActive: true },
  { code: "3020", name: "Owner's Drawings",          type: "Equity",   subtype: "Drawings",           normalBalance: "Debit",  isActive: true },
  { code: "3900", name: "Retained Earnings",         type: "Equity",   subtype: "Retained Earnings",  normalBalance: "Credit", isActive: true },

  // ─── REVENUE ─────────────────────────────────────────────────────────────────
  { code: "4010", name: "Repair Services Revenue",   type: "Revenue",  subtype: "Operating Revenue",  normalBalance: "Credit", isActive: true },
  { code: "4020", name: "Mobile Phone Sales",        type: "Revenue",  subtype: "Operating Revenue",  normalBalance: "Credit", isActive: true },
  { code: "4030", name: "Accessory Sales",           type: "Revenue",  subtype: "Operating Revenue",  normalBalance: "Credit", isActive: true },
  { code: "4040", name: "Other Revenue",             type: "Revenue",  subtype: "Other Income",       normalBalance: "Credit", isActive: true },

  // ─── COST OF GOODS SOLD ───────────────────────────────────────────────────────
  { code: "5010", name: "Cost of Parts",             type: "COGS",     subtype: "Direct Cost",        normalBalance: "Debit",  isActive: true },
  { code: "5020", name: "Cost of Phones Sold",       type: "COGS",     subtype: "Direct Cost",        normalBalance: "Debit",  isActive: true },
  { code: "5030", name: "Cost of Accessories Sold",  type: "COGS",     subtype: "Direct Cost",        normalBalance: "Debit",  isActive: true },

  // ─── OPERATING EXPENSES ───────────────────────────────────────────────────────
  { code: "6010", name: "Rent",                      type: "Expense",  subtype: "Operating Expense",  normalBalance: "Debit",  isActive: true },
  { code: "6020", name: "Electricity & Utilities",   type: "Expense",  subtype: "Operating Expense",  normalBalance: "Debit",  isActive: true },
  { code: "6030", name: "Salaries & Wages",          type: "Expense",  subtype: "Operating Expense",  normalBalance: "Debit",  isActive: true },
  { code: "6040", name: "Marketing & Advertising",   type: "Expense",  subtype: "Operating Expense",  normalBalance: "Debit",  isActive: true },
  { code: "6050", name: "Equipment Maintenance",     type: "Expense",  subtype: "Operating Expense",  normalBalance: "Debit",  isActive: true },
  { code: "6060", name: "Telephone & Internet",      type: "Expense",  subtype: "Operating Expense",  normalBalance: "Debit",  isActive: true },
  { code: "6070", name: "Depreciation",              type: "Expense",  subtype: "Non-cash Expense",   normalBalance: "Debit",  isActive: true },
  { code: "6080", name: "Miscellaneous Expenses",    type: "Expense",  subtype: "Operating Expense",  normalBalance: "Debit",  isActive: true },
];

export function getAccountByCode(code: string): COAAccount | undefined {
  return CHART_OF_ACCOUNTS.find(a => a.code === code);
}

export const COA_TYPE_ORDER: AccountType[] = ["Asset", "Liability", "Equity", "Revenue", "COGS", "Expense"];
