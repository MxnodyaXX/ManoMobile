"use client";

import { useState } from "react";
import { Search, ShieldCheck, ShieldX, ShieldAlert, Clock, Smartphone, Wrench, Package, Cpu, Box, User, Phone, FileText, Loader2 } from "lucide-react";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useWarranty, type Warranty } from "@/cashier/contexts/WarrantyContext";
import { lookupWarranty, type CoverageItem, type CoverageKind, type CoverageState, type LookupResult, type WarrantyPolicy } from "@/lib/warranty/lookup";
import { useToast } from "@/lib/ui/toast";
import PhoneClaimModal from "./PhoneClaimModal";

/**
 * Warranty Center → Lookup.
 *
 * Whatever the customer walks in with — the invoice, the job slip, the phone
 * itself (IMEI), the accessory's box (item code), or just their number — goes
 * in one box, and every item it leads to comes back with a plain verdict:
 * covered until when, or expired since when, or never covered.
 */

const ff = "'Plus Jakarta Sans', sans-serif";

const STATE: Record<CoverageState, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  Active:  { label: "Under warranty",   color: "#16a34a", bg: "rgba(34,197,94,0.10)",   icon: ShieldCheck },
  Pending: { label: "Starts on handover", color: "#d97706", bg: "rgba(245,158,11,0.10)", icon: Clock },
  Expired: { label: "Warranty expired", color: "#dc2626", bg: "rgba(239,68,68,0.08)",   icon: ShieldX },
  None:    { label: "No warranty",      color: "#64748b", bg: "rgba(100,116,139,0.10)", icon: ShieldAlert },
  Void:    { label: "Void",             color: "#dc2626", bg: "rgba(239,68,68,0.08)",   icon: ShieldX },
};

const KIND_ICON: Record<CoverageKind, typeof Smartphone> = {
  Repair: Wrench, Phone: Smartphone, Accessory: Package, Part: Cpu, Other: Box,
};

const day = (iso: string | null) =>
  iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" }) : "—";

const EXAMPLES = ["INV-000207", "RM-584", "IMEI", "Item code", "07X XXX XXXX"];

