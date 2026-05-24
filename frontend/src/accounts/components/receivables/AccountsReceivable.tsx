"use client";

import { useState, useMemo } from "react";
import { ArrowDownCircle, Search, Plus, CheckCircle, AlertTriangle, X, Phone, Calendar } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { useAccounts, type ARRecord } from "@/accounts/contexts/AccountsContext";

const AA = "#f59e0b";
const ff = "'Plus Jakarta Sans', sans-serif";

const STATUS_CFG: Record<ARRecord["status"], { color: string; bg: string; border: string }> = {
  Outstanding: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)"  },
  Partial:     { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
  Overdue:     { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Paid:        { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
};

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ record, onClose }: { record: ARRecord; onClose: () => void }) {
  const { recordARPayment } = useAccounts();
  const [amount, setAmount] = useState(record.amount - record.paid);
  const [method, setMethod] = useState("Cash");
  const [note,   setNote]   = useState("");

  const balance = record.amount - record.paid;
  const valid   = amount > 0 && amount <= balance;

  const submit = () => {
    if (!valid) return;
    recordARPayment(record.id, amount);
    onClose();
  };

  const inputStyle: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none" };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 440, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", zIndex: 71, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle size={15} color="#34d399" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Record Payment</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{record.invoiceNo} · {record.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={15} /></button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 2 }}>Invoice Total</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Rs. {record.amount.toLocaleString()}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 2 }}>Outstanding Balance</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#f87171", fontFamily: ff }}>Rs. {balance.toLocaleString()}</p>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, marginBottom: 6 }}>Payment Amount (Rs.)</p>
            <input type="number" min={1} max={balance} value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            {amount > balance && <p style={{ fontSize: 11, color: "#f87171", fontFamily: ff, marginTop: 4 }}>Amount cannot exceed outstanding balance</p>}
          </div>

          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, marginBottom: 6 }}>Payment Method</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["Cash", "Bank Transfer", "Card"].map(m => (
                <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${method === m ? AA + "40" : "var(--border)"}`, background: method === m ? `${AA}12` : "var(--bg-secondary)", color: method === m ? AA : "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, marginBottom: 6 }}>Note (optional)</p>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Payment reference or note…" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
          </div>

          <button onClick={submit} disabled={!valid} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, background: valid ? "#34d399" : "var(--bg-secondary)", color: valid ? "#000" : "var(--text-muted)", cursor: valid ? "pointer" : "not-allowed", fontFamily: ff }}>
            Confirm Payment — Rs. {amount.toLocaleString()}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── New AR Record Modal ──────────────────────────────────────────────────────

function NewARModal({ onClose }: { onClose: () => void }) {
  const { addARRecord } = useAccounts();
  const [form, setForm] = useState({ invoiceNo: "", customerName: "", phone: "", invoiceDate: "2026-05-22", dueDate: "", type: "Repair" as ARRecord["type"], amount: 0 });

  const valid = form.invoiceNo && form.customerName && form.dueDate && form.amount > 0;
  const set   = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = () => {
    if (!valid) return;
    addARRecord({ ...form, paid: 0, status: "Outstanding" });
    onClose();
  };

  const inputStyle: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none" };
  const Label = ({ text }: { text: string }) => <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff, marginBottom: 5 }}>{text}</p>;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 480, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", zIndex: 71, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ArrowDownCircle size={15} color={AA} />
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Add Receivable</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={15} /></button>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><Label text="Invoice No." /><input value={form.invoiceNo} onChange={e => set("invoiceNo", e.target.value)} placeholder="e.g. REP-1060" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
            <div>
              <Label text="Type" />
              <select value={form.type} onChange={e => set("type", e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", appearance: "none" }}>
                <option value="Repair">Repair</option>
                <option value="Sales">Sales</option>
              </select>
            </div>
          </div>
          <div><Label text="Customer Name" /><input value={form.customerName} onChange={e => set("customerName", e.target.value)} placeholder="Full name" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
          <div><Label text="Phone (optional)" /><input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="07X XXXXXXX" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><Label text="Invoice Date" /><input type="date" value={form.invoiceDate} onChange={e => set("invoiceDate", e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
            <div><Label text="Due Date" /><input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
          </div>
          <div><Label text="Amount (Rs.)" /><input type="number" min={1} value={form.amount || ""} onChange={e => set("amount", parseFloat(e.target.value) || 0)} placeholder="0.00" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} /></div>
          <button onClick={submit} disabled={!valid} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, marginTop: 4, background: valid ? AA : "var(--bg-secondary)", color: valid ? "#000" : "var(--text-muted)", cursor: valid ? "pointer" : "not-allowed", fontFamily: ff }}>
            Add Receivable
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountsReceivable() {
  const { arRecords, getARAgeing } = useAccounts();
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | ARRecord["status"]>("All");
  const [payRecord,    setPayRecord]    = useState<ARRecord | null>(null);
  const [showNew,      setShowNew]      = useState(false);

  const aging    = useMemo(() => getARAgeing(), [getARAgeing]);
  const filtered = useMemo(() => {
    return arRecords
      .filter(r => filterStatus === "All" || r.status === filterStatus)
      .filter(r => !search || r.customerName.toLowerCase().includes(search.toLowerCase()) || r.invoiceNo.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [arRecords, filterStatus, search]);

  const totalOutstanding = arRecords.filter(r => r.status !== "Paid").reduce((s, r) => s + (r.amount - r.paid), 0);
  const overdueTotal     = aging.slice(1).reduce((s, b) => s + b.total, 0);

  const inputStyle: React.CSSProperties = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none" };
  const isMobile = useIsMobile();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Accounts Receivable</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Customer outstanding balances and aging</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, background: AA, border: "none", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff }}>
          <Plus size={14} /> Add Receivable
        </button>
      </div>

      {/* Summary cards */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {aging.map((b, i) => {
          const colors = ["#34d399", "#fbbf24", "#f97316", "#f87171", "#dc2626"];
          return (
            <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-card)", border: `1px solid ${b.total > 0 && i > 0 ? colors[i] + "30" : "var(--border)"}` }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{b.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: b.total > 0 ? colors[i] : "var(--text-muted)", fontFamily: ff, letterSpacing: "-0.02em" }}>Rs. {b.total.toLocaleString()}</p>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginTop: 3 }}>{b.records.length} invoice{b.records.length !== 1 ? "s" : ""}</p>
            </div>
          );
        })}
      </div>

      {overdueTotal > 0 && (
        <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <AlertTriangle size={14} color="#f87171" />
          <p style={{ fontSize: 12.5, color: "#f87171", fontFamily: ff }}>
            <strong>Rs. {overdueTotal.toLocaleString()}</strong> is past due. Contact customers immediately to avoid bad debt.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="fade-up" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
        <div style={{ position: "relative", flex: isMobile ? undefined : 1 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input placeholder="Search by customer or invoice…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32, width: "100%", boxSizing: "border-box" }} />
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

      {/* Table */}
      <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Invoice No.", "Type", "Customer", "Phone", "Invoice Date", "Due Date", "Amount", "Paid", "Balance", "Status", "Action"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No records found.</td></tr>
            ) : filtered.map((r, i) => {
              const sCfg   = STATUS_CFG[r.status];
              const balance = r.amount - r.paid;
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", background: r.status === "Overdue" ? "rgba(248,113,113,0.03)" : i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{r.invoiceNo}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: r.type === "Repair" ? "rgba(96,165,250,0.12)" : `${AA}12`, color: r.type === "Repair" ? "#60a5fa" : AA, fontFamily: ff }}>{r.type}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.customerName}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.phone && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Phone size={10} color="var(--text-muted)" />
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{r.phone}</span>
                      </div>
                    )}
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
                        Record Payment
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
                <td colSpan={6} style={{ padding: "10px 12px", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>TOTAL OUTSTANDING</td>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Rs. {filtered.reduce((s, r) => s + r.amount, 0).toLocaleString()}</td>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: "#34d399", fontFamily: ff }}>Rs. {filtered.reduce((s, r) => s + r.paid, 0).toLocaleString()}</td>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: "#f87171", fontFamily: ff }}>Rs. {filtered.reduce((s, r) => s + (r.amount - r.paid), 0).toLocaleString()}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {payRecord && <PaymentModal record={payRecord} onClose={() => setPayRecord(null)} />}
      {showNew    && <NewARModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
