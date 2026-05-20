"use client";

import { useState } from "react";
import {
  PackageCheck, Phone, User, DollarSign,
  Bell, CheckCircle, Clock, Search, MessageSquare,
} from "lucide-react";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

export default function PendingCollection() {
  const { jobs } = useRepair();
  const { technicianName, jobMeta } = useTech();

  const [search, setSearch] = useState("");
  const [notified, setNotified] = useState<Set<string>>(new Set());

  const completedJobs = jobs.filter(
    j => j.technician === technicianName && j.status === "Completed"
  );

  const filtered = completedJobs.filter(j => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      j.id.toLowerCase().includes(q) ||
      j.customerName.toLowerCase().includes(q) ||
      j.model.toLowerCase().includes(q) ||
      j.brand.toLowerCase().includes(q)
    );
  });

  const totalBalance = completedJobs.reduce((s, j) => s + (j.estimatedCost - j.advancePaid), 0);

  const handleNotify = (jobId: string) => {
    setNotified(prev => new Set([...prev, jobId]));
  };

  const fmtDate = (meta?: { completedAt?: Date }) => {
    if (!meta?.completedAt) return "Recently";
    return meta.completedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff, flex: 1, minHeight: 0 }}>

      {/* Header */}
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>
          Pending Collection
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>
          Completed repairs waiting for customer pickup — hand off to cashier for payment
        </p>
      </div>

      {/* Stats strip */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Awaiting Pickup", value: completedJobs.length, color: "#60a5fa", icon: PackageCheck },
          { label: "Total Balance Due", value: `Rs. ${totalBalance.toLocaleString()}`, color: "#f87171", icon: DollarSign },
          { label: "Customers Notified", value: notified.size, color: TA, icon: Bell },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}12`, border: `1px solid ${s.color}25`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, flexShrink: 0 }}>
                <Icon size={16} />
              </div>
              <div>
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: ff, letterSpacing: "-0.02em" }}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div className="fade-up" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 14px", borderRadius: 10,
        background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)",
      }}>
        <CheckCircle size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>
          Devices listed here are ready for handover. The <strong style={{ color: "var(--text-secondary)" }}>cashier</strong> processes payment and marks the job as <strong style={{ color: "#a78bfa" }}>Delivered</strong>.
        </p>
      </div>

      {/* Search */}
      <div className="fade-up" style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          placeholder="Search by job ID, customer, or device…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 9, padding: "9px 12px 9px 32px", fontSize: 13,
            color: "var(--text-primary)", fontFamily: ff, outline: "none",
          }}
        />
      </div>

      {/* Cards grid */}
      <div className="fade-up" style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <PackageCheck size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff, marginBottom: 6 }}>
              {completedJobs.length === 0 ? "No jobs ready for collection" : "No results match your search"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>
              {completedJobs.length === 0 ? "Complete a repair job to see it here" : "Try a different search term"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
            {filtered.map(job => {
              const meta = jobMeta[job.id];
              const balanceDue = job.estimatedCost - job.advancePaid;
              const isNotified = notified.has(job.id);
              return (
                <div key={job.id} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 14, overflow: "hidden",
                  borderLeft: `3px solid ${TA}`,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}>
                  {/* Card header */}
                  <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{job.brand} {job.model}</p>
                      </div>
                      <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.issue}</p>
                    </div>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      background: "rgba(96,165,250,0.1)", color: "#60a5fa",
                      border: "1px solid rgba(96,165,250,0.25)", fontFamily: ff,
                    }}>
                      Ready
                    </span>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>

                    {/* Customer */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <User size={13} color="var(--text-muted)" />
                      <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: ff, fontWeight: 600 }}>{job.customerName}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Phone size={13} color="var(--text-muted)" />
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>{job.phone}</span>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div>
                          <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>Total</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Rs. {job.estimatedCost.toLocaleString()}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>Advance</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: TA, fontFamily: ff }}>Rs. {job.advancePaid.toLocaleString()}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>Balance</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: balanceDue > 0 ? "#f87171" : TA, fontFamily: ff }}>
                            {balanceDue > 0 ? `Rs. ${balanceDue.toLocaleString()}` : "Paid"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Completion info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 0", borderTop: "1px solid var(--border)" }}>
                      <Clock size={12} color="var(--text-muted)" />
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>Completed {fmtDate(meta)}</span>
                    </div>

                    {/* Work summary if available */}
                    {meta?.completionNotes && (
                      <div style={{ padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                          <MessageSquare size={11} color="var(--text-muted)" />
                          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>Work Done</span>
                        </div>
                        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: ff }}>{meta.completionNotes}</p>
                      </div>
                    )}

                    {/* Notify button */}
                    <button
                      onClick={() => handleNotify(job.id)}
                      disabled={isNotified}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        width: "100%", padding: "9px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                        background: isNotified ? "rgba(52,211,153,0.08)" : "var(--bg-secondary)",
                        border: `1px solid ${isNotified ? `${TA}35` : "var(--border)"}`,
                        color: isNotified ? TA : "var(--text-secondary)",
                        cursor: isNotified ? "default" : "pointer",
                        fontFamily: ff, transition: "all 0.15s",
                      }}
                    >
                      {isNotified ? <CheckCircle size={13} /> : <Bell size={13} />}
                      {isNotified ? "Customer Notified" : "Notify Customer"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
