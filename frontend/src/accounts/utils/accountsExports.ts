// Financial statement exports — IFRS / IAS global standard accounting format.
// All functions are async and use dynamic imports (avoids SSR issues).

import type { PLData, BalanceSheetData } from "@/accounts/contexts/AccountsContext";

// ─── Entity / period constants ────────────────────────────────────────────────

const CO_NAME  = "MANO MOBILE";
const CO_ADDR  = "Mobile Repair & Sales Centre, Sri Lanka";
const CCY      = "Rs.";
const PERIOD   = "For the Period: 1 May 2026 to 22 May 2026";
const AS_AT    = "As at 22 May 2026";
const PREP_BY  = "Accounts Department — Mano Mobile";
const STD_NOTE = "Prepared in accordance with International Financial Reporting Standards (IFRS)";

function fmt(n: number): string {
  return `${CCY} ${Math.abs(n).toLocaleString("en-US")}`;
}

// ─── PDF header ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPdf(title: string, periodLine: string): Promise<any> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
  doc.text(CO_NAME, 14, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110, 110, 110);
  doc.text(CO_ADDR, 14, 19);
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(14, 22, 196, 22);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(15, 15, 15);
  doc.text(title, 14, 30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
  doc.text(periodLine, 14, 36);
  doc.text(`Currency: Sri Lankan Rupee (${CCY})  |  ${STD_NOTE}  |  Prepared: 22 May 2026`, 14, 41);
  doc.setDrawColor(200, 160, 30); doc.setLineWidth(0.6); doc.line(14, 44, 196, 44);

  return doc;
}

// ─── Row builders ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any[];

function secHead(label: string, rgb: [number, number, number]): Row {
  return [
    { content: label, styles: { fontStyle: "bold", fillColor: rgb, textColor: [255, 255, 255], fontSize: 9 } },
    { content: "",    styles: { fillColor: rgb } },
  ];
}
function line(label: string, value: number, indent = true): Row {
  return [(indent ? "    " : "") + label, fmt(value)];
}
function subLabel(label: string): Row {
  return [
    { content: "  " + label, styles: { fontStyle: "bold", textColor: [50, 50, 50] } },
    { content: "", styles: { textColor: [50, 50, 50] } },
  ];
}
function total(label: string, value: number, bg: [number, number, number] = [245, 245, 240]): Row {
  return [
    { content: label,     styles: { fontStyle: "bold", fillColor: bg, textColor: [20, 20, 20] } },
    { content: fmt(value), styles: { fontStyle: "bold", fillColor: bg, textColor: [20, 20, 20], halign: "right" } },
  ];
}
function net(label: string, value: number): Row {
  const pos = value >= 0;
  const bg: [number, number, number] = pos ? [220, 248, 235] : [255, 230, 230];
  const tc: [number, number, number] = pos ? [0, 100, 50]   : [160,  0,   0];
  return [
    { content: label,                                            styles: { fontStyle: "bold", fillColor: bg, textColor: tc, fontSize: 10 } },
    { content: fmt(value) + (value < 0 ? " (Loss)" : ""),       styles: { fontStyle: "bold", fillColor: bg, textColor: tc, halign: "right", fontSize: 10 } },
  ];
}
function spacer(): Row {
  return [
    { content: "", styles: { fillColor: [255, 255, 255], cellPadding: 1 } },
    { content: "", styles: { fillColor: [255, 255, 255], cellPadding: 1 } },
  ];
}

// ─── Shared autoTable options ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tableOpts(headFill: [number, number, number], headText: [number, number, number] = [255, 255, 255]): any {
  return {
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 6, right: 6 } },
    headStyles: { fillColor: headFill, textColor: headText, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 46, halign: "right" } },
  };
}

// ─── Income Statement (IAS 1) ─────────────────────────────────────────────────

