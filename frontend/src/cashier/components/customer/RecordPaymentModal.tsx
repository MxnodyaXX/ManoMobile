"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Wallet, Banknote, Landmark, CreditCard, FileCheck, Globe, ListOrdered, ListChecks } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useToast } from "@/lib/ui/toast";
import { sendSms } from "@/lib/sms/client";
import { renderCreditPaymentRecorded, CREDIT_PAYMENT_PURPOSE } from "@/lib/sms/creditReminders";
import {
  useCreditEntries, recordPayment, recordAllocatedPayment, type CreditAccount,
} from "@/lib/credit/api";
import { openInvoices, allocatePayment, type OpenInvoice } from "@/lib/credit/allocation";

/**
 * Record a payment against a credit account — and show, invoice by invoice,
 * what it settles.
 *
 * Two ways to apply it:
 *   * Oldest first — the default, the way a statement reads "paid on account";
 *   * Choose invoices — tick the ones the dealer says this money is for. The
 *     amount follows the ticked total; anything above it still settles the
 *     remaining invoices oldest first, so no money is left unapplied.
 *
 * The payment is booked as one Payment entry per invoice it touches (see
 * recordAllocatedPayment), so each invoice's balance drops with it.
 */

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const day = (iso: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso)
    .toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });

const METHODS = [
  { id: "Cash", icon: Banknote },
  { id: "Bank Transfer", icon: Landmark },
  { id: "Card", icon: CreditCard },
  { id: "Cheque", icon: FileCheck },
  { id: "Online", icon: Globe },
] as const;

const cap: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--text-muted)", fontFamily: ff,
};

