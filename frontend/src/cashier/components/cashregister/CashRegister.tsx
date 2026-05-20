"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Calculator, ArrowDownLeft, ArrowUpRight, Lock,
  DollarSign, X, AlertTriangle, CheckCircle, Clock,
  UserCheck, History as HistoryIcon, Play,
} from "lucide-react";
import { useCashRegister, type CashEntry } from "@/cashier/contexts/CashRegisterContext";
import { useShift } from "@/cashier/contexts/ShiftContext";
import ExportButtons from "@/cashier/components/shared/ExportButtons";
import { exportToPdf, exportToExcel, exportToPng } from "@/cashier/utils/exportUtils";

type CRTab = "Cash Float" | "Transactions" | "End of Day" | "Shift History";

const tabs: { id: CRTab; icon: any; label: string }[] = [
  { id: "Cash Float",    icon: DollarSign,    label: "Cash Float" },
  { id: "Transactions",  icon: Calculator,    label: "Transactions" },
  { id: "End of Day",    icon: Lock,          label: "End of Day" },
  { id: "Shift History", icon: HistoryIcon,   label: "Shift History" },
];

const tabDescriptions: Record<CRTab, string> = {
  "Cash Float":    "View current drawer balance and open a new shift",
  "Transactions":  "Log cash-in and cash-out movements during the shift",
  "End of Day":    "Close the shift, reconcile cash, and print the Z-report",
  "Shift History": "View all past shifts, cashier assignments, and variance records",
};

function fmtRs(n: number) { return `Rs. ${n.toLocaleString()}`; }
function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(d: Date) {
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}


