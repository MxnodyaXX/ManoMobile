"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, CreditCard, AlertCircle, CheckCircle,
  X, DollarSign, TrendingDown, Wallet,
  History, Plus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreditStatus = "Active" | "Overdue" | "Settled";

interface CreditEntry {
  invoiceNo: string;
  jobId: string;
  device: string;
  date: string;
  invoiced: number;
  paid: number;
  due: number;
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
  recordedBy: string;
}

interface CreditCustomer {
  id: string;
  name: string;
  phone: string;
  nic: string;
  email: string;
  address: string;
  maxCredit: number;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  creditSince: string;
  approvedBy: string;
  status: CreditStatus;
  entries: CreditEntry[];
  payments: PaymentRecord[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_CREDIT: CreditCustomer[] = [
  {
    id: "CC-001", name: "Kasun Perera", phone: "+94 77 123 4567", nic: "942341567V", email: "kasun@email.com", address: "45 Galle Rd, Colombo 3",
    maxCredit: 30000, totalInvoiced: 25000, totalPaid: 10000, balance: 15000,
    creditSince: "2025-04-22", approvedBy: "ADMIN", status: "Active",
    entries: [
      { invoiceNo: "0012345678", jobId: "RM-001", device: "Apple iPhone 14 Pro", date: "2025-04-22", invoiced: 25000, paid: 10000, due: 15000 },
    ],
    payments: [
      { id: "P1", date: "2025-04-22", amount: 5000, method: "Cash", note: "Initial advance", recordedBy: "ADMIN" },
      { id: "P2", date: "2025-04-25", amount: 5000, method: "Bank Transfer", note: "Partial payment", recordedBy: "ADMIN" },
    ],
  },
  {
    id: "CC-002", name: "Roshan Fernando", phone: "+94 76 345 6789", nic: "900234789V", email: "", address: "7 Main St, Negombo",
    maxCredit: 10000, totalInvoiced: 4500, totalPaid: 1000, balance: 3500,
    creditSince: "2025-03-15", approvedBy: "MANAGER", status: "Overdue",
    entries: [
      { invoiceNo: "0023456789", jobId: "RM-003", device: "Xiaomi Redmi Note 12", date: "2025-03-15", invoiced: 4500, paid: 1000, due: 3500 },
    ],
    payments: [
      { id: "P1", date: "2025-03-15", amount: 1000, method: "Cash", note: "Advance on collection", recordedBy: "MANAGER" },
    ],
  },
  {
    id: "CC-003", name: "Chamara Wijesinghe", phone: "+94 72 789 0123", nic: "881122334V", email: "chamara@mail.com", address: "3 Baudhaloka Mw, Colombo 7",
    maxCredit: 8000, totalInvoiced: 5000, totalPaid: 2000, balance: 3000,
    creditSince: "2025-04-20", approvedBy: "ADMIN", status: "Active",
    entries: [
      { invoiceNo: "0034567890", jobId: "RM-007", device: "Huawei P30 Pro", date: "2025-04-20", invoiced: 5000, paid: 2000, due: 3000 },
    ],
    payments: [
      { id: "P1", date: "2025-04-20", amount: 2000, method: "Cash", note: "", recordedBy: "ADMIN" },
    ],
  },
  {
    id: "CC-004", name: "Samantha Bandara", phone: "+94 78 678 9012", nic: "955678901V", email: "sam@email.com", address: "14 Lake Dr, Kandy",
    maxCredit: 15000, totalInvoiced: 12000, totalPaid: 12000, balance: 0,
    creditSince: "2025-04-10", approvedBy: "ADMIN", status: "Settled",
    entries: [
      { invoiceNo: "0045678901", jobId: "RM-006", device: "Samsung Galaxy A54", date: "2025-04-10", invoiced: 12000, paid: 12000, due: 0 },
    ],
    payments: [
      { id: "P1", date: "2025-04-10", amount: 3000, method: "Cash", note: "Advance", recordedBy: "ADMIN" },
      { id: "P2", date: "2025-04-18", amount: 9000, method: "Bank Transfer", note: "Final settlement", recordedBy: "ADMIN" },
    ],
  },
  {
    id: "CC-005", name: "Pradeep Jayawardena", phone: "+94 75 567 8901", nic: "870456123V", email: "", address: "88 Baseline Rd, Colombo 9",
    maxCredit: 5000, totalInvoiced: 3000, totalPaid: 0, balance: 3000,
    creditSince: "2025-02-28", approvedBy: "MANAGER", status: "Overdue",
    entries: [
      { invoiceNo: "0056789012", jobId: "RM-005", device: "Oppo Reno 8", date: "2025-02-28", invoiced: 3000, paid: 0, due: 3000 },
    ],
    payments: [],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<CreditStatus, { color: string; bg: string; border: string; icon: any }> = {
  Active:   { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)",  icon: CreditCard },
  Overdue:  { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)", icon: AlertCircle },
  Settled:  { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.25)",  icon: CheckCircle },
};

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

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ customer, onClose, onRecord }: {
  customer: CreditCustomer;
  onClose: () => void;
  onRecord: (amount: number, method: string, note: string, by: string) => void;
}) {
  const [amount,     setAmount]     = useState("");
  const [method,     setMethod]     = useState("Cash");
  const [note,       setNote]       = useState("");
  const [recordedBy, setRecordedBy] = useState("");

  const amtNum  = parseFloat(amount) || 0;
  const newBal  = Math.max(0, customer.balance - amtNum);
  const canSave = amtNum > 0 && amtNum <= customer.balance && !!recordedBy.trim();

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Record Payment</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{customer.name} · {customer.id}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Balance summary */}
        <div style={{ margin: "14px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Total Invoiced", val: `Rs. ${customer.totalInvoiced.toLocaleString()}`, color: "var(--text-primary)" },
            { label: "Total Paid",     val: `Rs. ${customer.totalPaid.toLocaleString()}`,     color: "#4ade80" },
            { label: "Balance Due",    val: `Rs. ${customer.balance.toLocaleString()}`,       color: "#f87171" },
          ].map(r => (
            <div key={r.label} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>{r.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.val}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Payment Amount (Rs.)</label>
              <input
                type="number" min={1} max={customer.balance}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max Rs. ${customer.balance.toLocaleString()}`}
                style={{ ...inputSt, border: amtNum > customer.balance ? "1px solid #f87171" : "1px solid var(--border)" }}
              />
              {amtNum > customer.balance && (
                <p style={{ fontSize: 10.5, color: "#f87171", marginTop: 4 }}>Exceeds outstanding balance</p>
              )}
            </div>
            <div>
              <label style={labelSt}>Payment Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
                {["Cash", "Bank Transfer", "Card", "Cheque", "Online"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelSt}>Recorded By (Admin)</label>
            <input value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)} placeholder="Admin name" style={inputSt} />
          </div>

          <div>
            <label style={labelSt}>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Payment note..." style={inputSt} />
          </div>

          {/* Preview new balance */}
          {amtNum > 0 && amtNum <= customer.balance && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 9, background: newBal === 0 ? "rgba(74,222,128,0.07)" : "rgba(96,165,250,0.07)", border: `1px solid ${newBal === 0 ? "rgba(74,222,128,0.3)" : "rgba(96,165,250,0.25)"}` }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {newBal === 0 ? "Account will be fully settled" : "Remaining balance after payment"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: newBal === 0 ? "#4ade80" : "#60a5fa" }}>
                {newBal === 0 ? "SETTLED ✓" : `Rs. ${newBal.toLocaleString()}`}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button
            onClick={() => onRecord(amtNum, method, note, recordedBy.trim())}
            disabled={!canSave}
            style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.45, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Record Payment
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── History Modal ────────────────────────────────────────────────────────────

function HistoryModal({ customer, onClose }: { customer: CreditCustomer; onClose: () => void }) {
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.45)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Credit History</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{customer.name} · {customer.id}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Jobs on credit */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}>Credit Jobs</p>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                    {["Invoice", "Job", "Device", "Date", "Invoiced", "Paid", "Due"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customer.entries.map((e, i) => (
                    <tr key={i} style={{ borderBottom: i < customer.entries.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "var(--accent)" }}>{e.invoiceNo}</td>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "var(--text-muted)" }}>{e.jobId}</td>
                      <td style={{ padding: "9px 12px", fontSize: 11.5, color: "var(--text-primary)" }}>{e.device}</td>
                      <td style={{ padding: "9px 12px", fontSize: 11, color: "var(--text-muted)" }}>{e.date}</td>
                      <td style={{ padding: "9px 12px", fontSize: 11.5, textAlign: "right" }}>Rs. {e.invoiced.toLocaleString()}</td>
                      <td style={{ padding: "9px 12px", fontSize: 11.5, color: "#4ade80", textAlign: "right" }}>Rs. {e.paid.toLocaleString()}</td>
                      <td style={{ padding: "9px 12px", fontSize: 11.5, fontWeight: 700, color: e.due > 0 ? "#f87171" : "#4ade80", textAlign: "right" }}>
                        {e.due > 0 ? `Rs. ${e.due.toLocaleString()}` : "SETTLED"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment history */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 10 }}>Payment History</p>
            {customer.payments.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "12px 0" }}>No payments recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {customer.payments.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 13px" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Wallet size={13} color="#4ade80" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>Rs. {p.amount.toLocaleString()} · {p.method}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{p.note || "—"} · Recorded by {p.recordedBy}</p>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{p.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Add Credit Customer Modal ────────────────────────────────────────────────

function AddCreditCustomerModal({ nextId, onClose, onAdd }: {
  nextId: string;
  onClose: () => void;
  onAdd: (c: CreditCustomer) => void;
}) {
  const [name,      setName]      = useState("");
  const [phone,     setPhone]     = useState("");
  const [nic,       setNic]       = useState("");
  const [email,     setEmail]     = useState("");
  const [address,   setAddress]   = useState("");
  const [maxCredit, setMaxCredit] = useState("");

  const maxCreditAmt = parseFloat(maxCredit) || 0;
  const canAdd = !!name.trim() && !!phone.trim() && !!nic.trim() && maxCreditAmt > 0;

  const handleAdd = () => {
    const today = new Date().toISOString().slice(0, 10);
    onAdd({
      id:            nextId,
      name:          name.trim(),
      phone:         phone.trim(),
      nic:           nic.trim(),
      email:         email.trim(),
      address:       address.trim(),
      maxCredit:     maxCreditAmt,
      totalInvoiced: 0,
      totalPaid:     0,
      balance:       0,
      creditSince:   today,
      approvedBy:    "",
      status:        "Active",
      entries:       [],
      payments:      [],
    });
  };

  const fields = [
    { label: "Full Name *",          value: name,      set: setName,      placeholder: "Customer full name", type: "text"   },
    { label: "Phone *",              value: phone,     set: setPhone,     placeholder: "+94 7X XXX XXXX",    type: "tel"    },
    { label: "NIC *",                value: nic,       set: setNic,       placeholder: "XXXXXXXXX V",        type: "text"   },
    { label: "Email",                value: email,     set: setEmail,     placeholder: "Optional",           type: "email"  },
    { label: "Address",              value: address,   set: setAddress,   placeholder: "Street, City",       type: "text"   },
    { label: "Max Credit Level (Rs.) *", value: maxCredit, set: setMaxCredit, placeholder: "e.g. 25000",    type: "number" },
  ];

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={14} color="var(--accent)" strokeWidth={2.2} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>New Credit Customer</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ID will be assigned: {nextId}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map(f => (
            <div key={f.label}>
              <label style={labelSt}>{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
                style={inputSt}
              />
            </div>
          ))}
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
            Add Customer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Credit Customers ─────────────────────────────────────────────────────────

export default function CreditCustomers() {
  const [customers,     setCustomers]     = useState<CreditCustomer[]>(INITIAL_CREDIT);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<CreditStatus | "All">("All");
  const [searchFocused, setSearchFocused] = useState(false);
  const [payTarget,     setPayTarget]     = useState<CreditCustomer | null>(null);
  const [histTarget,    setHistTarget]    = useState<CreditCustomer | null>(null);
  const [showAdd,       setShowAdd]       = useState(false);

  const nextId = `CC-${String(customers.length + 1).padStart(3, "0")}`;

  const handleAdd = (c: CreditCustomer) => {
    setCustomers(prev => [...prev, c]);
    setShowAdd(false);
  };

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.nic.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalOutstanding = customers.filter(c => c.status !== "Settled").reduce((s, c) => s + c.balance, 0);
  const activeCount      = customers.filter(c => c.status === "Active").length;
  const overdueCount     = customers.filter(c => c.status === "Overdue").length;
  const settledCount     = customers.filter(c => c.status === "Settled").length;

  const handleRecord = (amount: number, method: string, note: string, by: string) => {
    if (!payTarget) return;
    const now = new Date().toISOString().slice(0, 10);
    setCustomers(prev => prev.map(c => {
      if (c.id !== payTarget.id) return c;
      const newPaid    = c.totalPaid + amount;
      const newBalance = Math.max(0, c.balance - amount);
      const newStatus: CreditStatus = newBalance === 0 ? "Settled" : c.status;
      const newPayment: PaymentRecord = {
        id: `P${c.payments.length + 1}`,
        date: now, amount, method, note, recordedBy: by,
      };
      return { ...c, totalPaid: newPaid, balance: newBalance, status: newStatus, payments: [...c.payments, newPayment] };
    }));
    setPayTarget(null);
  };

  const stats = [
    { label: "Total Outstanding",  value: `Rs. ${totalOutstanding.toLocaleString()}`, color: "#f87171", icon: TrendingDown },
    { label: "Active Credits",     value: activeCount.toString(),                      color: "#60a5fa", icon: CreditCard },
    { label: "Overdue",            value: overdueCount.toString(),                     color: "#fbbf24", icon: AlertCircle },
    { label: "Settled",            value: settledCount.toString(),                     color: "#4ade80", icon: CheckCircle },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}14`, border: `1px solid ${s.color}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={s.color} strokeWidth={2} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.label}</p>
                <p style={{ fontSize: 17, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: searchFocused ? "var(--accent)" : "var(--text-muted)", transition: "color 0.18s", pointerEvents: "none" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search by name, phone, NIC, ID..."
            style={{ width: "100%", background: "var(--bg-card)", border: `1px solid ${searchFocused ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "10px 14px 10px 36px", fontSize: 13.5, color: "var(--text-primary)", outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "border-color 0.18s" }}
          />
        </div>

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 5 }}>
          {(["All", "Active", "Overdue", "Settled"] as const).map(s => {
            const isActive = statusFilter === s;
            const color = s === "All" ? "var(--accent)" : statusConfig[s as CreditStatus]?.color ?? "var(--accent)";
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{ padding: "5px 13px", borderRadius: 7, fontSize: 12, fontWeight: isActive ? 700 : 400, border: isActive ? `1px solid ${color}44` : "1px solid transparent", background: isActive ? `${color}14` : "transparent", color: isActive ? color : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s" }}
              >{s}</button>
            );
          })}
        </div>