export default function RecordPaymentModal({ account, onClose, onDone }: {
  account: CreditAccount;
  onClose: () => void;
  onDone: () => void;
}) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const { entries, loading } = useCreditEntries(account.id);

  const [mode, setMode] = useState<"auto" | "pick">("auto");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useMemo(() => openInvoices(entries), [entries]);
  const openTotal = open.reduce((s, o) => s + o.open, 0);
  const pickedTotal = open.filter(o => picked.has(o.key)).reduce((s, o) => s + o.open, 0);

  const amt = Math.max(0, parseFloat(amount) || 0);
  const over = amt > account.balance + 0.005;
  const usable = over ? 0 : amt;

  // Ticked invoices take the money first (oldest of them first); the rest
  // follow oldest first. In "auto" this is just oldest first.
  const order: OpenInvoice[] = mode === "pick"
    ? [...open.filter(o => picked.has(o.key)), ...open.filter(o => !picked.has(o.key))]
    : open;
  const alloc = allocatePayment(order, usable);
  const byKey = new Map(alloc.map(a => [a.invoice.key, a]));
  const settling = alloc.filter(a => a.applied > 0);
  const fully = settling.filter(a => a.left <= 0.005).length;
  const remaining = alloc.filter(a => a.left > 0.005);
  const allocated = settling.reduce((s, a) => s + a.applied, 0);
  const newBal = Math.max(0, account.balance - usable);
  const canSave = usable > 0 && !busy;
  const settledPct = account.totalCharged > 0 ? Math.min(100, ((account.totalCharged - account.balance) / account.totalCharged) * 100) : 0;

  const toggle = (key: string) => {
    const next = new Set(picked);
    if (next.has(key)) next.delete(key); else next.add(key);
    setPicked(next);
    // The amount follows the ticked total — the usual case is "pay these".
    const total = open.filter(o => next.has(o.key)).reduce((s, o) => s + o.open, 0);
    setAmount(total > 0 ? String(Math.round(total * 100) / 100) : "");
  };
  const toggleAll = () => {
    const all = picked.size === open.length ? new Set<string>() : new Set(open.map(o => o.key));
    setPicked(all);
    const total = open.filter(o => all.has(o.key)).reduce((s, o) => s + o.open, 0);
    setAmount(total > 0 ? String(Math.round(total * 100) / 100) : "");
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true); setError(null);
    try {
      const unallocated = Math.round((usable - allocated) * 100) / 100;
      if (settling.length > 0) {
        await recordAllocatedPayment(account.id, [
          ...settling.map(a => ({ invoiceNo: a.invoice.invoiceNo, amount: a.applied })),
          ...(unallocated > 0.005 ? [{ invoiceNo: null, amount: unallocated }] : []),
        ], method, note);
      } else {
        await recordPayment(account.id, usable, method, note);
      }
      if (account.phone) {
        void sendSms({
          to: account.phone,
          message: renderCreditPaymentRecorded({ name: account.name }, usable, newBal),
          accountId: account.id, purpose: CREDIT_PAYMENT_PURPOSE,
        }).catch(() => {});
      }
      toast.success(`${rs(usable)} recorded against ${account.name}${settling.length > 1 ? ` · ${settling.length} invoices` : ""}`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  const initials = account.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(8,10,14,0.62)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{
        width: "min(980px, calc(100vw - 24px))", maxHeight: "calc(100vh - 32px)",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18,
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: ff,
      }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", color: "var(--accent)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {initials || <Wallet size={16} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Record payment</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {account.name} · {account.holderKind}{account.phone ? ` · ${account.phone}` : ""}
            </div>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Body: payment | invoices ───────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, flex: 1, overflow: isMobile ? "auto" : "hidden" }}>

          {/* Left — the payment */}
          <div style={{ width: isMobile ? "100%" : 360, flexShrink: 0, padding: 20, display: "flex", flexDirection: "column", gap: 16, borderRight: isMobile ? "none" : "1px solid var(--border)", overflowY: isMobile ? "visible" : "auto" }}>

            {/* Balance */}
            <div style={{ borderRadius: 14, padding: 16, background: "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.03))", border: "1px solid rgba(239,68,68,0.22)" }}>
              <div style={cap}>Outstanding</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--danger)", letterSpacing: "-0.02em", marginTop: 2 }}>{rs(account.balance)}</div>
              <div style={{ height: 6, borderRadius: 99, background: "var(--border)", marginTop: 12, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${settledPct}%`, background: "var(--success)", borderRadius: 99 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11.5, color: "var(--text-muted)" }}>
                <span>Charged {rs(account.totalCharged)}</span>
                <span>Paid {rs(account.totalPaid)}</span>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label style={{ ...cap, display: "block", marginBottom: 6 }}>Amount received</label>
              <div style={{ display: "flex", alignItems: "center", borderRadius: 12, border: `1.5px solid ${over ? "var(--danger)" : "var(--border)"}`, background: "var(--bg-primary)", padding: "0 14px" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)" }}>Rs.</span>
                <input
                  type="number" min={0} step="0.01" autoFocus
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 24, fontWeight: 800, color: "var(--text-primary)", padding: "10px 10px", fontFamily: ff, minWidth: 0 }}
                />
              </div>
              {over && <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 5 }}>More than the outstanding balance of {rs(account.balance)}</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <Chip onClick={() => setAmount(String(account.balance))}>Full balance</Chip>
                {mode === "pick" && pickedTotal > 0 && <Chip onClick={() => setAmount(String(Math.round(pickedTotal * 100) / 100))}>Selected · {rs(pickedTotal)}</Chip>}
                {open[0] && mode === "auto" && <Chip onClick={() => setAmount(String(open[0].open))}>Oldest invoice · {rs(open[0].open)}</Chip>}
              </div>
            </div>

            {/* Method */}
            <div>
              <div style={{ ...cap, marginBottom: 6 }}>Method</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {METHODS.map(({ id, icon: Icon }) => {
                  const on = method === id;
                  return (
                    <button key={id} onClick={() => setMethod(id)} style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "9px 4px", borderRadius: 10, cursor: "pointer",
                      border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                      background: on ? "var(--accent-dim)" : "transparent",
                      color: on ? "var(--accent)" : "var(--text-secondary)", fontSize: 11.5, fontWeight: 600, fontFamily: ff,
                    }}>
                      <Icon size={15} />
                      {id}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note */}
            <div>
              <label style={{ ...cap, display: "block", marginBottom: 6 }}>Note</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Reference, cheque or slip number…" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: ff }} />
            </div>

            {/* Result */}
            {usable > 0 && (
              <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                <Row label="Paying now" value={rs(usable)} strong />
                <Row label={`Invoices settled in full`} value={String(fully)} />
                {settling.length > fully && <Row label="Invoice part-paid" value="1" />}
                <Row label={`Invoices still open`} value={String(remaining.length)} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", background: newBal <= 0.005 ? "rgba(34,197,94,0.10)" : "var(--bg-secondary)" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)" }}>{newBal <= 0.005 ? "Account fully settled" : "Balance after payment"}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: newBal <= 0.005 ? "var(--success)" : "var(--text-primary)" }}>{newBal <= 0.005 ? "✓ Rs. 0" : rs(newBal)}</span>
                </div>
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: "var(--danger)", lineHeight: 1.5 }}>{error}</div>}
          </div>

          {/* Right — the invoices */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: isMobile ? 360 : 0 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>Open invoices</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{open.length} invoice{open.length === 1 ? "" : "s"} · {rs(openTotal)}</div>
              </div>
              {/* Segmented: how the money is applied */}
              <div style={{ marginLeft: "auto", display: "flex", padding: 3, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                {([["auto", "Oldest first", ListOrdered], ["pick", "Choose invoices", ListChecks]] as const).map(([id, label, Icon]) => {
                  const on = mode === id;
                  return (
                    <button key={id} onClick={() => { setMode(id); if (id === "auto") setPicked(new Set()); }} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: on ? "var(--bg-card)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                      color: on ? "var(--text-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 700, fontFamily: ff,
                    }}>
                      <Icon size={13} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column heads */}
            <div style={{ display: "grid", gridTemplateColumns: mode === "pick" ? "28px 1fr 110px 140px" : "1fr 110px 140px", gap: 10, padding: "9px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              {mode === "pick" && (
                <input type="checkbox" checked={open.length > 0 && picked.size === open.length} onChange={toggleAll} style={{ accentColor: "var(--accent)", cursor: "pointer" }} aria-label="Select all" />
              )}
              <span style={cap}>Invoice</span>
              <span style={{ ...cap, textAlign: "right" }}>Owed</span>
              <span style={{ ...cap, textAlign: "right" }}>This payment</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Loading invoices…</div>
              ) : open.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>No open invoices on this account.</div>
              ) : open.map(o => {
                const a = byKey.get(o.key);
                const applied = a?.applied ?? 0;
                const full = applied > 0 && (a?.left ?? 0) <= 0.005;
                const part = applied > 0 && !full;
                const pct = o.open > 0 ? Math.min(100, (applied / o.open) * 100) : 0;
                const ticked = picked.has(o.key);
                return (
                  <div
                    key={o.key}
                    onClick={mode === "pick" ? () => toggle(o.key) : undefined}
                    style={{
                      display: "grid", gridTemplateColumns: mode === "pick" ? "28px 1fr 110px 140px" : "1fr 110px 140px", gap: 10, alignItems: "center",
                      padding: "10px 18px", borderBottom: "1px solid var(--border)", cursor: mode === "pick" ? "pointer" : "default",
                      background: full ? "rgba(34,197,94,0.06)" : part ? "rgba(245,158,11,0.06)" : ticked ? "var(--accent-dim)" : "transparent",
                    }}
                  >
                    {mode === "pick" && (
                      <input type="checkbox" checked={ticked} onChange={() => toggle(o.key)} onClick={e => e.stopPropagation()} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                        {full && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(34,197,94,0.14)", color: "var(--success)" }}><Check size={10} strokeWidth={3} /> Settled</span>}
                        {part && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,0.16)", color: "#d97706" }}>{rs(a?.left ?? 0)} left</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>
                        {day(o.date)}{o.charged !== o.open ? ` · billed ${rs(o.charged)}` : ""}
                      </div>
                      {/* How much of what is owed this payment covers */}
                      <div style={{ height: 4, borderRadius: 99, background: "var(--border)", marginTop: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: full ? "var(--success)" : "#f59e0b", borderRadius: 99, transition: "width .2s" }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "right" }}>{rs(o.open)}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, textAlign: "right", color: applied > 0 ? (full ? "var(--success)" : "#d97706") : "var(--text-muted)" }}>
                      {applied > 0 ? rs(applied) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Totals strip */}
            {open.length > 0 && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "11px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", fontSize: 12.5 }}>
                <span style={{ color: "var(--text-muted)" }}>Settling <b style={{ color: "var(--success)" }}>{settling.length}</b></span>
                <span style={{ color: "var(--text-muted)" }}>Still open <b style={{ color: "var(--text-primary)" }}>{remaining.length}</b> · <b style={{ color: "var(--text-primary)" }}>{rs(remaining.reduce((s, a) => s + a.left, 0))}</b></span>
                {mode === "pick" && picked.size > 0 && usable > pickedTotal + 0.005 && (
                  <span style={{ color: "#d97706" }}>Extra {rs(usable - pickedTotal)} goes to the oldest other invoices</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>
            {mode === "auto" ? "Applied to the oldest invoices first." : "Applied to the ticked invoices first."}
          </span>
          <button onClick={onClose} disabled={busy} style={{ padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>
            Cancel
          </button>
          <button onClick={save} disabled={!canSave} style={{
            padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", fontFamily: ff,
            background: canSave ? "var(--accent)" : "var(--border)", color: canSave ? "var(--accent-fg)" : "var(--text-muted)",
            cursor: canSave ? "pointer" : "not-allowed", boxShadow: canSave ? "0 6px 18px rgba(0,0,0,0.18)" : "none",
          }}>
            {busy ? "Recording…" : usable > 0 ? `Record ${rs(usable)}${settling.length > 1 ? ` · ${settling.length} invoices` : ""}` : "Enter an amount"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "5px 10px", borderRadius: 99, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: ff }}>
      {children}
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 700, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
