"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Printer, FileSpreadsheet, CalendarRange } from "lucide-react";
import { groupCreditEntries, type CreditAccount, type CreditEntry, type CreditEntryGroup } from "@/lib/credit/api";
import { openInvoices } from "@/lib/credit/allocation";
import { SHOP_DETAILS } from "@/lib/shop";
import { useRepair } from "@/cashier/contexts/RepairContext";

/**
 * A statement of a credit account for a period — what a dealer asks for at
 * the end of the month: what they owed going in, every bill, payment, refund
 * and write-off in the period with the balance after each, what they owe
 * coming out, and which invoices make that up.
 *
 * Shown on screen as the page it prints as, so what is checked is what is
 * handed over. Print (or Save as PDF from the print dialog) and Excel.
 */

const ff = "'Plus Jakarta Sans', sans-serif";
/** Unpaid-invoice rows: a light red wash with a red edge — prints on any printer. */
const UNPAID_BG = "#fdecec";
const UNPAID_EDGE = "#d32f2f";
const money = (n: number) => Math.round(n).toLocaleString("en-LK");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nice = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export type Preset = "this-month" | "last-month" | "last-30" | "last-90" | "this-year" | "all" | "custom";

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-30",    label: "Last 30 days" },
  { id: "last-90",    label: "Last 3 months" },
  { id: "this-year",  label: "This year" },
  { id: "all",        label: "All time" },
  { id: "custom",     label: "Custom" },
];

export function rangeFor(p: Preset, first: string | null): { from: string; to: string } {
  const now = new Date();
  const today = iso(now);
  switch (p) {
    case "this-month": return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "last-month": return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "last-30":    return { from: iso(new Date(now.getTime() - 29 * 86400000)), to: today };
    case "last-90":    return { from: iso(new Date(now.getTime() - 89 * 86400000)), to: today };
    case "this-year":  return { from: `${now.getFullYear()}-01-01`, to: today };
    default:           return { from: first ?? today, to: today };
  }
}

/** How a line moves what is owed: an invoice (net of refunds on it) adds;
 *  payments, refunds and write-offs take off. */
const deltaOf = (g: CreditEntryGroup) => (g.kind === "Charge" ? g.amount : -Math.abs(g.amount));
const signedEntry = (e: CreditEntry) => (e.kind === "Charge" ? e.amount : -e.amount);

function describe(g: CreditEntryGroup, jobNo: (id: string) => string): string {
  const jobs = g.jobIds.length ? ` · ${g.jobIds.length > 3 ? `${g.jobIds.length} jobs` : g.jobIds.map(jobNo).join(", ")}` : "";
  switch (g.kind) {
    case "Charge":    return `Invoice ${g.invoiceNo ?? ""}${jobs}`.trim() || (g.note ?? "Charge");
    case "Payment":   return `Payment${g.method ? ` · ${g.method}` : ""}${g.invoiceNo ? ` · for ${g.invoiceNo}` : " · on account"}`;
    case "Refund":    return `Refund / credit${g.invoiceNo ? ` · ${g.invoiceNo}` : ""}${g.note ? ` · ${g.note}` : ""}`;
    case "Write-off": return `Written off${g.invoiceNo ? ` · ${g.invoiceNo}` : ""}`;
    default:          return g.note ?? g.kind;
  }
}

