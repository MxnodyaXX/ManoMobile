"use client";

import { useState } from "react";
import { ChevronDown, Plus, X, AlertCircle, Store } from "lucide-react";
import {
  useCreditAccounts, openCreditAccount, headroom, isOverLimit as overLimit,
  type CreditAccount,
} from "@/lib/credit/api";
import { useMyPermissions } from "@/lib/settings/staffRules";
import { useToast } from "@/lib/ui/toast";

/**
 * Choosing who a credit sale goes on.
 *
 * This component was copied into Mobile, Accessory, Other and Repair Sales, and
 * each copy was handed a list the screen kept in its own useState([]). Four
 * counters, four private lists, none of them saved, none of them the same as
 * the Credit Customers screen. It reads the one stored list now, so a limit set
 * anywhere is the limit everywhere.
 */

/** The picker used to have a type of its own. It is the same account the whole
 *  app now shares; the alias keeps the sale screens' annotations working. */
export type POSCreditCustomer = CreditAccount;

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

// ─── Open an account without leaving the sale ─────────────────────────────────

function QuickOpenModal({ onClose, onOpened }: {
  onClose: () => void;
  onOpened: (a: CreditAccount) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nic, setNic] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limitAmt = parseFloat(limit) || 0;
  const canSave = !busy && name.trim() !== "" && phone.trim() !== "" && limitAmt > 0;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const created = await openCreditAccount({
        holderKind: "Customer", name, phone, nic, creditLimit: limitAmt,
      });
      toast.success(`Credit account opened for ${created.name}`);
      onOpened(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 13px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>New Credit Customer</p>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex" }}>
          <X size={13} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><label style={labelSt}>Name *</label><input value={name} onChange={e => setName(e.target.value)} style={inputSt} autoFocus /></div>
        <div><label style={labelSt}>Phone *</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX" style={inputSt} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><label style={labelSt}>NIC</label><input value={nic} onChange={e => setNic(e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Credit Limit (Rs.) *</label><input type="number" min={1} value={limit} onChange={e => setLimit(e.target.value)} style={inputSt} /></div>
      </div>

      {error && <p style={{ fontSize: 11, color: "#f87171", lineHeight: 1.5, fontFamily: ff }}>{error}</p>}

      <button onClick={save} disabled={!canSave}
        style={{ minHeight: 34, borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.45, fontFamily: ff }}>
        {busy ? "Opening…" : "Open Account"}
      </button>
    </div>
  );
}

// ─── The picker ───────────────────────────────────────────────────────────────

interface CreditCustomerPickerProps {
  selected: CreditAccount | null;
  onSelect: (c: CreditAccount | null) => void;
  pendingAmount?: number;
}

export default function CreditCustomerPicker({ selected, onSelect, pendingAmount = 0 }: CreditCustomerPickerProps) {
  const { accounts, loading, error, reload } = useCreditAccounts();
  // Opening an account decides how much the shop is willing to be owed, which
  // is the same call as setting a limit — so the same tick governs it.
  const { isAdminCashier } = useMyPermissions();
  const [showAdd, setShowAdd] = useState(false);

  // A settled account is still a live account: last month's customer is exactly
  // who comes back this month. Only their balance is zero.
  const choosable = accounts;

  const available = selected ? headroom(selected) : 0;
  const usedPct = selected && selected.creditLimit > 0
    ? Math.min(100, Math.round((selected.balance / selected.creditLimit) * 100))
    : selected && selected.balance > 0 ? 100 : 0;
  const atLimit = selected ? overLimit(selected) : false;
  const wouldExceed = selected && pendingAmount > 0
    ? (selected.balance + pendingAmount) > selected.creditLimit
    : false;
  const afterSale = selected && pendingAmount > 0 ? selected.balance + pendingAmount : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {error && (
        <p style={{ fontSize: 11, color: "#f87171", lineHeight: 1.5, fontFamily: ff }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <select
            value={selected?.id ?? ""}
            onChange={e => onSelect(choosable.find(c => c.id === e.target.value) ?? null)}
            style={{
              width: "100%", padding: "8px 30px 8px 10px", borderRadius: 8, appearance: "none",
              border: "1px solid var(--border)", background: "var(--bg-primary)",
              color: selected ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: 12, outline: "none", cursor: "pointer", fontFamily: ff,
            }}
          >
            <option value="">
              {loading ? "Loading accounts…" : choosable.length === 0 ? "— No credit accounts yet —" : "— Select credit account —"}
            </option>
            {choosable.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.holderKind === "Dealer" ? " (dealer)" : ""} · Available: {rs(headroom(c))}
              </option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>

        {isAdminCashier && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            title="Open a new credit account"
            style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, border: "1px solid var(--accent-glow)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Why the + is missing for most people. Silence here reads as a bug. */}
      {!isAdminCashier && choosable.length === 0 && !loading && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, fontFamily: ff }}>
          No credit accounts have been opened. An admin cashier can open one under
          Customer Management → Credit Accounts.
        </p>
      )}

      {showAdd && (
        <QuickOpenModal
          onClose={() => setShowAdd(false)}
          onOpened={a => { setShowAdd(false); void reload(); onSelect(a); }}
        />
      )}

      {selected && (
        <div style={{ background: atLimit ? "rgba(248,113,113,0.06)" : "rgba(96,165,250,0.06)", border: `1px solid ${atLimit ? "rgba(248,113,113,0.25)" : "rgba(96,165,250,0.25)"}`, borderRadius: 9, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 8 }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, display: "flex", alignItems: "center", gap: 6 }}>
                {selected.holderKind === "Dealer" && <Store size={12} style={{ color: "#f59e0b" }} />}
                {selected.name}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: ff }}>
                {[selected.phone, selected.nic].filter(Boolean).join(" · ") || selected.holderKind}
              </p>
            </div>
            <button onClick={() => onSelect(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex" }}>
              <X size={13} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { label: "Outstanding", val: rs(selected.balance), color: selected.balance > 0 ? "#f87171" : "#4ade80" },
              { label: "Limit",       val: selected.creditLimit > 0 ? rs(selected.creditLimit) : "none", color: "var(--text-primary)" },
              { label: "Available",   val: rs(available), color: available > 0 ? "#4ade80" : "#f87171" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg-card)", borderRadius: 7, padding: "7px 9px", textAlign: "center" }}>
                <p style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.val}</p>
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", fontFamily: ff, marginBottom: 4 }}>
              <span>Credit Used</span>
              <span style={{ color: atLimit ? "#f87171" : "var(--text-muted)" }}>{usedPct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ width: `${usedPct}%`, height: "100%", background: atLimit ? "#f87171" : usedPct > 70 ? "#fbbf24" : "#60a5fa", borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          </div>

          {atLimit && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 11, color: "#f87171", fontFamily: ff, lineHeight: 1.5 }}>
              <AlertCircle size={12} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
              {selected.creditLimit === 0
                ? "No credit limit has been approved for this account — it exists only to hold what is already owed."
                : "This account is at or over its credit limit."}
            </div>
          )}

          {!atLimit && wouldExceed && afterSale !== null && (
            <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f87171", fontFamily: ff, fontWeight: 700 }}>
                <AlertCircle size={12} strokeWidth={2.2} />
                This sale exceeds the credit limit
              </div>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
                Balance after sale: {rs(afterSale)} against a {rs(selected.creditLimit)} limit.
              </p>
            </div>
          )}

          {!wouldExceed && !atLimit && pendingAmount > 0 && afterSale !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
              <span>After this sale:</span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{rs(afterSale)} outstanding</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
