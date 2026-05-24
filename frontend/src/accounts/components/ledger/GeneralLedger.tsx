"use client";

import { useState, useMemo } from "react";
import { BookOpen, Plus, ChevronDown, ChevronRight, Check, X, AlertCircle, Search } from "lucide-react";
import { useAccounts, type JournalEntry, type JournalLine } from "@/accounts/contexts/AccountsContext";
import { CHART_OF_ACCOUNTS, COA_TYPE_ORDER, type AccountType } from "@/accounts/data/chartOfAccounts";

const AA = "#f59e0b";
const ff = "'Plus Jakarta Sans', sans-serif";

const TYPE_COLOR: Record<AccountType, string> = {
  Asset:     "#34d399",
  Liability: "#f87171",
  Equity:    "#a78bfa",
  Revenue:   AA,
  COGS:      "#f97316",
  Expense:   "#60a5fa",
};

const STATUS_CFG = {
  Posted: { color: "#34d399", bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.25)"   },
  Draft:  { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   border: "rgba(251,191,36,0.25)"   },
  Voided: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)",  border: "rgba(148,163,184,0.25)"  },
};

// ─── New Journal Entry Modal ──────────────────────────────────────────────────

function NewEntryModal({ onClose }: { onClose: () => void }) {
  const { addJournalEntry } = useAccounts();
  const [description, setDesc] = useState("");
  const [reference,   setRef]  = useState("");
  const [date,        setDate] = useState("2026-05-22");
  const [lines, setLines] = useState<Partial<JournalLine>[]>([
    { accountCode: "", accountName: "", debit: 0, credit: 0, memo: "" },
    { accountCode: "", accountName: "", debit: 0, credit: 0, memo: "" },
  ]);

  const totalDR  = lines.reduce((s, l) => s + (l.debit  ?? 0), 0);
  const totalCR  = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const balanced = Math.abs(totalDR - totalCR) < 0.01 && totalDR > 0;

  const setLine = (i: number, field: keyof JournalLine, value: string | number) => {
    setLines(prev => {
      const next = [...prev];
      if (field === "accountCode") {
        const acct = CHART_OF_ACCOUNTS.find(a => a.code === String(value));
        next[i] = { ...next[i], accountCode: String(value), accountName: acct?.name ?? "" };
      } else {
        (next[i] as any)[field] = value;
      }
      return next;
    });
  };

  const addLine = () => setLines(prev => [...prev, { accountCode: "", accountName: "", debit: 0, credit: 0, memo: "" }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, j) => j !== i));

  const submit = (status: "Draft" | "Posted") => {
    if (!description.trim()) return;
    const validLines = lines.filter(l => l.accountCode && (l.debit! > 0 || l.credit! > 0)) as JournalLine[];
    if (validLines.length < 2) return;
    addJournalEntry({ date, reference: reference || `MAN-${Date.now()}`, description: description.trim(), lines: validLines, status, createdBy: "Accounts" });
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 7,
    padding: "7px 10px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none",
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 740, maxHeight: "90vh", background: "var(--bg-card)", borderRadius: 16,
        border: "1px solid var(--border)", display: "flex", flexDirection: "column",
        zIndex: 71, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BookOpen size={15} color={AA} />
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>New Journal Entry</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={15} /></button>
        </div>

        <div style={{ overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Meta row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", fontFamily: ff, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", fontFamily: ff, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reference</p>
              <input value={reference} onChange={e => setRef(e.target.value)} placeholder="e.g. INV-2026-001" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", fontFamily: ff, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description *</p>
              <input value={description} onChange={e => setDesc(e.target.value)} placeholder="Brief description of this entry…" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* Lines table */}
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Account", "Memo", "Debit (Rs.)", "Credit (Rs.)", ""].map(h => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td style={{ padding: "5px 8px", width: "35%" }}>
                      <select value={line.accountCode ?? ""} onChange={e => setLine(i, "accountCode", e.target.value)}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", appearance: "none" }}>
                        <option value="">Select account…</option>
                        {COA_TYPE_ORDER.map(type => (
                          <optgroup key={type} label={type}>
                            {CHART_OF_ACCOUNTS.filter(a => a.type === type && a.isActive).map(a => (
                              <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "5px 8px", width: "25%" }}>
                      <input value={line.memo ?? ""} onChange={e => setLine(i, "memo", e.target.value)} placeholder="Optional memo…"
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                    </td>
                    <td style={{ padding: "5px 8px", width: "17%" }}>
                      <input type="number" min={0} value={line.debit ?? 0} onChange={e => setLine(i, "debit", parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "5px 8px", width: "17%" }}>
                      <input type="number" min={0} value={line.credit ?? 0} onChange={e => setLine(i, "credit", parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "5px 8px", width: "6%" }}>
                      {lines.length > 2 && (
                        <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 3 }}>
                          <X size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td colSpan={2} style={{ padding: "8px", textAlign: "right" }}>
                    <button onClick={addLine} style={{ fontSize: 11.5, color: AA, background: "none", border: "none", cursor: "pointer", fontFamily: ff, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                      <Plus size={12} /> Add Line
                    </button>
                  </td>
                  <td style={{ padding: "8px", textAlign: "right", fontSize: 12.5, fontWeight: 700, color: balanced ? "#34d399" : "#f87171", fontFamily: ff }}>
                    Rs. {totalDR.toLocaleString()}
                  </td>
                  <td style={{ padding: "8px", textAlign: "right", fontSize: 12.5, fontWeight: 700, color: balanced ? "#34d399" : "#f87171", fontFamily: ff }}>
                    Rs. {totalCR.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>

            {!balanced && totalDR > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: "rgba(248,113,113,0.08)", borderRadius: 7, border: "1px solid rgba(248,113,113,0.2)", marginTop: 8 }}>
                <AlertCircle size={12} color="#f87171" />
                <span style={{ fontSize: 11.5, color: "#f87171", fontFamily: ff }}>Entry does not balance — debits must equal credits</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => submit("Draft")} disabled={!description.trim()} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer", fontFamily: ff }}>
            Save as Draft
          </button>
          <button onClick={() => submit("Posted")} disabled={!balanced || !description.trim()} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, border: "none", background: balanced && description.trim() ? AA : "var(--bg-secondary)", color: balanced && description.trim() ? "#000" : "var(--text-muted)", cursor: balanced && description.trim() ? "pointer" : "not-allowed", fontFamily: ff }}>
            Post Entry
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GeneralLedger() {
  const { journalEntries, voidJournalEntry, getAccountBalance } = useAccounts();
  const [tab,        setTab]        = useState<"coa" | "journal">("journal");
  const [search,     setSearch]     = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew,    setShowNew]    = useState(false);
  const [filterType, setFilterType] = useState<"All" | "Posted" | "Draft" | "Voided">("All");

  const filteredEntries = useMemo(() => {
    return journalEntries
      .filter(e => filterType === "All" || e.status === filterType)
      .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.reference.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [journalEntries, filterType, search]);

  const coaGrouped = useMemo(() => {
    const result: Record<string, { account: typeof CHART_OF_ACCOUNTS[0]; balance: number }[]> = {};
    for (const type of COA_TYPE_ORDER) {
      result[type] = CHART_OF_ACCOUNTS
        .filter(a => a.type === type && a.isActive)
        .map(a => ({ account: a, balance: getAccountBalance(a.code) }));
    }
    return result;
  }, [getAccountBalance]);

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "8px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>

      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>General Ledger</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Chart of accounts and double-entry journal</p>
        </div>
        {tab === "journal" && (
          <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, background: AA, border: "none", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff }}>
            <Plus size={14} /> New Entry
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="fade-up" style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
        {(["journal", "coa"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 18px", borderRadius: 7, fontSize: 13, fontFamily: ff,
            background: tab === t ? "var(--bg-secondary)" : "transparent",
            border: tab === t ? `1px solid ${AA}30` : "1px solid transparent",
            color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: tab === t ? 600 : 400, cursor: "pointer",
          }}>
            {t === "journal" ? "Journal Entries" : "Chart of Accounts"}
          </button>
        ))}
      </div>

      {/* Journal Entries view */}
      {tab === "journal" && (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input placeholder="Search entries…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: "100%", paddingLeft: 32, boxSizing: "border-box" }} />
            </div>
            {(["All", "Posted", "Draft", "Voided"] as const).map(s => (
              <button key={s} onClick={() => setFilterType(s)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: filterType === s ? 600 : 400, background: filterType === s ? `${AA}12` : "var(--bg-secondary)", border: `1px solid ${filterType === s ? AA + "30" : "var(--border)"}`, color: filterType === s ? AA : "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  {["", "Entry ID", "Date", "Reference", "Description", "Debit", "Credit", "Status", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontFamily: ff }}>No entries found.</td></tr>
                ) : filteredEntries.map((entry, i) => {
                  const totalDR = entry.lines.reduce((s, l) => s + l.debit, 0);
                  const totalCR = entry.lines.reduce((s, l) => s + l.credit, 0);
                  const sCfg   = STATUS_CFG[entry.status];
                  const expanded = expandedId === entry.id;

                  return (
                    <>
                      <tr key={entry.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)", cursor: "pointer" }} onClick={() => setExpandedId(expanded ? null : entry.id)}>
                        <td style={{ padding: "10px 12px", width: 20 }}>
                          {expanded ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, whiteSpace: "nowrap" }}>{entry.id}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontFamily: ff, whiteSpace: "nowrap" }}>{entry.date}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontFamily: ff }}>{entry.reference}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontFamily: ff, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.description}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>Rs. {totalDR.toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>Rs. {totalCR.toLocaleString()}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: sCfg.color, background: sCfg.bg, border: `1px solid ${sCfg.border}`, fontFamily: ff }}>{entry.status}</span>
                        </td>
                        <td style={{ padding: "10px 8px" }} onClick={e => e.stopPropagation()}>
                          {entry.status === "Posted" && (
                            <button onClick={() => voidJournalEntry(entry.id)} title="Void entry" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 5, fontSize: 10.5, fontFamily: ff }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                            >Void</button>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${entry.id}-exp`} style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                          <td colSpan={9} style={{ padding: "0 12px 10px 40px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                              <thead>
                                <tr>
                                  {["Account Code", "Account Name", "Memo", "Debit", "Credit"].map(h => (
                                    <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {entry.lines.map((line, j) => (
                                  <tr key={j} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "5px 8px", fontWeight: 600, color: AA, fontFamily: ff, fontSize: 12 }}>{line.accountCode}</td>
                                    <td style={{ padding: "5px 8px", color: "var(--text-primary)", fontFamily: ff, fontSize: 12 }}>{line.accountName}</td>
                                    <td style={{ padding: "5px 8px", color: "var(--text-muted)", fontFamily: ff, fontSize: 11.5 }}>{line.memo || "—"}</td>
                                    <td style={{ padding: "5px 8px", color: line.debit > 0 ? "var(--text-primary)" : "var(--text-muted)", fontFamily: ff, fontSize: 12, fontWeight: line.debit > 0 ? 600 : 400 }}>{line.debit > 0 ? `Rs. ${line.debit.toLocaleString()}` : "—"}</td>
                                    <td style={{ padding: "5px 8px", color: line.credit > 0 ? "var(--text-primary)" : "var(--text-muted)", fontFamily: ff, fontSize: 12, fontWeight: line.credit > 0 ? 600 : 400 }}>{line.credit > 0 ? `Rs. ${line.credit.toLocaleString()}` : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COA view */}
      {tab === "coa" && (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {COA_TYPE_ORDER.map(type => {
            const accounts = coaGrouped[type] ?? [];
            const total    = accounts.reduce((s, a) => s + a.balance, 0);
            const color    = TYPE_COLOR[type];
            return (
              <div key={type} style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", background: `${color}08`, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, textTransform: "uppercase", letterSpacing: "0.05em" }}>{type}</p>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>{accounts.length} accounts</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: ff }}>Total: Rs. {total.toLocaleString()}</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {accounts.map((a, i) => (
                      <tr key={a.account.code} style={{ borderBottom: i < accounts.length - 1 ? "1px solid var(--border)" : "none", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                        <td style={{ padding: "9px 16px", width: 80, fontWeight: 700, color, fontFamily: ff, fontSize: 12 }}>{a.account.code}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-primary)", fontFamily: ff, fontSize: 12.5 }}>{a.account.name}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-muted)", fontFamily: ff, fontSize: 11.5 }}>{a.account.subtype}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-muted)", fontFamily: ff, fontSize: 11 }}>{a.account.normalBalance}-normal</td>
                        <td style={{ padding: "9px 16px", textAlign: "right", fontWeight: 700, color: a.balance !== 0 ? "var(--text-primary)" : "var(--text-muted)", fontFamily: ff, fontSize: 12.5 }}>
                          Rs. {a.balance.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewEntryModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
