"use client";

import { useState, Suspense } from "react";
import { Landmark, ArrowRight } from "lucide-react";
import { AccountsProvider } from "@/accounts/contexts/AccountsContext";
import AccountsSidebar, { type AccountsPage } from "@/accounts/components/layout/AccountsSidebar";
import AccountsNavbar    from "@/accounts/components/layout/AccountsNavbar";
import AccountsDashboard from "@/accounts/components/dashboard/AccountsDashboard";
import GeneralLedger     from "@/accounts/components/ledger/GeneralLedger";
import AccountsReceivable from "@/accounts/components/receivables/AccountsReceivable";
import AccountsPayable   from "@/accounts/components/payables/AccountsPayable";
import FinancialReports  from "@/accounts/components/reports/FinancialReports";

const AA = "#f59e0b";
const ff = "'Plus Jakarta Sans', sans-serif";
const ACCOUNTS_STAFF = ["Ruwan", "Fathima", "Priya"];

// ─── Staff selector ───────────────────────────────────────────────────────────

function AccountsSelect({ onSelect }: { onSelect: (name: string) => void }) {
  const [hov, setHov] = useState<string | null>(null);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)", fontFamily: ff, padding: "40px 20px",
    }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>

        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `${AA}12`, border: `1px solid ${AA}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
          }}>
            <Landmark size={24} color={AA} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 6, fontFamily: ff }}>
            Accounts Login
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>
            Select your name to access the accounting module
          </p>
        </div>

        {/* Staff cards */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {ACCOUNTS_STAFF.map(name => {
            const isHov = hov === name;
            return (
              <button
                key={name}
                onClick={() => onSelect(name)}
                onMouseEnter={() => setHov(name)}
                onMouseLeave={() => setHov(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14,
                  background: isHov ? "var(--bg-card-hover)" : "var(--bg-card)",
                  border: `1px solid ${isHov ? `${AA}50` : "var(--border)"}`,
                  cursor: "pointer", transition: "all 0.18s", fontFamily: ff,
                  boxShadow: isHov ? `0 0 0 1px ${AA}20, 0 4px 20px rgba(0,0,0,0.3)` : "none",
                  transform: isHov ? "translateY(-1px)" : "none",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: isHov ? `${AA}20` : `${AA}10`,
                  border: `1px solid ${AA}${isHov ? "40" : "25"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, fontWeight: 800, color: AA, fontFamily: ff,
                  transition: "all 0.15s", flexShrink: 0,
                }}>
                  {name[0]}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 2 }}>{name}</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>Accounts Officer · Mano Mobile</p>
                </div>
                <ArrowRight size={15} style={{ color: isHov ? AA : "var(--text-muted)", transition: "color 0.15s", flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

function AccountsPageInner() {
  const [userName, setUserName]     = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AccountsPage>("Dashboard");

  if (!userName) {
    return <AccountsSelect onSelect={setUserName} />;
  }

  return (
    <AccountsProvider accountsUser={userName}>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>

        {/* Sidebar */}
        <AccountsSidebar
          activePage={activePage}
          onNavigate={setActivePage}
          userName={userName}
          onLogout={() => setUserName(null)}
        />

        {/* Main area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <AccountsNavbar activePage={activePage} />

          <main style={{
            flex: 1, overflowY: "auto",
            padding: "24px 26px 40px",
            display: "flex", flexDirection: "column",
          }}>
            {activePage === "Dashboard"           && <AccountsDashboard />}
            {activePage === "General Ledger"      && <GeneralLedger />}
            {activePage === "Accounts Receivable" && <AccountsReceivable />}
            {activePage === "Accounts Payable"    && <AccountsPayable />}
            {activePage === "Financial Reports"   && <FinancialReports />}
          </main>
        </div>
      </div>
    </AccountsProvider>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", fontFamily: ff }}>
        <div style={{ textAlign: "center" }}>
          <Landmark size={28} color={AA} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Loading…</p>
        </div>
      </div>
    }>
      <AccountsPageInner />
    </Suspense>
  );
}
