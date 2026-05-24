"use client";

import { useState, useMemo } from "react";
import { FileBarChart2, TrendingUp, Scale, ArrowLeftRight, Receipt, FileDown, FileSpreadsheet, Download } from "lucide-react";
import { useAccounts } from "@/accounts/contexts/AccountsContext";
import {
  exportIncomePDF, exportIncomeExcel,
  exportBalancePDF, exportBalanceExcel,
  exportCashFlowPDF, exportCashFlowExcel,
  exportTaxPDF, exportTaxExcel,
  exportAllStatements,
  type CashFlowInput, type TaxInput,
} from "@/accounts/utils/accountsExports";

const AA = "#f59e0b";
const ff = "'Plus Jakarta Sans', sans-serif";

type ReportTab = "income" | "balance" | "cashflow" | "tax";

// ─── Export button ────────────────────────────────────────────────────────────

function ExportBtn({ label, icon: Icon, color, onClick }: {
  label: string; icon: React.ComponentType<any>; color: string; onClick: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => { setBusy(true); try { await onClick(); } finally { setBusy(false); } };
  return (
    <button onClick={handle} disabled={busy} title={`Export ${label}`} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 8,
      border: `1px solid ${color}35`, background: busy ? "var(--bg-secondary)" : `${color}10`,
      color: busy ? "var(--text-muted)" : color, cursor: busy ? "not-allowed" : "pointer",
      fontSize: 12, fontWeight: 600, fontFamily: ff, transition: "all 0.15s", flexShrink: 0,
    }}>
      <Icon size={12} />
      {busy ? "Exporting…" : label}
    </button>
  );
}

// ─── Shared row components ────────────────────────────────────────────────────

function RSection({ title, color }: { title: string; color: string }) {
  return (
    <tr>
      <td colSpan={2} style={{ padding: "14px 16px 6px", fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, background: `${color}06`, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        {title}
      </td>
    </tr>
  );
}

function RRow({ label, value, indent, bold, color, separator }: { label: string; value: number; indent?: boolean; bold?: boolean; color?: string; separator?: boolean }) {
  const c = color ?? (bold ? "var(--text-primary)" : "var(--text-secondary)");
  return (
    <tr style={{ borderBottom: "1px solid var(--border)", background: bold ? "var(--bg-secondary)" : "transparent" }}>
      <td style={{ padding: `${bold ? 12 : 9}px 16px`, paddingLeft: indent ? 32 : 16, fontSize: bold ? 13 : 12.5, fontWeight: bold ? 700 : 400, color: c, fontFamily: ff }}>
        {label}
      </td>
      <td style={{ padding: `${bold ? 12 : 9}px 16px`, textAlign: "right", fontSize: bold ? 13 : 12.5, fontWeight: bold ? 700 : 400, color: c, fontFamily: ff, whiteSpace: "nowrap" }}>
        Rs. {Math.abs(value).toLocaleString()}
      </td>
    </tr>
  );
}

function RNet({ label, value }: { label: string; value: number }) {
  const positive = value >= 0;
  return (
    <tr style={{ background: `${positive ? "#34d399" : "#f87171"}10`, borderTop: "2px solid var(--border)" }}>
      <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 800, color: positive ? "#34d399" : "#f87171", fontFamily: ff }}>{label}</td>
      <td style={{ padding: "14px 16px", textAlign: "right", fontSize: 14, fontWeight: 800, color: positive ? "#34d399" : "#f87171", fontFamily: ff }}>Rs. {Math.abs(value).toLocaleString()}{positive ? "" : " (Loss)"}</td>
    </tr>
  );
}

// ─── Income Statement ─────────────────────────────────────────────────────────

