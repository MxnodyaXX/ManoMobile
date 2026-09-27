"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, Search, PackageCheck, Truck, CheckCircle } from "lucide-react";
import type { SaleTx } from "@/cashier/contexts/SalesContext";
import { useSales } from "@/cashier/contexts/SalesContext";
import { useCashRegister } from "@/cashier/contexts/CashRegisterContext";
import { useDevices, type DeviceRecord } from "@/cashier/contexts/DevicesContext";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  replaceMobileDevice, fetchReplacements,
  type DeviceReplacement, type ReplacementDisposition,
} from "@/lib/inventory/devices";

/**
 * A phone sold on this invoice comes back faulty and the customer leaves with
 * a different one.
 *
 * The swap itself is one database call (replace_mobile_device): the new unit
 * is sold on the SAME invoice, and the returned one goes either back to stock
 * as a flagged customer return or to the "return to company" pile. What this
 * window adds around it is the money — a top-up the customer pays, receipted
 * on its own invoice, or a refund out of the drawer.
 */

const ff = "'Plus Jakarta Sans', sans-serif";
const fmt = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;

const REASONS = ["No power / dead", "Display fault", "Charging fault", "Network / signal fault", "Camera fault", "Speaker / mic fault"];

const input: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-secondary)",
  color: "var(--text-primary)", fontSize: 13, fontFamily: ff, outline: "none", boxSizing: "border-box",
};
const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--text-muted)", display: "block", marginBottom: 6, fontFamily: ff,
};
const section: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };

const deviceLine = (d: DeviceRecord) =>
  [d.storage, d.color].filter(Boolean).join(" · ");

