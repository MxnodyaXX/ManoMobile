"use client";

import { useState, useEffect } from "react";
import { Clock, Play, Square, Coffee, LogIn, Calendar } from "lucide-react";
import { useTech, type ShiftRecord } from "@/technician/contexts/TechContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

function fmt(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function calcShiftMinutes(shift: ShiftRecord): number {
  const end = shift.clockOut ?? new Date();
  let total = Math.floor((end.getTime() - shift.clockIn.getTime()) / 60_000);
  for (const b of shift.breaks) {
    if (b.end) total -= Math.floor((b.end.getTime() - b.start.getTime()) / 60_000);
    else if (!shift.clockOut) total -= Math.floor((Date.now() - b.start.getTime()) / 60_000);
  }
  return Math.max(0, total);
}

function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function LiveTimer({ since }: { since: Date }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.floor((Date.now() - since.getTime()) / 60_000);
  return <>{fmtDuration(mins)}</>;
}

export default function ShiftTracker() {
  const { technicianName, currentShift, shiftHistory, clockIn, clockOut, startBreak, endBreak } = useTech();

  const onBreak = currentShift ? currentShift.breaks.some(b => !b.end) : false;
  const activeBreak = onBreak && currentShift ? currentShift.breaks.find(b => !b.end) : null;

  const currentMins = currentShift ? calcShiftMinutes(currentShift) : 0;
  const totalBreakMins = currentShift
    ? currentShift.breaks
        .filter(b => b.end)
        .reduce((s, b) => s + Math.floor((b.end!.getTime() - b.start.getTime()) / 60_000), 0)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: ff }}>

      {/* Header */}
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Shift Tracker</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Clock in, track breaks, and view your shift history — {technicianName}</p>
      </div>

      {/* Clock widget */}
      <div className="fade-up" style={{
        padding: "28px 32px", borderRadius: 16, border: `1px solid ${currentShift ? TA + "35" : "var(--border)"}`,
        background: currentShift ? `${TA}07` : "var(--bg-card)", display: "flex", flexDirection: "column", gap: 20,
      }}>
        {/* Status row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: currentShift ? `${TA}18` : "var(--bg-secondary)",
              border: `1px solid ${currentShift ? TA + "35" : "var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Clock size={20} color={currentShift ? TA : "var(--text-muted)"} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                {currentShift ? (onBreak ? "On Break" : "Shift Active") : "Not Clocked In"}
              </p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>
                {currentShift
                  ? `Clocked in at ${fmt(currentShift.clockIn)}`
                  : "Start your shift to begin tracking"}
              </p>
            </div>
          </div>
          {currentShift && (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: TA, fontFamily: ff, letterSpacing: "-0.03em", lineHeight: 1 }}>
                <LiveTimer since={currentShift.clockIn} />
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>
                total on shift (–{fmtDuration(totalBreakMins)} breaks)
              </p>
            </div>
          )}
        </div>

        {/* Stat pills */}
        {currentShift && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Clock In",   value: fmt(currentShift.clockIn),                     color: TA },
              { label: "Work Time",  value: fmtDuration(currentMins),                       color: "#60a5fa" },
              { label: "Break Time", value: fmtDuration(totalBreakMins),                    color: "#fbbf24" },
              { label: "Breaks",     value: `${currentShift.breaks.filter(b => b.end).length} completed`, color: "#a78bfa" },
            ].map(s => (
              <div key={s.label} style={{ padding: "8px 14px", borderRadius: 9, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: ff }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!currentShift ? (
            <button onClick={clockIn} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10,
              background: TA, border: "none", color: "#000", cursor: "pointer", fontSize: 13.5, fontWeight: 700, fontFamily: ff,
            }}>
              <LogIn size={15} /> Clock In
            </button>
          ) : (
            <>
              {!onBreak ? (
                <button onClick={startBreak} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 10,
                  background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff,
                }}>
                  <Coffee size={14} /> Start Break
                </button>
              ) : (
                <button onClick={endBreak} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 10,
                  background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff,
                }}>
                  <Play size={14} /> End Break
                </button>
              )}
              {!onBreak && (
                <button onClick={clockOut} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 10,
                  background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff,
                }}>
                  <Square size={14} /> Clock Out
                </button>
              )}
            </>
          )}
        </div>

        {/* Active break notice */}
        {onBreak && activeBreak && (
          <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
            <Coffee size={14} color="#fbbf24" />
            <p style={{ fontSize: 12.5, color: "#fbbf24", fontFamily: ff }}>
              Break started at {fmt(activeBreak.start)} · <LiveTimer since={activeBreak.start} /> elapsed
            </p>
          </div>
        )}
      </div>

      {/* Shift history */}
      <div className="fade-up">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Calendar size={15} color="var(--text-muted)" />
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Shift History</p>
          {shiftHistory.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${TA}15`, color: TA, fontFamily: ff }}>{shiftHistory.length}</span>
          )}
        </div>

        {shiftHistory.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <Clock size={24} color="var(--text-muted)" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff }}>No completed shifts yet. Clock out to save your first shift.</p>
          </div>
        ) : (
          <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Clock In", "Clock Out", "Breaks", "Work Time", "Total Time"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...shiftHistory].reverse().map((s, i) => {
                  const totalTime = s.clockOut
                    ? Math.floor((s.clockOut.getTime() - s.clockIn.getTime()) / 60_000)
                    : 0;
                  const breakTime = s.breaks
                    .filter(b => b.end)
                    .reduce((acc, b) => acc + Math.floor((b.end!.getTime() - b.start.getTime()) / 60_000), 0);
                  const workTime = Math.max(0, totalTime - breakTime);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{fmtDate(s.clockIn)}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{fmt(s.clockIn)}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{s.clockOut ? fmt(s.clockOut) : "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#fbbf24", fontFamily: ff }}>{s.breaks.filter(b => b.end).length} ({fmtDuration(breakTime)})</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: TA, fontFamily: ff }}>{fmtDuration(workTime)}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontFamily: ff }}>{fmtDuration(totalTime)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