function IncomeStatement() {
  const { getPLData } = useAccounts();
  const pl = useMemo(() => getPLData(), [getPLData]);

  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: `${AA}08`, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Income Statement (Profit & Loss)</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>For the period: 1 May 2026 — 22 May 2026  ·  IAS 1 / IFRS</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "right", marginRight: 4 }}>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>Gross Margin</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: AA, fontFamily: ff }}>{pl.grossMargin.toFixed(1)}%</p>
          </div>
          <ExportBtn label="PDF"   icon={FileDown}        color={AA}        onClick={() => exportIncomePDF(pl)} />
          <ExportBtn label="Excel" icon={FileSpreadsheet} color="#34d399"   onClick={() => exportIncomeExcel(pl)} />
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <RSection title="Revenue" color={AA} />
          {Object.entries(pl.revenue).map(([name, val]) => val > 0 && <RRow key={name} label={name} value={val} indent />)}
          <RRow label="Total Revenue" value={pl.totalRevenue} bold color={AA} />

          <RSection title="Cost of Goods Sold" color="#f97316" />
          {Object.entries(pl.cogs).map(([name, val]) => val > 0 && <RRow key={name} label={name} value={val} indent />)}
          <RRow label="Total COGS" value={pl.totalCOGS} bold color="#f97316" />

          <tr style={{ background: "rgba(52,211,153,0.06)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: "#34d399", fontFamily: ff }}>GROSS PROFIT</td>
            <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 800, color: "#34d399", fontFamily: ff }}>Rs. {pl.grossProfit.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 600 }}>({pl.grossMargin.toFixed(1)}%)</span></td>
          </tr>

          <RSection title="Operating Expenses" color="#f87171" />
          {Object.entries(pl.expenses).map(([name, val]) => val > 0 && <RRow key={name} label={name} value={val} indent />)}
          <RRow label="Total Operating Expenses" value={pl.totalExpenses} bold color="#f87171" />

          <RNet label="NET INCOME" value={pl.netIncome} />

          <tr>
            <td colSpan={2} style={{ padding: "12px 16px", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  { label: "Gross Margin",    value: `${pl.grossMargin.toFixed(1)}%`,  color: "#34d399" },
                  { label: "Net Margin",      value: `${pl.netMargin.toFixed(1)}%`,    color: AA },
                  { label: "Expense Ratio",   value: `${pl.totalRevenue > 0 ? ((pl.totalExpenses / pl.totalRevenue) * 100).toFixed(1) : "0"}%`, color: "#f87171" },
                  { label: "COGS Ratio",      value: `${pl.totalRevenue > 0 ? ((pl.totalCOGS / pl.totalRevenue) * 100).toFixed(1) : "0"}%`,    color: "#f97316" },
                ].map(m => (
                  <div key={m.label}>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: ff }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

function BalanceSheet() {
  const { getBalanceSheetData } = useAccounts();
  const bs = useMemo(() => getBalanceSheetData(), [getBalanceSheetData]);
  const checks = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Export bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Statement of Financial Position</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>As at 22 May 2026  ·  IAS 1 / IFRS</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportBtn label="PDF"   icon={FileDown}        color="#34d399" onClick={() => exportBalancePDF(bs)} />
          <ExportBtn label="Excel" icon={FileSpreadsheet} color="#34d399" onClick={() => exportBalanceExcel(bs)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Assets */}
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "rgba(52,211,153,0.06)", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#34d399", fontFamily: ff }}>ASSETS</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>As at 22 May 2026</p>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {bs.assets.map(a => <RRow key={a.code} label={a.name} value={a.balance} indent />)}
              <tr style={{ background: "rgba(52,211,153,0.08)", borderTop: "2px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: "#34d399", fontFamily: ff }}>TOTAL ASSETS</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 800, color: "#34d399", fontFamily: ff }}>Rs. {bs.totalAssets.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Liabilities + Equity */}
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "rgba(248,113,113,0.06)", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#f87171", fontFamily: ff }}>LIABILITIES & EQUITY</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>As at 22 May 2026</p>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr><td colSpan={2} style={{ padding: "8px 16px 4px", fontSize: 10.5, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, background: "rgba(248,113,113,0.04)" }}>Liabilities</td></tr>
              {bs.liabilities.map(a => <RRow key={a.code} label={a.name} value={a.balance} indent />)}
              <tr style={{ background: "rgba(248,113,113,0.06)" }}>
                <td style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "#f87171", fontFamily: ff }}>Total Liabilities</td>
                <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#f87171", fontFamily: ff }}>Rs. {bs.totalLiabilities.toLocaleString()}</td>
              </tr>
              <tr><td colSpan={2} style={{ padding: "8px 16px 4px", fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, background: "rgba(167,139,250,0.04)", borderTop: "1px solid var(--border)" }}>Equity</td></tr>
              {bs.equity.map(a => <RRow key={a.code} label={a.name} value={a.balance} indent />)}
              <tr style={{ background: "rgba(167,139,250,0.06)" }}>
                <td style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "#a78bfa", fontFamily: ff }}>Total Equity</td>
                <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#a78bfa", fontFamily: ff }}>Rs. {bs.totalEquity.toLocaleString()}</td>
              </tr>
              <tr style={{ background: checks ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", borderTop: "2px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: checks ? "#34d399" : "#f87171", fontFamily: ff }}>TOTAL LIABILITIES + EQUITY</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 800, color: checks ? "#34d399" : "#f87171", fontFamily: ff }}>Rs. {(bs.totalLiabilities + bs.totalEquity).toLocaleString()} {checks ? "✓" : "✗"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────

function CashFlowStatement() {
  const { getPLData, getAccountBalance, getTotalAROutstanding, getTotalAPOutstanding } = useAccounts();
  const pl      = useMemo(() => getPLData(), [getPLData]);
  const cashBal = getAccountBalance("1010") + getAccountBalance("1020");
  const arBal   = getTotalAROutstanding();
  const apBal   = getTotalAPOutstanding();

  const operatingCF = pl.netIncome - arBal + apBal;
  const netCF       = operatingCF;

  const cfData: CashFlowInput = {
    netIncome:    pl.netIncome,
    arChange:     arBal,
    apChange:     apBal,
    depreciation: pl.expenses["Depreciation"] ?? 0,
    operatingCF,
    investingCF:  0,
    financingCF:  0,
    netChange:    netCF,
    cashPosition: cashBal,
  };

  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: "rgba(96,165,250,0.06)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", fontFamily: ff }}>Cash Flow Statement</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>For the period: 1 May 2026 — 22 May 2026  ·  Indirect Method  ·  IAS 7</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportBtn label="PDF"   icon={FileDown}        color="#60a5fa" onClick={() => exportCashFlowPDF(cfData)} />
          <ExportBtn label="Excel" icon={FileSpreadsheet} color="#34d399" onClick={() => exportCashFlowExcel(cfData)} />
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <RSection title="Operating Activities" color="#60a5fa" />
          <RRow label="Net Income"                    value={pl.netIncome}      indent bold={false} />
          <RRow label="Adjustments — Accounts Receivable (change)" value={-arBal}  indent />
          <RRow label="Adjustments — Accounts Payable (change)"    value={apBal}   indent />
          <RRow label="Depreciation & Amortisation (non-cash)"     value={pl.expenses["Depreciation"] ?? 0} indent />
          <tr style={{ background: "rgba(96,165,250,0.06)", borderTop: "1px solid var(--border)" }}>
            <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#60a5fa", fontFamily: ff }}>Net Cash from Operating Activities</td>
            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#60a5fa", fontFamily: ff }}>Rs. {operatingCF.toLocaleString()}</td>
          </tr>

          <RSection title="Investing Activities" color="#a78bfa" />
          <RRow label="Equipment & Tools purchases"   value={0}   indent />
          <RRow label="Net Cash from Investing Activities" value={0}  bold={false} />

          <RSection title="Financing Activities" color="#f97316" />
          <RRow label="Owner contributions / drawings" value={0}  indent />
          <RRow label="Loan repayments"                value={0}  indent />
          <RRow label="Net Cash from Financing Activities" value={0} bold={false} />

          <RNet label="NET CHANGE IN CASH" value={netCF} />

          <tr>
            <td colSpan={2} style={{ padding: "12px 16px", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                {[
                  { label: "Cash Position",    value: `Rs. ${cashBal.toLocaleString()}`,  color: "#34d399" },
                  { label: "AR Outstanding",   value: `Rs. ${arBal.toLocaleString()}`,    color: "#fbbf24" },
                  { label: "AP Outstanding",   value: `Rs. ${apBal.toLocaleString()}`,    color: "#f97316" },
                ].map(m => (
                  <div key={m.label}>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: m.color, fontFamily: ff }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Tax Summary ──────────────────────────────────────────────────────────────

function TaxSummary() {
  const { getTaxSummary, getPLData } = useAccounts();
  const tax = useMemo(() => getTaxSummary(), [getTaxSummary]);
  const pl  = useMemo(() => getPLData(),     [getPLData]);

  const vatRate   = 18;
  const taxable   = pl.totalRevenue;
  const taxData: TaxInput = {
    vatCollected: tax.vatCollected,
    vatPaid:      tax.vatPaid,
    netVat:       tax.netVat,
    revenue:      pl.revenue,
    totalRevenue: pl.totalRevenue,
    vatRate,
  };

  const rows = [
    { label: "Repair Services Revenue",  amount: pl.revenue["Repair Services Revenue"] ?? 0  },
    { label: "Mobile Phone Sales",       amount: pl.revenue["Mobile Phone Sales"] ?? 0       },
    { label: "Accessory Sales",          amount: pl.revenue["Accessory Sales"] ?? 0          },
    { label: "Other Revenue",            amount: pl.revenue["Other Revenue"] ?? 0            },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Export bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>VAT Return Summary</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>Period: May 2026  ·  Standard Rate: {vatRate}%  ·  Sri Lanka IRD</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportBtn label="PDF"   icon={FileDown}        color="#f87171" onClick={() => exportTaxPDF(taxData)} />
          <ExportBtn label="Excel" icon={FileSpreadsheet} color="#34d399" onClick={() => exportTaxExcel(taxData)} />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "VAT Collected (Output)",   value: `Rs. ${tax.vatCollected.toLocaleString()}`,  color: "#f87171",  sub: `${vatRate}% on taxable sales` },
          { label: "VAT Paid (Input)",          value: `Rs. ${tax.vatPaid.toLocaleString()}`,        color: "#34d399",  sub: "Reclaimable input VAT" },
          { label: "Net VAT Payable",           value: `Rs. ${tax.netVat.toLocaleString()}`,          color: AA,         sub: "To be remitted to IRD" },
          { label: "Total Taxable Revenue",     value: `Rs. ${taxable.toLocaleString()}`,              color: "#60a5fa",  sub: "All taxable supplies" },
        ].map(c => (
          <div key={c.label} style={{ padding: "16px", borderRadius: 12, background: "var(--bg-card)", border: `1px solid ${c.color}25` }}>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 6, fontWeight: 600 }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: c.color, fontFamily: ff, letterSpacing: "-0.02em" }}>{c.value}</p>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginTop: 4 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue breakdown for tax */}
      <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: `${AA}08`, borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: AA, fontFamily: ff }}>VAT Output Breakdown — May 2026</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Standard rate: {vatRate}% · Period: 1 May – 22 May 2026</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Revenue Category", "Gross Revenue", "VAT Rate", "VAT Collected", "Net Revenue"].map(h => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.filter(r => r.amount > 0).map((r, i) => {
              const vat = Math.round(r.amount * (vatRate / 118));
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "9px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.label}</td>
                  <td style={{ padding: "9px 14px", color: "var(--text-secondary)", fontFamily: ff }}>Rs. {r.amount.toLocaleString()}</td>
                  <td style={{ padding: "9px 14px" }}><span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${AA}12`, color: AA, fontFamily: ff }}>{vatRate}%</span></td>
                  <td style={{ padding: "9px 14px", fontWeight: 600, color: "#f87171", fontFamily: ff }}>Rs. {vat.toLocaleString()}</td>
                  <td style={{ padding: "9px 14px", color: "var(--text-secondary)", fontFamily: ff }}>Rs. {(r.amount - vat).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>TOTAL</td>
              <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Rs. {taxable.toLocaleString()}</td>
              <td />
              <td style={{ padding: "10px 14px", fontWeight: 700, color: "#f87171", fontFamily: ff }}>Rs. {tax.vatCollected.toLocaleString()}</td>
              <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Rs. {(taxable - tax.vatCollected).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#f87171", fontFamily: ff, marginBottom: 4 }}>VAT Filing Reminder</p>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>VAT return for May 2026 is due by <strong style={{ color: "var(--text-primary)" }}>30 June 2026</strong>. Net VAT payable: <strong style={{ color: "#f87171" }}>Rs. {tax.netVat.toLocaleString()}</strong>. File via the Inland Revenue Department (IRD) eFiling portal.</p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS: { id: ReportTab; label: string; icon: any; color: string }[] = [
  { id: "income",   label: "Income Statement", icon: TrendingUp,     color: AA       },
  { id: "balance",  label: "Balance Sheet",    icon: Scale,          color: "#34d399" },
  { id: "cashflow", label: "Cash Flow",        icon: ArrowLeftRight, color: "#60a5fa" },
  { id: "tax",      label: "Tax Summary",      icon: Receipt,        color: "#f87171" },
];

export default function FinancialReports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("income");

  const { getPLData, getBalanceSheetData, getTaxSummary, getAccountBalance, getTotalAROutstanding, getTotalAPOutstanding } = useAccounts();

  const handleExportAll = async () => {
    const pl      = getPLData();
    const bs      = getBalanceSheetData();
    const tax     = getTaxSummary();
    const cashBal = getAccountBalance("1010") + getAccountBalance("1020");
    const arBal   = getTotalAROutstanding();
    const apBal   = getTotalAPOutstanding();
    const operatingCF = pl.netIncome - arBal + apBal;

    const cfData: CashFlowInput = {
      netIncome:    pl.netIncome,
      arChange:     arBal,
      apChange:     apBal,
      depreciation: pl.expenses["Depreciation"] ?? 0,
      operatingCF,
      investingCF:  0,
      financingCF:  0,
      netChange:    operatingCF,
      cashPosition: cashBal,
    };
    const taxData: TaxInput = {
      vatCollected: tax.vatCollected,
      vatPaid:      tax.vatPaid,
      netVat:       tax.netVat,
      revenue:      pl.revenue,
      totalRevenue: pl.totalRevenue,
      vatRate:      18,
    };
    await exportAllStatements(pl, bs, cfData, taxData);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>
      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Financial Reports</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Statutory and management financial statements · May 2026 · IFRS / IAS</p>
        </div>
        <ExportBtn label="Export All Statements (Excel)" icon={Download} color={AA} onClick={handleExportAll} />
      </div>

      {/* Tab bar */}
      <div className="fade-up" style={{ display: "flex", gap: 10 }}>
        {TABS.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10,
              background: active ? `${t.color}12` : "var(--bg-card)", border: `1px solid ${active ? t.color + "40" : "var(--border)"}`,
              cursor: "pointer", fontFamily: ff, transition: "all 0.15s",
            }}>
              <t.icon size={14} color={active ? t.color : "var(--text-muted)"} />
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? t.color : "var(--text-secondary)", fontFamily: ff }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="fade-up">
        {activeTab === "income"   && <IncomeStatement />}
        {activeTab === "balance"  && <BalanceSheet />}
        {activeTab === "cashflow" && <CashFlowStatement />}
        {activeTab === "tax"      && <TaxSummary />}
      </div>
    </div>
  );
}