export default function ReplaceDeviceModal({ tx, onClose }: { tx: SaleTx; onClose: () => void }) {
  const { devices, reload: reloadDevices } = useDevices();
  const { addSale } = useSales();
  const { addEntry } = useCashRegister();
  const { profile } = useAuth();

  const soldOnInvoice = devices.filter(d => d.status === "sold" && d.soldInvoiceNo === tx.invoiceNo);

  const [returnedId, setReturnedId]   = useState<number | null>(null);
  const [reason, setReason]           = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [disposition, setDisposition] = useState<ReplacementDisposition | "">("");
  const [query, setQuery]             = useState("");
  const [replacementId, setReplacementId] = useState<number | null>(null);
  const [price, setPrice]             = useState("");
  const [payBy, setPayBy]             = useState<"Cash" | "Card">("Cash");
  const [cardRef, setCardRef]         = useState("");
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [warning, setWarning]         = useState<string | null>(null);
  const [done, setDone]               = useState<DeviceReplacement | null>(null);
  const [history, setHistory]         = useState<DeviceReplacement[]>([]);

  // One device on the invoice — the usual case — needs no picking.
  const returnedChoice = returnedId ?? (soldOnInvoice.length === 1 ? soldOnInvoice[0].id : null);
  const returned = soldOnInvoice.find(d => d.id === returnedChoice) ?? null;
  const returnedPrice = returned?.soldPrice ?? 0;

  useEffect(() => {
    let live = true;
    fetchReplacements(tx.invoiceNo)
      .then(rows => { if (live) setHistory(rows); })
      .catch(() => { /* history is a courtesy; the swap does not depend on it */ });
    return () => { live = false; };
  }, [tx.invoiceNo, done]);

  const q = query.trim().toLowerCase();
  const returnedName = returned?.name;
  const onShelf = devices
      .filter(d => (d.status === "available" || d.status === "reserved") && d.id !== returnedChoice)
      .filter(d => !q || [d.imei, d.imei2, d.serialNumber, d.name, d.brand, d.modelNumber]
        .some(v => v.toLowerCase().includes(q)))
      // The same model first — a like-for-like swap is the common case.
      .sort((a, b) => Number(b.name === returnedName) - Number(a.name === returnedName) || a.name.localeCompare(b.name))
      .slice(0, 50);

  const replacement = devices.find(d => d.id === replacementId) ?? null;
  // Like-for-like by default: the customer paid for a phone and gets a phone.
  const replacementPrice = price.trim() === "" ? returnedPrice : Math.max(0, parseFloat(price) || 0);
  const difference = Math.round((replacementPrice - returnedPrice) * 100) / 100;
  const finalReason = reason === "Other" ? otherReason.trim() : reason;
  const belowMin = !!replacement && replacement.minSellingPrice > 0 && replacementPrice < replacement.minSellingPrice;

  const ready = !!returned && !!replacement && !!finalReason && !!disposition &&
    (difference <= 0 || payBy === "Cash" || cardRef.trim() !== "");

  const confirm = async () => {
    if (!ready || busy || !returned || !replacement || !disposition) return;
    setBusy(true);
    setError(null);
    try {
      const rec = await replaceMobileDevice({
        invoiceNo: tx.invoiceNo,
        returnedId: returned.id,
        replacementId: replacement.id,
        reason: finalReason,
        disposition,
        replacementPrice,
      });
      void reloadDevices();

      if (rec.priceDifference > 0 && rec.topupInvoiceNo) {
        const extra = rec.priceDifference;
        if (payBy === "Cash") addEntry("in", `Replacement top-up — ${rec.topupInvoiceNo} (${tx.invoiceNo})`, extra);
        const stored = await addSale({
          invoiceNo: rec.topupInvoiceNo,
          date: new Date().toISOString().slice(0, 10),
          customer: tx.customer,
          category: "Mobile",
          items: `Replacement top-up for ${tx.invoiceNo}: ${returned.name} → ${replacement.name}`,
          total: extra,
          subtotal: extra,
          paid: extra,
          status: "Paid",
          paymentMethod: payBy,
          cashAmount: payBy === "Cash" ? extra : undefined,
          cardAmount: payBy === "Card" ? extra : undefined,
          cardRef: payBy === "Card" ? cardRef.trim() : undefined,
          cashier: profile?.fullName?.trim() || undefined,
        }, {
          customerPhone: tx.customerPhone ?? null,
          saleItems: [{
            kind: "other",
            referenceId: replacement.imei,
            description: `Price difference — ${returned.name} (${returned.imei}) replaced with ${replacement.name} (${replacement.imei})`,
            qty: 1,
            unitPrice: extra,
            lineTotal: extra,
          }],
        });
        if (!stored) setWarning(`The swap is done, but the top-up invoice ${rec.topupInvoiceNo} could not be saved to the sales ledger — tell an Admin.`);
      } else if (rec.priceDifference < 0) {
        addEntry("out", `Replacement refund — ${tx.invoiceNo}`, -rec.priceDifference);
      }

      setDone(rec);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const choice = (active: boolean): React.CSSProperties => ({
    padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff,
    border: `1px solid ${active ? "var(--border-active)" : "var(--border)"}`,
    background: active ? "var(--accent-dim)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-secondary)",
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={busy ? undefined : onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: 760, maxHeight: "calc(100vh - 40px)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, fontFamily: ff,
      }}>
        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Replace Device</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {tx.invoiceNo} · {tx.customer}{tx.customerPhone ? ` · ${tx.customerPhone}` : ""} · sold {tx.date}
            </div>
          </div>
          <button onClick={onClose} disabled={busy} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        </div>

        {done ? (
          <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
            <CheckCircle size={44} color="#16a34a" />
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Device replaced</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <span style={{ fontFamily: "monospace" }}>{done.returnedImei}</span> came back and{" "}
              {done.disposition === "resell" ? "is back in stock as a customer return" : "is set aside to return to the company"}.<br />
              <span style={{ fontFamily: "monospace" }}>{done.replacementImei}</span> is now sold on {done.invoiceNo}.
              {done.priceDifference > 0 && <><br />Customer paid {fmt(done.priceDifference)} ({payBy}) — invoice {done.topupInvoiceNo}.</>}
              {done.priceDifference < 0 && <><br />Refund {fmt(-done.priceDifference)} to the customer from the cash drawer.</>}
            </div>
            {warning && (
              <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", fontSize: 12.5, color: "#dc2626" }}>{warning}</div>
            )}
            <button onClick={onClose} style={{ marginTop: 6, padding: "10px 28px", borderRadius: 9, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: ff }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ padding: "18px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>

              {/* 1 — which phone came back */}
              <div style={section}>
                <span style={label}>1 · Device coming back</span>
                {soldOnInvoice.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "10px 12px", borderRadius: 9, border: "1px dashed var(--border)" }}>
                    No device is recorded as sold on {tx.invoiceNo}. Sales made before device tracking cannot be replaced here.
                  </div>
                ) : soldOnInvoice.map(d => (
                  <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, cursor: "pointer", border: `1px solid ${returnedChoice === d.id ? "var(--border-active)" : "var(--border)"}`, background: returnedChoice === d.id ? "var(--accent-dim)" : "transparent" }}>
                    <input type="radio" checked={returnedChoice === d.id} onChange={() => setReturnedId(d.id)} style={{ accentColor: "var(--accent)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{d.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}><span style={{ fontFamily: "monospace" }}>{d.imei}</span>{deviceLine(d) && ` · ${deviceLine(d)}`}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(d.soldPrice ?? 0)}</div>
                  </label>
                ))}
              </div>

              {/* 2 — why */}
              <div style={section}>
                <span style={label}>2 · What is wrong with it? *</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[...REASONS, "Other"].map(r => (
                    <button key={r} onClick={() => setReason(r)} style={choice(reason === r)}>{r}</button>
                  ))}
                </div>
                {reason === "Other" && (
                  <input value={otherReason} onChange={e => setOtherReason(e.target.value)} placeholder="Describe the fault…" autoFocus style={input} />
                )}
              </div>

              {/* 3 — where the returned phone goes */}
              <div style={section}>
                <span style={label}>3 · What happens to the returned phone? *</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([
                    ["resell", PackageCheck, "Keep for resale", "Goes back into stock, flagged as a customer return."],
                    ["return_to_company", Truck, "Return to company", "Set aside to send back to the supplier. Not sellable."],
                  ] as const).map(([v, Icon, title, sub]) => (
                    <button key={v} onClick={() => setDisposition(v)} style={{ ...choice(disposition === v), display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", padding: "12px" }}>
                      <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{title}</span>
                        <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", marginTop: 2 }}>{sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 — the phone going out */}
              <div style={section}>
                <span style={label}>4 · Replacement device *</span>
                <div style={{ position: "relative" }}>
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Scan IMEI or search name…" style={{ ...input, paddingLeft: 32 }} />
                  <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                </div>
                <div style={{ maxHeight: 190, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 9 }}>
                  {onShelf.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>No device on the shelf matches</div>
                  ) : onShelf.map(d => (
                    <div key={d.id} onClick={() => setReplacementId(d.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", background: replacementId === d.id ? "var(--accent-dim)" : "transparent" }}>
                      <input type="radio" readOnly checked={replacementId === d.id} style={{ accentColor: "var(--accent)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
                          {d.name}
                          {d.name === returned?.name && <span style={{ fontSize: 10.5, color: "#16a34a", fontWeight: 700 }}> · same model</span>}
                          {d.returnedFromInvoice && <span style={{ fontSize: 10.5, color: "#ef4444", fontWeight: 700 }}> · customer return</span>}
                          {d.status === "reserved" && <span style={{ fontSize: 10.5, color: "#f59e0b", fontWeight: 700 }}> · reserved</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}><span style={{ fontFamily: "monospace" }}>{d.imei}</span>{deviceLine(d) && ` · ${deviceLine(d)}`}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{fmt(d.suggestedPrice)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5 — money */}
              {returned && replacement && (
                <div style={{ ...section, padding: 14, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-secondary)" }}>
                    <span>{returned.name} <b style={{ color: "var(--text-primary)" }}>{fmt(returnedPrice)}</b></span>
                    <ArrowRight size={14} />
                    <span>{replacement.name}</span>
                  </div>
                  <div>
                    <span style={label}>Replacement price (Rs.)</span>
                    <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder={returnedPrice.toString()} style={{ ...input, fontWeight: 700, background: "var(--bg-card)" }} />
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      Defaults to what the customer paid for the returned phone. Change it only if they are taking a dearer or cheaper model.
                    </div>
                    {belowMin && (
                      <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                        Below this unit&apos;s minimum selling price of {fmt(replacement.minSellingPrice)} — allowed for a replacement, but check it is intended.
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 800, color: difference > 0 ? "#16a34a" : difference < 0 ? "#dc2626" : "var(--text-primary)" }}>
                    {difference > 0 ? `Customer pays ${fmt(difference)}` : difference < 0 ? `Refund ${fmt(-difference)} to the customer (cash)` : "No charge — like-for-like replacement"}
                  </div>

                  {difference > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["Cash", "Card"] as const).map(m => (
                          <button key={m} onClick={() => setPayBy(m)} style={{ ...choice(payBy === m), flex: 1 }}>{m}</button>
                        ))}
                      </div>
                      {payBy === "Card" && (
                        <input value={cardRef} onChange={e => setCardRef(e.target.value)} placeholder="Card reference number *" style={{ ...input, fontFamily: "monospace", background: "var(--bg-card)" }} />
                      )}
                    </div>
                  )}
                </div>
              )}

              {history.length > 0 && (
                <div style={section}>
                  <span style={label}>Earlier replacements on this invoice</span>
                  {history.map(h => (
                    <div key={h.id} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                      {new Date(h.createdAt).toLocaleDateString("en-LK")} · <span style={{ fontFamily: "monospace" }}>{h.returnedImei}</span> → <span style={{ fontFamily: "monospace" }}>{h.replacementImei}</span>
                      {" "}· {h.reason} · {h.disposition === "resell" ? "kept for resale" : "return to company"}
                      {h.priceDifference !== 0 && ` · ${h.priceDifference > 0 ? "+" : "−"}${fmt(Math.abs(h.priceDifference))}`}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", fontSize: 12.5, color: "#dc2626" }}>
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
              <button onClick={onClose} disabled={busy} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>
                Cancel
              </button>
              <button onClick={confirm} disabled={!ready || busy} style={{
                flex: 2, padding: 10, borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700, fontFamily: ff,
                background: ready && !busy ? "var(--accent)" : "var(--border)",
                color: ready && !busy ? "var(--accent-fg)" : "var(--text-muted)",
                cursor: ready && !busy ? "pointer" : "not-allowed",
              }}>
                {busy ? "Replacing…"
                  : !returned ? "Choose the device coming back"
                  : !finalReason ? "Say what is wrong with it"
                  : !disposition ? "Choose where the returned phone goes"
                  : !replacement ? "Choose the replacement device"
                  : difference > 0 && payBy === "Card" && !cardRef.trim() ? "Enter card reference"
                  : "Confirm Replacement"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
