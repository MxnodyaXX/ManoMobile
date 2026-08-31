"use client";

import { Fragment, useState } from "react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { createPortal } from "react-dom";
import {
  Search, CreditCard, AlertCircle, CheckCircle,
  X, DollarSign, TrendingDown, Wallet, Store,
  History, Plus, Sparkles, Loader2, Undo2, FileText, ChevronDown,
} from "lucide-react";
import {
  useCreditAccounts, useCreditEntries, openCreditAccount, recordPayment, writeOff,
  groupCreditEntries, STATUS_COLOURS, isOverLimit,
  type CreditAccount, type CreditStatus, type HolderKind,
} from "@/lib/credit/api";
import InvoiceDetail from "@/cashier/components/sales/InvoiceDetail";
import { useInvoiceCategories } from "@/lib/sales/api";
import type { TxCategory } from "@/cashier/contexts/SalesContext";

/**
 * What a credit charge came from, in the words the sale screens use.
 *
 * An invoice number on its own does not tell somebody chasing a balance whether
 * it was a repair, a phone or a case — and those are settled and disputed in
 * completely different ways.
 */
const SOURCE_LABEL: Record<TxCategory, string> = {
  Repair: "Repairs",
  Accessories: "Accessories",
  Mobile: "Mobile Sales",
  Others: "Other Sales",
};
import { useMyPermissions } from "@/lib/settings/staffRules";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useToast } from "@/lib/ui/toast";

/**
 * Credit accounts — who owes the shop money.
 *
 * Both kinds live here on purpose. A walk-in who took their phone before
 * settling and a dealer running a month's work on account are the same
 * question — how much is out, and how old is it — and splitting them across two
 * screens would mean the shop never sees one total.
 *
 * Everything is stored: see lib/credit/api.ts and migration 20260901000010.
 */

const statusConfig: Record<CreditStatus, { color: string; bg: string; border: string; icon: typeof CreditCard }> = {
  Active:  { ...STATUS_COLOURS.Active,  icon: CreditCard },
  Overdue: { ...STATUS_COLOURS.Overdue, icon: AlertCircle },
  Settled: { ...STATUS_COLOURS.Settled, icon: CheckCircle },
};

const ff = "'Plus Jakarta Sans', sans-serif";

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: 5, fontFamily: ff,
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 12, outline: "none",
  fontFamily: ff, boxSizing: "border-box",
};

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