export async function exportIncomePDF(pl: PLData): Promise<void> {
  const doc  = await buildPdf("STATEMENT OF COMPREHENSIVE INCOME", PERIOD + "  |  IAS 1 / IFRS");
  const { default: autoTable } = await import("jspdf-autotable");

  const body: Row[] = [
    secHead("REVENUE", [180, 130, 0]),
    ...Object.entries(pl.revenue).filter(([, v]) => v > 0).map(([k, v]) => line(k, v)),
    total("Total Revenue", pl.totalRevenue, [255, 249, 220]),
    spacer(),

    secHead("COST OF GOODS SOLD", [190, 80, 10]),
    ...Object.entries(pl.cogs).filter(([, v]) => v > 0).map(([k, v]) => line(k, v)),
    total("Total Cost of Goods Sold", pl.totalCOGS, [255, 240, 220]),
    spacer(),

    [
      { content: `GROSS PROFIT  ·  Gross Margin: ${pl.grossMargin.toFixed(1)}%`, styles: { fontStyle: "bold", fillColor: [218, 250, 232], textColor: [0, 110, 60], fontSize: 10 } },
      { content: fmt(pl.grossProfit), styles: { fontStyle: "bold", fillColor: [218, 250, 232], textColor: [0, 110, 60], halign: "right", fontSize: 10 } },
    ],
    spacer(),

    secHead("OPERATING EXPENSES", [175, 40, 40]),
    ...Object.entries(pl.expenses).filter(([, v]) => v > 0).map(([k, v]) => line(k, v)),
    total("Total Operating Expenses", pl.totalExpenses, [255, 232, 232]),
    spacer(),

    net(`NET INCOME / PROFIT FOR THE PERIOD  ·  Net Margin: ${pl.netMargin.toFixed(1)}%`, pl.netIncome),
  ];

  autoTable(doc, { startY: 49, head: [["Description", `Amount (${CCY})`]], body, ...tableOpts([245, 158, 11]) });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 250;
  doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130);
  doc.text(
    `Key Ratios — Gross Margin: ${pl.grossMargin.toFixed(1)}%  |  Net Margin: ${pl.netMargin.toFixed(1)}%  |  COGS/Revenue: ${pl.totalRevenue > 0 ? ((pl.totalCOGS / pl.totalRevenue) * 100).toFixed(1) : 0}%  |  OpEx/Revenue: ${pl.totalRevenue > 0 ? ((pl.totalExpenses / pl.totalRevenue) * 100).toFixed(1) : 0}%`,
    14, finalY + 8
  );
  doc.text(PREP_BY + "  ·  " + STD_NOTE, 14, finalY + 13);
  doc.save("ManoMobile_IncomeStatement_May2026.pdf");
}

export async function exportIncomeExcel(pl: PLData): Promise<void> {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    [CO_NAME],
    ["STATEMENT OF COMPREHENSIVE INCOME (PROFIT & LOSS)"],
    [PERIOD],
    [`Currency: Sri Lankan Rupee (${CCY})  |  Standard: IFRS / IAS 1`],
    [],
    ["Description", `Amount (${CCY})`],
    ["REVENUE"],
    ...Object.entries(pl.revenue).filter(([, v]) => v > 0).map(([k, v]) => ["  " + k, v]),
    ["Total Revenue", pl.totalRevenue],
    [],
    ["COST OF GOODS SOLD"],
    ...Object.entries(pl.cogs).filter(([, v]) => v > 0).map(([k, v]) => ["  " + k, v]),
    ["Total Cost of Goods Sold", pl.totalCOGS],
    [],
    ["GROSS PROFIT", pl.grossProfit],
    ["  Gross Profit Margin", `${pl.grossMargin.toFixed(1)}%`],
    [],
    ["OPERATING EXPENSES"],
    ...Object.entries(pl.expenses).filter(([, v]) => v > 0).map(([k, v]) => ["  " + k, v]),
    ["Total Operating Expenses", pl.totalExpenses],
    [],
    ["NET INCOME / PROFIT FOR THE PERIOD", pl.netIncome],
    ["  Net Profit Margin", `${pl.netMargin.toFixed(1)}%`],
    [],
    ["KEY RATIOS"],
    ["  Gross Profit Margin",    `${pl.grossMargin.toFixed(1)}%`],
    ["  Net Profit Margin",      `${pl.netMargin.toFixed(1)}%`],
    ["  COGS to Revenue",        pl.totalRevenue > 0 ? `${((pl.totalCOGS      / pl.totalRevenue) * 100).toFixed(1)}%` : "0%"],
    ["  Operating Expense Ratio",pl.totalRevenue > 0 ? `${((pl.totalExpenses  / pl.totalRevenue) * 100).toFixed(1)}%` : "0%"],
    [],
    [PREP_BY],
    [STD_NOTE],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 48 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Income Statement");
  XLSX.writeFile(wb, "ManoMobile_IncomeStatement_May2026.xlsx");
}

// ─── Balance Sheet (IAS 1 — Statement of Financial Position) ─────────────────