/* ── Add Cash Entry Modal ── */
function AddEntryModal({ type, onAdd, onClose }: {
  type: "in" | "out";
  onAdd: (amount: number, reason: string) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const isIn = type === "in";
  const color = isIn ? "#4ade80" : "#f87171";
  const borderColor = isIn ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)";
  const bg = isIn ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)";

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 9, padding: "10px 12px", fontSize: 13,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1010, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 400,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: bg, border: `1px solid ${borderColor}`,
            display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0,
          }}>
            {isIn ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
              {isIn ? "Cash In" : "Cash Out"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {isIn ? "Record incoming cash" : "Record outgoing cash"}
            </p>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Amount (Rs.)
            </label>
            <input
              type="number" min="0"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Reason / Note
            </label>
            <input
              placeholder={isIn ? "e.g. Cash sale payment" : "e.g. Petty cash for supplies"}
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>Cancel</button>
          <button
            disabled={!amount || !reason || Number(amount) <= 0}
            onClick={() => { onAdd(Number(amount), reason); onClose(); }}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 9,
              border: `1px solid ${borderColor}`, background: bg,
              color, cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              opacity: !amount || !reason || Number(amount) <= 0 ? 0.4 : 1,
            }}>
            Confirm {isIn ? "Cash In" : "Cash Out"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Open Shift Screen ── */
function OpenShiftScreen({ onOpen }: { onOpen: (cashier: string, float: number) => void }) {
  const [cashier, setCashier] = useState("");
  const [float,   setFloat]   = useState("5000");

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 9, padding: "11px 14px", fontSize: 14, fontWeight: 600,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 24 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)",
      }}>
        <UserCheck size={28} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Open a New Shift</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Enter cashier name and opening float to start the shift.</p>
      </div>

      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cashier Name</label>
          <input
            placeholder="e.g. Kamal Perera"
            value={cashier}
            onChange={e => setCashier(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Opening Float (Rs.)</label>
          <input
            type="number" min="0"
            value={float}
            onChange={e => setFloat(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          disabled={!cashier.trim() || !float || Number(float) < 0}
          onClick={() => onOpen(cashier.trim(), Number(float))}
          style={{
            padding: "13px 0", borderRadius: 10, border: "1px solid var(--accent-glow)",
            background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
            fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: !cashier.trim() || !float || Number(float) < 0 ? 0.4 : 1,
          }}>
          <Play size={14} /> Open Shift
        </button>
      </div>
    </div>
  );
}

/* ── Shift History tab ── */
function ShiftHistory() {
  const { shiftHistory, currentShift } = useShift();

  const fmtDT = (d: Date) => new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  const allShifts = currentShift
    ? [currentShift, ...shiftHistory]
    : shiftHistory;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)" }}>
              {["Shift ID", "Cashier", "Opened At", "Closed At", "Opening Float", "Closing Balance", "Variance", "Status"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", textAlign: "left", fontSize: 11,
                  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allShifts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No shift history yet.
                </td>
              </tr>
            ) : allShifts.map((s, i) => {
              const isOpen = s.status === "open";
              return (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 1 ? "var(--bg-secondary)" : "transparent" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{s.id.slice(-8)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-primary)" }}>{s.cashier}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDT(s.openedAt)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {s.closedAt ? fmtDT(s.closedAt) : <span style={{ color: "#4ade80", fontWeight: 600 }}>Active</span>}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-primary)" }}>{fmtRs(s.openingFloat)}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-primary)" }}>
                    {s.closingBalance !== undefined ? fmtRs(s.closingBalance) : "—"}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    {s.variance !== undefined ? (
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: s.variance === 0 ? "#4ade80" : s.variance > 0 ? "#60a5fa" : "#f87171",
                      }}>
                        {s.variance > 0 ? "+" : ""}{fmtRs(s.variance)}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      color: isOpen ? "#4ade80" : "var(--text-muted)",
                      background: isOpen ? "rgba(74,222,128,0.1)" : "var(--bg-secondary)",
                      border: `1px solid ${isOpen ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
                    }}>
                      {isOpen ? "Open" : "Closed"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Cash Float tab ── */
function CashFloat({ log }: { log: CashEntry[] }) {
  const balance = log.reduce((a, e) => e.type === "in" ? a + e.amount : a - e.amount, 0);
  const openFloat = log.find(e => e.reason === "Opening Float")?.amount ?? 0;
  const cashIn    = log.filter(e => e.type === "in" && e.reason !== "Opening Float").reduce((a, e) => a + e.amount, 0);
  const cashOut   = log.filter(e => e.type === "out").reduce((a, e) => a + e.amount, 0);

  const cards = [
    { label: "Current Balance", value: fmtRs(balance), color: "#4ade80", large: true },
    { label: "Opening Float",   value: fmtRs(openFloat), color: "var(--text-primary)", large: false },
    { label: "Cash In",         value: fmtRs(cashIn),   color: "#4ade80",  large: false },
    { label: "Cash Out",        value: fmtRs(cashOut),  color: "#f87171",  large: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
            padding: c.large ? "22px 24px" : "16px 18px",
          }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{c.label}</p>
            <p style={{ fontSize: c.large ? 28 : 18, fontWeight: 800, color: c.color, letterSpacing: "-0.02em" }}>{c.value}</p>
            {c.large && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                Shift opened at {fmtTime(log[0]?.time ?? new Date())}
              </p>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Denomination Tracker</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {[5000, 2000, 1000, 500, 100, 50].map(denom => (
            <div key={denom} style={{
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: 9, padding: "10px 12px", textAlign: "center",
            }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Rs. {denom}</p>
              <input
                type="number" min="0" defaultValue="0"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  textAlign: "center", fontSize: 16, fontWeight: 700, color: "var(--text-primary)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              />
              <p style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>notes</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>
          Enter the count of each denomination to verify physical cash count.
        </p>
      </div>
    </div>
  );
}

/* ── Transactions tab ── */
function Transactions({ log, onAdd }: { log: CashEntry[]; onAdd: (type: "in" | "out") => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const TX_HEADERS   = ["Date/Time", "Type", "Reason", "Amount (Rs.)", "By"];
  const txRows       = () => [...log].reverse().map(e => [
    new Date(e.time).toLocaleString("en-GB"),
    e.type === "in" ? "Cash In" : "Cash Out",
    e.reason,
    `${e.type === "out" ? "-" : "+"}${e.amount}`,
    e.by,
  ]);
  const txFilename = `cash-transactions-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => onAdd("in")} style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(74,222,128,0.3)",
          background: "rgba(74,222,128,0.08)", color: "#4ade80",
          cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          <ArrowDownLeft size={14} /> Cash In
        </button>
        <button onClick={() => onAdd("out")} style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(248,113,113,0.3)",
          background: "rgba(248,113,113,0.08)", color: "#f87171",
          cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          <ArrowUpRight size={14} /> Cash Out
        </button>
        <div style={{ marginLeft: "auto" }}>
          <ExportButtons
            onPdf={()   => exportToPdf("Cash Transactions", TX_HEADERS, txRows(), txFilename, "portrait")}
            onExcel={()  => exportToExcel(txFilename, "Transactions", TX_HEADERS, txRows())}
            onPng={()   => containerRef.current && exportToPng(containerRef.current, txFilename)}
          />
        </div>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)" }}>
              {["Time", "Type", "Reason", "Amount", "By"].map(h => (
                <th key={h} style={{
                  padding: "10px 16px", textAlign: "left", fontSize: 11,
                  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...log].reverse().map((e, i) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 1 ? "var(--bg-secondary)" : "transparent" }}>
                <td style={{ padding: "11px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={11} />
                    {fmtDateTime(e.time)}
                  </div>
                </td>
                <td style={{ padding: "11px 16px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                    color: e.type === "in" ? "#4ade80" : "#f87171",
                    background: e.type === "in" ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                    border: `1px solid ${e.type === "in" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                    textTransform: "capitalize",
                  }}>
                    {e.type === "in" ? "Cash In" : "Cash Out"}
                  </span>
                </td>
                <td style={{ padding: "11px 16px", color: "var(--text-primary)" }}>{e.reason}</td>
                <td style={{ padding: "11px 16px", fontWeight: 700, color: e.type === "in" ? "#4ade80" : "#f87171" }}>
                  {e.type === "out" ? "-" : "+"}{fmtRs(e.amount)}
                </td>
                <td style={{ padding: "11px 16px", color: "var(--text-secondary)" }}>{e.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── End of Day tab ── */
function EndOfDay({ log }: { log: CashEntry[] }) {
  const { currentShift, closeShift } = useShift();
  const [actualClose, setActualClose] = useState("");

  const expectedClose = log.reduce((a, e) => e.type === "in" ? a + e.amount : a - e.amount, 0);
  const variance      = actualClose ? Number(actualClose) - expectedClose : null;

  const handleClose = () => {
    closeShift(Number(actualClose));
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 9, padding: "10px 14px", fontSize: 14, fontWeight: 700,
    color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      {currentShift && (
        <div style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <UserCheck size={16} color="var(--accent)" />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Active Shift — {currentShift.cashier}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Opened at {currentShift.openedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} | Float: {fmtRs(currentShift.openingFloat)}
            </p>
          </div>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Closing Summary</p>
        {[
          { label: "Opening Float",    value: fmtRs(log.find(e => e.reason === "Opening Float")?.amount ?? currentShift?.openingFloat ?? 0) },
          { label: "Total Cash In",    value: fmtRs(log.filter(e => e.type === "in").reduce((a, e) => a + e.amount, 0)) },
          { label: "Total Cash Out",   value: fmtRs(log.filter(e => e.type === "out").reduce((a, e) => a + e.amount, 0)) },
          { label: "Expected Closing", value: fmtRs(expectedClose), bold: true },
        ].map(row => (
          <div key={row.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 0", borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: 13, color: row.bold ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: "var(--text-primary)" }}>{row.value}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
        <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Actual Closing Balance (Rs.)
        </label>
        <input
          type="number" min="0"
          placeholder={String(expectedClose)}
          value={actualClose}
          onChange={e => setActualClose(e.target.value)}
          style={inputStyle}
        />
        {variance !== null && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 9,
            background: variance === 0 ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
            border: `1px solid ${variance === 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {variance !== 0 && <AlertTriangle size={14} color="#f87171" />}
              {variance === 0 && <CheckCircle size={14} color="#4ade80" />}
              <p style={{ fontSize: 12.5, fontWeight: 600, color: variance === 0 ? "#4ade80" : "#f87171" }}>
                {variance === 0
                  ? "Cash balanced — no variance."
                  : `Variance: ${variance > 0 ? "+" : ""}${fmtRs(variance)} (${variance > 0 ? "overage" : "shortage"})`}
              </p>
            </div>
          </div>
        )}
      </div>

      <button
        disabled={!actualClose || Number(actualClose) < 0}
        onClick={handleClose}
        style={{
          padding: "12px 0", borderRadius: 10, border: "1px solid var(--accent-glow)",
          background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer",
          fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          opacity: !actualClose || Number(actualClose) < 0 ? 0.4 : 1,
        }}>
        <Lock size={14} /> Close Shift & Save Z-Report
      </button>
    </div>
  );
}

/* ── Main Component ── */
export default function CashRegister() {
  const [active, setActive] = useState<CRTab>("Cash Float");
  const { log, addEntry } = useCashRegister();
  const { currentShift, openShift } = useShift();
  const [addModal, setAddModal] = useState<"in" | "out" | null>(null);

  const ActiveIcon = tabs.find(t => t.id === active)!.icon;

  const handleAdd = (amount: number, reason: string) => {
    if (!addModal) return;
    addEntry(addModal, reason, amount);
  };

  const handleOpenShift = (cashier: string, float: number) => {
    openShift(cashier, float);
    addEntry("in", "Opening Float", float);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minHeight: 0 }}>

      {/* Header + sub-nav */}
      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Cash Register</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
            Manage the cash drawer, log movements, and close the shift.
          </p>
        </div>

        <div style={{
          display: "flex", gap: 4,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 5,
        }}>
          {tabs.map(({ id, icon: Icon, label }) => {
            const isActive = active === id;
            return (
              <button key={id} onClick={() => setActive(id)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8, fontSize: 12.5,
                border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent",
                background: isActive ? "var(--accent-dim)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer", transition: "all 0.18s",
                fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap",
              }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}}
              >
                <Icon size={13} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section header */}
      <div className="fade-up fade-up-2" style={{
        display: "flex", alignItems: "center", gap: 10,
        paddingBottom: 16, borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: "var(--accent-dim)",
          border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center",
          justifyContent: "center", color: "var(--accent)",
        }}>
          <ActiveIcon size={15} strokeWidth={2.2} />
        </div>
        <div>
          <h2 className="heading" style={{ fontSize: 15, color: "var(--text-primary)" }}>{active}</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{tabDescriptions[active]}</p>
        </div>
      </div>

      {/* Active shift banner */}
      {currentShift && (
        <div className="fade-up fade-up-2" style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)",
          borderRadius: 10, padding: "10px 16px",
        }}>
          <UserCheck size={14} color="#4ade80" />
          <p style={{ fontSize: 12.5, color: "#4ade80", fontWeight: 600 }}>
            Shift Open — {currentShift.cashier}
          </p>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
            Since {currentShift.openedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="fade-up fade-up-3" style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
        {!currentShift && active !== "Shift History" ? (
          <OpenShiftScreen onOpen={handleOpenShift} />
        ) : (
          <>
            {active === "Cash Float"    && <CashFloat log={log} />}
            {active === "Transactions"  && <Transactions log={log} onAdd={type => setAddModal(type)} />}
            {active === "End of Day"    && <EndOfDay log={log} />}
            {active === "Shift History" && <ShiftHistory />}
          </>
        )}
      </div>

      {addModal && (
        <AddEntryModal type={addModal} onAdd={handleAdd} onClose={() => setAddModal(null)} />
      )}
    </div>
  );
}
