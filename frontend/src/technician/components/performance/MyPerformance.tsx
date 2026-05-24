"use client";

import { useMemo } from "react";
import { TrendingUp, CheckCircle, Clock, Package, AlertTriangle, FileText, ClipboardCheck, Star } from "lucide-react";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import { SPARE_PARTS } from "@/technician/data/partsData";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

function StatCard({ icon: Icon, iconColor, label, value, sub, highlight }: {
  icon: any; iconColor: string; label: string; value: string | number;
  sub?: string; highlight?: boolean;
}) {
  return (
    <div style={{
      padding: "18px 20px", borderRadius: 14, border: `1px solid ${highlight ? TA + "35" : "var(--border)"}`,
      background: highlight ? `${TA}08` : "var(--bg-card)", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, fontWeight: 600 }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${iconColor}15`, border: `1px solid ${iconColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={iconColor} />
        </div>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", fontFamily: ff, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff, width: 120, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--bg-secondary)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: color, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, width: 36, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function MyPerformance() {
  const { jobs } = useRepair();
  const { technicianName, jobMeta, partRequests, diagnostics, activityLog, notes, escalations, functionalTests } = useTech();

  const myJobs = useMemo(() => jobs.filter(j => j.technician === technicianName), [jobs, technicianName]);

  const stats = useMemo(() => {
    const completed = myJobs.filter(j => ["Completed", "Delivered"].includes(j.status));
    const active    = myJobs.filter(j => j.status === "Issued");
    const paused    = myJobs.filter(j => j.status === "Pending");

    // On-time rate
    const doneWithDate = completed.filter(j => j.estimatedCompletion);
    const onTime = doneWithDate.filter(j => {
      const meta = jobMeta[j.id];
      if (!meta?.completedAt) return true; // assume on time if no record
      const due = new Date(j.estimatedCompletion + "T23:59:59");
      return meta.completedAt <= due;
    });
    const onTimeRate = doneWithDate.length > 0 ? Math.round((onTime.length / doneWithDate.length) * 100) : 100;

    // Average repair time (minutes) for completed jobs with tracked time
    const jobsWithTime = completed.filter(j => {
      const m = jobMeta[j.id];
      return m?.accumulatedMinutes && m.accumulatedMinutes > 0;
    });
    const avgMinutes = jobsWithTime.length > 0
      ? Math.round(jobsWithTime.reduce((s, j) => s + (jobMeta[j.id]?.accumulatedMinutes ?? 0), 0) / jobsWithTime.length)
      : 0;

    // Parts cost
    const myRequests = partRequests.filter(r => myJobs.some(j => j.id === r.jobId));
    const totalPartsCost = myRequests.reduce((s, r) => s + (SPARE_PARTS.find(p => p.sku === r.partSku)?.costPrice ?? 0) * r.quantity, 0);

    // Escalations
    const myEsc = escalations.filter(e => myJobs.some(j => j.id === e.jobId));
    const openEsc = myEsc.filter(e => !e.resolved).length;

    // Diagnostics done
    const diagDone = Object.keys(diagnostics).filter(id => myJobs.some(j => j.id === id)).length;

    // Tests done
    const testsDone = Object.keys(functionalTests).filter(id => myJobs.some(j => j.id === id)).length;

    // Total activity entries
    const totalActivity = Object.entries(activityLog)
      .filter(([id]) => myJobs.some(j => j.id === id))
      .reduce((s, [, entries]) => s + entries.length, 0);

    // Notes
    const totalNotes = Object.entries(notes)
      .filter(([id]) => myJobs.some(j => j.id === id))
      .reduce((s, [, ns]) => s + ns.length, 0);

    // Jobs this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const completedThisWeek = completed.filter(j => {
      const m = jobMeta[j.id];
      return m?.completedAt && m.completedAt >= weekStart;
    }).length;

    // Status breakdown counts
    const breakdownCounts = {
      "Not Started": myJobs.filter(j => j.status === "Non-Issued").length,
      "In Progress": active.length,
      "Paused":      paused.length,
      "Completed":   completed.length,
    };

    return {
      total: myJobs.length, completed: completed.length, active: active.length,
      onTimeRate, avgMinutes, totalPartsCost, openEsc, diagDone, testsDone,
      totalActivity, totalNotes, completedThisWeek, breakdownCounts, myRequests,
    };
  }, [myJobs, jobMeta, partRequests, diagnostics, activityLog, notes, escalations, functionalTests]);

  const avgTimeStr = stats.avgMinutes > 0
    ? `${Math.floor(stats.avgMinutes / 60)}h ${stats.avgMinutes % 60}m avg`
    : "No data yet";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: ff }}>

      {/* Header */}
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>My Performance</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Personal metrics and repair quality overview for {technicianName}</p>
      </div>

      {/* Top stat cards */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        <StatCard icon={CheckCircle}    iconColor={TA}        label="Jobs Completed"   value={stats.completed}       sub={`${stats.completedThisWeek} this week`} highlight />
        <StatCard icon={TrendingUp}     iconColor="#60a5fa"   label="On-Time Rate"      value={`${stats.onTimeRate}%`} sub="Jobs finished by due date" />
        <StatCard icon={Clock}          iconColor="#fbbf24"   label="Avg Repair Time"   value={stats.avgMinutes > 0 ? `${Math.floor(stats.avgMinutes / 60)}h ${stats.avgMinutes % 60}m` : "—"} sub="Per completed job" />
        <StatCard icon={Package}        iconColor="#a78bfa"   label="Parts Cost Used"   value={`Rs. ${stats.totalPartsCost.toLocaleString()}`} sub={`${stats.myRequests.length} part request${stats.myRequests.length !== 1 ? "s" : ""}`} />
        <StatCard icon={AlertTriangle}  iconColor="#f87171"   label="Open Escalations"  value={stats.openEsc}         sub="Awaiting admin resolution" />
        <StatCard icon={ClipboardCheck} iconColor="#34d399"   label="Diagnostics Done"  value={stats.diagDone}        sub={`${stats.testsDone} post-repair tests`} />
        <StatCard icon={FileText}       iconColor="#fbbf24"   label="Repair Notes"      value={stats.totalNotes}       sub={`${stats.totalActivity} activity entries`} />
        <StatCard icon={Star}           iconColor="#f97316"   label="Total Jobs"        value={stats.total}            sub={`${stats.active} active, ${myJobs.filter(j => j.status === "Pending").length} paused`} />
      </div>

      {/* Two-column lower section */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Job status breakdown */}
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Job Status Breakdown</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <BarRow label="Completed"   value={stats.breakdownCounts["Completed"]}   max={stats.total} color={TA} />
            <BarRow label="In Progress" value={stats.breakdownCounts["In Progress"]} max={stats.total} color="#60a5fa" />
            <BarRow label="Paused"      value={stats.breakdownCounts["Paused"]}      max={stats.total} color="#fbbf24" />
            <BarRow label="Not Started" value={stats.breakdownCounts["Not Started"]} max={stats.total} color="#94a3b8" />
          </div>
        </div>

        {/* Quality indicators */}
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Quality Indicators</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "On-Time Delivery", value: `${stats.onTimeRate}%`, color: stats.onTimeRate >= 80 ? TA : stats.onTimeRate >= 60 ? "#fbbf24" : "#f87171" },
              { label: "Diagnostics Coverage", value: stats.completed > 0 ? `${Math.round((stats.diagDone / Math.max(stats.total, 1)) * 100)}%` : "—", color: "#60a5fa" },
              { label: "Post-Repair Tests", value: stats.completed > 0 ? `${Math.round((stats.testsDone / Math.max(stats.completed, 1)) * 100)}%` : "—", color: "#a78bfa" },
              { label: "Avg Repair Time", value: avgTimeStr, color: "#fbbf24" },
            ].map(q => (
              <div key={q.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 9, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>{q.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: q.color, fontFamily: ff }}>{q.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent parts requests */}
      {stats.myRequests.length > 0 && (
        <div className="fade-up" style={{ padding: "20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent Part Requests</p>
          <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  {["Part", "Job", "Qty", "Cost", "Status"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.myRequests.slice(-10).reverse().map((r, i) => {
                  const part = SPARE_PARTS.find(p => p.sku === r.partSku);
                  const STATUS_COLOR: Record<string, string> = { Pending: "#fbbf24", Approved: TA, Issued: "#60a5fa", Rejected: "#f87171" };
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                      <td style={{ padding: "8px 12px", color: "var(--text-primary)", fontFamily: ff, fontWeight: 600 }}>{r.partName}</td>
                      <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontFamily: ff }}>{r.jobId}</td>
                      <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: ff }}>{r.quantity}</td>
                      <td style={{ padding: "8px 12px", color: "#a78bfa", fontFamily: ff, fontWeight: 600 }}>Rs. {((part?.costPrice ?? 0) * r.quantity).toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: STATUS_COLOR[r.status] ?? TA, background: `${STATUS_COLOR[r.status] ?? TA}15`, fontFamily: ff }}>{r.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
