"use client";

import { useState } from "react";
import {
  Search, Layers, PackageCheck, AlertTriangle, XCircle,
  Plus, X, ChevronDown, Filter, Clock, CheckCircle,
} from "lucide-react";
import { SPARE_PARTS, PART_CATEGORIES, type SparePart, type PartCategory } from "@/technician/data/partsData";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useTech, type PartRequestStatus } from "@/technician/contexts/TechContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

// ─── Request Modal ─────────────────────────────────────────────────────────────

function RequestModal({ part, onClose }: { part: SparePart; onClose: () => void }) {
  const { jobs } = useRepair();
  const { technicianName, requestPart } = useTech();

  const [selectedJobId, setSelectedJobId] = useState("");
  const [qty, setQty]                     = useState(1);
  const [note, setNote]                   = useState("");
  const [done, setDone]                   = useState(false);

  const myJobs = jobs.filter(j =>
    j.technician === technicianName &&
    ["Non-Issued", "Issued", "Pending"].includes(j.status)
  );

  const canSubmit = selectedJobId.length > 0 && qty >= 1 && qty <= part.stock;

  const handleSubmit = () => {
    const job = myJobs.find(j => j.id === selectedJobId);
    if (!job) return;
    requestPart({
      jobId: selectedJobId,
      jobDevice: `${job.brand} ${job.model}`,
      partName: part.name,
      partSku: part.sku,
      quantity: qty,
      note: note || undefined,
    });
    setDone(true);
    setTimeout(onClose, 1400);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "9px 12px", fontSize: 13,
    color: "var(--text-primary)", fontFamily: ff, outline: "none",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "26px 26px 22px", width: 440, display: "flex", flexDirection: "column", gap: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", fontFamily: ff }}>

        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "16px 0" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${TA}14`, border: `2px solid ${TA}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={24} color={TA} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Request Submitted</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Your part request is pending approval</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3, fontFamily: ff }}>Request Part</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{part.name}</p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={15} /></button>
            </div>

            {/* Part info */}
            <div style={{ padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>SKU</p>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{part.sku}</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>Location</p>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{part.location}</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>In Stock</p>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: part.stock > part.reorderLevel ? TA : part.stock > 0 ? "#fbbf24" : "#f87171", fontFamily: ff }}>{part.stock} units</p>
              </div>
            </div>

            {/* Job selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>Select Job *</label>
              <div style={{ position: "relative" }}>
                <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} style={{ ...inputStyle, appearance: "none", paddingRight: 32, cursor: "pointer" }}>
                  <option value="">Choose a job…</option>
                  {myJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.id} — {j.brand} {j.model} ({j.status})</option>
                  ))}
                </select>
                <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              </div>
              {myJobs.length === 0 && <p style={{ fontSize: 11, color: "#fbbf24", fontFamily: ff }}>No active jobs to assign this part to</p>}
            </div>

            {/* Quantity */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>Quantity *</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 34, height: 34, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-primary)", fontSize: 16 }}>−</button>
                <input type="number" min={1} max={part.stock} value={qty} onChange={e => setQty(Math.max(1, Math.min(part.stock, Number(e.target.value))))} style={{ ...inputStyle, width: 80, textAlign: "center" }} />
                <button onClick={() => setQty(q => Math.min(part.stock, q + 1))} style={{ width: 34, height: 34, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-primary)", fontSize: 16 }}>+</button>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>of {part.stock} available</span>
              </div>
            </div>

            {/* Note */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>Note (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Why you need this part…" rows={2} style={{ ...inputStyle, resize: "none" as const }} />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
              <button onClick={handleSubmit} disabled={!canSubmit} style={{ padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: canSubmit ? TA : "var(--bg-secondary)", border: `1px solid ${canSubmit ? TA : "var(--border)"}`, color: canSubmit ? "#000" : "var(--text-muted)", cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: ff }}>Submit Request</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Stock level badge ─────────────────────────────────────────────────────────

function StockBadge({ stock, reorderLevel }: { stock: number; reorderLevel: number }) {
  if (stock === 0)                 return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)", fontFamily: ff }}>Out of Stock</span>;
  if (stock <= reorderLevel)       return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(251,191,36,0.1)",  color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)",  fontFamily: ff }}>Low — {stock} left</span>;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(52,211,153,0.1)", color: TA, border: `1px solid ${TA}25`, fontFamily: ff }}>{stock} in stock</span>;
}

// ─── Request status badge ──────────────────────────────────────────────────────

