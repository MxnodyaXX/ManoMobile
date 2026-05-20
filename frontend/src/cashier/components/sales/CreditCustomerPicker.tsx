"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X, CreditCard, ShieldCheck, ChevronDown, AlertCircle } from "lucide-react";

// ─── Shared type used by all sales components ─────────────────────────────────

export interface POSCreditCustomer {
  id: string;
  name: string;
  phone: string;
  nic: string;
  email: string;
  address: string;
  maxCredit: number;
  balance: number;
  status: "Active" | "Overdue" | "Settled";
}

export const INITIAL_POS_CREDIT_CUSTOMERS: POSCreditCustomer[] = [
  { id: "CC-001", name: "Kasun Perera",       phone: "+94 77 123 4567", nic: "942341567V",  email: "kasun@email.com",   address: "45 Galle Rd, Colombo 3",       maxCredit: 30000,  balance: 15000, status: "Active"  },
  { id: "CC-002", name: "Roshan Fernando",     phone: "+94 76 345 6789", nic: "900234789V",  email: "",                  address: "7 Main St, Negombo",           maxCredit: 10000,  balance: 3500,  status: "Overdue" },
  { id: "CC-003", name: "Chamara Wijesinghe",  phone: "+94 72 789 0123", nic: "881122334V",  email: "chamara@mail.com",  address: "3 Baudhaloka Mw, Colombo 7",   maxCredit: 8000,   balance: 3000,  status: "Active"  },
  { id: "CC-004", name: "Samantha Bandara",    phone: "+94 78 678 9012", nic: "955678901V",  email: "sam@email.com",     address: "14 Lake Dr, Kandy",            maxCredit: 15000,  balance: 0,     status: "Settled" },
  { id: "CC-005", name: "Pradeep Jayawardena", phone: "+94 75 567 8901", nic: "870456123V",  email: "",                  address: "88 Baseline Rd, Colombo 9",    maxCredit: 5000,   balance: 3000,  status: "Overdue" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: 5,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-primary)",
  color: "var(--text-primary)", fontSize: 12, outline: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box",
};

// ─── Add Credit Customer at POS Modal ─────────────────────────────────────────

function AddCreditCustomerAtPOSModal({ nextId, onClose, onAdd }: {
  nextId: string;
  onClose: () => void;
  onAdd: (c: POSCreditCustomer) => void;
}) {
  const [name,      setName]      = useState("");
  const [phone,     setPhone]     = useState("");
  const [nic,       setNic]       = useState("");
  const [email,     setEmail]     = useState("");
  const [address,   setAddress]   = useState("");
  const [maxCredit, setMaxCredit] = useState("");
  const [approvedBy, setApprovedBy] = useState("");

  const maxCreditAmt = parseFloat(maxCredit) || 0;
  const canAdd = !!name.trim() && !!phone.trim() && !!nic.trim() && maxCreditAmt > 0 && !!approvedBy.trim();

  const handleAdd = () => {
    onAdd({
      id:        nextId,
      name:      name.trim(),
      phone:     phone.trim(),
      nic:       nic.trim(),
      email:     email.trim(),
      address:   address.trim(),
      maxCredit: maxCreditAmt,
      balance:   0,
      status:    "Active",
    });
  };

  const fields = [
    { label: "Full Name *",              value: name,      set: setName,      placeholder: "Customer full name", type: "text"   },
    { label: "Phone *",                  value: phone,     set: setPhone,     placeholder: "+94 7X XXX XXXX",    type: "tel"    },
    { label: "NIC *",                    value: nic,       set: setNic,       placeholder: "XXXXXXXXX V",        type: "text"   },
    { label: "Email",                    value: email,     set: setEmail,     placeholder: "Optional",           type: "email"  },
    { label: "Address",                  value: address,   set: setAddress,   placeholder: "Street, City",       type: "text"   },
    { label: "Max Credit Level (Rs.) *", value: maxCredit, set: setMaxCredit, placeholder: "e.g. 25000",        type: "number" },
  ];

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={14} color="var(--accent)" strokeWidth={2.2} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>New Credit Customer</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ID: {nextId} · Added at point of sale</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Customer fields */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11, overflowY: "auto" }}>
          {fields.map(f => (
            <div key={f.label}>
              <label style={labelSt}>{f.label}</label>
              <input type={f.type} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} style={inputSt} />
            </div>
          ))}

          {/* Admin Approval */}
          <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "12px 13px", display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={13} color="#fbbf24" strokeWidth={2.2} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Admin Approval Required</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Adding a credit customer at point of sale requires an admin to authorise.
            </p>
            <div>
              <label style={{ ...labelSt, color: "#fbbf24" }}>Approved By *</label>
              <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Admin name" style={inputSt} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: canAdd ? "pointer" : "not-allowed", opacity: canAdd ? 1 : 0.45, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <Plus size={13} strokeWidth={2.5} />
            Add & Select
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Credit Customer Picker ───────────────────────────────────────────────────

