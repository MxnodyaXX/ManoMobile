"use client";

import { useCallback, useEffect, useState } from "react";
import { Wrench, Building2, Repeat, Banknote, Smartphone, Truck, Undo2 } from "lucide-react";
import { useToast } from "@/lib/ui/toast";
import {
  fetchDeviceClaims, updateDeviceClaim, RESOLUTION_LABEL,
  type DeviceClaim, type DeviceClaimResolution, type DeviceClaimStatus,
} from "@/lib/warranty/deviceClaims";

/**
 * Warranty Center → Claims → Phone claims: every claim on a phone the shop
 * sold, and the next step for each — back from the company, handed to the
 * customer, closed, or rejected.
 */

const ff = "'Plus Jakarta Sans', sans-serif";
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-LK")}`;
const day = (iso: string | null) => iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" }) : "—";

const ICON: Record<DeviceClaimResolution, typeof Wrench> = {
  repair_shop: Wrench, company_replace: Truck, company_refund: Undo2, repair_company: Building2, replace: Repeat, refund: Banknote,
};
const STATUS_COLOR: Record<DeviceClaimStatus, string> = {
  Open: "#d97706", "In repair": "#2563eb", "At company": "#7c3aed", Ready: "#0d9488", Completed: "#16a34a", Rejected: "#dc2626",
};

export default function PhoneClaimsList({ refreshKey = 0 }: { refreshKey?: number }) {
  const toast = useToast();
  const [claims, setClaims] = useState<DeviceClaim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(() => {
    fetchDeviceClaims()
      .then(c => { setClaims(c); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const move = async (c: DeviceClaim, patch: Parameters<typeof updateDeviceClaim>[1], msg: string) => {
    try { await updateDeviceClaim(c.id, patch); toast.success(msg); load(); }
    catch (e) { toast.dialog("error", "Could not update the claim", e instanceof Error ? e.message : String(e)); }
  };

  const shown = filter === "open" ? claims.filter(c => c.status !== "Completed" && c.status !== "Rejected") : claims;
  const openCount = claims.filter(c => c.status !== "Completed" && c.status !== "Rejected").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: ff }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Smartphone size={16} color="var(--accent)" />
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Phone claims</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{openCount} open</span>
        <span style={{ flex: 1 }} />
        {(["open", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff, border: `1px solid ${filter === f ? "var(--accent)" : "var(--border)"}`, background: filter === f ? "var(--accent-dim)" : "transparent", color: filter === f ? "var(--accent)" : "var(--text-secondary)" }}>
            {f === "open" ? "Open" : "All"}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: "10px 12px", borderRadius: 9, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 12.5, color: "var(--text-secondary)" }}>{error}</div>}

      {loading ? <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading…</div>
        : shown.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", borderRadius: 12, border: "1px dashed var(--border)", fontSize: 12.5, color: "var(--text-muted)" }}>
            {filter === "open" ? "No open phone claims. Start one from Check warranty." : "No phone claims yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {shown.map(c => {
              const Icon = ICON[c.resolution];
              const color = STATUS_COLOR[c.status];
              const closed = c.status === "Completed" || c.status === "Rejected";
              return (
                <div key={c.id} style={{ borderRadius: 14, border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, background: "var(--bg-card)", padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text-primary)" }}>{c.id} · {c.deviceName}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "monospace" }}>IMEI {c.imei}</div>
                    </div>
                    <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, color, background: `${color}1c`, whiteSpace: "nowrap" }}>{c.status}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                    <Icon size={13} /> {RESOLUTION_LABEL[c.resolution]}
                    {c.resolution === "repair_company" && c.companyName && <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>· {c.companyName}</span>}
                    {c.jobId && <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>· job {c.jobId}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}><b>Fault:</b> {c.reportedIssue}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    {c.invoiceNo} · {c.customer ?? "—"}{c.customerPhone ? ` · ${c.customerPhone}` : ""}<br />
                    Claimed {day(c.createdAt)}
                    {c.sentAt && c.resolution === "repair_company" && <> · sent {day(c.sentAt)}</>}
                    {c.expectedBack && !c.backAt && <> · expected {day(c.expectedBack)}</>}
                    {c.backAt && <> · back {day(c.backAt)}</>}
                    {c.replacementImei && <> · replaced with IMEI {c.replacementImei}</>}
                    {c.refundAmount != null && (
                      <> · refunded {rs(c.refundAmount)}
                        {(c.refundCreditAmount ?? 0) > 0.005 && <> ({rs(c.refundCreditAmount!)} off credit{c.refundAmount - (c.refundCreditAmount ?? 0) > 0.005 ? `, ${rs(c.refundAmount - (c.refundCreditAmount ?? 0))} by ${c.refundMethod ?? "cash"}` : ""})</>}
                        {(c.refundCreditAmount ?? 0) <= 0.005 && c.refundMethod && <> by {c.refundMethod.toLowerCase()}</>}
                      </>
                    )}
                    {c.resolvedAt && <> · closed {day(c.resolvedAt)}</>}
                  </div>
                  {c.notes && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{c.notes}</div>}

                  {!closed && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 9 }}>
                      {c.status === "At company" && (
                        <Btn onClick={() => void move(c, { status: "Ready", backAt: new Date().toISOString() }, `${c.id} is back from ${c.companyName ?? "the company"}`)}>Back from company</Btn>
                      )}
                      {(c.status === "Ready" || c.status === "In repair" || c.status === "Open") && (
                        <Btn primary onClick={() => void move(c, { status: "Completed", resolvedAt: new Date().toISOString() }, `${c.id} closed — device with the customer`)}>
                          {c.status === "Ready" ? "Handed to customer" : "Mark completed"}
                        </Btn>
                      )}
                      <Btn danger onClick={() => {
                        const why = window.prompt("Why is this claim not covered?");
                        if (why && why.trim()) void move(c, { status: "Rejected", resolvedAt: new Date().toISOString(), notes: [c.notes, `Rejected: ${why.trim()}`].filter(Boolean).join(" · ") }, `${c.id} rejected`);
                      }}>Reject</Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

function Btn({ children, onClick, primary, danger }: { children: React.ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: ff,
      border: `1px solid ${primary ? "var(--accent)" : danger ? "rgba(220,38,38,0.4)" : "var(--border)"}`,
      background: primary ? "var(--accent)" : "transparent",
      color: primary ? "var(--accent-fg)" : danger ? "#dc2626" : "var(--text-secondary)",
    }}>{children}</button>
  );
}
