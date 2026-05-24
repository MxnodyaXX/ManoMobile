"use client";

import { useState, useMemo } from "react";
import { ArrowUpCircle, Search, Plus, CheckCircle, AlertTriangle, X, Calendar, Receipt } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useAccounts, type APRecord, type Expense, type ExpenseCategory } from "@/accounts/contexts/AccountsContext";

const AA = "#f59e0b";
const ff = "'Plus Jakarta Sans', sans-serif";

const STATUS_CFG: Record<APRecord["status"], { color: string; bg: string; border: string }> = {
  Outstanding: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)"  },
  Partial:     { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
  Overdue:     { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Paid:        { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
};

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent", "Electricity & Utilities", "Salaries & Wages",
  "Marketing & Advertising", "Equipment Maintenance",
  "Telephone & Internet", "Depreciation", "Miscellaneous Expenses",
];

const EXPENSE_ACCT: Record<ExpenseCategory, string> = {
  "Rent":                    "6010",
  "Electricity & Utilities": "6020",
  "Salaries & Wages":        "6030",
  "Marketing & Advertising": "6040",
  "Equipment Maintenance":   "6050",
  "Telephone & Internet":    "6060",
  "Depreciation":            "6070",
  "Miscellaneous Expenses":  "6080",
};

// ─── AP Payment Modal ─────────────────────────────────────────────────────────

function APPaymentModal({ record, onClose }: { record: APRecord; onClose: () => void }) {
  const { recordAPPayment } = useAccounts();
  const [amount, setAmount] = useState(record.amount - record.paid);
  const [method, setMethod] = useState("Bank Transfer");

  const balance = record.amount - record.paid;
  const valid   = amount > 0 && amount <= balance;

  const inputStyle: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none" };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", zIndex: 71, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle size={15} color="#34d399" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Record Payment</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{record.invoiceNo} · {record.supplierName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={15} /></button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <div><p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 2 }}>Invoice Total</p><p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Rs. {record.amount.toLocaleString()}</p></div>
            <div style={{ textAlign: "right" }}><p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 2 }}>Balance Due</p><p style={{ fontSize: 14, fontWeight: 700, color: "#f87171", fontFamily: ff }}>Rs. {balance.toLocaleString()}</p></div>
          </div>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, marginBottom: 6 }}>Payment Amount (Rs.)</p>
            <input type="number" min={1} max={balance} value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, marginBottom: 6 }}>Payment Method</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["Cash", "Bank Transfer", "Card"].map(m => (
                <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${method === m ? AA + "40" : "var(--border)"}`, background: method === m ? `${AA}12` : "var(--bg-secondary)", color: method === m ? AA : "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>{m}</button>
              ))}
            </div>
          </div>
          <button onClick={() => { recordAPPayment(record.id, amount); onClose(); }} disabled={!valid} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, background: valid ? "#34d399" : "var(--bg-secondary)", color: valid ? "#000" : "var(--text-muted)", cursor: valid ? "pointer" : "not-allowed", fontFamily: ff }}>
            Confirm Payment — Rs. {amount.toLocaleString()}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Add AP/Expense Modal ─────────────────────────────────────────────────────

function AddAPModal({ onClose }: { onClose: () => void }) {
  const { addAPRecord, addExpense } = useAccounts();
  const [entryType, setEntryType] = useState<"supplier" | "expense">("supplier");

  // Supplier invoice fields
  const [ap, setAP] = useState({ supplierName: "", invoiceNo: "", invoiceDate: "2026-05-22", dueDate: "", category: "Inventory", amount: 0, notes: "" });
  // Expense fields
  const [exp, setExp] = useState({ date: "2026-05-22", category: "Rent" as ExpenseCategory, description: "", amount: 0, paymentMethod: "Cash" as Expense["paymentMethod"], vendor: "", reference: "" });

  const apValid  = ap.supplierName && ap.invoiceNo && ap.dueDate && ap.amount > 0;
  const expValid = exp.description && exp.amount > 0;

  const inputStyle: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none" };
  const Label = ({ text }: { text: string }) => <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, marginBottom: 5 }}>{text}</p>;

  const submit = () => {
    if (entryType === "supplier" && apValid) {
      addAPRecord({ ...ap, paid: 0, status: "Outstanding" });
      onClose();
    } else if (entryType === "expense" && expValid) {
      addExpense(exp);
      onClose();
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", zIndex: 71, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ArrowUpCircle size={15} color={AA} />
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Add Payable / Expense</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={15} /></button>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Type toggle */}
          <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10 }}>
            {(["supplier", "expense"] as const).map(t => (
              <button key={t} onClick={() => setEntryType(t)} style={{ flex: 1, padding: "7px", borderRadius: 7, fontSize: 12.5, fontWeight: entryType === t ? 600 : 400, background: entryType === t ? "var(--bg-card)" : "transparent", border: entryType === t ? `1px solid ${AA}30` : "1px solid transparent", color: entryType === t ? "var(--text-primary)" : "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>
                {t === "supplier" ? "Supplier Invoice" : "Direct Expense"}
              </button>
            ))}
          </div>

          {entryType === "supplier" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><Label text="Supplier Name" /><input value={ap.supplierName} onChange={e => setAP(p => ({ ...p, supplierName: e.target.value }))} placeholder="Supplier name" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
                <div><Label text="Invoice No." /><input value={ap.invoiceNo} onChange={e => setAP(p => ({ ...p, invoiceNo: e.target.value }))} placeholder="e.g. SUPP-001" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
              </div>
              <div><Label text="Category" />
                <select value={ap.category} onChange={e => setAP(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", appearance: "none" }}>
                  {["Inventory", "Equipment", "Services", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><Label text="Invoice Date" /><input type="date" value={ap.invoiceDate} onChange={e => setAP(p => ({ ...p, invoiceDate: e.target.value }))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
                <div><Label text="Due Date" /><input type="date" value={ap.dueDate} onChange={e => setAP(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div><Label text="Amount (Rs.)" /><input type="number" min={1} value={ap.amount || ""} onChange={e => setAP(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
                <div><Label text="Notes (optional)" /><input value={ap.notes} onChange={e => setAP(p => ({ ...p, notes: e.target.value }))} placeholder="Notes…" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><Label text="Date" /><input type="date" value={exp.date} onChange={e => setExp(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
                <div><Label text="Category" />
                  <select value={exp.category} onChange={e => setExp(p => ({ ...p, category: e.target.value as ExpenseCategory }))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", appearance: "none" }}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><Label text="Description *" /><input value={exp.description} onChange={e => setExp(p => ({ ...p, description: e.target.value }))} placeholder="Brief description…" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><Label text="Amount (Rs.)" /><input type="number" min={1} value={exp.amount || ""} onChange={e => setExp(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
                <div><Label text="Payment Method" />
                  <select value={exp.paymentMethod} onChange={e => setExp(p => ({ ...p, paymentMethod: e.target.value as Expense["paymentMethod"] }))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", appearance: "none" }}>
                    {["Cash", "Bank Transfer", "Card"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><Label text="Vendor (optional)" /><input value={exp.vendor} onChange={e => setExp(p => ({ ...p, vendor: e.target.value }))} placeholder="Vendor name" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
                <div><Label text="Reference (optional)" /><input value={exp.reference} onChange={e => setExp(p => ({ ...p, reference: e.target.value }))} placeholder="Receipt / ref no." style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
              </div>
            </>
          )}

          <button onClick={submit} disabled={entryType === "supplier" ? !apValid : !expValid} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, background: (entryType === "supplier" ? apValid : expValid) ? AA : "var(--bg-secondary)", color: (entryType === "supplier" ? apValid : expValid) ? "#000" : "var(--text-muted)", cursor: (entryType === "supplier" ? apValid : expValid) ? "pointer" : "not-allowed", fontFamily: ff }}>
            {entryType === "supplier" ? "Add Supplier Invoice" : "Record Expense"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountsPayable() {
  const { apRecords, expenses, getAPAgeing } = useAccounts();
  const [tab,          setTab]         = useState<"payables" | "expenses">("payables");
  const [search,       setSearch]      = useState("");
  const [filterStatus, setFilterStatus]= useState<"All" | APRecord["status"]>("All");
  const [payRecord,    setPayRecord]   = useState<APRecord | null>(null);
  const [showAdd,      setShowAdd]     = useState(false);

  const aging    = useMemo(() => getAPAgeing(), [getAPAgeing]);
  const filtered = useMemo(() => {
    return apRecords
      .filter(r => filterStatus === "All" || r.status === filterStatus)
      .filter(r => !search || r.supplierName.toLowerCase().includes(search.toLowerCase()) || r.invoiceNo.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [apRecords, filterStatus, search]);

  const filteredExp = useMemo(() => {
    return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses]);

  const overdueTotal = aging.slice(1).reduce((s, b) => s + b.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const inputStyle: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none" };
  const isMobile = useIsMobile();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>
      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Accounts Payable</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Supplier invoices, payables & expense management</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, background: AA, border: "none", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff }}>
          <Plus size={14} /> Add Payable
        </button>
      </div>

      {/* Aging summary */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {aging.map((b, i) => {
          const colors = ["#34d399", "#fbbf24", "#f97316", "#f87171", "#dc2626"];
          return (
            <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-card)", border: `1px solid ${b.total > 0 && i > 0 ? colors[i] + "30" : "var(--border)"}` }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{b.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: b.total > 0 ? colors[i] : "var(--text-muted)", fontFamily: ff }}>Rs. {b.total.toLocaleString()}</p>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginTop: 3 }}>{b.records.length} invoice{b.records.length !== 1 ? "s" : ""}</p>
            </div>
          );
        })}
      </div>

      {overdueTotal > 0 && (
        <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}>
          <AlertTriangle size={14} color="#f97316" />
          <p style={{ fontSize: 12.5, color: "#f97316", fontFamily: ff }}><strong>Rs. {overdueTotal.toLocaleString()}</strong> to suppliers is past due. Pay immediately to maintain supplier relationships.</p>
        </div>
      )}

      {/* Tab bar */}
      <div className={`fade-up${isMobile ? " tabs-scroll" : ""}`}>
      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
        {(["payables", "expenses"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 18px", borderRadius: 7, fontSize: 13, fontFamily: ff, background: tab === t ? "var(--bg-secondary)" : "transparent", border: tab === t ? `1px solid ${AA}30` : "1px solid transparent", color: tab === t ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: tab === t ? 600 : 400, cursor: "pointer" }}>
            {t === "payables" ? "Supplier Invoices" : `Expenses (Rs. ${totalExpenses.toLocaleString()})`}
          </button>
        ))}
      </div>
      </div>

      {/* Payables table */}
      {tab === "payables" && (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
            <div style={{ position: "relative", flex: isMobile ? undefined : 1 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input placeholder="Search supplier or invoice…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div className={isMobile ? "tabs-scroll" : undefined}>
            <div style={{ display: "flex", gap: 6, width: "fit-content" }}>
              {(["All", "Outstanding", "Partial", "Overdue", "Paid"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: filterStatus === s ? 600 : 400, background: filterStatus === s ? `${AA}12` : "var(--bg-secondary)", border: `1px solid ${filterStatus === s ? AA + "30" : "var(--border)"}`, color: filterStatus === s ? AA : "var(--text-secondary)", cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap" }}>
                  {s}
                </button>
              ))}
            </div>
            </div>
          </div>

          <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  {["Supplier", "Invoice No.", "Category", "Invoice Date", "Due Date", "Amount", "Paid", "Balance", "Status", "Action"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No payables found.</td></tr>
                ) : filtered.map((r, i) => {
                  const sCfg   = STATUS_CFG[r.status];
                  const balance = r.amount - r.paid;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", background: r.status === "Overdue" ? "rgba(249,115,22,0.03)" : i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.supplierName}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontFamily: ff }}>{r.invoiceNo}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 20, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: ff }}>{r.category}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontFamily: ff, whiteSpace: "nowrap" }}>{r.invoiceDate}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Calendar size={10} color={r.status === "Overdue" ? "#f87171" : "var(--text-muted)"} />
                          <span style={{ fontSize: 12, color: r.status === "Overdue" ? "#f87171" : "var(--text-secondary)", fontFamily: ff, fontWeight: r.status === "Overdue" ? 600 : 400 }}>{r.dueDate}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>Rs. {r.amount.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", color: "#34d399", fontFamily: ff }}>Rs. {r.paid.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: balance > 0 ? "#f87171" : "#34d399", fontFamily: ff }}>Rs. {balance.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: sCfg.color, background: sCfg.bg, border: `1px solid ${sCfg.border}`, fontFamily: ff }}>{r.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {r.status !== "Paid" && (
                          <button onClick={() => setPayRecord(r)} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", cursor: "pointer", fontFamily: ff, whiteSpace: "nowrap" }}>
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expenses table */}
      {tab === "expenses" && (
        <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Date", "Category", "Description", "Vendor", "Payment Method", "Reference", "Amount"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredExp.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No expenses recorded.</td></tr>
              ) : filteredExp.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontFamily: ff }}>{e.date}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${AA}12`, color: AA, border: `1px solid ${AA}25`, fontFamily: ff }}>{e.category}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontFamily: ff }}>{e.description}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontFamily: ff }}>{e.vendor || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontFamily: ff }}>{e.paymentMethod}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontFamily: ff }}>{e.reference || "—"}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#f87171", fontFamily: ff }}>Rs. {e.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {filteredExp.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
                  <td colSpan={6} style={{ padding: "10px 12px", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>TOTAL EXPENSES</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#f87171", fontFamily: ff }}>Rs. {totalExpenses.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {payRecord && <APPaymentModal record={payRecord} onClose={() => setPayRecord(null)} />}
      {showAdd    && <AddAPModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
