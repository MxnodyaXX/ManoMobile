"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DeviceLock } from "@/lib/repair/DeviceLock";
import { ScanLine, X, Search, CheckCircle2, AlertCircle, ArrowRight, BellRing, Receipt } from "lucide-react";
import { hasOpenInquiry, inquiryLabel, recordInquiry } from "@/lib/repair/inquiry";
import { useToast } from "@/lib/ui/toast";
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
 * The one thing worth doing about this job right now.
 *
 * Four stages, four different answers, and offering all four at once would
 * make the useful one the hardest to find:
 *
 *   not started    tell the bench somebody is asking
 *   in progress    tell the bench it is now urgent
 *   repaired       bill it and hand it over
 *   collected      nothing to do but read the record
 *
 * The reading stays available at every stage as the quiet second button,
 * because "open the whole job" is never wrong and never the point.
 */
function JobActions({ job, flagged, flagging, onFlag, onOpen, onIssue }: {
  job: RepairJob;
  flagged: boolean;
  flagging: boolean;
  onFlag: () => void;
  onOpen?: () => void;
  onIssue?: () => void;
}) {
  const waiting  = job.status === "Non-Issued";
  const working  = job.status === "Issued" || job.status === "Pending";
  const repaired = job.status === "Completed";

  const primary: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "11px 16px", borderRadius: 10, cursor: "pointer",
    fontSize: 13, fontWeight: 700, fontFamily: ff,
  };
  const quiet: React.CSSProperties = {
    ...primary,
    border: "1px solid var(--border)", background: "transparent",
    color: "var(--text-secondary)", fontWeight: 600,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(waiting || working) && (
        <button
          onClick={onFlag}
          disabled={flagging || flagged}
          title={flagged ? "The bench has already been told about this one" : undefined}
          style={{
            ...primary,
            border: `1px solid ${working ? "#f87171" : "#fbbf24"}`,
            background: flagged ? "transparent" : working ? "#f87171" : "#fbbf24",
            color: flagged ? (working ? "#f87171" : "#fbbf24") : "#1a1a1a",
            cursor: flagging || flagged ? "default" : "pointer",
            opacity: flagging ? 0.6 : 1,
          }}
        >
          <BellRing size={14} />
          {flagged
            ? "The bench has been told"
            : flagging ? "Telling the bench…" : inquiryLabel(job)}
        </button>
      )}

      {repaired && onIssue && (
        <button onClick={onIssue} style={{ ...primary, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)" }}>
          <Receipt size={14} />Proceed to Issue Job
        </button>
      )}

      {onOpen && (
        <button onClick={onOpen} style={waiting || working || repaired ? quiet : { ...primary, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)" }}>
          Open {job.id}<ArrowRight size={14} />
        </button>
      )}
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
export default function JobScanFab({ onOpenJob, onIssueJob }: {
  /**
   * What "open this job" means in the shell this is mounted in.
   *
   * The panel finds jobs; it does not own what can be done with one, and the
   * two shells do not agree on the answer — a cashier gets the full record
   * with its billing, cancelling and Ctrl+E, a technician gets the read-only
   * view of somebody else's bench. Passing the action in keeps both of those
   * where they already live instead of a second copy of either ending up here.
   *
   * No handler, no button.
   */
  onOpenJob?: (job: RepairJob) => void;
  /**
   * Billing a finished repair. Only the cashier shell passes it — a technician
   * scanning a completed job is looking at it, not taking money for it.
   */
  onIssueJob?: (job: RepairJob) => void;
} = {}) {
  const { jobs } = useRepair();
  const toast = useToast();
  // Which job the counter has just flagged, so the button can answer for
  // itself rather than waiting for the row to come back round through
  // realtime. Keyed by id: scanning a second job must not inherit the first
  // one's confirmation.
  const [flagged, setFlagged] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
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

  /**
   * The found job as it stands now, not as it stood when it was found.
   *
   * The panel stays open while somebody flags an inquiry, or while another
   * machine moves the job on. Reading the match it was given would keep
   * showing that row — which is how a screen ends up needing a reload to tell
   * the truth. `result` remains the raw lookup: null for "looked and found
   * nothing", undefined for "not looked yet".
   */
  const live = result ? jobs.find(j => j.id === result.id) ?? result : result;

  const view: RepairView | null = live ? jobLabel(live) : null;
  const meta = view ? VIEW_META[view as Exclude<RepairView, "All">] : null;
  const balance = live ? Math.max(0, live.estimatedCost - live.advancePaid) : 0;

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
                    // timing, so lives appear the instant the scan finishes.
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

              {live === undefined && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "18px 0", fontFamily: ff }}>
                  Point the scanner at a job&apos;s barcode label, or type its Job ID / IMEI above.
                </p>
              )}

              {live === null && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)" }}>
                  <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: ff }}>
                    No job found for <strong>{query}</strong>. Check the code and try again.
                  </span>
                </div>
              )}

              {live && meta && view && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={16} color={meta.color} />
                      <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", fontFamily: ff }}>{live.id}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontFamily: ff }}>{view}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor[live.priority], fontFamily: ff }}>● {live.priority}</span>
                    </div>
                  </div>

                  {/* Which handset, right under which job. The scan already
                      said which record; this is what confirms the thing in
                      your hand is the one it describes. */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: -6 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                      {[live.brand, live.model].filter(Boolean).join(" ") || "—"}
                    </span>
                    {live.imei && (
                      <span style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--text-muted)" }}>IMEI {live.imei}</span>
                    )}
                  </div>

                  {/* The two reasons a technician opens this at all: what is
                      wrong with it, and how to get into it. Everything below
                      is context — whose it is, when it is due, what it costs —
                      and none of it is needed with the phone already in hand.
                      They lead. */}
                  <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: ff }}>Reported fault</div>
                    <p style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45, fontFamily: ff }}>{live.issue || "—"}</p>
                  </div>

                  <DeviceLock type={live.passcodeType} code={live.devicePasscode} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--bg-surface)", borderRadius: 10, padding: "14px 16px" }}>
                    <Row label="Customer" value={live.customerName} />
                    <Row label="Phone" value={live.phone} />
                    <Row label="Technician" value={live.technician} />
                    <Row label="Dealer" value={live.dealer || "Mano Mobile"} />
                    <Row label="Created" value={live.createdAt} />
                    <Row label="Est. Completion" value={live.estimatedCompletion} />
                  </div>

                  {/* What the counter can do about this job, which depends
                      entirely on where it has got to. A job nobody has started
                      needs the bench told; one in progress needs the bench told
                      it is now urgent; a finished one needs billing; a
                      collected one needs nothing but reading. */}
                  <JobActions
                    job={live}
                    flagged={flagged === live.id || hasOpenInquiry(live)}
                    flagging={flagging}
                    onFlag={async () => {
                      setFlagging(true);
                      try {
                        await recordInquiry(live.id);
                        setFlagged(live.id);
                        toast.success(
                          live.status === "Non-Issued"
                            ? `${live.technician && live.technician !== "Unassigned" ? live.technician : "The bench"} has been told a customer is asking about ${live.id}.`
                            : `${live.id} is flagged as urgent — the customer came in for an update.`,
                        );
                      } catch (e) {
                        toast.dialog("error", "Could not flag the job", e instanceof Error ? e.message : String(e));
                      } finally {
                        setFlagging(false);
                      }
                    }}
                    onOpen={onOpenJob && (() => { const j = live; setOpen(false); onOpenJob(j); })}
                    onIssue={onIssueJob && (() => { const j = live; setOpen(false); onIssueJob(j); })}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "10px 12px" }}>
                      <Row label="Estimated" value={`Rs. ${live.estimatedCost.toLocaleString()}`} />
                    </div>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "10px 12px" }}>
                      <Row label="Advance" value={`Rs. ${live.advancePaid.toLocaleString()}`} />
                    </div>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "10px 12px" }}>
                      <Row label="Balance" value={<span style={{ color: balance > 0 ? "#f87171" : "#4ade80" }}>Rs. {balance.toLocaleString()}</span>} />
                    </div>
                  </div>

                  {live.techRemarks && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontFamily: ff }}>Technician Remarks</div>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: ff }}>{live.techRemarks}</p>
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
