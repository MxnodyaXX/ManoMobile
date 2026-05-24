"use client";

import { Bell, Calendar } from "lucide-react";
import type { AccountsPage } from "./AccountsSidebar";
import { useAccounts } from "@/accounts/contexts/AccountsContext";

const AA = "#f59e0b";
const ff = "'Plus Jakarta Sans', sans-serif";

const PAGE_SUBS: Record<AccountsPage, string> = {
  "Dashboard":           "Financial overview and KPIs",
  "General Ledger":      "Chart of accounts & journal entries",
  "Accounts Receivable": "Customer balances & aging analysis",
  "Accounts Payable":    "Supplier invoices & expense management",
  "Financial Reports":   "Income statement, balance sheet & cash flow",
};

export default function AccountsNavbar({ activePage }: { activePage: AccountsPage }) {
  const { arRecords, apRecords } = useAccounts();
  const overdueAR = arRecords.filter(r => r.status === "Overdue").length;
  const overdueAP = apRecords.filter(r => r.status === "Overdue").length;
  const alerts    = overdueAR + overdueAP;

  const today = new Date("2026-05-22").toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{
      height: 56, padding: "0 24px", borderBottom: "1px solid var(--border)",
      background: "var(--bg-secondary)", display: "flex", alignItems: "center",
      justifyContent: "space-between", flexShrink: 0, fontFamily: ff,
    }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{activePage}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{PAGE_SUBS[activePage]}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={12} color="var(--text-muted)" />
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{today}</span>
        </div>

        {alerts > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 7, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
            <Bell size={12} color="#f87171" />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "#f87171", fontFamily: ff }}>{alerts} overdue</span>
          </div>
        )}

        <div style={{ padding: "4px 10px", borderRadius: 7, background: `${AA}12`, border: `1px solid ${AA}25` }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: AA, fontFamily: ff, letterSpacing: "0.04em" }}>FY 2026</span>
        </div>
      </div>
    </div>
  );
}