interface CreditCustomerPickerProps {
  customers: POSCreditCustomer[];
  selected: POSCreditCustomer | null;
  onSelect: (c: POSCreditCustomer | null) => void;
  onNewCustomer: (c: POSCreditCustomer) => void;
  pendingAmount?: number;
}

export default function CreditCustomerPicker({ customers, selected, onSelect, onNewCustomer, pendingAmount = 0 }: CreditCustomerPickerProps) {
  const [showAdd, setShowAdd] = useState(false);

  const nextId = `CC-${String(customers.length + 1).padStart(3, "0")}`;

  const activeCustomers = customers.filter(c => c.status !== "Settled");

  const handleAdd = (c: POSCreditCustomer) => {
    onNewCustomer(c);
    onSelect(c);
    setShowAdd(false);
  };

  const available        = selected ? selected.maxCredit - selected.balance : 0;
  const usedPct          = selected && selected.maxCredit > 0 ? Math.min(100, Math.round((selected.balance / selected.maxCredit) * 100)) : 0;
  const isOverLimit      = selected ? selected.balance >= selected.maxCredit : false;
  const wouldExceedLimit = selected && pendingAmount > 0 ? (selected.balance + pendingAmount) > selected.maxCredit : false;
  const afterSaleBalance = selected && pendingAmount > 0 ? selected.balance + pendingAmount : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* Dropdown row */}
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <select
            value={selected?.id ?? ""}
            onChange={(e) => {
              const found = customers.find(c => c.id === e.target.value) ?? null;
              onSelect(found);
            }}
            style={{
              width: "100%", padding: "8px 30px 8px 10px", borderRadius: 8, appearance: "none",
              border: "1px solid var(--border)", background: "var(--bg-primary)",
              color: selected ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: 12, outline: "none", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <option value="">— Select credit customer —</option>
            {activeCustomers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id}) · Available: Rs. {Math.max(0, c.maxCredit - c.balance).toLocaleString()}
              </option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>

        {/* + New customer button */}
        <button
          onClick={() => setShowAdd(true)}
          title="Add new credit customer"
          style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, border: "1px solid var(--accent-glow)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
          onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--accent)"; b.style.color = "var(--accent-fg)"; }}
          onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--accent-dim)"; b.style.color = "var(--accent)"; }}
        >
          <Plus size={15} strokeWidth={2.5} />
        </button>
      </div>

      {/* Selected customer info card */}
      {selected && (
        <div style={{ background: isOverLimit ? "rgba(248,113,113,0.06)" : "rgba(96,165,250,0.06)", border: `1px solid ${isOverLimit ? "rgba(248,113,113,0.25)" : "rgba(96,165,250,0.25)"}`, borderRadius: 9, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Name + clear */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{selected.name}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{selected.phone} · {selected.nic}</p>
            </div>
            <button onClick={() => onSelect(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex" }}>
              <X size={13} />
            </button>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { label: "Outstanding",  val: `Rs. ${selected.balance.toLocaleString()}`,  color: selected.balance > 0 ? "#f87171" : "#4ade80" },
              { label: "Max Limit",    val: `Rs. ${selected.maxCredit.toLocaleString()}`, color: "var(--text-primary)" },
              { label: "Available",    val: `Rs. ${Math.max(0, available).toLocaleString()}`, color: available > 0 ? "#4ade80" : "#f87171" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg-card)", borderRadius: 7, padding: "7px 9px", textAlign: "center" }}>
                <p style={{ fontSize: 9.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.val}</p>
              </div>
            ))}
          </div>

          {/* Usage bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
              <span>Credit Used</span>
              <span style={{ color: isOverLimit ? "#f87171" : "var(--text-muted)" }}>{usedPct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ width: `${usedPct}%`, height: "100%", background: isOverLimit ? "#f87171" : usedPct > 70 ? "#fbbf24" : "#60a5fa", borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* Over-limit warning */}
          {isOverLimit && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f87171", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <AlertCircle size={12} strokeWidth={2.2} />
              Customer has reached their credit limit. Credit sales are blocked.
            </div>
          )}

          {/* Would exceed limit */}
          {!isOverLimit && wouldExceedLimit && afterSaleBalance !== null && (
            <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f87171", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                <AlertCircle size={12} strokeWidth={2.2} />
                This sale exceeds the credit limit
              </div>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Balance after sale: Rs. {afterSaleBalance.toLocaleString()} / Limit: Rs. {selected!.maxCredit.toLocaleString()}.
                Requires manager approval to proceed.
              </p>
            </div>
          )}

          {/* Pending amount preview */}
          {!wouldExceedLimit && !isOverLimit && pendingAmount > 0 && afterSaleBalance !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <span>After this sale:</span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Rs. {afterSaleBalance.toLocaleString()} outstanding</span>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddCreditCustomerAtPOSModal
          nextId={nextId}
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
