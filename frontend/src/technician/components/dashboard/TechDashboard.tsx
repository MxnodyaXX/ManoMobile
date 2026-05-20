"use client";

import { useEffect, useState, useRef } from "react";
import {
  Wrench, Clock, CheckCircle, AlertCircle, PackageCheck,
  Play, Timer, Layers, TrendingUp, Calendar,
} from "lucide-react";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import StatusUpdateModal from "@/technician/components/jobs/StatusUpdateModal";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

function fmtMinutes(min: number) {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function fmtElapsed(startedAt: Date): string {
  const secs = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PRIORITY_CFG = {
  Low:    { color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
  Normal: { color: "#60a5fa", bg: "rgba(96,165,250,0.08)"  },
  High:   { color: "#fbbf24", bg: "rgba(251,191,36,0.08)"  },
  Urgent: { color: "#f87171", bg: "rgba(248,113,113,0.08)" },
};

export default function TechDashboard() {
  const { jobs } = useRepair();
  const { technicianName, partRequests, jobMeta, getElapsedMinutes } = useTech();
  const [, tick] = useState(0);
  const [statusModalJob, setStatusModalJob] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myJobs = jobs.filter(j => j.technician === technicianName);
  const activeJob = myJobs.find(j => j.status === "Issued");

  // Tick every second for live timer
  useEffect(() => {
    if (activeJob) {
      timerRef.current = setInterval(() => tick(n => n + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeJob?.id]);

  const stats = [
    { label: "Assigned",       value: myJobs.length,                                                      color: TA,       icon: Wrench      },
    { label: "In Progress",    value: myJobs.filter(j => j.status === "Issued").length,                   color: "#34d399", icon: Play        },
    { label: "Paused",         value: myJobs.filter(j => j.status === "Pending").length,                  color: "#fbbf24", icon: Timer       },
    { label: "Ready Pickup",   value: myJobs.filter(j => j.status === "Completed").length,                color: "#60a5fa", icon: PackageCheck },
    { label: "Parts Pending",  value: partRequests.filter(r => r.status === "Pending").length,            color: "#a78bfa", icon: Layers      },
  ];

  const pendingJobs  = myJobs.filter(j => j.status === "Pending");
  const notStarted   = myJobs.filter(j => j.status === "Non-Issued").slice(0, 3);
  const approvedParts = partRequests.filter(r => r.status === "Approved");

  const activeJobModal = statusModalJob ? myJobs.find(j => j.id === statusModalJob) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff }}>

      {/* Greeting */}
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {technicianName} 👋
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* ── ACTIVE JOB BANNER ── */}
      {activeJob ? (() => {
        const meta = jobMeta[activeJob.id];
        const elapsed = meta?.startedAt ? fmtElapsed(meta.startedAt) : "00:00";
        const pc = PRIORITY_CFG[activeJob.priority];
        return (
          <div className="fade-up" style={{
            background: `linear-gradient(135deg, ${TA}12 0%, ${TA}06 100%)`,
            border: `1px solid ${TA}35`,
            borderRadius: 16, padding: "20px 22px",
            display: "flex", alignItems: "center", gap: 18,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: `${TA}18`, border: `1px solid ${TA}35`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Wrench size={22} color={TA} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: TA, animation: "pulse-tech 2s infinite", display: "inline-block" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: TA, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: ff }}>ACTIVE JOB</span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3, fontFamily: ff }}>
                {activeJob.brand} {activeJob.model} — {activeJob.issue}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>
                  <strong style={{ color: "var(--text-secondary)" }}>{activeJob.id}</strong> · {activeJob.customerName}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                  background: pc.bg, color: pc.color, fontFamily: ff,
                }}>
                  {activeJob.priority}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "0 10px", borderLeft: `1px solid ${TA}22` }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: TA, fontFamily: ff, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{elapsed}</p>
              <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff }}>Time on job</p>
            </div>
            <button
              onClick={() => setStatusModalJob(activeJob.id)}
              style={{
                padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                background: TA, border: "none", color: "#000",
                cursor: "pointer", fontFamily: ff, flexShrink: 0,
              }}
            >
              Update Status
            </button>
          </div>
        );
      })() : (
        <div className="fade-up" style={{
          background: "var(--bg-card)", border: "1px dashed var(--border)",
          borderRadius: 16, padding: "22px", textAlign: "center",
        }}>
          <Wrench size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff, marginBottom: 4 }}>No active job</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Head to &quot;My Jobs&quot; to start working on a repair</p>
        </div>
      )}

      {/* Stat strip */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{s.label}</p>
                <Icon size={13} color={s.color} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: ff, letterSpacing: "-0.02em" }}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Lower row: Paused jobs + Approved parts notifications */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Paused jobs */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Timer size={14} color="#fbbf24" />
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Paused Jobs</p>
            {pendingJobs.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 20, padding: "2px 7px", fontFamily: ff, marginLeft: "auto" }}>
                {pendingJobs.length}
              </span>
            )}
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingJobs.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, padding: "8px 0" }}>No paused jobs</p>
            ) : pendingJobs.slice(0, 4).map(job => {
              const meta = jobMeta[job.id];
              return (
                <div key={job.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "9px 10px",
                  background: "var(--bg-secondary)", borderRadius: 9, border: "1px solid var(--border)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.id} · {job.brand} {job.model}
                    </p>
                    {meta?.pauseReason && (
                      <p style={{ fontSize: 11, color: "#fbbf24", fontFamily: ff, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {meta.pauseReason}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setStatusModalJob(job.id)}
                    style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 7, background: `${TA}12`, border: `1px solid ${TA}30`, color: TA, cursor: "pointer", fontFamily: ff, flexShrink: 0 }}
                  >
                    Resume
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approved parts + Upcoming jobs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Approved parts notification */}
          {approvedParts.length > 0 && (
            <div style={{
              background: `${TA}08`, border: `1px solid ${TA}25`,
              borderRadius: 14, padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={14} color={TA} />
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                  {approvedParts.length} Part{approvedParts.length > 1 ? "s" : ""} Ready for Collection
                </p>
              </div>
              {approvedParts.map(r => (
                <div key={r.id} style={{ padding: "8px 10px", background: `${TA}08`, borderRadius: 8, border: `1px solid ${TA}20` }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{r.partName}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>For job {r.jobId} · Qty {r.quantity}</p>
                </div>
              ))}
            </div>
          )}

          {/* Not started yet */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", flex: 1 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={14} color="var(--text-muted)" />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Up Next</p>
            </div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {notStarted.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, padding: "8px 4px" }}>All jobs started or no pending assignments</p>
              ) : notStarted.map(job => {
                const pc = PRIORITY_CFG[job.priority];
                return (
                  <div key={job.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <AlertCircle size={13} color={pc.color} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job.brand} {job.model} — {job.issue}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{job.id}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: pc.color, background: pc.bg, padding: "2px 6px", borderRadius: 5, fontFamily: ff, flexShrink: 0 }}>{job.priority}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Today's progress bar */}
      {myJobs.length > 0 && (() => {
        const done = myJobs.filter(j => j.status === "Completed" || j.status === "Delivered").length;
        const pct  = Math.round((done / myJobs.length) * 100);
        return (
          <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={14} color={TA} />
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Overall Progress</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 800, color: TA, fontFamily: ff }}>{done}/{myJobs.length} done</p>
            </div>
            <div style={{ height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${TA}, #60a5fa)`, borderRadius: 4, transition: "width 0.4s" }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, fontFamily: ff }}>{pct}% of assigned jobs completed</p>
          </div>
        );
      })()}

      {statusModalJob && activeJobModal && (
        <StatusUpdateModal job={activeJobModal} onClose={() => setStatusModalJob(null)} />
      )}

      <style>{`@keyframes pulse-tech { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}
