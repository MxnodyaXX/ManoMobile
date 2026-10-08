"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck, FileWarning, Search, Clock, ScanSearch, SlidersHorizontal,
  X, Printer, AlertTriangle, CheckCircle, XCircle, Wrench,
} from "lucide-react";
import { useRepair } from "@/cashier/contexts/RepairContext";
import {
  useWarranty, effectiveStatus, daysRemaining,
  type Warranty, type WarrantyStatus, type WarrantyClaim, type ClaimResolution,
} from "@/cashier/contexts/WarrantyContext";
import WarrantyLookup from "./WarrantyLookup";
import WarrantyPolicies from "./WarrantyPolicies";
import PhoneClaimsList from "./PhoneClaimsList";
import { fetchPolicies, type WarrantyPolicy } from "@/lib/warranty/lookup";

const ff = "'Plus Jakarta Sans', sans-serif";
const STAFF = "Cashier";

const STATUS_COLOR: Record<WarrantyStatus, string> = {
  "Pending Activation": "#fbbf24",
  "Active": "#4ade80",
  "Expired": "#94a3b8",
  "Void": "#f87171",
  "Claimed": "#a78bfa",
};

// Lookup is the front door: anything the shop sold or repaired, by any number
// the customer has. Handover lives in the checkout (Repair Sales / Issue Job),
// which now starts the repair warranty itself — see migration 20261006000066.
type Tab = "Lookup" | "Warranties" | "Claims" | "Policies";

// ─── Warranty card (printable) ────────────────────────────────────────────────