function Modal({ children, onClose, width = 480 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: `min(${width}px, calc(100vw - 24px))`, maxHeight: "calc(100vh - 40px)", boxShadow: "0 24px 64px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ModalHead({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{title}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>
      </div>
      <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Record Payment ───────────────────────────────────────────────────────────

function RecordPaymentModal({ account, onClose, onDone }: {
  account: CreditAccount;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amt = parseFloat(amount) || 0;
  const over = amt > account.balance;
  const newBal = Math.max(0, account.balance - amt);
  const canSave = amt > 0 && !over && !busy;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await recordPayment(account.id, amt, method, note);
      toast.success(`${rs(amt)} recorded against ${account.name}`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHead title="Record Payment" sub={`${account.name} · ${account.holderKind}`} onClose={onClose} />

      <div style={{ margin: "14px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Total Charged", val: rs(account.totalCharged), color: "var(--text-primary)" },
          { label: "Total Paid",    val: rs(account.totalPaid),    color: "#4ade80" },
          { label: "Balance Due",   val: rs(account.balance),      color: "#f87171" },
        ].map(r => (
          <div key={r.label} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: ff, marginBottom: 4 }}>{r.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.val}</p>
          </div>
        ))}
      </div>

      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelSt}>Payment Amount (Rs.)</label>
            <input
              type="number" min={1} step="0.01" autoFocus
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`Max ${rs(account.balance)}`}
              style={{ ...inputSt, border: over ? "1px solid #f87171" : "1px solid var(--border)" }}
            />
            {over && <p style={{ fontSize: 10.5, color: "#f87171", marginTop: 4 }}>More than the outstanding balance</p>}
          </div>
          <div>
            <label style={labelSt}>Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
              {["Cash", "Bank Transfer", "Card", "Cheque", "Online"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={labelSt}>Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Reference, cheque number…" style={inputSt} />
        </div>

        {/* Who recorded it used to be a free-text box anyone could type any name
            into. It is the signed-in person now, taken from the session. */}
        {amt > 0 && !over && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 9, background: newBal === 0 ? "rgba(74,222,128,0.07)" : "rgba(96,165,250,0.07)", border: `1px solid ${newBal === 0 ? "rgba(74,222,128,0.3)" : "rgba(96,165,250,0.25)"}` }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>
              {newBal === 0 ? "Account will be fully settled" : "Remaining balance after payment"}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: newBal === 0 ? "#4ade80" : "#60a5fa" }}>
              {newBal === 0 ? "SETTLED ✓" : rs(newBal)}
            </span>
          </div>
        )}

        {error && (
          <p style={{ fontSize: 11.5, color: "#f87171", lineHeight: 1.5, fontFamily: ff }}>{error}</p>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
        <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
        <button onClick={save} disabled={!canSave}
          style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.45, fontFamily: ff }}>
          {busy ? "Recording…" : "Record Payment"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Write off ────────────────────────────────────────────────────────────────

function WriteOffModal({ account, onClose, onDone }: {
  account: CreditAccount;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(Math.round(account.balance)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amt = parseFloat(amount) || 0;
  const canSave = amt > 0 && amt <= account.balance && note.trim() !== "" && !busy;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await writeOff(account.id, amt, note);
      toast.success(`${rs(amt)} written off ${account.name}`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={440}>
      <ModalHead title="Write Off Balance" sub={`${account.name} · ${rs(account.balance)} outstanding`} onClose={onClose} />
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "11px 13px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: ff }}>
            A write-off clears the balance without any money coming in. It is recorded separately from
            payments on purpose — folded together, the day&apos;s takings would include money nobody paid.
          </p>
        </div>
        <div>
          <label style={labelSt}>Amount to write off (Rs.)</label>
          <input type="number" min={1} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={inputSt} />
        </div>
        <div>
          <label style={labelSt}>Reason *</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Why is this being written off?" style={inputSt} />
        </div>
        {error && <p style={{ fontSize: 11.5, color: "#f87171", lineHeight: 1.5, fontFamily: ff }}>{error}</p>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
        <button onClick={save} disabled={!canSave}
          style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid #fbbf24", background: "rgba(251,191,36,0.15)", color: "#fbbf24", cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.45, fontFamily: ff }}>
          {busy ? "Writing off…" : "Write Off"}
        </button>
      </div>
    </Modal>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

/**
 * One account's ledger, as a list.
 *
 * It was a modal. It is a list because it is now opened from inside the
 * accounts table — expanding a row shows the history under it, so the balance
 * on the row and the entries that add up to it are on screen together. A modal
 * covered the very table somebody was comparing it against.
 */
function CreditHistoryList({ account }: { account: CreditAccount }) {
  const { entries, loading, error } = useCreditEntries(account.id);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState<string | null>(null);

  /**
   * One row per thing that happened, not per row in the ledger.
   *
   * Three phones billed on one invoice are stored as three charges — the
   * handover trigger fires per job and each job has to stay traceable — but the
   * customer signed one bill for the total. Grouping by invoice number makes
   * the history match the paper in their hand; the individual jobs are still
   * there, one click down.
   */
  const groups = groupCreditEntries(entries);

  const categories = useInvoiceCategories(
    groups.map(g => g.invoiceNo).filter((n): n is string => !!n),
  );

  /** "Repairs", "Accessories"… or nothing when there is no invoice to label. */
  const sourceOf = (invoiceNo: string | null, jobIds: string[]): string | null => {
    const c = invoiceNo ? categories[invoiceNo] : undefined;
    if (c) return SOURCE_LABEL[c];
    // A charge that names repair jobs came from a repair, whether or not the
    // sales ledger has a row for it — invoices raised before the ledger existed
    // still deserve the right label.
    return jobIds.length > 0 ? SOURCE_LABEL.Repair : null;
  };

  const tone: Record<string, { color: string; icon: typeof Wallet; sign: string }> = {
    "Charge":    { color: "#f87171", icon: CreditCard, sign: "+" },
    "Payment":   { color: "#4ade80", icon: Wallet,     sign: "−" },
    "Write-off": { color: "#fbbf24", icon: Undo2,      sign: "−" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: ff }}>
          Credit history
        </p>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>
          {account.name} · {account.holderKind} · {rs(account.balance)} outstanding
        </p>
      </div>
        {loading && <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff }}>Loading…</p>}
        {error && <p style={{ fontSize: 12, color: "#f87171", fontFamily: ff, lineHeight: 1.5 }}>{error}</p>}
        {!loading && !error && groups.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, padding: "16px 0", textAlign: "center" }}>
            Nothing on this account yet.
          </p>
        )}

        {groups.map(g => {
          const t = tone[g.kind];
          const Icon = t.icon;
          const multi = g.entries.length > 1;
          const open = expanded === g.key;
          const source = sourceOf(g.invoiceNo, g.jobIds);

          return (
            <div key={g.key} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 13px" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${t.color}14`, border: `1px solid ${t.color}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={13} color={t.color} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>
                    {g.invoiceNo
                      ? `${source ? `${source} - ` : ""}${g.invoiceNo}`
                      : g.kind}
                    {g.method ? ` · ${g.method}` : ""}
                    {multi && (
                      <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                        {" "}· {g.entries.length} jobs
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {/* With an invoice number the number IS the description, so
                        the space goes to what it covered instead. */}
                    {g.invoiceNo
                      ? (g.jobIds.join(", ") || g.note || "—")
                      : (g.note || g.jobIds.join(", ") || "—")}
                    {g.dueOn && g.kind === "Charge" ? ` · due ${g.dueOn}` : ""}
                  </p>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: t.color, fontFamily: ff }}>{t.sign} {rs(g.amount)}</p>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>{g.occurredOn}</p>
                </div>

                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  {g.invoiceNo && (
                    <button
                      onClick={() => setShowInvoice(g.invoiceNo)}
                      title={`View ${g.invoiceNo}`}
                      style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <FileText size={13} />
                    </button>
                  )}
                  {multi && (
                    <button
                      onClick={() => setExpanded(open ? null : g.key)}
                      title={open ? "Hide jobs" : "Show the jobs on this invoice"}
                      style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                    </button>
                  )}
                </div>
              </div>

              {open && (
                <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", padding: "4px 13px 8px 55px" }}>
                  {g.entries.map(e => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: ff }}>{e.jobId ?? "—"}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{rs(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

      {showInvoice && <InvoiceDetail invoiceNo={showInvoice} onClose={() => setShowInvoice(null)} />}
    </div>
  );
}

// ─── Open an account ──────────────────────────────────────────────────────────

function OpenAccountModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { dealers } = useRepair();
  const { accounts } = useCreditAccounts();

  const [kind, setKind] = useState<HolderKind>("Customer");
  const [dealerId, setDealerId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nic, setNic] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [limit, setLimit] = useState("");
  const [terms, setTerms] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A dealer with an account already has one balance; a second would split it.
  const taken = new Set(accounts.map(a => a.dealerId).filter((d): d is number => d != null));
  const availableDealers = (dealers ?? []).filter(d => !d.inHouse && !taken.has(Number(d.id)));

  const limitAmt = parseFloat(limit) || 0;
  const canSave = !busy && limitAmt >= 0 && (
    kind === "Dealer" ? dealerId !== "" : name.trim() !== "" && phone.trim() !== ""
  );

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const dealer = kind === "Dealer" ? availableDealers.find(d => String(d.id) === dealerId) : null;
      await openCreditAccount({
        holderKind: kind,
        name: kind === "Dealer" ? (dealer?.name ?? "Dealer") : name,
        phone: kind === "Dealer" ? (dealer?.contact ?? "") : phone,
        nic, email,
        address: kind === "Dealer" ? (dealer?.address ?? "") : address,
        dealerId: dealer ? Number(dealer.id) : null,
        creditLimit: limitAmt,
        termsDays: parseInt(terms, 10) || 30,
      });
      toast.success("Credit account opened");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHead title="Open Credit Account" sub="Decide how much this holder may run up" onClose={onClose} />

      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div>
          <label style={labelSt}>Who is this for?</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["Customer", "Dealer"] as HolderKind[]).map(k => {
              const active = kind === k;
              return (
                <button key={k} onClick={() => setKind(k)}
                  style={{ flex: 1, minHeight: 38, borderRadius: 9, fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: ff, cursor: "pointer", border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-dim)" : "transparent", color: active ? "var(--accent)" : "var(--text-secondary)" }}>
                  {k === "Customer" ? "Walk-in customer" : "Repair dealer"}
                </button>
              );
            })}
          </div>
        </div>

        {kind === "Dealer" ? (
          <div>
            <label style={labelSt}>Dealer *</label>
            <select value={dealerId} onChange={e => setDealerId(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
              <option value="">Select a dealer…</option>
              {availableDealers.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
            {availableDealers.length === 0 && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5, fontFamily: ff, lineHeight: 1.5 }}>
                Every dealer already has an account. Add more under Admin Control → Repair Dealers.
              </p>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={labelSt}>Full Name *</label><input value={name} onChange={e => setName(e.target.value)} style={inputSt} /></div>
              <div><label style={labelSt}>Phone *</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX" style={inputSt} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={labelSt}>NIC</label><input value={nic} onChange={e => setNic(e.target.value)} style={inputSt} /></div>
              <div><label style={labelSt}>Email</label><input value={email} onChange={e => setEmail(e.target.value)} style={inputSt} /></div>
            </div>
            <div><label style={labelSt}>Address</label><input value={address} onChange={e => setAddress(e.target.value)} style={inputSt} /></div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelSt}>Credit Limit (Rs.)</label>
            <input type="number" min={0} value={limit} onChange={e => setLimit(e.target.value)} placeholder="0" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Payment Terms (days)</label>
            <input type="number" min={0} value={terms} onChange={e => setTerms(e.target.value)} style={inputSt} />
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.55, marginTop: -4 }}>
          A balance older than the terms shows as <strong>Overdue</strong>. A zero limit means no credit
          was approved — the account can still carry what is owed, it just reads as over limit.
        </p>

        {error && <p style={{ fontSize: 11.5, color: "#f87171", lineHeight: 1.5, fontFamily: ff }}>{error}</p>}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
        <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
        <button onClick={save} disabled={!canSave}
          style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.45, fontFamily: ff }}>
          {busy ? "Opening…" : "Open Account"}
        </button>
      </div>
    </Modal>
  );
}

// ─── The screen ───────────────────────────────────────────────────────────────

export default function CreditCustomers() {
  const isMobile = useIsMobile();
  const { accounts, loading, error, reload, configured } = useCreditAccounts();
  // Opening an account and writing off a balance are both decisions about how
  // much the shop is willing to lose. Taking a payment is not, so it stays open
  // to every cashier.
  const { isAdminCashier } = useMyPermissions();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CreditStatus | "All">("All");
  const [kindFilter, setKindFilter] = useState<HolderKind | "All">("All");
  const [searchFocused, setSearchFocused] = useState(false);
  const [payTarget, setPayTarget] = useState<CreditAccount | null>(null);
  // Which account's history is open. One at a time: two expanded rows push the
  // rest of the table off screen and the point is to compare against it.
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [offTarget, setOffTarget] = useState<CreditAccount | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = accounts.filter(a => {
    const matchSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      (a.phone ?? "").includes(q) ||
      (a.nic ?? "").toLowerCase().includes(q);
    return matchSearch
      && (statusFilter === "All" || a.status === statusFilter)
      && (kindFilter === "All" || a.holderKind === kindFilter);
  });

  const outstanding = accounts.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const overdueValue = accounts.filter(a => a.status === "Overdue").reduce((s, a) => s + a.balance, 0);
  const overLimit = accounts.filter(isOverLimit).length;

  const stats = [
    { label: "Total Outstanding", value: rs(outstanding),   color: "#f87171", icon: TrendingDown },
    { label: "Overdue Value",     value: rs(overdueValue),  color: "#fbbf24", icon: AlertCircle },
    { label: "Accounts",          value: String(accounts.length), color: "#60a5fa", icon: CreditCard },
    { label: "Over Limit",        value: String(overLimit), color: overLimit > 0 ? "#f87171" : "#4ade80", icon: overLimit > 0 ? AlertCircle : CheckCircle },
  ];

  const refresh = () => { void reload(); setPayTarget(null); setOffTarget(null); setShowAdd(false); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>

      {(!configured || error) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: ff }}>
            {!configured ? "Connect Supabase to track credit." : error}
          </p>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}14`, border: `1px solid ${s.color}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={s.color} strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: ff }}>{s.label}</p>
                <p style={{ fontSize: 17, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 330 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: searchFocused ? "var(--accent)" : "var(--text-muted)", transition: "color 0.18s", pointerEvents: "none" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search by name, phone, NIC…"
            style={{ width: "100%", background: "var(--bg-card)", border: `1px solid ${searchFocused ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "10px 14px 10px 36px", fontSize: 13.5, color: "var(--text-primary)", outline: "none", fontFamily: ff, transition: "border-color 0.18s" }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 5 }}>
          {(["All", "Customer", "Dealer"] as const).map(k => {
            const active = kindFilter === k;
            return (
              <button key={k} onClick={() => setKindFilter(k)}
                style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: active ? 700 : 400, border: active ? "1px solid var(--accent-glow)" : "1px solid transparent", background: active ? "var(--accent-dim)" : "transparent", color: active ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontFamily: ff }}>
                {k === "All" ? "All" : k === "Customer" ? "Customers" : "Dealers"}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 5 }}>
          {(["All", "Active", "Overdue", "Settled"] as const).map(s => {
            const active = statusFilter === s;
            const color = s === "All" ? "var(--accent)" : statusConfig[s as CreditStatus].color;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: active ? 700 : 400, border: active ? `1px solid ${color}44` : "1px solid transparent", background: active ? `${color}14` : "transparent", color: active ? color : "var(--text-muted)", cursor: "pointer", fontFamily: ff }}>
                {s}
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: ff }}>
          {filtered.length} {filtered.length === 1 ? "account" : "accounts"}
        </span>

        {isAdminCashier && (
          <button
            onClick={() => setShowAdd(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid var(--accent-glow)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap" }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Open Account
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-scroll" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, flex: 1, minHeight: 0, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Holder", "Contact", "Charged", "Paid", "Balance", "Limit", "Status", ""].map(h => (
                <th key={h} style={{ position: "sticky", top: 0, zIndex: 1, padding: "12px 16px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", fontFamily: ff, background: "var(--bg-secondary)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                <Loader2 size={16} className="spin-icon" style={{ verticalAlign: "middle", marginRight: 8 }} />Loading credit accounts…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
                {accounts.length === 0
                  ? "No credit accounts yet. One opens by itself the first time a job is handed over unpaid."
                  : "No accounts match those filters."}
              </td></tr>
            ) : filtered.map((a, i) => {
              const sc = statusConfig[a.status];
              const StatusIcon = sc.icon;
              const pct = a.totalCharged > 0 ? Math.round((a.totalPaid / a.totalCharged) * 100) : 0;
              const over = isOverLimit(a) && a.balance > 0;
              const open = openHistory === a.id;
              return (
                <Fragment key={a.id}>
                <tr
                  style={{
                    borderBottom: open || i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.15s",
                    background: open ? "var(--bg-card-hover)" : "transparent",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = open ? "var(--bg-card-hover)" : "transparent"}
                >
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {a.holderKind === "Dealer"
                        ? <Store size={13} style={{ color: "#f59e0b", flexShrink: 0 }} />
                        : <CreditCard size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{a.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: ff, display: "flex", alignItems: "center", gap: 5 }}>
                          {a.nic || a.holderKind}
                          {/* Opened by the handover trigger rather than by a
                              person — the shop is owed money it never agreed to
                              lend, which is worth seeing at a glance. */}
                          {a.autoOpened && (
                            <span title="Opened automatically to hold an unpaid handover" style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#fbbf24" }}>
                              <Sparkles size={9} /> auto
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>{a.phone || "—"}</p>
                    {a.email && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: ff }}>{a.email}</p>}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-primary)", fontFamily: ff }}>{rs(a.totalCharged)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 500, fontFamily: ff }}>{rs(a.totalPaid)}</p>
                    <div style={{ width: 72, height: 3, background: "var(--border)", borderRadius: 4, marginTop: 4 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#4ade80", borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: a.balance > 0 ? "#f87171" : "#4ade80", fontFamily: ff }}>
                      {a.balance > 0 ? rs(a.balance) : "—"}
                    </span>
                    {a.totalWrittenOff > 0 && (
                      <p style={{ fontSize: 10.5, color: "#fbbf24", marginTop: 2, fontFamily: ff }}>{rs(a.totalWrittenOff)} written off</p>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12.5, color: over ? "#f87171" : "var(--text-secondary)", fontWeight: over ? 700 : 400, fontFamily: ff }}>
                      {a.creditLimit > 0 ? rs(a.creditLimit) : "none"}
                    </span>
                    {over && <p style={{ fontSize: 10.5, color: "#f87171", marginTop: 2, fontFamily: ff }}>over limit</p>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", fontFamily: ff }}>
                      <StatusIcon size={10} strokeWidth={2.5} />{a.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setOpenHistory(open ? null : a.id)}
                        title={open ? "Hide credit history" : "Show credit history"}
                        aria-expanded={open}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 9px", borderRadius: 7,
                          border: `1px solid ${open ? "var(--accent-glow)" : "var(--border)"}`,
                          background: open ? "var(--accent-dim)" : "transparent",
                          color: open ? "var(--accent)" : "var(--text-muted)",
                          cursor: "pointer", fontFamily: ff,
                        }}
                      >
                        <History size={13} />
                        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
                      </button>
                      {a.balance > 0 && (
                        <button onClick={() => setPayTarget(a)} title="Record payment"
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.07)", color: "#4ade80", fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: ff }}>
                          <DollarSign size={11} strokeWidth={2.5} />Pay
                        </button>
                      )}
                      {a.balance > 0 && isAdminCashier && (
                        <button onClick={() => setOffTarget(a)} title="Write off"
                          style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.07)", color: "#fbbf24", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Undo2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {open && (
                  <tr style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td colSpan={8} style={{ padding: 0, background: "var(--bg-secondary)" }}>
                      <CreditHistoryList account={a} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {payTarget  && <RecordPaymentModal account={payTarget}  onClose={() => setPayTarget(null)}  onDone={refresh} />}
      {offTarget  && <WriteOffModal      account={offTarget}  onClose={() => setOffTarget(null)}  onDone={refresh} />}
      {showAdd    && <OpenAccountModal   onClose={() => setShowAdd(false)} onDone={refresh} />}
    </div>
  );
}
