"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, AlertTriangle, Play, Pause, CheckCircle,
  XCircle, ArrowRight, Shield, CheckSquare, DollarSign,
} from "lucide-react";
import { type RepairJob, type JobStatus, type CompletionType, type EstimateApproval, type ApprovalChannel, useRepair } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import { rulesForTechnician, type EffectiveRules } from "@/lib/settings/staffRules";
import { useToast } from "@/lib/ui/toast";
import { useWarranty, type WarrantyScope } from "@/cashier/contexts/WarrantyContext";
import SignaturePad from "@/cashier/components/shared/SignaturePad";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

const STATUS_CFG: Record<JobStatus, { label: string; color: string; bg: string; border: string }> = {
  "Non-Issued": { label: "Not Started", color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
  "Issued":     { label: "In Progress", color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.25)"  },
  "Pending":    { label: "Paused",       color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)"  },
  "Completed":  { label: "Completed",   color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)"  },
  "Delivered":  { label: "Delivered",   color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)" },
  "Cancelled":  { label: "Cancelled",   color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
};

const PAUSE_REASONS = [
  "Waiting for parts to arrive",
  "Waiting for customer approval",
  "Switched to higher priority job",
  "Needs further diagnosis",
  "Waiting for software download",
];

/**
 * Baseline transitions. Widened at runtime by the technician's work rules —
 * see `allowed` below. On its own this table forces every job to be Started in
 * the system before it can be Completed, which a busy bench does not do.
 */
const ALLOWED_NEXT: Partial<Record<JobStatus, JobStatus[]>> = {
  "Non-Issued": ["Issued"],
  "Issued":     ["Pending", "Completed"],
  "Pending":    ["Issued"],
};

const FUNCTIONAL_TESTS = [
  "Powers on / off normally",
  "Touchscreen responsive",
  "Phone calls (earpiece & mic)",
  "WiFi connection",
  "Bluetooth",
  "Front camera",
  "Rear camera",
  "Charging",
  "Loudspeaker",
  "Volume & power buttons",
  "Fingerprint / Face ID",
];

/**
 * How a finished job ended. All three leave the bench and wait for collection,
 * but they are not the same event: only Normal is chargeable work, and only a
 * repaired device can carry a warranty.
 */
const COMPLETION_TYPES = [
  {
    id: "Normal" as const,
    label: "Normal",
    blurb: "Repaired successfully and charged as quoted.",
    color: "#34d399",
  },
  {
    id: "Return" as const,
    label: "Return",
    blurb: "Could not be repaired. Device goes back to the customer unrepaired, with nothing to pay.",
    color: "#f87171",
  },
  {
    id: "FOC" as const,
    label: "FOC",
    blurb: "Repaired free of charge. Nothing to pay.",
    color: "#60a5fa",
  },
];

const WARRANTY_OPTIONS = [
  { days: 0,   label: "No Warranty"  },
  { days: 7,   label: "7 Days"       },
  { days: 30,  label: "30 Days"      },
  { days: 90,  label: "90 Days"      },
  { days: 180, label: "6 Months"     },
  { days: 365, label: "1 Year"       },
];

function StatusBadge({ status }: { status: JobStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 6, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, fontFamily: ff, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

export default function StatusUpdateModal({ job, onClose }: { job: RepairJob; onClose: () => void }) {
  const { jobs, updateJob } = useRepair();
  const { technicianName, setJobMeta, getElapsedMinutes, diagnostics, addActivity, saveFunctionalTest, saveWarranty, partRequests } = useTech();
  const { issueWarranty } = useWarranty();

  const [selectedNext, setSelectedNext] = useState<JobStatus | null>(null);
  const [pauseReason, setPauseReason]   = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmed, setConfirmed]       = useState(false);

  // Functional test state (shown when completing)
  const [testResults, setTestResults]   = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(FUNCTIONAL_TESTS.map(t => [t, null]))
  );
  const [testNotes, setTestNotes]       = useState("");
  const [warrantyDays, setWarrantyDays] = useState(30);
  const [completionType, setCompletionType] = useState<CompletionType>("Normal");
  // What this technician is allowed to do. Defaults are permissive, so a rules
  // lookup that fails never traps a finished job on the bench.
  const [rules, setRules] = useState<EffectiveRules | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    rulesForTechnician(technicianName)
      .then(r => { if (active) setRules(r); })
      .catch(() => { /* defaults apply */ });
    return () => { active = false; };
  }, [technicianName]);
  const [warrantyScope, setWarrantyScope] = useState<WarrantyScope>("Parts & Labour");

  // Parts used (prefilled from installed part requests) + future faults — both printed on the receipt.
  const installedParts = partRequests
    .filter(r => r.jobId === job.id && r.installedAt)
    .map(r => `${r.partName}${r.quantity > 1 ? ` ×${r.quantity}` : ""}`);
  const [partsUsedText, setPartsUsedText] = useState(installedParts.join("\n"));
  const [futureFaults, setFutureFaults]   = useState("");

  // ── Estimate approval gate ──
  const originalEstimate = job.originalEstimate ?? job.estimatedCost;
  const [revisedCost, setRevisedCost]   = useState(String(job.estimatedCost));
  const [apprChannel, setApprChannel]   = useState<ApprovalChannel>("In-store");
  const [apprRef, setApprRef]           = useState("");
  const [apprSig, setApprSig]           = useState("");
  // Nothing is charged for a Return or an FOC, whatever was quoted. The
  // original estimate stays on the job; this is the final charge.
  const chargeable   = completionType === "Normal";
  const revisedNum   = chargeable ? (parseFloat(revisedCost) || 0) : 0;
  // A device that was not repaired cannot carry a repair warranty.
  const canWarrant   = completionType !== "Return";
  const needsApproval = revisedNum > originalEstimate + 0.001 && !job.approval;
  const approvalCaptured = apprChannel === "In-store" ? apprSig.trim() !== "" : apprRef.trim().length > 2;

  const conflictJob = selectedNext === "Issued"
    ? jobs.find(j => j.technician === technicianName && j.status === "Issued" && j.id !== job.id)
    : undefined;

  const hasDiagnostic = !!diagnostics[job.id];
  const requireStart = rules?.requireStartBeforeFinish ?? true;

  const allowed = (() => {
    const list = [...(ALLOWED_NEXT[job.status] ?? [])];
    // A paused job was already started; making the technician resume it just to
    // finish it is friction that records nothing.
    if (job.status === "Pending" && !list.includes("Completed")) list.push("Completed");
    // Shop rule off: a job can be finished without ever being started here.
    if (job.status === "Non-Issued" && !requireStart && !list.includes("Completed")) list.push("Completed");
    return list;
  })();

  const testsPassed = Object.values(testResults).filter(v => v === true).length;
  const testsFailed = Object.values(testResults).filter(v => v === false).length;
  const testsTotal  = FUNCTIONAL_TESTS.length;

  /** The one thing standing between this form and a saved status. */
  const blockedBecause = (() => {
    if (!selectedNext) return "Choose the new status above.";
    if (selectedNext === "Pending" && pauseReason.trim().length <= 3) return "Give a reason for putting the job on hold.";
    if (selectedNext === "Completed") {
      if (completionNotes.trim().length <= 5) {
        return completionType === "Return"
          ? "Explain why the repair could not be completed (at least 6 characters)."
          : "Add a work summary (at least 6 characters).";
      }
      if (needsApproval && !approvalCaptured) {
        return "The final cost is above the quote — capture the customer's approval first.";
      }
    }
    if (selectedNext === "Cancelled" && cancelReason.trim().length <= 3) return "Give a reason for cancelling.";
    return null;
  })();

  const canSubmit = (() => {
    if (!selectedNext) return false;
    if (selectedNext === "Pending")   return pauseReason.trim().length > 3;
    if (selectedNext === "Completed") return completionNotes.trim().length > 5 && (!needsApproval || approvalCaptured);
    if (selectedNext === "Cancelled") return cancelReason.trim().length > 3;
    return true;
  })();

  const handleSubmit = async () => {
    if (!selectedNext || !canSubmit) return;

    if (conflictJob) {
      updateJob(conflictJob.id, { status: "Pending" });
      setJobMeta(conflictJob.id, { lastPausedAt: new Date(), pauseReason: "Switched to another job" });
    }

    const now = new Date();
    const completedPatch: Partial<RepairJob> = {};

    if (selectedNext === "Issued") {
      const elapsed = getElapsedMinutes(job.id);
      setJobMeta(job.id, { startedAt: now, lastPausedAt: undefined, pauseReason: undefined, accumulatedMinutes: elapsed });
      completedPatch.startedAt = now.toISOString();
      completedPatch.pauseReason = undefined;
      addActivity({ jobId: job.id, type: "status_change", description: `Job started${hasDiagnostic ? " (diagnostic on record)" : " (no pre-repair diagnostic)"}` });
    } else if (selectedNext === "Pending") {
      setJobMeta(job.id, { lastPausedAt: now, pauseReason: pauseReason.trim() });
      completedPatch.pauseReason = pauseReason.trim();
      completedPatch.pausedAt = now.toISOString();
      addActivity({ jobId: job.id, type: "status_change", description: `Job paused — ${pauseReason.trim()}` });
    } else if (selectedNext === "Completed") {
      setJobMeta(job.id, { completedAt: now, completionNotes, lastPausedAt: now });
      completedPatch.completedAt = now.toISOString().slice(0, 10);
      completedPatch.techRemarks = completionNotes.trim();
      const partsList = partsUsedText.split("\n").map(s => s.trim()).filter(Boolean);
      if (partsList.length) completedPatch.partsUsed = partsList;
      if (futureFaults.trim()) completedPatch.futureFaults = futureFaults.trim();
      // Save functional test
      const overallPass = testsFailed === 0;
      saveFunctionalTest({ jobId: job.id, completedAt: now, results: testResults, overallPass, notes: testNotes || undefined });

      // Capture estimate approval if the cost went up
      let approval: EstimateApproval | undefined;
      if (revisedNum > originalEstimate + 0.001 && !job.approval) {
        approval = {
          amount: revisedNum, approvedBy: job.customerName, channel: apprChannel,
          signature: apprChannel === "In-store" ? apprSig : undefined,
          reference: apprChannel !== "In-store" ? apprRef : undefined,
          approvedAt: now.toISOString(), recordedByStaff: technicianName,
        };
        addActivity({ jobId: job.id, type: "note_added", description: `Revised estimate Rs. ${revisedNum.toLocaleString()} approved by customer (${apprChannel})` });
      }

      // Issue the unified warranty (status: Pending Activation — clock starts at handover)
      if (warrantyDays > 0 && canWarrant) {
        const wid = issueWarranty({
          jobId: job.id,
          customerName: job.customerName,
          customerPhone: job.phone,
          deviceModel: `${job.brand} ${job.model}`,
          imei: job.imei,
          partsCovered: [job.issue],
          scope: warrantyScope,
          durationDays: warrantyDays,
        });
        completedPatch.warrantyId = wid;
        // Legacy record kept for technician-side views
        const expiresAt = new Date(now.getTime() + warrantyDays * 86_400_000);
        saveWarranty({ jobId: job.id, issuedAt: now, durationDays: warrantyDays, expiresAt });
        addActivity({ jobId: job.id, type: "warranty_issued", description: `Warranty issued: ${WARRANTY_OPTIONS.find(w => w.days === warrantyDays)?.label} (${warrantyScope}) — activates on collection` });
      }

      completedPatch.estimatedCost = revisedNum;
      completedPatch.revisedEstimate = revisedNum;
      completedPatch.completionType = completionType;
      if (approval) completedPatch.approval = approval;

      addActivity({ jobId: job.id, type: "test_completed", description: `Functional tests: ${testsPassed}/${testsTotal} passed${testsFailed > 0 ? `, ${testsFailed} failed` : ""}` });
      addActivity({
        jobId: job.id,
        type: "status_change",
        description: `Job completed (${completionType}). ${completionNotes.slice(0, 70)}${completionNotes.length > 70 ? "…" : ""}`,
      });
    }

    // Await the write: a status that the database rejected must not be shown
    // as done, or the job silently springs back a moment later.
    const result = await updateJob(job.id, { status: selectedNext, ...completedPatch });
    if (!result.ok) {
      const msg = result.error ?? "The status could not be saved.";
      setSaveError(msg);
      toast.dialog("error", `${job.id} was not updated`, msg, "Try again");
      return;
    }
    toast.dialog("success", `${job.id} updated`, selectedNext === "Completed"
      ? `Finished as ${completionType}. The device is ready for collection.`
      : `Status is now ${selectedNext}.`);
    setConfirmed(true);
    setTimeout(onClose, 1400);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text-primary)",
    fontFamily: ff, outline: "none", resize: "none" as const,
  };

  const sec = (label: string) => (
    <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{label}</p>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 28px 24px", width: 520, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", fontFamily: ff }}>

        {/* Success */}
        {confirmed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${TA}14`, border: `2px solid ${TA}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={26} color={TA} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Status Updated</p>
            <StatusBadge status={selectedNext!} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3, fontFamily: ff }}>Update Job Status</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.brand} {job.model}</p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6 }}><X size={16} /></button>
            </div>

            {/* Diagnostic warning (start job) */}
            {!hasDiagnostic && job.status === "Non-Issued" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.55 }}>
                  <strong style={{ color: "#fbbf24" }}>No diagnostic on record.</strong> Consider running a pre-repair diagnostic before starting.
                </p>
              </div>
            )}

            {/* Why "Completed" is not on the list, when it is not */}
            {job.status === "Non-Issued" && requireStart && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderRadius: 10, background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.25)" }}>
                <AlertTriangle size={14} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.55 }}>
                  <strong style={{ color: "#60a5fa" }}>Start this job before finishing it.</strong> The shop requires a
                  start to be recorded. An Admin can turn that off under <strong>Permissions</strong>, and finishing
                  directly becomes available.
                </p>
              </div>
            )}

            {/* Status flow */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>Current</p>
                <StatusBadge status={job.status} />
              </div>
              <ArrowRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>New Status</p>
                {selectedNext ? <StatusBadge status={selectedNext} /> : <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Choose below</span>}
              </div>
            </div>

            {/* Transition buttons */}
            {allowed.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sec("Available Transitions")}
                {allowed.map(next => {
                  const cfg = STATUS_CFG[next];
                  const isSelected = selectedNext === next;
                  const icons: Record<string, any> = { Issued: Play, Pending: Pause, Completed: CheckCircle, Cancelled: XCircle };
                  const Icon = icons[next] ?? ArrowRight;
                  return (
                    <button key={next} onClick={() => setSelectedNext(next)} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10,
                      background: isSelected ? `${cfg.color}10` : "var(--bg-secondary)",
                      border: `1px solid ${isSelected ? cfg.color + "40" : "var(--border)"}`,
                      cursor: "pointer", transition: "all 0.15s", fontFamily: ff, textAlign: "left",
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                        <Icon size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{cfg.label}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
                          {next === "Issued"    && "Start / resume working on this job"}
                          {next === "Pending"   && "Pause this job — requires a reason"}
                          {next === "Completed" && "Mark as finished — includes QC checklist & warranty"}
                          {next === "Cancelled" && "Cancel this job — requires reason"}
                        </p>
                      </div>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSelected ? cfg.color : "var(--border)"}`, background: isSelected ? cfg.color : "transparent", flexShrink: 0, transition: "all 0.15s" }} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Conflict warning */}
            {conflictJob && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3, fontFamily: ff }}>Active Job Conflict</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55, fontFamily: ff }}>
                    <strong style={{ color: "var(--text-primary)" }}>{conflictJob.id}</strong> ({conflictJob.brand} {conflictJob.model}) is active and will be automatically <strong style={{ color: "#fbbf24" }}>paused</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* ── Pause inputs ── */}
            {selectedNext === "Pending" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sec("Pause Reason *")}
                <input list="pause-reason-list" value={pauseReason} onChange={e => setPauseReason(e.target.value)}
                  placeholder="Select a suggestion or type your own…" style={inputStyle} autoComplete="off" />
                <datalist id="pause-reason-list">{PAUSE_REASONS.map(r => <option key={r} value={r} />)}</datalist>
                <p style={{ fontSize: 11, color: pauseReason.trim().length > 3 ? TA : "var(--text-muted)", fontFamily: ff }}>
                  {pauseReason.trim().length} chars {pauseReason.trim().length > 3 ? "✓" : "(min 4)"}
                </p>
              </div>
            )}

            {/* ── Completion: work notes + functional tests + warranty ── */}
            {selectedNext === "Completed" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Estimate & approval gate */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <DollarSign size={13} color="#fbbf24" />
                    {sec("Final Cost")}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>Quoted at intake</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", fontFamily: ff }}>Rs. {originalEstimate.toLocaleString()}</p>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>Final cost (Rs.)</p>
                      <input type="number" min={0} value={revisedCost} onChange={e => setRevisedCost(e.target.value)} style={inputStyle} />
                    </div>
                  </div>

                  {needsApproval && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 13px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.3)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                        <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
                          Final cost is <strong style={{ color: "#fbbf24" }}>Rs. {(revisedNum - originalEstimate).toLocaleString()} higher</strong> than quoted.
                          Customer approval is required before completing.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(["In-store", "SMS", "WhatsApp", "Phone"] as ApprovalChannel[]).map(c => (
                          <button key={c} onClick={() => setApprChannel(c)} style={{
                            padding: "5px 11px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                            border: `1px solid ${apprChannel === c ? "#fbbf24" : "var(--border)"}`,
                            background: apprChannel === c ? "rgba(251,191,36,0.14)" : "var(--bg-secondary)",
                            color: apprChannel === c ? "#fbbf24" : "var(--text-muted)", cursor: "pointer", fontFamily: ff,
                          }}>{c}</button>
                        ))}
                      </div>
                      {apprChannel === "In-store" ? (
                        <SignaturePad value={apprSig} onChange={setApprSig} height={110} label="Customer Approval Signature *" />
                      ) : (
                        <input value={apprRef} onChange={e => setApprRef(e.target.value)} placeholder={`${apprChannel} reference / note (e.g. "approved by reply at 14:32")`} style={inputStyle} />
                      )}
                    </div>
                  )}
                </div>

                {/* How this job ended — drives the charge, the warranty and the receipt */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sec("Completion Type *")}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {COMPLETION_TYPES.map(t => {
                      const active = completionType === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setCompletionType(t.id)}
                          style={{
                            flex: "1 1 150px", textAlign: "left", padding: "10px 12px", borderRadius: 10,
                            border: `1px solid ${active ? t.color + "60" : "var(--border)"}`,
                            background: active ? t.color + "12" : "var(--bg-secondary)",
                            cursor: "pointer", fontFamily: ff, transition: "all 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", background: active ? t.color : "var(--border)", flexShrink: 0 }} />
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: active ? t.color : "var(--text-primary)" }}>{t.label}</span>
                          </div>
                          <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.45 }}>{t.blurb}</p>
                        </button>
                      );
                    })}
                  </div>
                  {completionType !== "Normal" && (
                    <p style={{ fontSize: 11.5, color: "#fbbf24", fontFamily: ff, lineHeight: 1.5 }}>
                      {completionType === "Return"
                        ? "Nothing will be charged and no warranty is issued. Explain below what could not be repaired — it goes on the customer's receipt."
                        : "Nothing will be charged. A warranty can still be issued for the work done."}
                    </p>
                  )}
                </div>

                {/* Work summary (technician remarks → printed on the Non-Issued receipt) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sec(completionType === "Return" ? "Reason Not Repaired * (required)" : "Job Remarks / Work Summary * (required)")}
                  <textarea placeholder={completionType === "Return"
                    ? "Why the repair could not be completed — what was tried, what failed…"
                    : "Describe all work performed — parts replaced, tests done, issues found…"} value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={3} style={inputStyle} />
                  <p style={{ fontSize: 11, color: completionNotes.trim().length > 5 ? TA : "var(--text-muted)", fontFamily: ff }}>
                    {completionNotes.trim().length} chars {completionNotes.trim().length > 5 ? "✓" : "(min 6)"}
                  </p>
                </div>

                {/* Parts used (prefilled from installed part requests) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sec("Parts Used (one per line)")}
                  <textarea placeholder="e.g. iPhone 13 Rear Camera Module" value={partsUsedText} onChange={e => setPartsUsedText(e.target.value)} rows={2} style={inputStyle} />
                </div>

                {/* Future faults the technician spotted */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sec("Future Faults Identified (optional)")}
                  <textarea placeholder="e.g. Battery health at 82% — may need replacement soon" value={futureFaults} onChange={e => setFutureFaults(e.target.value)} rows={2} style={inputStyle} />
                </div>

                {/* Functional tests */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckSquare size={13} color={TA} />
                    {sec("Functional Test Checklist")}
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: testsFailed > 0 ? "#f87171" : TA, fontFamily: ff }}>
                      {testsPassed}/{testsTotal} passed
                    </span>
                  </div>

                  {/* Marking eleven checks one at a time is the slowest part of
                      finishing a job — set them all, then correct the odd one. */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {([
                      { label: "Select all passed", v: true as const,  col: TA },
                      { label: "Mark all failed",   v: false as const, col: "#f87171" },
                      { label: "Clear all",         v: null as null,   col: "#94a3b8" },
                    ]).map(b => (
                      <button
                        key={b.label}
                        onClick={() => setTestResults(Object.fromEntries(FUNCTIONAL_TESTS.map(t => [t, b.v])))}
                        style={{
                          padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                          border: `1px solid ${b.col}40`, background: `${b.col}10`, color: b.col,
                          cursor: "pointer", fontFamily: ff, transition: "all 0.12s",
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", padding: "4px 0" }}>
                    {FUNCTIONAL_TESTS.map(test => {
                      const v = testResults[test];
                      return (
                        <div key={test} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff }}>{test}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {([true, false, null] as const).map((s, i) => {
                              const isActive = v === s;
                              const col = s === true ? TA : s === false ? "#f87171" : "#94a3b8";
                              const label = s === true ? "✓" : s === false ? "✕" : "—";
                              return (
                                <button key={i} onClick={() => setTestResults(prev => ({ ...prev, [test]: s }))} style={{
                                  width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 700,
                                  border: `1px solid ${isActive ? col + "50" : "var(--border)"}`,
                                  background: isActive ? col + "14" : "var(--bg-card)",
                                  color: isActive ? col : "var(--text-muted)",
                                  cursor: "pointer", transition: "all 0.12s",
                                }}>{label}</button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <textarea placeholder="Test notes (optional)…" value={testNotes} onChange={e => setTestNotes(e.target.value)} rows={2} style={inputStyle} />
                </div>

                {/* Warranty */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Shield size={13} color="#a78bfa" />
                    {sec("Warranty")}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {WARRANTY_OPTIONS.map(o => (
                      <button key={o.days} onClick={() => setWarrantyDays(o.days)} style={{
                        padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: `1px solid ${warrantyDays === o.days ? "#a78bfa50" : "var(--border)"}`,
                        background: warrantyDays === o.days ? "rgba(167,139,250,0.12)" : "var(--bg-secondary)",
                        color: warrantyDays === o.days ? "#a78bfa" : "var(--text-muted)",
                        cursor: "pointer", fontFamily: ff, transition: "all 0.12s",
                      }}>{o.label}</button>
                    ))}
                  </div>
                  {warrantyDays > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(["Parts & Labour", "Parts Only", "Labour Only"] as WarrantyScope[]).map(sc => (
                        <button key={sc} onClick={() => setWarrantyScope(sc)} style={{
                          padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                          border: `1px solid ${warrantyScope === sc ? "#a78bfa50" : "var(--border)"}`,
                          background: warrantyScope === sc ? "rgba(167,139,250,0.10)" : "var(--bg-secondary)",
                          color: warrantyScope === sc ? "#a78bfa" : "var(--text-muted)",
                          cursor: "pointer", fontFamily: ff,
                        }}>{sc}</button>
                      ))}
                    </div>
                  )}
                  {warrantyDays > 0 && (
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>
                      Warranty is issued now but <strong style={{ color: "#a78bfa" }}>activates when the customer collects</strong> the device.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Cancel reason ── */}
            {selectedNext === "Cancelled" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sec("Cancellation Reason *")}
                <textarea placeholder="Reason for cancellation…" value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} style={inputStyle} />
              </div>
            )}

            {/* The database refused it — say so instead of springing the row back */}
            {saveError && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 13px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)" }}>
                <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.55 }}>
                  <strong style={{ color: "#f87171" }}>Not saved:</strong> {saveError}
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", marginTop: 4 }}>
              {blockedBecause && (
                <p style={{ flex: 1, fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
                  {blockedBecause}
                </p>
              )}
              <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
              <button onClick={handleSubmit} disabled={!canSubmit} style={{
                padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: canSubmit ? TA : "var(--bg-secondary)",
                border: `1px solid ${canSubmit ? TA : "var(--border)"}`,
                color: canSubmit ? "#000" : "var(--text-muted)",
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontFamily: ff, transition: "all 0.15s",
              }}>Confirm Update</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
