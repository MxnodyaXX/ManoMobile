"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Smartphone, Search, ShieldCheck, CheckCircle, Clock, Wrench, Truck, AlertTriangle } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

// Minimal mirrors of the stored shapes (the tracking page reads localStorage directly,
// the same store the staff app writes to — in production this would be a public API).
interface Job {
  id: string; customerName: string; brand: string; model: string; issue: string;
  status: string; estimatedCompletion: string; estimatedCost: number; advancePaid: number;
  originalEstimate?: number; revisedEstimate?: number; approval?: unknown; warrantyId?: string;
}
interface Warranty {
  id: string; jobId: string; deviceModel: string; partsCovered: string[]; scope: string;
  durationDays: number; startsAt?: string; expiresAt?: string; status: string;
}

const STEPS = [
  { key: "Non-Issued", label: "Received", icon: CheckCircle },
  { key: "Issued",     label: "In Repair", icon: Wrench },
  { key: "Completed",  label: "Ready",     icon: Clock },
  { key: "Delivered",  label: "Collected", icon: Truck },
];

function read<T>(key: string): T[] {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T[]) : []; } catch { return []; }
}

function TrackInner() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("job") ?? "");
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [approved, setApproved] = useState(false);

  const lookup = (id: string) => {
    const jobs = read<Job>("mano_repair_jobs");
    const found = jobs.find(j => j.id.toLowerCase() === id.toLowerCase().trim()) ?? null;
    setJob(found);
    if (found) {
      const ws = read<Warranty>("mano_warranties");
      setWarranty(ws.find(w => w.jobId === found.id) ?? null);
      setApproved(!!found.approval);
    }
  };

  useEffect(() => { if (params.get("job")) lookup(params.get("job")!); /* eslint-disable-next-line */ }, []);

  const approve = () => {
    if (!job) return;
    const jobs = read<Job>("mano_repair_jobs");
    const updated = jobs.map(j => j.id === job.id ? {
      ...j,
      approval: { amount: j.revisedEstimate ?? j.estimatedCost, approvedBy: j.customerName, channel: "Online", approvedAt: new Date().toISOString(), recordedByStaff: "Customer (self-service)" },
    } : j);
    try { localStorage.setItem("mano_repair_jobs", JSON.stringify(updated)); } catch {}
    setApproved(true);
  };

  const stepIdx = job ? Math.max(0, STEPS.findIndex(s => s.key === (job.status === "Pending" ? "Issued" : job.status))) : 0;
  const needsApproval = job && (job.revisedEstimate ?? 0) > (job.originalEstimate ?? job.estimatedCost) && !approved;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", fontFamily: ff, display: "flex", justifyContent: "center", padding: "40px 18px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Smartphone size={22} color="var(--text-secondary)" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Track Your Repair</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 5 }}>Mano Mobile · enter your job number</p>
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup(query)} placeholder="e.g. RM-001"
              style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 12px 11px 34px", fontSize: 14, color: "var(--text-primary)", fontFamily: ff, outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={() => lookup(query)} style={{ padding: "0 20px", borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Track</button>
        </div>

        {job === null && (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <AlertTriangle size={30} color="var(--text-muted)" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No job found with that number.</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Check the number on your job card and try again.</p>
          </div>
        )}

        {job && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Device card */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{job.brand} {job.model}</p>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{job.id} · {job.issue}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 7, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-glow)" }}>{job.status}</span>
              </div>

              {/* Progress */}
              {job.status !== "Cancelled" && (
                <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 6 }}>
                  {STEPS.map((s, i) => {
                    const Icon = s.icon; const done = i <= stepIdx;
                    return (
                      <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "unset" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: done ? "var(--accent)" : "var(--bg-secondary)", border: `2px solid ${done ? "var(--accent)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: done ? "var(--accent-fg)" : "var(--text-muted)" }}>
                            <Icon size={15} />
                          </div>
                          <span style={{ fontSize: 10.5, color: done ? "var(--text-primary)" : "var(--text-muted)", fontWeight: i === stepIdx ? 700 : 400 }}>{s.label}</span>
                        </div>
                        {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 6px", marginBottom: 20, background: i < stepIdx ? "var(--accent)" : "var(--border)" }} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {job.status !== "Delivered" && job.status !== "Cancelled" && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, textAlign: "center" }}>Estimated ready: <strong style={{ color: "var(--text-secondary)" }}>{job.estimatedCompletion}</strong></p>
              )}
            </div>

            {/* Approval request */}
            {needsApproval && (
              <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <AlertTriangle size={16} color="#fbbf24" />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Approval needed</p>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
                  After inspection, the repair cost is now <strong>Rs. {(job.revisedEstimate ?? 0).toLocaleString()}</strong> (originally
                  Rs. {(job.originalEstimate ?? job.estimatedCost).toLocaleString()}). Please approve to let us proceed.
                </p>
                <button onClick={approve} style={{ width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "#fbbf24", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Approve Rs. {(job.revisedEstimate ?? 0).toLocaleString()}</button>
              </div>
            )}
            {approved && (job.revisedEstimate ?? 0) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 12, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)" }}>
                <CheckCircle size={15} color="#4ade80" /><span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Revised estimate approved — thank you!</span>
              </div>
            )}

            {/* Warranty */}
            {warranty && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <ShieldCheck size={16} color="#a78bfa" />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Warranty {warranty.id}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    ["Covers", warranty.partsCovered.join(", ")],
                    ["Scope", warranty.scope],
                    ["Status", warranty.status === "Pending Activation" ? "Starts on collection" : warranty.status],
                    ["Valid until", warranty.expiresAt ? warranty.expiresAt.slice(0, 10) : "On collection"],
                  ].map(([k, v]) => (
                    <div key={k}><p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{k}</p><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{v}</p></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 28 }}>Mano Mobile · For help call 011-234-5678</p>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackInner />
    </Suspense>
  );
}
