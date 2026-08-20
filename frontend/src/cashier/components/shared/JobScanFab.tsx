"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScanLine, X, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { useRepair, jobLabel, VIEW_META, type RepairJob, type RepairView } from "@/cashier/contexts/RepairContext";
import { useBarcodeScanner } from "@/cashier/hooks/useBarcodeScanner";

const ff = "'Plus Jakarta Sans', sans-serif";
const priorityColor: Record<string, string> = {
  Low: "#94a3b8", Normal: "#60a5fa", High: "#fbbf24", Urgent: "#f87171",
};

/** Matches whatever a job's printed label actually encodes — the job ID
 *  (job tags) or the device IMEI (mobile device tags). Job ID wins on a tie
 *  since it's the unambiguous one; an IMEI can theoretically repeat across
 *  a device's repair history, so the most recent job wins there. */
function findJobByCode(jobs: RepairJob[], raw: string): RepairJob | null {
  const code = raw.trim();
  if (!code) return null;
  const byId = jobs.find(j => j.id.toLowerCase() === code.toLowerCase());
  if (byId) return byId;
  // Then the originating dealer's number, which is what a dealer quotes when
  // they ring about a device. Unique per dealer, so a shared number across two
  // dealers is resolved to the most recent job rather than an arbitrary one.
  const byDealerNo = jobs
    .filter(j => (j.dealerJobNo ?? "").trim().toLowerCase() === code.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (byDealerNo[0]) return byDealerNo[0];
  const byImei = jobs
    .filter(j => (j.imei ?? "").trim() !== "" && j.imei === code)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return byImei[0] ?? null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontFamily: ff }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, fontFamily: ff, wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
}

/**
 * Floating scan button, mounted once per dashboard shell (Cashier and
 * Technician both render it just outside their page-switching `<main>`, so
 * it stays visible no matter which tab is open) — see src/app/cashier/page.tsx
 * and src/app/technician/page.tsx.
 *
 * Works two ways: click it and scan/type into the focused field, or just
 * scan while browsing anywhere (no editable field focused) and this pops
 * open on its own — see useBarcodeScanner for how a hardware scan is told
 * apart from normal typing.
 */
export default function JobScanFab() {
  const { jobs } = useRepair();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // undefined = no lookup run yet, null = looked up and not found, RepairJob = found
  const [result, setResult] = useState<RepairJob | null | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const runLookup = (code: string) => {
    setQuery(code);
    setResult(findJobByCode(jobs, code) ?? null);
  };

  useBarcodeScanner((code) => {
    setOpen(true);
    runLookup(code);
  });

  // Keyboard shortcut: F9 opens the panel by hand (useful when there's no
  // scanner in reach). A single function key on purpose — no modifier combo
  // to go wrong: Ctrl+F is browser-reserved (Find in page, unpreventable),
  // and Ctrl+Alt+letter is physically the same chord as AltGr on many
  // non-US keyboard layouts, which can make the browser report a different
  // key than what was actually pressed. F9 has no browser default and
  // reports the same `key` value regardless of layout.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.repeat) return; // ignore auto-repeat while held down
      if (e.key === "F9") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const close = () => { setOpen(false); setQuery(""); setResult(undefined); };

  const view: RepairView | null = result ? jobLabel(result) : null;
  const meta = view ? VIEW_META[view as Exclude<RepairView, "All">] : null;
  const balance = result ? Math.max(0, result.estimatedCost - result.advancePaid) : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Scan a job's barcode (F9)"
        style={{
          position: "fixed", right: 24, bottom: 24, zIndex: 900,
          width: 54, height: 54, borderRadius: "50%", border: "none",
          background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
      >
        <ScanLine size={22} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1010, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(480px, calc(100vw - 24px))", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ScanLine size={15} color="var(--accent)" />
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Scan Job</p>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 6px", fontFamily: ff }}>F9</span>
              </div>
              <button onClick={close} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
              <form onSubmit={(e) => { e.preventDefault(); runLookup(query); }} style={{ display: "flex", gap: 8 }}>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    // When the panel's opened via the button, the input is
                    // already focused — a scan types straight into it, then
                    // sends Enter. Read the DOM value directly here instead
                    // of waiting on React's controlled-state + native-submit
                    // timing, so results appear the instant the scan finishes.
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runLookup(e.currentTarget.value);
                    }
                  }}
                  placeholder="Scan or type Job ID / IMEI"
                  style={{ flex: 1, minWidth: 0, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: ff }}
                />
                <button type="submit" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff, flexShrink: 0 }}>
                  <Search size={14} /> Find
                </button>
              </form>

              {result === undefined && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "18px 0", fontFamily: ff }}>
                  Point the scanner at a job&apos;s barcode label, or type its Job ID / IMEI above.
                </p>
              )}

              {result === null && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)" }}>
                  <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>
                    No job found for <strong>{query}</strong>. Check the code and try again.
                  </span>
                </div>
              )}

              {result && meta && view && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={16} color={meta.color} />
                      <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", fontFamily: ff }}>{result.id}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontFamily: ff }}>{view}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor[result.priority], fontFamily: ff }}>● {result.priority}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--bg-surface)", borderRadius: 10, padding: "14px 16px" }}>
                    <Row label="Customer" value={result.customerName} />
                    <Row label="Phone" value={result.phone} />
                    <Row label="Device" value={`${result.brand} ${result.model}`} />
                    <Row label="IMEI" value={result.imei} />
                    <Row label="Technician" value={result.technician} />
                    <Row label="Dealer" value={result.dealer || "Mano Mobile"} />
                    <Row label="Created" value={result.createdAt} />
                    <Row label="Est. Completion" value={result.estimatedCompletion} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "10px 12px" }}>
                      <Row label="Estimated" value={`Rs. ${result.estimatedCost.toLocaleString()}`} />
                    </div>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "10px 12px" }}>
                      <Row label="Advance" value={`Rs. ${result.advancePaid.toLocaleString()}`} />
                    </div>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "10px 12px" }}>
                      <Row label="Balance" value={<span style={{ color: balance > 0 ? "#f87171" : "#4ade80" }}>Rs. {balance.toLocaleString()}</span>} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontFamily: ff }}>Issue</div>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, fontFamily: ff }}>{result.issue || "—"}</p>
                  </div>

                  {result.techRemarks && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontFamily: ff }}>Technician Remarks</div>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: ff }}>{result.techRemarks}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