export default function WarrantyLookup({ policies, onPrintCard, onClaim, onPhoneClaimed }: {
  policies: WarrantyPolicy[];
  onPrintCard: (w: Warranty) => void;
  onClaim: (w: Warranty) => void;
  /** A phone claim was recorded — the Claims tab should show it. */
  onPhoneClaimed?: () => void;
}) {
  const { jobs } = useRepair();
  const { warranties } = useWarranty();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneClaim, setPhoneClaim] = useState<CoverageItem | null>(null);

  const run = async (raw = query) => {
    const q = raw.trim();
    if (!q || busy) return;
    setBusy(true); setError(null);
    try {
      setResult(await lookupWarranty(q, { jobs, warranties, policies }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const counts = result?.items.reduce<Record<CoverageState, number>>((m, i) => ({ ...m, [i.state]: (m[i.state] ?? 0) + 1 }), { Active: 0, Pending: 0, Expired: 0, None: 0, Void: 0 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: ff }}>
      {/* ── Search ── */}
      <div style={{ borderRadius: 18, padding: "22px 22px 18px", background: "linear-gradient(135deg, var(--accent-dim), transparent 70%)", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Check a warranty</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
          Invoice number, job number, IMEI, accessory item code, warranty number or the customer&apos;s phone.
        </div>
        <form onSubmit={e => { e.preventDefault(); void run(); }} style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Scan or type… e.g. INV-000207, RM-584, 356789…"
              style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px 14px 44px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 15, fontWeight: 600, outline: "none", fontFamily: ff }}
            />
          </div>
          <button type="submit" disabled={!query.trim() || busy} style={{
            padding: "0 22px", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700, fontFamily: ff,
            background: query.trim() && !busy ? "var(--accent)" : "var(--border)", color: query.trim() && !busy ? "var(--accent-fg)" : "var(--text-muted)",
            cursor: query.trim() && !busy ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8,
          }}>
            {busy ? <Loader2 size={16} className="spin-icon" /> : <ShieldCheck size={16} />} Check
          </button>
        </form>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {EXAMPLES.map(x => (
            <span key={x} style={{ fontSize: 11, color: "var(--text-muted)", padding: "3px 9px", borderRadius: 99, border: "1px dashed var(--border)" }}>{x}</span>
          ))}
        </div>
      </div>

      {error && <div style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626", fontSize: 12.5 }}>{error}</div>}

      {/* ── Results ── */}
      {result && (
        result.items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", borderRadius: 16, border: "1px dashed var(--border)" }}>
            <ShieldAlert size={30} color="var(--text-muted)" />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 8 }}>Nothing found for “{result.query}”</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>Check the number, or try the IMEI or the customer&apos;s phone instead.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                <b style={{ color: "var(--text-primary)" }}>{result.items.length}</b> item{result.items.length === 1 ? "" : "s"} for “{result.query}”
                {result.matchedAs.length > 0 && <span style={{ color: "var(--text-muted)" }}> · matched as {result.matchedAs.join(", ")}</span>}
              </span>
              <span style={{ flex: 1 }} />
              {(Object.keys(STATE) as CoverageState[]).filter(s => counts?.[s]).map(s => (
                <span key={s} style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: STATE[s].bg, color: STATE[s].color }}>
                  {counts?.[s]} {STATE[s].label.toLowerCase()}
                </span>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {result.items.map(item => <CoverageCard key={item.key} item={item} onPrintCard={onPrintCard} onClaim={onClaim} onPhoneClaim={setPhoneClaim} />)}
            </div>
          </>
        )
      )}

      {phoneClaim && (
        <PhoneClaimModal
          item={phoneClaim}
          onClose={() => setPhoneClaim(null)}
          onDone={(_claim, message) => {
            setPhoneClaim(null);
            toast.dialog("success", "Warranty claim recorded", message);
            onPhoneClaimed?.();
            void run(result?.query ?? query);
          }}
        />
      )}
    </div>
  );
}

function CoverageCard({ item, onPrintCard, onClaim, onPhoneClaim }: {
  item: CoverageItem; onPrintCard: (w: Warranty) => void; onClaim: (w: Warranty) => void; onPhoneClaim: (i: CoverageItem) => void;
}) {
  const st = STATE[item.state];
  const Icon = st.icon;
  const KindIcon = KIND_ICON[item.kind];
  // How much of the cover has been used — the bar a customer understands.
  const used = item.state === "Active" && item.durationDays > 0 && item.days !== null
    ? Math.min(100, Math.max(0, ((item.durationDays - item.days) / item.durationDays) * 100)) : item.state === "Expired" ? 100 : 0;

  return (
    <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-card)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Verdict band */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: st.bg, borderBottom: "1px solid var(--border)" }}>
        <Icon size={20} color={st.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: st.color }}>{st.label}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
            {item.state === "Active" && item.days !== null && <>{item.days} day{item.days === 1 ? "" : "s"} left · until {day(item.expiresOn)}</>}
            {item.state === "Expired" && <>Ended {day(item.expiresOn)} · {item.days} day{item.days === 1 ? "" : "s"} ago</>}
            {item.state === "Pending" && <>{item.label}</>}
            {(item.state === "None" || item.state === "Void") && <>{item.note ?? item.label}</>}
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <KindIcon size={12} /> {item.kind}
        </span>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)" }}>{item.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontFamily: item.detail.startsWith("IMEI") ? "monospace" : ff }}>{item.detail}</div>
        </div>

        {item.durationDays > 0 && item.state !== "Void" && (
          <div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${used}%`, background: item.state === "Expired" ? "#dc2626" : used > 85 ? "#f59e0b" : "#16a34a", borderRadius: 99 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>{item.startsOn ? `From ${day(item.startsOn)}` : "Not started"}</span>
              <span>{item.label}</span>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
          {item.invoiceNo && <Fact icon={FileText} text={item.invoiceNo} />}
          {item.jobId && <Fact icon={Wrench} text={item.jobId} />}
          {item.customer && <Fact icon={User} text={item.customer} />}
          {item.phone && <Fact icon={Phone} text={item.phone} />}
        </div>

        {item.terms && <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, borderTop: "1px dashed var(--border)", paddingTop: 8 }}>{item.terms}</div>}
        {item.note && item.state !== "None" && item.state !== "Void" && <div style={{ fontSize: 11.5, color: "#d97706" }}>{item.note}</div>}
      </div>

      {/* A phone under warranty: claim on it here. */}
      {item.kind === "Phone" && item.claimable && item.state === "Active" && item.deviceId && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", alignSelf: "center", flex: 1 }}>Repair · send to company · replace · refund</span>
          <button onClick={() => onPhoneClaim(item)} style={{ ...btn, color: "#d97706", borderColor: "rgba(245,158,11,0.45)" }}>Start claim</button>
        </div>
      )}

      {item.warranty && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", alignSelf: "center", flex: 1 }}>{item.warranty.id}</span>
          <button onClick={() => onPrintCard(item.warranty!)} style={btn}>Warranty card</button>
          {item.state === "Active" && <button onClick={() => onClaim(item.warranty!)} style={{ ...btn, color: "#d97706", borderColor: "rgba(245,158,11,0.45)" }}>Start claim</button>}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ff };

function Fact({ icon: Icon, text }: { icon: typeof User; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, color: "var(--text-secondary)" }}>
      <Icon size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
}