export async function exportBalancePDF(bs: BalanceSheetData): Promise<void> {
  const doc = await buildPdf("STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)", AS_AT + "  |  IAS 1 / IFRS");
  const { default: autoTable } = await import("jspdf-autotable");
  const balanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 1;

  const currentAssets    = bs.assets.filter(a => parseInt(a.code) < 1500);
  const nonCurrentAssets = bs.assets.filter(a => parseInt(a.code) >= 1500);

  const assetBody: Row[] = [
    secHead("ASSETS", [30, 140, 90]),
    subLabel("Current Assets"),
    ...currentAssets.map(a => line(a.name, a.balance)),
    subLabel("Non-Current Assets"),
    ...nonCurrentAssets.map(a => line(a.name, a.balance)),
    total("TOTAL ASSETS", bs.totalAssets, [218, 250, 232]),
  ];

  const leBody: Row[] = [
    secHead("LIABILITIES", [175, 40, 40]),
    subLabel("Current Liabilities"),
    ...bs.liabilities.map(l => line(l.name, l.balance)),
    total("Total Liabilities", bs.totalLiabilities, [255, 232, 232]),
    spacer(),

    secHead("EQUITY", [100, 70, 200]),
    ...bs.equity.map(e => line(e.name, e.balance)),
    total("Total Equity", bs.totalEquity, [238, 232, 255]),
    spacer(),

    [
      { content: `TOTAL LIABILITIES + EQUITY  ${balanced ? "✓ Balanced" : "✗ Imbalanced"}`, styles: { fontStyle: "bold", fillColor: balanced ? [218, 250, 232] : [255, 220, 220], textColor: balanced ? [0, 100, 50] : [160, 0, 0], fontSize: 10 } },
      { content: fmt(bs.totalLiabilities + bs.totalEquity),                                  styles: { fontStyle: "bold", fillColor: balanced ? [218, 250, 232] : [255, 220, 220], textColor: balanced ? [0, 100, 50] : [160, 0, 0], halign: "right", fontSize: 10 } },
    ],
  ];

  autoTable(doc, { startY: 49, head: [["Description", `Amount (${CCY})`]], body: assetBody, ...tableOpts([52, 211, 153], [0, 50, 30]) });

  const afterAssets = (doc as any).lastAutoTable?.finalY ?? 140;
  autoTable(doc, { startY: afterAssets + 6, head: [["Description", `Amount (${CCY})`]], body: leBody, ...tableOpts([248, 113, 113]) });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 260;
  doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130);
  doc.text(PREP_BY + "  ·  " + STD_NOTE, 14, finalY + 8);
  doc.save("ManoMobile_BalanceSheet_22May2026.pdf");
}