const REQ_STATUS_CFG: Record<PartRequestStatus, { color: string; bg: string; border: string; label: string }> = {
  Pending:  { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)",  label: "Pending"  },
  Approved: { color: TA,        bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.25)",  label: "Approved" },
  Issued:   { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)",  label: "Issued"   },
  Rejected: { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)", label: "Rejected" },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

type ViewTab = "Browse" | "My Requests";

export default function PartsAvailability() {
  const { technicianName, partRequests } = useTech();

  const [view, setView]               = useState<ViewTab>("Browse");
  const [search, setSearch]           = useState("");
  const [catFilter, setCatFilter]     = useState<PartCategory | "All">("All");
  const [requestPart, setRequestPart] = useState<SparePart | null>(null);
  const [statusFilter, setStatusFilter] = useState<PartRequestStatus | "All">("All");

  const filteredParts = SPARE_PARTS.filter(p => {
    if (catFilter !== "All" && p.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) &&
          !p.compatibleWith.some(c => c.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const myRequests = partRequests.filter(r => {
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    return true;
  }).sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5,
    color: "var(--text-primary)", fontFamily: ff, outline: "none",
  };

  const pendingCount = partRequests.filter(r => r.status === "Pending").length;
  const approvedCount = partRequests.filter(r => r.status === "Approved").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: ff, flex: 1, minHeight: 0 }}>

      {/* Header */}
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Parts & Stock</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Browse available spare parts and manage your requests</p>
      </div>

      {/* Quick stat strip */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Total Parts",   value: SPARE_PARTS.length,                                                      color: "var(--text-primary)" },
          { label: "Out of Stock",  value: SPARE_PARTS.filter(p => p.stock === 0).length,                          color: "#f87171" },
          { label: "My Pending",    value: pendingCount,                                                             color: "#fbbf24" },
          { label: "Ready to Collect", value: approvedCount,                                                         color: TA },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: ff }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="fade-up" style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
        {(["Browse", "My Requests"] as ViewTab[]).map(tab => {
          const active = view === tab;
          const badge = tab === "My Requests" ? partRequests.length : undefined;
          return (
            <button key={tab} onClick={() => setView(tab)} style={{
              padding: "7px 16px", borderRadius: 7, fontSize: 12.5,
              background: active ? "var(--bg-secondary)" : "transparent",
              border: active ? `1px solid ${TA}30` : "1px solid transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: active ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s", fontFamily: ff,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {tab}
              {badge !== undefined && badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: active ? `${TA}20` : "var(--border)", color: active ? TA : "var(--text-muted)", fontFamily: ff }}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── BROWSE VIEW ── */}
      {view === "Browse" && (
        <>
          {/* Filters */}
          <div className="fade-up" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input placeholder="Search part name, SKU, or device model…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: "100%", paddingLeft: 30 }} />
            </div>
            <div style={{ position: "relative" }}>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value as any)} style={{ ...inputStyle, appearance: "none", paddingRight: 28, cursor: "pointer", minWidth: 160 }}>
                <option value="All">All Categories</option>
                {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Parts table */}
          <div className="fade-up" style={{ flex: 1, overflow: "auto", borderRadius: 14, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  {["Part Name", "SKU", "Category", "Compatible With", "Location", "Stock", "Cost", "Action"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap", fontFamily: ff }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredParts.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: ff }}>No parts match your filters.</td></tr>
                ) : filteredParts.map((part, i) => (
                  <tr key={part.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)", transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "var(--bg-secondary)")}
                  >
                    <td style={{ padding: "11px 14px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{part.name}</p>
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 11.5, color: "var(--text-muted)" }}>{part.sku}</td>
                    <td style={{ padding: "11px 14px", color: "var(--text-secondary)", fontFamily: ff, whiteSpace: "nowrap" }}>{part.category}</td>
                    <td style={{ padding: "11px 14px", maxWidth: 180 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {part.compatibleWith.slice(0, 2).map(m => (
                          <span key={m} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: ff, whiteSpace: "nowrap" }}>{m}</span>
                        ))}
                        {part.compatibleWith.length > 2 && <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff }}>+{part.compatibleWith.length - 2}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{part.location}</td>
                    <td style={{ padding: "11px 14px" }}><StockBadge stock={part.stock} reorderLevel={part.reorderLevel} /></td>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, whiteSpace: "nowrap" }}>Rs. {part.costPrice.toLocaleString()}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <button
                        onClick={() => setRequestPart(part)}
                        disabled={part.stock === 0}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                          background: part.stock > 0 ? `${TA}12` : "var(--bg-secondary)",
                          border: `1px solid ${part.stock > 0 ? `${TA}30` : "var(--border)"}`,
                          color: part.stock > 0 ? TA : "var(--text-muted)",
                          cursor: part.stock > 0 ? "pointer" : "not-allowed", fontFamily: ff,
                        }}
                      >
                        <Plus size={11} /> Request
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── MY REQUESTS VIEW ── */}
      {view === "My Requests" && (
        <>
          {/* Status filter */}
          <div className="fade-up" style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
            {(["All", "Pending", "Approved", "Issued", "Rejected"] as (PartRequestStatus | "All")[]).map(s => {
              const active = statusFilter === s;
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "6px 13px", borderRadius: 7, fontSize: 12, background: active ? "var(--bg-secondary)" : "transparent", border: active ? "1px solid var(--border-active)" : "1px solid transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: ff }}>
                  {s}
                </button>
              );
            })}
          </div>

          <div className="fade-up" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {myRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Layers size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: ff, marginBottom: 4 }}>No part requests yet</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Browse the parts list and click Request to get started</p>
              </div>
            ) : myRequests.map(req => {
              const cfg = REQ_STATUS_CFG[req.status];
              return (
                <div key={req.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                    {req.status === "Pending"  && <Clock size={16} />}
                    {req.status === "Approved" && <CheckCircle size={16} />}
                    {req.status === "Issued"   && <PackageCheck size={16} />}
                    {req.status === "Rejected" && <XCircle size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{req.partName}</p>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, fontFamily: ff, flexShrink: 0, marginLeft: 10 }}>{cfg.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Job: <strong style={{ color: "var(--text-secondary)" }}>{req.jobId}</strong></span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Device: <strong style={{ color: "var(--text-secondary)" }}>{req.jobDevice}</strong></span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Qty: <strong style={{ color: "var(--text-secondary)" }}>{req.quantity}</strong></span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>SKU: <strong style={{ color: "var(--text-secondary)" }}>{req.partSku}</strong></span>
                    </div>
                    {req.note && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, fontFamily: ff }}>Note: {req.note}</p>}
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5, fontFamily: ff }}>
                      Requested {req.requestedAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {req.resolvedAt && ` · Resolved ${req.resolvedAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {requestPart && <RequestModal part={requestPart} onClose={() => setRequestPart(null)} />}
    </div>
  );
}
