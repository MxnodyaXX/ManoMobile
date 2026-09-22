"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { openCreditAccount, addCharge } from "@/lib/credit/api";
import { useToast } from "@/lib/ui/toast";
import { sendSms } from "@/lib/sms/client";
import {
  renderCreditAccountOpened, renderCreditChargeRecorded,
  CREDIT_OPENED_PURPOSE, CREDIT_CHARGE_PURPOSE,
} from "@/lib/sms/creditReminders";

const ff = "'Plus Jakarta Sans', sans-serif";
const labelSt: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block", fontFamily: ff };
const inputSt: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, fontFamily: ff, outline: "none", boxSizing: "border-box" };

/**
 * Who a manual charge — or the account opened to hold it — is for.
 *
 * Just enough to open an account and text somebody about it, not the full
 * shape either caller keeps for its own screen: All Customers has a `Customer`
 * row built from jobs and dealers, Credit Customers has a `CreditAccount` row
 * read straight from the ledger. Both already carry these five fields, so
 * neither has to reshape itself to call this.
 */
export interface CreditChargeTarget {
  name: string;
  phone: string;
  nic?: string;
  email?: string;
  address?: string;
}

/**
 * Record a manual charge — or open the account it needs first.
 *
 * The gap this closes: credit_entries has only ever been written by code —
 * the repair Delivered trigger, the POS checkout RPC. There was no way for a
 * cashier to just say "this person owes us 5,000 from an emergency sale that
 * didn't go through the register" — addCharge() existed in the API and had no
 * caller anywhere in the app until this modal. When the target has no account
 * yet, saving opens one in the same step as posting the charge — one action
 * for the common case, not two.
 *
 * Shared between All Customers (RecordCreditModal was born there) and Credit
 * Customers, which reuses it from its account detail view rather than
 * building the same open-then-charge logic a second time.
 */
export default function RecordCreditModal({ target, existingAccountId, priorBalance, onClose, onDone }: {
  target: CreditChargeTarget;
  /** Null when this holder has no credit account yet — saving creates one. */
  existingAccountId: string | null;
  /** The account's current balance, for the SMS — 0 when there is no account
   *  yet, since a freshly opened one has nothing charged on it before this. */
  priorBalance: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [limit, setLimit] = useState("");
  const [terms, setTerms] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amt = parseFloat(amount) || 0;
  // Opening a fresh account with nothing owed yet is a valid outcome (record
  // the relationship now, charge it later); charging an account that already
  // exists needs an actual amount or there is nothing to record.
  const canSave = !busy && (existingAccountId ? amt > 0 : true);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const limitAmt = parseFloat(limit) || 0;
      let accountId = existingAccountId;
      let openedNow = false;
      if (!accountId) {
        const acct = await openCreditAccount({
          holderKind: "Customer",
          name: target.name,
          phone: target.phone,
          nic: target.nic || undefined,
          email: target.email || undefined,
          address: target.address || undefined,
          dealerId: null,
          creditLimit: limitAmt,
          termsDays: parseInt(terms, 10) || 30,
        });
        accountId = acct.id;
        openedNow = true;
      }

      if (amt > 0) {
        await addCharge(accountId, amt, note.trim() || undefined);
      }

      // Best-effort from here: the credit side is already committed, so an
      // SMS hiccup should not look like the save itself failed — and nothing
      // gets texted about a write that didn't actually happen.
      if (target.phone) {
        if (openedNow) {
          void sendSms({
            to: target.phone,
            message: renderCreditAccountOpened({ name: target.name, creditLimit: limitAmt }),
            accountId, purpose: CREDIT_OPENED_PURPOSE,
          }).catch(() => {});
        }
        if (amt > 0) {
          const priorBal = existingAccountId ? priorBalance : 0;
          void sendSms({
            to: target.phone,
            message: renderCreditChargeRecorded({ name: target.name }, amt, priorBal + amt, note),
            accountId, purpose: CREDIT_CHARGE_PURPOSE,
          }).catch(() => {});
        }
      }

      toast.success(
        existingAccountId ? "Credit recorded" : amt > 0 ? "Account opened and credit recorded" : "Credit account opened",
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(460px, calc(100vw - 24px))", boxShadow: "0 24px 64px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: ff }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              {existingAccountId ? "Record Credit Charge" : "Open Credit Account"}
            </p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{target.name} · {target.phone || "no phone on file"}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {!existingAccountId && (
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
          )}

          <div>
            <label style={labelSt}>Amount (Rs.){!existingAccountId && " — optional"}</label>
            <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputSt} autoFocus />
          </div>
          <div>
            <label style={labelSt}>Note</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Emergency accessory purchase, no register open" style={inputSt} />
          </div>

          {!existingAccountId && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55, marginTop: -4 }}>
              Leave the amount at 0 to just open the account on file with nothing owed yet.
            </p>
          )}
          {error && <p style={{ fontSize: 11.5, color: "var(--danger)", lineHeight: 1.5 }}>{error}</p>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
          <button onClick={save} disabled={!canSave}
            style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.45, fontFamily: ff }}>
            {busy ? "Saving…" : existingAccountId ? "Record Charge" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