export default function AccountStatement({ account, entries, onClose, initialPreset = "this-month", initialRange }: {
  account: CreditAccount;
  entries: CreditEntry[];
  onClose: () => void;
  /** Opens on the period the account window was showing. */
  initialPreset?: Preset;
  initialRange?: { from: string; to: string };
}) {
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [custom, setCustom] = useState(() => initialRange ?? rangeFor("this-month", null));
  const paper = useRef<HTMLDivElement>(null);
  // The dealer's job numbers, which are the ones on their slips; ours only
  // where they gave none.
  const { jobs } = useRepair();
  const jobNo = (id: string) => { const d = jobs.find(j => j.id === id)?.dealerJobNo; return d ? `#${d}` : id; };

  const { from, to } = preset === "custom" ? custom : rangeFor(preset, account.firstChargeOn);
  const valid = from <= to;

  const s = useMemo(() => {
    const before = entries.filter(e => e.occurredOn < from);
    const inside = entries.filter(e => e.occurredOn >= from && e.occurredOn <= to);
    const upTo = entries.filter(e => e.occurredOn <= to);
    const opening = before.reduce((t, e) => t + signedEntry(e), 0);

    const groups = groupCreditEntries(inside).sort((a, b) =>
      a.occurredOn.localeCompare(b.occurredOn) || (a.entries[0]?.createdAt ?? "").localeCompare(b.entries[0]?.createdAt ?? ""));
    type Line = { g: CreditEntryGroup; debit: number; credit: number; balance: number };
    const lines = groups.reduce<Line[]>((acc, g) => {
      const delta = deltaOf(g);
      const balance = (acc.length ? acc[acc.length - 1].balance : opening) + delta;
      return [...acc, { g, debit: delta > 0 ? delta : 0, credit: delta < 0 ? -delta : 0, balance }];
    }, []);

    const sum = (k: CreditEntry["kind"]) => inside.filter(e => e.kind === k).reduce((t, e) => t + e.amount, 0);
    const charged = sum("Charge"), paid = sum("Payment"), refunds = sum("Refund"), writtenOff = sum("Write-off");
    const closing = upTo.reduce((t, e) => t + signedEntry(e), 0);
    const outstanding = openInvoices(upTo);
    // What is still owed on each invoice at the end of the period, for the red rows;
    // and the open ones from before the period, which sit in the opening balance.
    const owedOn = new Map(outstanding.filter(o => o.invoiceNo).map(o => [o.invoiceNo!, o.open]));
    const inPeriodInvoices = new Set(inside.map(e => e.invoiceNo).filter(Boolean));
    const carried = outstanding.filter(o => !o.invoiceNo || !inPeriodInvoices.has(o.invoiceNo));
    const owedTotal = outstanding.reduce((t, o) => t + o.open, 0);
    const totalDebit = lines.reduce((t, l) => t + l.debit, 0);
    const totalCredit = lines.reduce((t, l) => t + l.credit, 0);
    return { opening, lines, charged, paid, refunds, writtenOff, closing, outstanding, owedOn, carried, owedTotal, totalDebit, totalCredit };
  }, [entries, from, to]);

  const print = () => {
    if (!paper.current) return;
    // "Save as PDF" names the file after the main page's title, not the
    // frame's — so the page wears the statement's name while the dialog is
    // open, e.g. "Statement - Thirasara Max - 01 Sept 2026 to 30 Sept 2026".
    const fileName = `Statement - ${account.name.replace(/[\\/:*?"<>|]+/g, " ").trim()} - ${nice(from)} to ${nice(to)}`;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>@page{size:A4 portrait;margin:12mm}body{margin:0;font-family:${ff};-webkit-print-color-adjust:exact;print-color-adjust:exact}
      table{border-collapse:collapse;width:100%}tr{page-break-inside:avoid}thead{display:table-header-group}</style>
      </head><body>${paper.current.outerHTML}</body></html>`);
    doc.close();
    const go = () => {
      const pageTitle = document.title;
      document.title = fileName;
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      // print() blocks until the dialog closes in most browsers; the delay
      // covers the ones where it does not.
      setTimeout(() => { document.title = pageTitle; frame.remove(); }, 1500);
    };
    // Give the logo and the font a moment; print regardless after that.
    setTimeout(go, 500);
  };

  const exportCsv = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: (string | number)[][] = [
      ["Statement", account.name], ["Period", `${from} to ${to}`], [],
      ["Date", "Reference", "Description", "Debit (Rs.)", "Credit (Rs.)", "Balance (Rs.)"],
      [from, "", "Opening balance", "", "", Math.round(s.opening)],
      ...s.lines.map(l => [l.g.occurredOn, l.g.invoiceNo ?? "", describe(l.g, jobNo), l.debit ? Math.round(l.debit) : "", l.credit ? Math.round(l.credit) : "", Math.round(l.balance)]),
      [to, "", "Closing balance", "", "", Math.round(s.closing)],
    ];
    const blob = new Blob(["﻿" + rows.map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Statement-${account.name.replace(/[^\w]+/g, "-")}-${from}-to-${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // ── The page — inline styles only, so it prints exactly as shown ─────────
  const th: React.CSSProperties = { padding: "7px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#fff", background: "#d32f2f", textAlign: "left" };
  const td: React.CSSProperties = { padding: "6px 8px", fontSize: 11, color: "#111", borderBottom: "1px solid #e5e5e5", verticalAlign: "top" };
  const num: React.CSSProperties = { ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const box = (label: string, value: string, color = "#111") => (
    <div style={{ flex: 1, minWidth: 110, border: "1px solid #e2e2e2", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#777" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color, marginTop: 2 }}>Rs. {value}</div>
    </div>
  );

  const chip = (on: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-dim)" : "transparent",
    color: on ? "var(--accent)" : "var(--text-secondary)",
  });
  const dateBox: React.CSSProperties = { padding: "6px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12, fontFamily: ff };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="fade-up" style={{ width: "min(960px, 100%)", maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", fontFamily: ff }}>
        {/* Controls */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CalendarRange size={16} color="var(--accent)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Account statement — {account.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Pick the period, check it, then print or export.</div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={14} /></button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {PRESETS.map(p => <button key={p.id} onClick={() => { if (p.id === "custom") setCustom({ from, to }); setPreset(p.id); }} style={chip(preset === p.id)}>{p.label}</button>)}
            {preset === "custom" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                <input type="date" value={custom.from} max={custom.to} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} style={dateBox} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
                <input type="date" value={custom.to} min={custom.from} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} style={dateBox} />
              </span>
            )}
          </div>
        </div>

        {/* The page */}
        <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-secondary)", padding: 18 }}>
          {!valid ? (
            <p style={{ fontSize: 13, color: "var(--danger)", textAlign: "center", padding: 30 }}>The start date is after the end date.</p>
          ) : (
            <div ref={paper} style={{ background: "#fff", color: "#111", maxWidth: 794, margin: "0 auto", padding: "26px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", fontFamily: ff }}>
              {/* Letterhead */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, borderBottom: "3px solid #111", paddingBottom: 12 }}>
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${window.location.origin}${SHOP_DETAILS.logo}`} alt={SHOP_DETAILS.name} style={{ height: 42 }} />
                  <div style={{ fontSize: 10, color: "#555", marginTop: 6, lineHeight: 1.5 }}>
                    {SHOP_DETAILS.address}<br />{SHOP_DETAILS.phone} · {SHOP_DETAILS.email}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.04em" }}>STATEMENT</div>
                  <div style={{ fontSize: 10.5, color: "#d32f2f", fontWeight: 700, letterSpacing: "0.08em" }}>OF ACCOUNT</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>{nice(from)} — {nice(to)}</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Printed {nice(iso(new Date()))}</div>
                </div>
              </div>

              {/* Who */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, margin: "14px 0" }}>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#d32f2f", letterSpacing: "0.08em" }}>{account.holderKind.toUpperCase()}</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{account.name}</div>
                  <div style={{ fontSize: 11, color: "#444" }}>{[account.phone, account.email].filter(Boolean).join(" · ")}</div>
                  {account.address && <div style={{ fontSize: 11, color: "#444" }}>{account.address}</div>}
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: "#444", lineHeight: 1.6 }}>
                  <div>Account <b style={{ color: "#111" }}>{account.id.slice(0, 8).toUpperCase()}</b></div>
                  <div>Terms <b style={{ color: "#111" }}>{account.termsDays} days</b></div>
                </div>
              </div>

              {/* Summary */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {box("Opening balance", money(s.opening))}
                {box("Billed", money(s.charged))}
                {box("Paid", money(s.paid), "#15803d")}
                {(s.refunds > 0 || s.writtenOff > 0) && box("Refunds & write-offs", money(s.refunds + s.writtenOff), "#b45309")}
                {box("Closing balance", money(s.closing), s.closing > 0 ? "#d32f2f" : "#15803d")}
              </div>

              {/* One table. An invoice still unpaid at the end of the period is
                  shaded red, with what is still owed on it, so the reader sees
                  both the history and what is open without matching two lists. */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", fontSize: 9.5, color: "#777", marginBottom: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 2, background: UNPAID_BG, borderLeft: `3px solid ${UNPAID_EDGE}` }} />
                Unpaid at {nice(to)}
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 78 }}>Date</th>
                    <th style={th}>Description</th>
                    <th style={{ ...th, textAlign: "right", width: 86 }}>Debit</th>
                    <th style={{ ...th, textAlign: "right", width: 86 }}>Credit</th>
                    <th style={{ ...th, textAlign: "right", width: 96 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "#f7f7f7" }}>
                    <td style={td}>{nice(from)}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>Opening balance</div>
                      {/* Bills from before the period that are still open are
                          part of the opening balance — named here, not listed
                          again, so nothing is counted twice. */}
                      {s.carried.length > 0 && (
                        <div style={{ fontSize: 9.5, color: UNPAID_EDGE, marginTop: 2, lineHeight: 1.5 }}>
                          Includes unpaid from before: {s.carried.map(o => `${o.label} (Rs. ${money(o.open)})`).join(", ")}
                        </div>
                      )}
                    </td>
                    <td style={num} /><td style={num} />
                    <td style={{ ...num, fontWeight: 700 }}>{money(s.opening)}</td>
                  </tr>
                  {s.lines.length === 0 ? (
                    <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#888", padding: 18 }}>Nothing on this account in this period.</td></tr>
                  ) : s.lines.map(l => {
                    const owed = l.g.kind === "Charge" && l.g.invoiceNo ? s.owedOn.get(l.g.invoiceNo) : undefined;
                    const unpaid = owed !== undefined;
                    const cell = (x: React.CSSProperties): React.CSSProperties => unpaid ? { ...x, background: UNPAID_BG } : x;
                    return (
                      <tr key={l.g.key}>
                        <td style={cell({ ...td, borderLeft: unpaid ? `3px solid ${UNPAID_EDGE}` : "3px solid transparent" })}>{nice(l.g.occurredOn)}</td>
                        <td style={cell(td)}>
                          <div style={{ fontWeight: 600 }}>{describe(l.g, jobNo)}</div>
                          {l.g.kind === "Charge" && l.g.jobIds.length > 3 && <div style={{ fontSize: 9.5, color: "#777" }}>{l.g.jobIds.map(jobNo).join(", ")}</div>}
                          {l.g.kind === "Charge" && l.g.dueOn && <div style={{ fontSize: 9.5, color: "#777" }}>Due {nice(l.g.dueOn)}</div>}
                          {unpaid && (
                            <div style={{ fontSize: 9.5, fontWeight: 700, color: UNPAID_EDGE, marginTop: 1 }}>
                              {owed! < l.debit - 0.5 ? `Part paid · Rs. ${money(owed!)} still owed` : "Unpaid"}
                            </div>
                          )}
                        </td>
                        <td style={cell(num)}>{l.debit ? money(l.debit) : ""}</td>
                        <td style={cell({ ...num, color: "#15803d" })}>{l.credit ? money(l.credit) : ""}</td>
                        <td style={cell({ ...num, fontWeight: 600 })}>{money(l.balance)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#111" }}>
                    <td style={{ ...td, color: "#fff", borderBottom: "none" }}>{nice(to)}</td>
                    <td style={{ ...td, color: "#fff", fontWeight: 800, borderBottom: "none" }}>Closing balance</td>
                    <td style={{ ...num, color: "#fff", borderBottom: "none" }}>{money(s.totalDebit)}</td>
                    <td style={{ ...num, color: "#fff", borderBottom: "none" }}>{money(s.totalCredit)}</td>
                    <td style={{ ...num, color: "#fff", fontWeight: 800, borderBottom: "none" }}>{money(s.closing)}</td>
                  </tr>
                </tbody>
              </table>
              {s.outstanding.length > 0 && (
                <div style={{ fontSize: 10, color: "#555", marginTop: 6, textAlign: "right" }}>
                  {s.outstanding.length} unpaid invoice{s.outstanding.length === 1 ? "" : "s"} · Rs. {money(s.owedTotal)} still owed
                  {Math.abs(s.owedTotal - s.closing) > 1 && <> · the difference from the closing balance is money paid on account without naming an invoice</>}
                </div>
              )}

              <div style={{ marginTop: 22, paddingTop: 10, borderTop: "1px solid #e5e5e5", fontSize: 10, color: "#777", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span>Please pay to {SHOP_DETAILS.bankName} · {SHOP_DETAILS.bankAccountNumber} · {SHOP_DETAILS.bankAccountHolder}</span>
                <span>{SHOP_DETAILS.website}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
          <button onClick={exportCsv} disabled={!valid} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, cursor: valid ? "pointer" : "not-allowed", fontFamily: ff }}>
            <FileSpreadsheet size={14} /> Excel (CSV)
          </button>
          <button onClick={print} disabled={!valid} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: valid ? "var(--accent)" : "var(--border)", color: "var(--accent-fg)", fontSize: 12.5, fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", fontFamily: ff }}>
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
