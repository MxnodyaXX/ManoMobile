"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Smartphone, Search, ShieldCheck, CheckCircle, Clock, Wrench, Truck, AlertTriangle, Loader2 } from "lucide-react";
import { trackJob, approveJobEstimate, type TrackedJob } from "@/lib/repair/api";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const ff = "'Plus Jakarta Sans', sans-serif";

// Warranties aren't in the database yet (WarrantyContext is still
// localStorage-only — see its own file), so this half of the page can only
// ever show something on the same browser/device that issued the warranty.
// Real customers scanning the QR code on their own phone will not see this
// section; it's read defensively rather than removed, so it still works for
// whoever's testing on the staff machine.
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

function readWarranties(): Warranty[] {
  try { const r = localStorage.getItem("mano_warranties"); return r ? (JSON.parse(r) as Warranty[]) : []; } catch { return []; }
}

function TrackInner() {
  const params = useSearchParams();
  const configured = isSupabaseConfigured();
  const [query, setQuery] = useState(params.get("job") ?? "");
  const [job, setJob] = useState<TrackedJob | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approverName, setApproverName] = useState("");

  const lookup = async (id: string) => {
    if (!id.trim() || !configured) return;
    setLoading(true);
    setLookupError(null);
    try {
      const found = await trackJob(id);
      setJob(found);
      if (found) {
        const ws = readWarranties();
        setWarranty(ws.find(w => w.jobId === found.id) ?? null);
        setApproved(!!found.approval);
      } else {
        setWarranty(null);
      }
    } catch (e) {
      setJob(null);
      setLookupError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = params.get("job");
    if (initial) void lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async () => {
    if (!job) return;
    setApproving(true);
    try {
      await approveJobEstimate(job.id, approverName.trim() || job.customerName);
      setApproved(true);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : String(e));
    } finally {
      setApproving(false);
    }
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

        {!configured && (
          <div style={{ textAlign: "center", padding: "16px 18px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 14, marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Tracking isn&apos;t connected right now — please call the shop for your repair status.</p>
          </div>
        )}

        {/* Search */}
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup(query)} placeholder="e.g. RM-001" disabled={!configured}
              style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 12px 11px 34px", fontSize: 14, color: "var(--text-primary)", fontFamily: ff, outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={() => lookup(query)} disabled={!configured || loading} style={{ padding: "0 20px", borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 13.5, fontWeight: 700, cursor: configured && !loading ? "pointer" : "not-allowed", fontFamily: ff, opacity: configured && !loading ? 1 : 0.6, display: "flex", alignItems: "center", gap: 6 }}>
            {loading && <Loader2 size={14} className="spin-icon" />} Track
          </button>
        </div>

        {lookupError && (
          <div style={{ textAlign: "center", padding: "14px 18px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#f87171" }}>{lookupError}</p>
          </div>
        )}

        {job === null && !lookupError && (
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

            {/* On hold / cancelled context — the progress strip alone doesn't say why */}
            {job.status === "Pending" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 16px", borderRadius: 12, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <Clock size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-primary)" }}>On hold</strong>{job.pauseReason ? ` — ${job.pauseReason}` : " — we'll update this once work resumes."}
                </span>
              </div>
            )}
            {job.status === "Cancelled" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 16px", borderRadius: 12, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.25)" }}>
                <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-primary)" }}>Job cancelled</strong>{job.cancelReason ? ` — ${job.cancelReason}` : ""}{job.cancelledAt ? ` (${job.cancelledAt})` : ""}
                </span>
              </div>
            )}

            {/* Cost */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Cost</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Estimated</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Rs. {job.estimatedCost.toLocaleString()}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Advance Paid</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>Rs. {job.advancePaid.toLocaleString()}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Balance Due</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: job.estimatedCost - job.advancePaid > 0 ? "#f87171" : "#4ade80" }}>
                    Rs. {Math.max(0, job.estimatedCost - job.advancePaid).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Job details — hidden entirely rather than shown empty. A blank
                card here almost always means the database's track_job()
                function still predates migration 20260819000016 and doesn't
                return these columns yet (created_at alone should never be
                missing for a real job otherwise). */}
            {(job.technician || job.createdAt || job.startedAt || job.completedAt || job.handedOverAt || (job.receivedItems && job.receivedItems.length > 0)) && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Job Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {job.technician && (
                  <div><p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Technician</p><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{job.technician}</p></div>
                )}
                {job.createdAt && (
                  <div><p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Received</p><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{job.createdAt}</p></div>
                )}
                {job.startedAt && (
                  <div><p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Started</p><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{job.startedAt}</p></div>
                )}
                {job.completedAt && (
                  <div><p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Completed</p><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{job.completedAt}</p></div>
                )}
                {job.handedOverAt && (
                  <div><p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Collected</p><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{job.handedOverAt}</p></div>
                )}
                {job.receivedItems && job.receivedItems.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}><p style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Items Received</p><p style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{job.receivedItems.join(", ")}</p></div>
                )}
              </div>
            </div>
            )}

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
                <input
                  value={approverName}
                  onChange={e => setApproverName(e.target.value)}
                  placeholder={`Your name (defaults to ${job.customerName})`}
                  style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "var(--text-primary)", fontFamily: ff, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                />
                <button onClick={approve} disabled={approving} style={{ width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "#fbbf24", color: "#000", fontSize: 13, fontWeight: 700, cursor: approving ? "not-allowed" : "pointer", fontFamily: ff, opacity: approving ? 0.7 : 1 }}>
                  {approving ? "Recording…" : `Approve Rs. ${(job.revisedEstimate ?? 0).toLocaleString()}`}
                </button>
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