        <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
        </span>

        <button
          onClick={() => setShowAdd(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid var(--accent-glow)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.18s", whiteSpace: "nowrap" }}
          onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--accent)"; b.style.color = "var(--accent-fg)"; b.style.borderColor = "var(--accent)"; }}
          onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--accent-dim)"; b.style.color = "var(--accent)"; b.style.borderColor = "var(--accent-glow)"; }}
        >
          <Plus size={14} strokeWidth={2.5} />
          New Credit Customer
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ID", "Customer", "Contact", "Total Invoiced", "Paid", "Balance Due", "Credit Since", "Approved By", "Status", ""].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--bg-secondary)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No credit customers found</td></tr>
            ) : filtered.map((c, i) => {
              const sc      = statusConfig[c.status];
              const StatusIcon = sc.icon;
              const pct     = c.totalInvoiced > 0 ? Math.round((c.totalPaid / c.totalInvoiced) * 100) : 0;
              return (
                <tr key={c.id}
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-card-hover)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                >
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{c.id}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                    {c.nic && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{c.nic}</p>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.phone}</p>
                    {c.email && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{c.email}</p>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Rs. {c.totalInvoiced.toLocaleString()}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 500 }}>Rs. {c.totalPaid.toLocaleString()}</p>
                    {/* Progress bar */}
                    <div style={{ width: 72, height: 3, background: "var(--border)", borderRadius: 4, marginTop: 4 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#4ade80", borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.balance > 0 ? "#f87171" : "#4ade80" }}>
                      {c.balance > 0 ? `Rs. ${c.balance.toLocaleString()}` : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.creditSince}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.approvedBy}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                      <StatusIcon size={10} strokeWidth={2.5} />{c.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setHistTarget(c)}
                        title="View history"
                        style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--accent-glow)"; b.style.color = "var(--accent)"; b.style.background = "var(--accent-dim)"; }}
                        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--border)"; b.style.color = "var(--text-muted)"; b.style.background = "transparent"; }}
                      >
                        <History size={13} />
                      </button>
                      {c.status !== "Settled" && (
                        <button
                          onClick={() => setPayTarget(c)}
                          title="Record payment"
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.07)", color: "#4ade80", fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
                          onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(74,222,128,0.15)"; }}
                          onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(74,222,128,0.07)"; }}
                        >
                          <DollarSign size={11} strokeWidth={2.5} />Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payTarget  && <RecordPaymentModal customer={payTarget}  onClose={() => setPayTarget(null)}  onRecord={handleRecord} />}
      {histTarget && <HistoryModal       customer={histTarget} onClose={() => setHistTarget(null)} />}
      {showAdd    && <AddCreditCustomerModal nextId={nextId}  onClose={() => setShowAdd(false)}   onAdd={handleAdd} />}
    </div>
  );
}