function WarrantyCard({ warranty, onClose }: { warranty: Warranty; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const print = () => {
    if (!ref.current) return;
    const el = document.createElement("div"); el.id = "__wc__"; el.innerHTML = ref.current.outerHTML;
    document.body.appendChild(el);
    const st = document.createElement("style"); st.id = "__wc_style__";
    st.textContent = `@page{size:A5 landscape;margin:10mm}#__wc__{display:none}@media print{body{visibility:hidden}#__wc__{display:block!important;visibility:visible;position:fixed;top:0;left:0;width:100%}#__wc__ *{visibility:visible}}`;
    document.head.appendChild(st); window.print();
    setTimeout(() => { document.getElementById("__wc__")?.remove(); document.getElementById("__wc_style__")?.remove(); }, 500);
  };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(620px, calc(100vw - 24px))", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Warranty Card — {warranty.id}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={print} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontFamily: ff }}><Printer size={12} /> Print</button>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: 18 }}>
          <div ref={ref} style={{ background: "#fff", color: "#000", padding: "24px 28px", fontFamily: "Arial, sans-serif", border: "2px solid #000" }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "0.06em" }}>MANO MOBILE — WARRANTY CARD</h2>
              <p style={{ margin: "3px 0 0", fontSize: 10, color: "#555" }}>Keep this card. Present it for any warranty claim.</p>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <tbody>
                {[
                  ["Warranty No.", warranty.id],
                  ["Customer", `${warranty.customerName} · ${warranty.customerPhone}`],
                  ["Device", `${warranty.deviceModel}${warranty.imei ? ` · IMEI ${warranty.imei}` : ""}`],
                  ["Covered", warranty.partsCovered.join(", ")],
                  ["Scope", warranty.scope],
                  ["Duration", `${warranty.durationDays} days`],
                  ["Valid From", warranty.startsAt ? warranty.startsAt.slice(0, 10) : "On collection"],
                  ["Valid Until", warranty.expiresAt ? warranty.expiresAt.slice(0, 10) : "—"],
                ].map(([k, v]) => (
                  <tr key={k}><td style={{ padding: "4px 8px 4px 0", fontWeight: 700, width: 110, verticalAlign: "top" }}>{k}:</td><td style={{ padding: "4px 0" }}>{v}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12, borderTop: "1px dashed #999", paddingTop: 8 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, marginBottom: 4 }}>NOT COVERED:</p>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 9, color: "#444", lineHeight: 1.5 }}>
                {warranty.exclusions.map(e => <li key={e}>{e}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Start-claim modal ────────────────────────────────────────────────────────

function StartClaimModal({ warranty, onClose, onCreated }: { warranty: Warranty; onClose: () => void; onCreated: () => void }) {
  const { openClaim } = useWarranty();
  const [issue, setIssue] = useState("");
  const create = () => {
    if (issue.trim().length < 4) return;
    void openClaim({ warrantyId: warranty.id, jobId: warranty.jobId, reportedIssue: issue.trim(), handledBy: STAFF })
      .catch(err => console.error(`Could not open a claim for ${warranty.id}:`, err));
    onCreated();
  };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(440px, calc(100vw - 24px))", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>New Warranty Claim — {warranty.id}</p>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{warranty.deviceModel} · covers {warranty.partsCovered.join(", ")}</p>
          <textarea value={issue} onChange={e => setIssue(e.target.value)} rows={3} placeholder="Describe the reported fault…"
            style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12.5, fontFamily: ff, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          <button onClick={create} disabled={issue.trim().length < 4} style={{ padding: "9px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: "none", background: issue.trim().length < 4 ? "var(--border)" : "var(--accent)", color: issue.trim().length < 4 ? "var(--text-muted)" : "var(--accent-fg)", cursor: issue.trim().length < 4 ? "not-allowed" : "pointer", fontFamily: ff }}>Open Claim</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WarrantyCenter() {
  const { jobs, addJob } = useRepair();
  const { warranties, claims, updateClaim } = useWarranty();
  const [tab, setTab] = useState<Tab>("Lookup");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | WarrantyStatus>("All");
  const [cardFor, setCardFor] = useState<Warranty | null>(null);
  const [claimFor, setClaimFor] = useState<Warranty | null>(null);

  const [phoneClaimsKey, setPhoneClaimsKey] = useState(0);
  const [policies, setPolicies] = useState<WarrantyPolicy[]>([]);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const loadPolicies = useCallback(() => {
    fetchPolicies()
      .then(p => { setPolicies(p); setPolicyError(null); })
      .catch(e => setPolicyError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { loadPolicies(); }, [loadPolicies]);
  const expiringSoon = warranties.filter(w => { const d = daysRemaining(w); return effectiveStatus(w) === "Active" && d !== null && d >= 0 && d <= 7; });

  const filteredWarranties = useMemo(() => {
    const q = search.toLowerCase().trim();
    return warranties.filter(w => {
      const st = effectiveStatus(w);
      if (statusFilter !== "All" && st !== statusFilter) return false;
      if (!q) return true;
      return [w.id, w.customerName, w.customerPhone, w.imei ?? "", w.deviceModel, w.invoiceNo ?? ""]
        .join(" ").toLowerCase().includes(q);
    });
  }, [warranties, search, statusFilter]);

  const openClaims = claims.filter(c => c.status !== "Resolved" && c.status !== "Rejected");

  const resolveClaim = (claim: WarrantyClaim, withinCoverage: boolean, notes: string) => {
    if (withinCoverage) {
      const orig = jobs.find(j => j.id === claim.jobId);
      const newId = `RM-C${String(Date.now()).slice(-4)}`;
      if (orig) {
        // Fire-and-forget: the claim resolution below is what the user is
        // waiting on. A failed re-repair job is reported, not silently dropped.
        void addJob({
          customerName: orig.customerName, phone: orig.phone, brand: orig.brand, model: orig.model,
          issue: `[Warranty Claim ${claim.id}] ${claim.reportedIssue}`, technician: "Unassigned",
          status: "Non-Issued", priority: "High", estimatedCost: 0, originalEstimate: 0, advancePaid: 0,
          createdAt: new Date().toISOString().slice(0, 10), estimatedCompletion: new Date().toISOString().slice(0, 10),
          // The re-repair stays with whichever dealer brought the device in.
          imei: orig.imei, dealer: orig.dealer, dealerId: orig.dealerId,
        }).catch(err => console.error(`Warranty re-repair job for ${claim.id} failed to save:`, err));
      }
      void updateClaim(claim.id, { status: "Resolved", withinCoverage: true, inspectionNotes: notes, resolution: "Re-repair (free)" as ClaimResolution, newJobId: newId, resolvedAt: new Date().toISOString() })
        .catch(err => console.error(`Could not resolve claim ${claim.id}:`, err));
    } else {
      void updateClaim(claim.id, { status: "Rejected", withinCoverage: false, inspectionNotes: notes, resolution: "Rejected — out of scope" as ClaimResolution, resolvedAt: new Date().toISOString() })
        .catch(err => console.error(`Could not reject claim ${claim.id}:`, err));
    }
  };

  const tabs: { id: Tab; label: string; icon: any; count: number }[] = [
    { id: "Lookup",     label: "Check warranty", icon: ScanSearch, count: -1 },
    { id: "Warranties", label: "Warranties", icon: ShieldCheck, count: warranties.length },
    { id: "Claims", label: "Claims", icon: FileWarning, count: openClaims.length },
    { id: "Policies", label: "Policies", icon: SlidersHorizontal, count: -1 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0, fontFamily: ff }}>
      {/* Header + tabs */}
      <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="heading-xl" style={{ fontSize: 24, color: "var(--text-primary)" }}>Warranty Center</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
            Check any sale or repair for warranty, manage repair warranties and claims, and set warranty policies.
          </p>
        </div>

        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 5, width: "fit-content" }}>
        {tabs.map(t => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 8, fontSize: 12.5,
              border: active ? "1px solid var(--accent-glow)" : "1px solid transparent",
              background: active ? "var(--accent-dim)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-secondary)", fontWeight: active ? 600 : 400,
              cursor: "pointer", fontFamily: ff,
            }}>
              <Icon size={14} /> {t.label}
              {t.count >= 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: active ? "var(--accent)" : "var(--border)", color: active ? "var(--accent-fg)" : "var(--text-muted)" }}>{t.count}</span>}
            </button>
          );
        })}
        </div>
      </div>

      <div className="fade-up fade-up-3" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

        {/* ── Lookup ── */}
        {tab === "Lookup" && (
          <WarrantyLookup policies={policies} onPrintCard={setCardFor} onClaim={setClaimFor} onPhoneClaimed={() => setPhoneClaimsKey(k => k + 1)} />
        )}

        {/* ── Warranties (register) ── */}
        {tab === "Warranties" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {expiringSoon.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <Clock size={15} color="#fbbf24" />
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}><strong style={{ color: "#fbbf24" }}>{expiringSoon.length} warranties</strong> expire within 7 days.</p>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input placeholder="Search IMEI, phone, name, WR id…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px 9px 32px", fontSize: 13, color: "var(--text-primary)", fontFamily: ff, outline: "none", boxSizing: "border-box" }} />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "var(--text-primary)", fontFamily: ff, cursor: "pointer" }}>
                {["All", "Active", "Pending Activation", "Expired", "Void", "Claimed"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                    {["Warranty", "Customer", "Device", "Covers", "Status", "Expires", ""].map(h => (
                      <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWarranties.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>No warranties match.</td></tr>
                  ) : filteredWarranties.map((w, i) => {
                    const st = effectiveStatus(w); const d = daysRemaining(w);
                    return (
                      <tr key={w.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 ? "var(--bg-secondary)" : "transparent" }}>
                        <td style={{ padding: "9px 13px", fontWeight: 700, color: "var(--text-primary)" }}>{w.id}</td>
                        <td style={{ padding: "9px 13px", color: "var(--text-secondary)" }}>{w.customerName}<br /><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{w.customerPhone}</span></td>
                        <td style={{ padding: "9px 13px", color: "var(--text-secondary)" }}>{w.deviceModel}</td>
                        <td style={{ padding: "9px 13px", color: "var(--text-muted)", fontSize: 11.5 }}>{w.partsCovered.join(", ")}</td>
                        <td style={{ padding: "9px 13px" }}><span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, color: STATUS_COLOR[st], background: `${STATUS_COLOR[st]}1e`, border: `1px solid ${STATUS_COLOR[st]}40`, whiteSpace: "nowrap" }}>{st}</span></td>
                        <td style={{ padding: "9px 13px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{w.expiresAt ? w.expiresAt.slice(0, 10) : "—"}{st === "Active" && d !== null && <span style={{ fontSize: 10.5, color: d <= 7 ? "#fbbf24" : "var(--text-muted)", display: "block" }}>{d}d left</span>}</td>
                        <td style={{ padding: "9px 13px", whiteSpace: "nowrap" }}>
                          <button onClick={() => setCardFor(w)} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", marginRight: 6, fontFamily: ff }}>Card</button>
                          {st === "Active" && <button onClick={() => setClaimFor(w)} style={{ fontSize: 11, fontWeight: 600, color: "#fbbf24", background: "none", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontFamily: ff }}>Claim</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Claims ── */}
        {tab === "Claims" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Phones sold — repaired, sent to the company, replaced or refunded. */}
            <PhoneClaimsList refreshKey={phoneClaimsKey} />

            {/* Repair warranties — a repair that failed again. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Wrench size={16} color="var(--accent)" />
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Repair claims</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{openClaims.length} open</span>
              </div>
              {claims.length === 0 ? (
                <Empty icon={FileWarning} title="No repair warranty claims" sub="Start one from a repair's card in Check warranty." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {claims.map(c => <ClaimCard key={c.id} claim={c} warranty={warranties.find(w => w.id === c.warrantyId)} onResolve={resolveClaim} />)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Policies ── */}
        {tab === "Policies" && (
          <WarrantyPolicies policies={policies} onChanged={loadPolicies} error={policyError} />
        )}
      </div>

      {cardFor && <WarrantyCard warranty={cardFor} onClose={() => setCardFor(null)} />}
      {claimFor && <StartClaimModal warranty={claimFor} onClose={() => setClaimFor(null)} onCreated={() => { setClaimFor(null); setTab("Claims"); }} />}
    </div>
  );
}

// ─── Claim card ───────────────────────────────────────────────────────────────

function ClaimCard({ claim, warranty, onResolve }: {
  claim: WarrantyClaim;
  warranty?: Warranty;
  onResolve: (c: WarrantyClaim, withinCoverage: boolean, notes: string) => void;
}) {
  const [notes, setNotes] = useState(claim.inspectionNotes ?? "");
  const open = claim.status !== "Resolved" && claim.status !== "Rejected";
  const color = claim.status === "Resolved" ? "#4ade80" : claim.status === "Rejected" ? "#f87171" : "#fbbf24";

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{claim.id} · {warranty?.deviceModel ?? "Device"}</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Warranty {claim.warrantyId} · reported {claim.reportedAt.slice(0, 10)}</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, color, background: `${color}1e`, border: `1px solid ${color}40` }}>{claim.status}</span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}><strong>Reported:</strong> {claim.reportedIssue}</p>

      {open ? (
        <>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Inspection notes — what did you find?"
            style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: ff, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => onResolve(claim, true, notes)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid #4ade80", background: "rgba(74,222,128,0.1)", color: "#4ade80", cursor: "pointer", fontFamily: ff }}>
              <Wrench size={13} /> In coverage → free re-repair
            </button>
            <button onClick={() => onResolve(claim, false, notes)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid #f87171", background: "rgba(248,113,113,0.1)", color: "#f87171", cursor: "pointer", fontFamily: ff }}>
              <XCircle size={13} /> Reject — out of scope
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 8, background: "var(--bg-secondary)" }}>
          {claim.status === "Resolved" ? <CheckCircle size={13} color="#4ade80" /> : <AlertTriangle size={13} color="#f87171" />}
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
            {claim.resolution}{claim.newJobId ? ` · job ${claim.newJobId}` : ""}{claim.inspectionNotes ? ` — ${claim.inspectionNotes}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function Empty({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <Icon size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{sub}</p>
    </div>
  );
}