export async function exportBalanceExcel(bs: BalanceSheetData): Promise<void> {
  const XLSX = await import("xlsx");
  const balanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 1;
  const rows: (string | number)[][] = [
    [CO_NAME],
    ["STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)"],
    [AS_AT],
    [`Currency: Sri Lankan Rupee (${CCY})  |  Standard: IFRS / IAS 1`],
    [],
    ["ASSETS"],
    ["  Current Assets"],
    ...bs.assets.filter(a => parseInt(a.code) < 1500).map(a => ["    " + a.name, a.balance]),
    ["  Non-Current Assets"],
    ...bs.assets.filter(a => parseInt(a.code) >= 1500).map(a => ["    " + a.name, a.balance]),
    ["TOTAL ASSETS", bs.totalAssets],
    [],
    ["LIABILITIES"],
    ["  Current Liabilities"],
    ...bs.liabilities.map(l => ["    " + l.name, l.balance]),
    ["Total Liabilities", bs.totalLiabilities],
    [],
    ["EQUITY"],
    ...bs.equity.map(e => ["  " + e.name, e.balance]),
    ["Total Equity", bs.totalEquity],
    [],
    ["TOTAL LIABILITIES + EQUITY", bs.totalLiabilities + bs.totalEquity],
    ["Balance Check", balanced ? "Assets = Liabilities + Equity  ✓" : "IMBALANCE DETECTED  ✗"],
    [],
    [PREP_BY],
    [STD_NOTE],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 45 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
  XLSX.writeFile(wb, "ManoMobile_BalanceSheet_22May2026.xlsx");
}

// ─── Cash Flow Statement (IAS 7) ──────────────────────────────────────────────

export interface CashFlowInput {
  netIncome:    number;
  arChange:     number;
  apChange:     number;
  depreciation: number;
  operatingCF:  number;
  investingCF:  number;
  financingCF:  number;
  netChange:    number;
  cashPosition: number;
}

export async function exportCashFlowPDF(d: CashFlowInput): Promise<void> {
  const doc = await buildPdf("STATEMENT OF CASH FLOWS", PERIOD + "  |  Indirect Method  |  IAS 7");
  const { default: autoTable } = await import("jspdf-autotable");

  const body: Row[] = [
    secHead("OPERATING ACTIVITIES — Indirect Method", [60, 110, 200]),
    line("Net Income / Profit for the Period", d.netIncome, false),
    subLabel("Adjustments for non-cash items:"),
    line("Depreciation & Amortisation", d.depreciation),
    subLabel("Changes in working capital:"),
    line("(Increase) in Trade Receivables (AR)", -d.arChange),
    line("Increase in Trade Payables (AP)", d.apChange),
    total("Net Cash Generated from Operating Activities", d.operatingCF, [222, 234, 252]),
    spacer(),

    secHead("INVESTING ACTIVITIES", [120, 80, 200]),
    line("Purchase of property, plant & equipment", 0),
    total("Net Cash Used in Investing Activities", d.investingCF, [238, 232, 255]),
    spacer(),

    secHead("FINANCING ACTIVITIES", [190, 100, 20]),
    line("Owner contributions / (drawings)", 0),
    line("Repayment of borrowings", 0),
    total("Net Cash from Financing Activities", d.financingCF, [255, 242, 220]),
    spacer(),

    net("NET INCREASE IN CASH & CASH EQUIVALENTS", d.netChange),
    spacer(),
    [
      { content: "Cash & Cash Equivalents — End of Period", styles: { fontStyle: "bold", fillColor: [218, 250, 232], textColor: [0, 100, 50] } },
      { content: fmt(d.cashPosition),                       styles: { fontStyle: "bold", fillColor: [218, 250, 232], textColor: [0, 100, 50], halign: "right" } },
    ],
  ];

  autoTable(doc, { startY: 49, head: [["Description", `Amount (${CCY})`]], body, ...tableOpts([96, 165, 250]) });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 260;
  doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130);
  doc.text(PREP_BY + "  ·  " + STD_NOTE + "  ·  IAS 7", 14, finalY + 8);
  doc.save("ManoMobile_CashFlowStatement_May2026.pdf");
}

