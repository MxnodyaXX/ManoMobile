"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Printer, FileText, AlertCircle, Store } from "lucide-react";
import { fetchSaleByInvoiceNo } from "@/lib/sales/api";
import type { SaleExtras } from "@/lib/sales/api";
import type { SaleTx } from "@/cashier/contexts/SalesContext";
import { useRepair } from "@/cashier/contexts/RepairContext";

/**
 * The bill behind a number.
 *
 * A credit charge says Rs. 1,050 is owed and names INV-000123. This is what
 * INV-000123 actually was: the date, who it was for, what was on it, what was
 * paid and which repair jobs it covered.
 *
 * It reads the stored sale rather than re-deriving anything from the jobs. The
 * jobs can be edited afterwards — an estimate revised, a status changed — and
 * an invoice is a record of what was billed on the day, not a live view of the
 * work. The job list is looked up only for the device names.
 */

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

export default function InvoiceDetail({ invoiceNo, onClose }: {
  invoiceNo: string;
  onClose: () => void;
}) {
  const { jobs } = useRepair();
  const [sale, setSale] = useState<(SaleTx & SaleExtras) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const found = await fetchSaleByInvoiceNo(invoiceNo);
        if (!active) return;
        setSale(found);
        setState(found ? "ready" : "missing");
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    })();
    return () => { active = false; };
  }, [invoiceNo]);

  const covered: { id: string; job: (typeof jobs)[number] | undefined }[] =
    (sale?.jobIds ?? []).map((id: string) => ({
      id,
      job: jobs.find(j => j.id === id),
    }));

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "7px 0" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 12.5, fontWeight: strong ? 800 : 600, color: "var(--text-primary)", fontFamily: ff, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(560px, calc(100vw - 24px))", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={14} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{invoiceNo}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
                {sale ? `${sale.category} · ${sale.date}` : "Invoice"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {state === "ready" && (
              <button onClick={() => window.print()} title="Print"
                style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Printer size={13} />
              </button>
            )}
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

          {state === "loading" && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff }}>Loading invoice…</p>
          )}

          {state === "error" && (
            <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.3)" }}>
              <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: ff }}>{error}</p>
            </div>
          )}

          {/* The number exists on the charge but no sale row carries it. That
              means the invoice was issued before the sales ledger existed —
              worth saying plainly rather than showing an empty invoice. */}
          {state === "missing" && (
            <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
              <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: ff }}>
                No stored sale carries {invoiceNo}. It was issued before the sales ledger existed,
                so only the credit charge remains as a record of it.
              </p>
            </div>
          )}

          {state === "ready" && sale && (
            <>
              <div style={{ padding: "12px 14px", borderRadius: 11, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                {row("Billed to", sale.customer)}
                {sale.customerPhone && row("Phone", sale.customerPhone)}
                {row("Date", sale.date)}
                {sale.cashier && row("Cashier", sale.cashier)}
                {row("Payment", (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    {sale.creditAccountId && <Store size={11} style={{ color: "#fbbf24" }} />}
                    {sale.paymentMethod ?? "—"}
                  </span>
                ))}
                {row("Status", sale.status)}
              </div>

              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: ff, marginBottom: 8 }}>
                  On this invoice
                </p>

                {covered.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {covered.map(({ id, job }) => (
                      <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 12px", borderRadius: 9, background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>
                            {job ? `${job.brand} ${job.model}`.trim() : "Repair job"}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{id}</p>
                        </div>
                        {job && (
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, flexShrink: 0 }}>
                            {rs(job.estimatedCost)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.55 }}>
                    {sale.items || "—"}
                  </p>
                )}
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 11, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                {sale.discountPct != null && row("Discount", `${sale.discountPct}%`)}
                {sale.taxAmount != null && row("Tax", rs(sale.taxAmount))}
                {row("Invoice total", rs(sale.total), true)}
                {sale.status === "Returned" && sale.returnedAmount != null && (
                  row("Returned", rs(sale.returnedAmount))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