export async function exportCashFlowExcel(d: CashFlowInput): Promise<void> {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    [CO_NAME],
    ["STATEMENT OF CASH FLOWS"],
    [PERIOD],
    [`Method: Indirect  |  Currency: Sri Lankan Rupee (${CCY})  |  Standard: IFRS / IAS 7`],
    [],
    ["OPERATING ACTIVITIES"],
    ["  Net Income / Profit for the Period",         d.netIncome],
    ["  Add: Depreciation & Amortisation",           d.depreciation],
    ["  (Increase) in Trade Receivables",            -d.arChange],
    ["  Increase in Trade Payables",                 d.apChange],
    ["Net Cash from Operating Activities",           d.operatingCF],
    [],
    ["INVESTING ACTIVITIES"],
    ["  Purchase of PP&E",                           0],
    ["Net Cash from Investing Activities",           d.investingCF],
    [],
    ["FINANCING ACTIVITIES"],
    ["  Owner contributions / (drawings)",           0],
    ["  Repayment of borrowings",                    0],
    ["Net Cash from Financing Activities",           d.financingCF],
    [],
    ["NET INCREASE IN CASH & CASH EQUIVALENTS",      d.netChange],
    ["Cash & Cash Equivalents — End of Period",      d.cashPosition],
    [],
    [PREP_BY],
    [STD_NOTE + "  ·  IAS 7"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 50 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cash Flow Statement");
  XLSX.writeFile(wb, "ManoMobile_CashFlowStatement_May2026.xlsx");
}

// ─── Tax / VAT Return ─────────────────────────────────────────────────────────

export interface TaxInput {
  vatCollected: number;
  vatPaid:      number;
  netVat:       number;
  revenue:      Record<string, number>;
  totalRevenue: number;
  vatRate:      number;
}

export async function exportTaxPDF(d: TaxInput): Promise<void> {
  const doc = await buildPdf(`VAT RETURN — STANDARD RATED SUPPLIES (${d.vatRate}%)`, PERIOD);
  const { default: autoTable } = await import("jspdf-autotable");

  const body: Row[] = [
    secHead("OUTPUT TAX (VAT COLLECTED ON SALES)", [175, 40, 40]),
    ...Object.entries(d.revenue).filter(([, v]) => v > 0).map(([k, v]) => {
      const vat = Math.round(v * (d.vatRate / 118));
      return [`    ${k}  (Gross: ${fmt(v)})`, fmt(vat)];
    }),
    total("Total Output Tax (VAT Collected)", d.vatCollected, [255, 232, 232]),
    spacer(),

    secHead("INPUT TAX (VAT PAID ON PURCHASES — RECLAIMABLE)", [30, 140, 90]),
    line("Input VAT on stock & supplies", d.vatPaid),
    total("Total Input Tax Reclaimable", d.vatPaid, [218, 250, 232]),
    spacer(),

    net(`NET VAT PAYABLE TO IRD  (Output − Input)`, d.netVat),
    spacer(),

    ["Filing Deadline",      "30 June 2026"],
    ["Submission Portal",    "Inland Revenue Department (IRD) eFiling — Sri Lanka"],
    ["Tax Period Reference", "May 2026 — Standard Rated"],
  ];

  autoTable(doc, { startY: 49, head: [["Description", `VAT Amount (${CCY})`]], body, ...tableOpts([248, 113, 113]) });

  const after = (doc as any).lastAutoTable?.finalY ?? 200;

  // Detailed revenue breakdown
  autoTable(doc, {
    startY: after + 8,
    head: [["Revenue Category", "Gross Revenue", "VAT Rate", "VAT Collected", "Net Revenue"]],
    body: Object.entries(d.revenue).filter(([, v]) => v > 0).map(([k, v]) => {
      const vat = Math.round(v * (d.vatRate / 118));
      return [k, fmt(v), `${d.vatRate}%`, fmt(vat), fmt(v - vat)];
    }),
    foot: [["TOTAL", fmt(d.totalRevenue), "", fmt(d.vatCollected), fmt(d.totalRevenue - d.vatCollected)]],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
    headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [250, 240, 200], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70 }, 1: { cellWidth: 30, halign: "right" },
      2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 30, halign: "right" }, 4: { cellWidth: 36, halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 270;
  doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130);
  doc.text(PREP_BY + "  ·  This VAT return is prepared for IRD filing purposes.", 14, finalY + 8);
  doc.save("ManoMobile_VATReturn_May2026.pdf");
}

export async function exportTaxExcel(d: TaxInput): Promise<void> {
  const XLSX = await import("xlsx");
  const vatRate = d.vatRate;
  const rows: (string | number)[][] = [
    [CO_NAME],
    ["VAT RETURN SUMMARY"],
    ["VAT Period: 1 May 2026 — 31 May 2026"],
    [`Standard VAT Rate: ${vatRate}%  |  Currency: Sri Lankan Rupee (${CCY})`],
    [],
    ["OUTPUT TAX (VAT COLLECTED)"],
    ...Object.entries(d.revenue).filter(([, v]) => v > 0).map(([k, v]) => {
      const vat = Math.round(v * (vatRate / 118));
      return ["  " + k, vat];
    }),
    ["Total Output Tax", d.vatCollected],
    [],
    ["INPUT TAX (VAT RECLAIMABLE)"],
    ["  Input VAT on purchases", d.vatPaid],
    ["Total Input Tax", d.vatPaid],
    [],
    ["NET VAT PAYABLE TO IRD", d.netVat],
    [],
    ["VAT REVENUE BREAKDOWN"],
    ["Category", "Gross Revenue", "VAT Rate", "VAT Collected", "Net Revenue"],
    ...Object.entries(d.revenue).filter(([, v]) => v > 0).map(([k, v]) => {
      const vat = Math.round(v * (vatRate / 118));
      return [k, v, `${vatRate}%`, vat, v - vat];
    }),
    ["TOTAL", d.totalRevenue, "", d.vatCollected, d.totalRevenue - d.vatCollected],
    [],
    ["Filing Deadline", "30 June 2026"],
    ["Submission Portal", "IRD eFiling Portal — Sri Lanka"],
    [],
    [PREP_BY],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 38 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "VAT Return");
  XLSX.writeFile(wb, "ManoMobile_VATReturn_May2026.xlsx");
}

// ─── All Statements — combined Excel workbook ─────────────────────────────────

export async function exportAllStatements(
  pl: PLData,
  bs: BalanceSheetData,
  cf: CashFlowInput,
  tax: TaxInput,
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Income Statement
  {
    const rows: (string | number)[][] = [
      [CO_NAME], ["Income Statement (P&L)"], [PERIOD], [`Currency: ${CCY}  |  IFRS / IAS 1`], [],
      ["Description", `Amount (${CCY})`],
      ["REVENUE"],
      ...Object.entries(pl.revenue).filter(([, v]) => v > 0).map(([k, v]) => ["  " + k, v]),
      ["Total Revenue", pl.totalRevenue], [],
      ["COST OF GOODS SOLD"],
      ...Object.entries(pl.cogs).filter(([, v]) => v > 0).map(([k, v]) => ["  " + k, v]),
      ["Total COGS", pl.totalCOGS], [],
      ["GROSS PROFIT", pl.grossProfit],
      ["  Gross Margin", `${pl.grossMargin.toFixed(1)}%`], [],
      ["OPERATING EXPENSES"],
      ...Object.entries(pl.expenses).filter(([, v]) => v > 0).map(([k, v]) => ["  " + k, v]),
      ["Total Expenses", pl.totalExpenses], [],
      ["NET INCOME", pl.netIncome],
      ["  Net Margin", `${pl.netMargin.toFixed(1)}%`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 45 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Income Statement");
  }

  // Sheet 2 — Balance Sheet
  {
    const balanced = Math.abs(bs.totalAssets - bs.totalLiabilities - bs.totalEquity) < 1;
    const rows: (string | number)[][] = [
      [CO_NAME], ["Balance Sheet"], [AS_AT], [`Currency: ${CCY}  |  IFRS / IAS 1`], [],
      ["ASSETS"],
      ["  Current Assets"],
      ...bs.assets.filter(a => parseInt(a.code) < 1500).map(a => ["    " + a.name, a.balance]),
      ["  Non-Current Assets"],
      ...bs.assets.filter(a => parseInt(a.code) >= 1500).map(a => ["    " + a.name, a.balance]),
      ["TOTAL ASSETS", bs.totalAssets], [],
      ["LIABILITIES"],
      ...bs.liabilities.map(l => ["  " + l.name, l.balance]),
      ["Total Liabilities", bs.totalLiabilities], [],
      ["EQUITY"],
      ...bs.equity.map(e => ["  " + e.name, e.balance]),
      ["Total Equity", bs.totalEquity], [],
      ["TOTAL LIABILITIES + EQUITY", bs.totalLiabilities + bs.totalEquity],
      ["Balance Check", balanced ? "Assets = L + E  ✓" : "IMBALANCE  ✗"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 42 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
  }

  // Sheet 3 — Cash Flow
  {
    const rows: (string | number)[][] = [
      [CO_NAME], ["Cash Flow Statement"], [PERIOD], [`Indirect Method  |  Currency: ${CCY}  |  IAS 7`], [],
      ["OPERATING ACTIVITIES"],
      ["  Net Income", cf.netIncome], ["  Depreciation", cf.depreciation],
      ["  (Increase) in Receivables", -cf.arChange], ["  Increase in Payables", cf.apChange],
      ["Net Cash — Operating", cf.operatingCF], [],
      ["INVESTING ACTIVITIES"], ["  Capital expenditures", 0],
      ["Net Cash — Investing", cf.investingCF], [],
      ["FINANCING ACTIVITIES"], ["  Owner contributions/drawings", 0],
      ["Net Cash — Financing", cf.financingCF], [],
      ["NET CHANGE IN CASH", cf.netChange],
      ["Cash Position — End of Period", cf.cashPosition],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 42 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Cash Flow");
  }

  // Sheet 4 — VAT Return
  {
    const vatRate = tax.vatRate;
    const rows: (string | number)[][] = [
      [CO_NAME], ["VAT Return Summary"], ["Period: May 2026"], [`Standard VAT Rate: ${vatRate}%`], [],
      ["Output VAT (Collected)",       tax.vatCollected],
      ["Input VAT (Reclaimable)",      tax.vatPaid],
      ["Net VAT Payable to IRD",       tax.netVat],
      [], ["Filing Deadline", "30 June 2026"],
      ["Submission Portal", "IRD eFiling Portal"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 38 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "VAT Return");
  }

  XLSX.writeFile(wb, "ManoMobile_FinancialStatements_May2026.xlsx");
}
