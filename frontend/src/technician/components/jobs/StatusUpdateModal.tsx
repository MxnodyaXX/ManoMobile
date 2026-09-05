"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, AlertTriangle, Play, Pause, CheckCircle,
  XCircle, ArrowRight, Shield, CheckSquare, DollarSign, ChevronDown, Wrench,
} from "lucide-react";
import { type RepairJob, type JobStatus, type CompletionType, type EstimateApproval, type ApprovalChannel, useRepair, isInHouseDealer } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import DeviceDetailsFields, { draftFromJob, missingOn, type DeviceDraft } from "@/technician/components/jobs/DeviceDetailsFields";
import { useParts } from "@/cashier/contexts/PartsContext";
import { rulesForTechnician, type EffectiveRules } from "@/lib/settings/staffRules";
import { labourFromRate, describeRate } from "@/lib/repair/labour";
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
    // Not a variation of Return. A Return means we are not taking the
    // customer's money; this means we are giving back money already taken.
    id: "Cash Return" as const,
    label: "Cash Return",
    blurb: "Could not be repaired and the customer is owed money back — usually a repair that did not hold. Enter what should be returned.",
    color: "#60a5fa",
  },
  {
    id: "FOC" as const,
    label: "FOC",
    blurb: "Repaired free of charge. Nothing to pay.",
    color: "#60a5fa",
  },
];

/**
 * The work summaries that repeat all day. Tapping one appends it, so the
 * common case is a tap and the unusual case is still a sentence typed by hand.
 * "Too much typing" was one of the three complaints about this screen.
 */
const QUICK_SUMMARIES = [
  "Screen replaced", "Battery replaced", "Charging port replaced",
  "Software reflashed", "Cleaned and serviced", "Camera replaced",
  "Speaker / mic replaced", "No fault found",
];

/**
 * Warranty periods, plus the one that is not a period.
 *
 * CHECKING_WARRANTY is a sentinel, not a duration: the device is going back to
 * the counter with its cover still to be worked out — usually because it is a
 * repeat visit and somebody has to look up what was issued last time.
 *
 * It is also the default, which the 30 days here used to be. A form that opens
 * on a real warranty gives one away every time a technician finishes a job
 * without reading this section; a form that opens on "checking" gives away
 * nothing and leaves the decision where it belongs.
 */
const CHECKING_WARRANTY = -1;

const WARRANTY_OPTIONS = [
  { days: CHECKING_WARRANTY, label: "Checking Warranty" },
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

export default function StatusUpdateModal({ job, initialNext, onClose }: {
  job: RepairJob;
  /** Open with this transition already chosen. The banner buttons name the
   *  action ("Mark as Completed"), so landing on a status picker the technician
   *  has already answered is a step that asks the same question twice. */
  initialNext?: JobStatus;
  onClose: () => void;
}) {
  const { jobs, updateJob, dealers } = useRepair();
  // A device sent in by another shop has no end customer of ours to ask —
  // the dealer is who we deal with, and they already know their own quote.
  // The approval gate below only makes sense for a Mano Mobile customer.
  const isManoMobileJob = isInHouseDealer(dealers, job);
  const { technicianName, setJobMeta, getElapsedMinutes, diagnostics, addActivity, saveFunctionalTest, saveWarranty, partRequests } = useTech();
  const { parts: catalog } = useParts();
  const { issueWarranty } = useWarranty();

  const [selectedNext, setSelectedNext] = useState<JobStatus | null>(initialNext ?? null);
  const [pauseReason, setPauseReason]   = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmed, setConfirmed]       = useState(false);

  // Functional test state (shown when completing)
  const [testResults, setTestResults]   = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(FUNCTIONAL_TESTS.map(t => [t, null]))
  );
  const [testNotes, setTestNotes]       = useState("");
  const [testsOpen, setTestsOpen]       = useState(false);
  const [extrasOpen, setExtrasOpen]     = useState(false);
  /**
   * The two optional sections, folded away.
   *
   * Finishing a job that needs nothing said about it still meant scrolling past
   * eight quick-remark chips, a notes box, a parts table and a parts box to
   * reach the button. Both are genuinely optional on most repairs, so they
   * start closed and say what is in them — and open themselves the moment
   * there is something to see.
   */
  const [notesOpen, setNotesOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [warrantyDays, setWarrantyDays] = useState(CHECKING_WARRANTY);
  // What the shop owes back. Seeded from the original repair when this is a
  // re-job, because that is nearly always the figure — the customer paid it
  // for a repair that has not held.
  const [cashReturnAmount, setCashReturnAmount] = useState("");

  /**
   * The repair this job repeats, if it does.
   *
   * Read from the register rather than refetched: the technician needs to see
   * that this handset was already repaired for Rs. 5,000, because that is
   * nearly always the figure that should go back.
   */
  const rejobOf = job.rejobOf ? jobs.find(j => j.id === job.rejobOf) ?? null : null;
  const rejobWarranty = (() => {
    if (!rejobOf?.completedAt) return "Unknown";
    const w = rejobOf.jobWarranty ?? "";
    if (!w || /^NO WARRANTY/i.test(w)) return "No warranty";
    if (/CHECKING/i.test(w)) return "Being checked";
    return `Within warranty · ${w}`;
  })();

  /**
   * Model number and IMEI, filled in at the bench.
   *
   * Neither is printed on the outside of most handsets, so intake books the
   * majority of jobs in without them and they stay empty for the life of the
   * record — which is the one place they matter, since the IMEI is what ties a
   * warranty claim or a police enquiry to this repair.
   *
   * The technician is the first person who can read them. Opened by default
   * when either is missing, folded away when the record is already complete.
   */
  const [deviceDraft, setDeviceDraft] = useState<DeviceDraft>(() => draftFromJob(job));
  const deviceNeed = missingOn(job);
  const deviceIncomplete = deviceNeed.modelNumber || deviceNeed.imei;
  const [deviceOpen, setDeviceOpen] = useState(deviceIncomplete);
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

  /**
   * What this job actually consumed, and what it cost the shop.
   *
   * Approved counts, not only Installed: an approved request has already come
   * off the shelf, so it is a real cost against the job whether or not the
   * technician remembered to tick it as installed. Unit cost is read from the
   * catalogue at completion time — the request rows carry no price of their
   * own, so a part delisted since (part_sku gone) shows as unpriced rather
   * than being silently counted as free.
   */
  const jobPartLines = partRequests
    .filter(r => r.jobId === job.id && (r.status === "Approved" || r.status === "Issued"))
    .map(r => {
      const cat = catalog.find(p => p.sku === r.partSku);
      const unitCost = cat?.costPrice ?? 0;
      return {
        id: r.id,
        name: r.partName,
        qty: r.quantity,
        unitCost,
        lineTotal: unitCost * r.quantity,
        priced: !!cat,
        installed: !!r.installedAt,
      };
    });

  const partsCost    = jobPartLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const unpricedPart = jobPartLines.some(l => !l.priced);

  // Parts used (prefilled from those same requests) + future faults — both printed on the receipt.
  const installedParts = jobPartLines.map(l => `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ""}`);
  const [partsUsedText, setPartsUsedText] = useState(installedParts.join("\n"));
  const [futureFaults, setFutureFaults]   = useState("");
  // Charging less than the parts cost is a real loss on the job, and should be
  // a deliberate decision here rather than something discovered in a report at
  // the end of the month.
  const [lossAccepted, setLossAccepted]   = useState(false);

  // ── Estimate approval gate ──
  const originalEstimate = job.originalEstimate ?? job.estimatedCost;
  const [revisedCost, setRevisedCost]   = useState(String(job.estimatedCost));
  const [apprChannel, setApprChannel]   = useState<ApprovalChannel>("In-store");
  const [apprRef, setApprRef]           = useState("");
  const [apprSig, setApprSig]           = useState("");
  // Nothing is charged for a Return or an FOC, whatever was quoted. The
  // original estimate stays on the job; this is the final charge.
  const chargeable   = completionType === "Normal";
  const cashReturn   = completionType === "Cash Return";
  const revisedNum   = chargeable ? (parseFloat(revisedCost) || 0) : 0;
  // What the box shows. Derived rather than written into state so switching
  // Return -> Normal brings the original figure back instead of leaving a zero
  // the technician has to retype.
  const shownCost    = chargeable ? revisedCost : "0";
  // A device that was not repaired cannot carry a repair warranty.
  const canWarrant   = completionType !== "Return" && completionType !== "Cash Return";
  const needsApproval = isManoMobileJob && revisedNum > originalEstimate + 0.001 && !job.approval;
  // Margin on this job. A Return charges nothing but the parts are usually
  // still gone, and an FOC is a loss by definition — so the shortfall is shown
  // for all three, and only a *chargeable* job asks for an acknowledgement,
  // since choosing FOC is already the acknowledgement.
  /**
   * What the technician is charging for this job.
   *
   * Always entered here, because only they know what the job was worth. The
   * per-person rate in Admin -> Permissions pre-fills it — a technician on a
   * flat Rs. 500 shouldn't retype it every time — but it is a suggestion, not
   * a formula, and can always be overwritten.
   *
   * Written onto the job at completion rather than derived later from whatever
   * the rate happens to be then: a renegotiated rate must not rewrite the
   * profit on jobs already finished.
   */
  const labourMode = rules?.labourCostMode ?? "none";
  const labourRate = rules?.labourCostValue ?? 0;
  const suggestedLabour = labourMode === "custom"
    ? null
    : labourFromRate(labourMode, labourRate, revisedNum);

  const [labourInput, setLabourInput] = useState("");
  const [labourTouched, setLabourTouched] = useState(false);
  // Derived, not synced through an effect: while untouched the field simply
  // shows the suggestion, so a percentage rate follows the final cost as it is
  // edited instead of going stale at whatever it was when the modal opened.
  const labourValue = labourTouched
    ? labourInput
    : suggestedLabour === null ? "" : String(suggestedLabour);
  const labourCost = Math.max(0, parseFloat(labourValue) || 0);

  // Parts and labour together are what the job actually cost.
  const jobCost   = partsCost + labourCost;
  const jobMargin = revisedNum - jobCost;
  const atALoss   = jobCost > 0 && jobMargin < -0.001;
  const needsLossAck = atALoss && chargeable;
  const approvalCaptured = apprChannel === "In-store" ? apprSig.trim() !== "" : apprRef.trim().length > 2;

  /**
   * Starting a job used to pause whatever else this technician had running,
   * unconditionally — which quietly overrode the "work on several jobs at
   * once" permission: the rule said yes, and the bench still only ever had one
   * live job. Now the other job is only paused when starting this one would
   * actually breach the rule.
   *
   * `rules` is null while the lookup is in flight; treated as permissive, the
   * same as everywhere else in this file, so a slow network never pauses a job
   * it had no business pausing.
   */
  const myOtherActive = jobs
    .filter(j => j.technician === technicianName && j.status === "Issued" && j.id !== job.id)
    // Oldest first: if something has to give, it is the job that has been
    // sitting open longest, not the one just touched.
    .sort((a, b) => new Date(a.startedAt ?? a.createdAt).getTime() - new Date(b.startedAt ?? b.createdAt).getTime());

  const activeCap = rules
    ? (rules.allowMultipleActiveJobs ? (rules.maxActiveJobs ?? Infinity) : 1)
    : Infinity;

  const conflictJob = selectedNext === "Issued" && myOtherActive.length + 1 > activeCap
    ? myOtherActive[0]
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
  // How many checks were actually answered. A collapsed, untouched checklist
  // has none — which is not the same as eleven passes, and must not be
  // recorded as one.
  const testsAnswered = Object.values(testResults).filter(v => v !== null).length;
  const testsFailed = Object.values(testResults).filter(v => v === false).length;
  const testsTotal  = FUNCTIONAL_TESTS.length;

  /** The one thing standing between this form and a saved status. */
  const blockedBecause = (() => {
    if (!selectedNext) return "Choose the new status above.";
    if (selectedNext === "Pending" && pauseReason.trim().length <= 3) return "Give a reason for putting the job on hold.";
    if (selectedNext === "Completed") {
      // Optional on a normal or free-of-charge repair — the device works, and
      // forcing a sentence out of a busy bench just produces "done". A Return
      // is different: nothing was repaired, and that explanation is printed on
      // the customer's receipt, so it stays required.
      if ((completionType === "Return" || completionType === "Cash Return") && completionNotes.trim().length <= 5) {
        return "Explain why the repair could not be completed (at least 6 characters).";
      }
      // A Cash Return with no figure is a job that says money is owed without
      // saying how much, which nobody downstream can act on.
      if (completionType === "Cash Return" && !(parseFloat(cashReturnAmount) > 0)) {
        return "Enter the amount that should be returned to the customer.";
      }
      if (needsApproval && !approvalCaptured) {
        return "The final cost is above the quote — capture the customer's approval first.";
      }
      if (labourValue.trim() === "") {
        return "Enter what you are charging for this job.";
      }
      if (needsLossAck && !lossAccepted) {
        return `This job costs Rs. ${jobCost.toLocaleString()} but you are charging Rs. ${revisedNum.toLocaleString()} — confirm the loss or raise the final cost.`;
      }
    }
    if (selectedNext === "Cancelled" && cancelReason.trim().length <= 3) return "Give a reason for cancelling.";
    return null;
  })();

  const canSubmit = (() => {
    if (!selectedNext) return false;
    if (selectedNext === "Pending")   return pauseReason.trim().length > 3;
    if (selectedNext === "Completed") {
      return ((completionType !== "Return" && completionType !== "Cash Return") || completionNotes.trim().length > 5)
        && (completionType !== "Cash Return" || parseFloat(cashReturnAmount) > 0)
        && (!needsApproval || approvalCaptured)
        && labourValue.trim() !== ""
        && (!needsLossAck || lossAccepted);
    }
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

      // Finished without ever being started in the system — a quick job the
      // technician did in one go. Stamp a start anyway: a job with a completion
      // date and no start breaks the Started column, the stage tables and every
      // turnaround figure. The activity note below keeps the record honest
      // about what actually happened.
      if (!job.startedAt) {
        completedPatch.startedAt = now.toISOString();
        setJobMeta(job.id, { startedAt: now });
        addActivity({
          jobId: job.id,
          type: "status_change",
          description: "Completed directly — the job was never started in the system, so start and finish are the same moment",
        });
      }
      const partsList = partsUsedText.split("\n").map(s => s.trim()).filter(Boolean);
      if (partsList.length) completedPatch.partsUsed = partsList;
      if (futureFaults.trim()) completedPatch.futureFaults = futureFaults.trim();
      // What the technician charged. Written unconditionally — including zero,
      // which is a real answer — so a job that cost nothing is distinguishable
      // from one finished before this field existed (those stay null).
      completedPatch.labourCost = labourCost;
      // Only when something was actually typed. A blank box means intake had
      // nothing and the technician could not read it either — not an
      // instruction to wipe a number somebody already recorded.
      if (deviceNeed.modelNumber) {
        if (deviceDraft.modelNumber.trim()) completedPatch.modelNumber = deviceDraft.modelNumber.trim();
        if (deviceDraft.brand.trim())       completedPatch.brand       = deviceDraft.brand.trim();
        if (deviceDraft.model.trim())       completedPatch.model       = deviceDraft.model.trim();
      }
      if (deviceNeed.imei && deviceDraft.imei.trim()) completedPatch.imei = deviceDraft.imei.trim();
      // Left at "checking", the counter has to settle the cover at handover —
      // so say so on the job. Without it the sales screen falls back to
      // "NO WARRANTY", which is a different answer from "not decided yet" and
      // the one nobody would go back and correct.
      if (warrantyDays === CHECKING_WARRANTY && canWarrant) {
        completedPatch.jobWarranty = "CHECKING WARRANTY";
      }
      // Save functional test
      // Only record a QC result when something was actually checked. Saving
      // "overall pass" for a checklist nobody opened would put a test on the
      // job's history that never happened.
      if (testsAnswered > 0) {
        saveFunctionalTest({
          jobId: job.id, completedAt: now, results: testResults,
          overallPass: testsFailed === 0, notes: testNotes || undefined,
        });
      }

      // Capture estimate approval if the cost went up — Mano Mobile jobs
      // only; an outside dealer's job never showed the gate above, so there
      // is no approval interaction here to record.
      let approval: EstimateApproval | undefined;
      if (isManoMobileJob && revisedNum > originalEstimate + 0.001 && !job.approval) {
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
        const wid = await issueWarranty({
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
      // Owed, not paid. The technician says money should go back and how much;
      // a cashier records the money actually leaving the till.
      completedPatch.cashReturnAmount = cashReturn ? parseFloat(cashReturnAmount) || 0 : null;
      if (approval) completedPatch.approval = approval;

      if (testsAnswered > 0) {
        addActivity({ jobId: job.id, type: "test_completed", description: `Functional tests: ${testsPassed}/${testsTotal} passed${testsFailed > 0 ? `, ${testsFailed} failed` : ""}` });
      }
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

  /**
   * A section heading that folds.
   *
   * Same row the functional tests and future-faults sections already use — one
   * tappable bar, the state on the right — so an optional block reads the same
   * wherever it appears in this sheet.
   */
  const fold = (label: string, open: boolean, toggle: () => void, hint: string) => (
    <button
      onClick={toggle}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        minHeight: 44, padding: "0 12px", borderRadius: 9, cursor: "pointer",
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
        fontFamily: ff, textAlign: "left",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: hint === "Optional" || hint === "None" ? "var(--text-muted)" : TA }}>
        {hint}
      </span>
      <ChevronDown
        size={14}
        style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.18s" }}
      />
    </button>
  );

  const sec = (label: string) => (
    <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>{label}</p>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 28px 24px", width: "min(920px, 96vw)", maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", fontFamily: ff }}>

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

            {/* Transition buttons — hidden when the caller already named the
                action. "Mark as Completed" opening onto a list where Completed
                is pre-ticked asks the same question twice; to switch, close and
                press the other button. Still shown wherever the modal is opened
                without a choice, since there the list is the only way to make
                one. */}
            {!initialNext && allowed.length > 0 && (
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
                    <strong style={{ color: "var(--text-primary)" }}>{conflictJob.id}</strong> ({conflictJob.brand} {conflictJob.model}) is active and will be automatically <strong style={{ color: "#fbbf24" }}>paused</strong>
                    {activeCap === 1
                      ? " — you are set to one job at a time."
                      : ` — you are capped at ${activeCap} at a time and already have ${myOtherActive.length}.`}
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
                {/* The five reasons that cover almost every pause, as one tap
                    each — the datalist above only helps someone who already
                    started typing the right words. */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {PAUSE_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setPauseReason(r)}
                      style={{
                        minHeight: 34, padding: "0 12px", borderRadius: 17, fontSize: 12,
                        background: pauseReason === r ? "rgba(251,191,36,0.14)" : "var(--bg-secondary)",
                        border: `1px solid ${pauseReason === r ? "rgba(251,191,36,0.45)" : "var(--border)"}`,
                        color: pauseReason === r ? "#b45309" : "var(--text-secondary)",
                        cursor: "pointer", fontFamily: ff,
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: pauseReason.trim().length > 3 ? TA : "var(--text-muted)", fontFamily: ff }}>
                  {pauseReason.trim().length} chars {pauseReason.trim().length > 3 ? "✓" : "(min 4)"}
                </p>
              </div>
            )}

            {/* ── Completion: work notes + functional tests + warranty ── */}
            {selectedNext === "Completed" && (
              /* Two columns on anything wider than a tablet. Finishing a job
                 asks for eight separate things, and stacked in one column that
                 is a long scroll on every repair — the cost and the completion
                 type end up on different screens from the Complete button.
                 Sections that carry a table or a full checklist still span both
                 columns; only the short ones pair up. */
              <div className="complete-grid" style={{ display: "grid", gap: 16, alignItems: "start" }}>

                {/*
                  The first thing asked, because it decides everything under it:
                  whether there is anything to charge, whether a warranty can be
                  issued, and what the receipt says. It used to sit in the right
                  column beside a Final Cost field the technician had to fill in
                  before knowing whether the job had a cost at all.
                */}
                {/* How this job ended — drives the charge, the warranty and the receipt */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, gridColumn: "1 / -1" }}>
                  {sec("How did this job end? *")}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {COMPLETION_TYPES.map(t => {
                      const active = completionType === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setCompletionType(t.id)}
                          style={{
                            flex: "1 1 210px", textAlign: "left", padding: "14px 16px", borderRadius: 11,
                            borderWidth: active ? 2 : 1, borderStyle: "solid",
                            borderColor: active ? t.color : "var(--border)",
                            background: active ? t.color + "12" : "var(--bg-secondary)",
                            cursor: "pointer", fontFamily: ff, transition: "all 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                            <span style={{
                              width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                              border: `2px solid ${active ? t.color : "var(--border)"}`,
                              background: active ? t.color : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--bg-card)" }} />}
                            </span>
                            <span style={{ fontSize: 14.5, fontWeight: 700, color: active ? t.color : "var(--text-primary)" }}>{t.label}</span>
                          </div>
                          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{t.blurb}</p>
                        </button>
                      );
                    })}
                  </div>
                  {completionType !== "Normal" && completionType !== "Cash Return" && (
                    <p style={{ fontSize: 11.5, color: "#fbbf24", fontFamily: ff, lineHeight: 1.5 }}>
                      {completionType === "Return"
                        ? "Nothing will be charged and no warranty is issued. Explain below what could not be repaired — it goes on the customer's receipt."
                        : "Nothing will be charged. A warranty can still be issued for the work done."}
                    </p>
                  )}

                  {/* The figure the whole downstream flow runs on: the cashier's
                      list, Sales Management, the billing screen and the dealer's
                      account all read this one number off the job. */}
                  {cashReturn && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "13px 15px", borderRadius: 11, background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.35)" }}>
                      {/* Everything known about why this device is back, so the
                          amount is a decision rather than a guess. Shown only
                          where it exists — most jobs have no earlier one. */}
                      {rejobOf && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", paddingBottom: 10, borderBottom: "1px solid rgba(96,165,250,0.25)" }}>
                          {[
                            { k: "Re-job", v: "Yes" },
                            { k: "Original job", v: rejobOf.id },
                            { k: "Original repair", v: `Rs. ${rejobOf.estimatedCost.toLocaleString()}` },
                            { k: "Warranty", v: rejobWarranty },
                          ].map(r => (
                            <span key={r.k} style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>
                              {r.k}: <strong style={{ color: "var(--text-primary)" }}>{r.v}</strong>
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 2 }}>
                            Cash Return Amount *
                          </p>
                          <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
                            What the shop owes back. Recorded as owed — a cashier pays it out and confirms it separately.
                          </p>
                        </div>
                        <input
                          type="number" min={0} step="0.01"
                          value={cashReturnAmount}
                          onChange={e => setCashReturnAmount(e.target.value)}
                          placeholder="0.00"
                          style={{
                            width: 150, padding: "9px 11px", borderRadius: 9, fontSize: 15, fontWeight: 700,
                            textAlign: "right", outline: "none", fontFamily: ff,
                            border: `1px solid ${parseFloat(cashReturnAmount) > 0 ? "rgba(96,165,250,0.6)" : "var(--border)"}`,
                            background: "var(--bg-primary)", color: "var(--text-primary)",
                          }}
                        />
                      </div>

                      {rejobOf && parseFloat(cashReturnAmount || "0") !== rejobOf.estimatedCost && rejobOf.estimatedCost > 0 && (
                        <button
                          type="button"
                          onClick={() => setCashReturnAmount(String(rejobOf.estimatedCost))}
                          style={{ alignSelf: "flex-start", padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(96,165,250,0.4)", background: "transparent", color: "#60a5fa", fontFamily: ff }}
                        >
                          Use the original repair amount · Rs. {rejobOf.estimatedCost.toLocaleString()}
                        </button>
                      )}
                    </div>
                  )}
                </div>


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
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>
                        Final cost (Rs.){!chargeable && <span style={{ color: "#fbbf24" }}> · nothing to pay</span>}
                      </p>
                      <input
                        type="number"
                        min={0}
                        value={shownCost}
                        readOnly={!chargeable}
                        onChange={e => setRevisedCost(e.target.value)}
                        style={{
                          ...inputStyle,
                          ...(chargeable ? {} : { background: "var(--bg-primary)", color: "var(--text-muted)", cursor: "not-allowed" }),
                        }}
                      />
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


                  {/* Work summary (technician remarks → printed on the receipt) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* A Return has to be explained, so that one is never folded. */}
                  {completionType === "Return"
                    ? sec("Reason Not Repaired * (required)")
                    : fold("Job remarks", notesOpen, () => setNotesOpen(v => !v),
                        completionNotes.trim() ? "Written" : "Optional")}
                  {(completionType === "Return" || notesOpen || completionNotes.trim() !== "") && (
                  <>
                  {completionType !== "Return" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {QUICK_SUMMARIES.map(q => (
                        <button
                          key={q}
                          onClick={() => setCompletionNotes(n => (n.trim() ? `${n.trim()}, ${q}` : q))}
                          style={{
                            minHeight: 32, padding: "0 11px", borderRadius: 16, fontSize: 11.5,
                            background: "var(--bg-secondary)", border: "1px solid var(--border)",
                            color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff,
                          }}
                        >
                          + {q}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea placeholder={completionType === "Return"
                    ? "Why the repair could not be completed — what was tried, what failed…"
                    : "Describe all work performed — parts replaced, tests done, issues found…"} value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={3} style={inputStyle} />
                  <p style={{ fontSize: 11, color: completionNotes.trim().length > 5 ? TA : "var(--text-muted)", fontFamily: ff }}>
                    {completionType === "Return"
                      ? <>{completionNotes.trim().length} chars {completionNotes.trim().length > 5 ? "✓" : "(min 6)"}</>
                      : <>Printed on the customer&apos;s receipt if you fill it in.</>}
                  </p>
                  </>
                  )}
                </div>

                </div>

                {/*
                  What the technician is charging the shop for the job.

                  Structured to mirror the Final Cost block beside it: an icon
                  row, then a small caption, then the input. Without the caption
                  this input sat a line higher than the one it is read against,
                  which is the sort of half-alignment that reads as broken even
                  when nothing is.
                */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Wrench size={13} color={TA} />
                    {sec("Your Charge For This Job * (required)")}
                  </div>
                  <div>
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3 }}>
                      Amount (Rs.)
                    </p>
                    <input
                      type="number"
                      min={0}
                      value={labourValue}
                      onChange={e => { setLabourTouched(true); setLabourInput(e.target.value); }}
                      placeholder="What you are charging for this repair"
                      style={inputStyle}
                    />
                  </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
                      {!labourTouched && labourMode !== "none" && labourMode !== "custom"
                        ? `Suggested from your rate (${describeRate(labourMode, labourRate)}) — change it if this job was worth more or less.`
                        : labourMode === "custom"
                          ? "Your work is priced job by job, so this cannot be worked out later."
                          : "Recorded against the repair. It is what the shop pays out, and what profit is measured after."}
                    </p>
                  </div>

                {/*
                  The device's own identity, captured while it is open.

                  Sits with the optional folds rather than at the top: it is not
                  a decision, and on a job where intake already got both it is
                  nothing to read. It opens itself when either is missing, which
                  on this shop's jobs is most of them.
                */}
                {/* Nothing at all when intake already captured both — an empty
                    fold saying "Recorded" is a row of chrome asking to be read
                    on every single job that does not need it. */}
                {deviceIncomplete && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: "1 / -1" }}>
                    {fold("Device details", deviceOpen, () => setDeviceOpen(v => !v),
                      deviceNeed.modelNumber && deviceNeed.imei ? "Model no. and IMEI missing"
                        : deviceNeed.modelNumber ? "Model number missing"
                          : "IMEI missing")}

                    {deviceOpen && (
                      <DeviceDetailsFields job={job} value={deviceDraft} onChange={setDeviceDraft} inputStyle={inputStyle} />
                    )}
                  </div>
                )}

                {/* Parts used, with what they cost the shop */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: "1 / -1" }}>
                  {fold("Parts used", partsOpen || jobPartLines.length > 0, () => setPartsOpen(v => !v),
                    jobPartLines.length > 0
                      ? `${jobPartLines.length} ${jobPartLines.length === 1 ? "part" : "parts"} · Rs. ${partsCost.toLocaleString()}`
                      : "None")}

                  {(partsOpen || jobPartLines.length > 0) && (
                  <>
                  {(jobPartLines.length > 0 || labourCost > 0) && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", fontFamily: ff }}>
                      {jobPartLines.map(l => (
                        <div key={l.id} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "8px 11px",
                          borderBottom: "1px solid var(--border)", fontSize: 12,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                              {l.name}{l.qty > 1 ? ` ×${l.qty}` : ""}
                            </p>
                            <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>
                              {l.priced ? `Rs. ${l.unitCost.toLocaleString()} each` : "No catalogue price"}
                              {!l.installed && " · not marked installed"}
                            </p>
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: l.priced ? "var(--text-primary)" : "var(--text-muted)" }}>
                            {l.priced ? `Rs. ${l.lineTotal.toLocaleString()}` : "—"}
                          </span>
                        </div>
                      ))}

                      {/* Parts and labour against what is being charged */}
                      <div style={{ padding: "9px 11px", background: "var(--bg-secondary)", display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Parts cost</span>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Rs. {partsCost.toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Technician&apos;s charge</span>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Rs. {labourCost.toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {chargeable ? "Charging" : `Charging (${completionType})`}
                          </span>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Rs. {revisedNum.toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 5, borderTop: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                            {jobMargin < 0 ? "Loss on this job" : "Margin"}
                          </span>
                          <span style={{ fontWeight: 800, color: jobMargin < 0 ? "#f87171" : TA }}>
                            {jobMargin < 0 ? "−" : ""}Rs. {Math.abs(jobMargin).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {unpricedPart && (
                    <p style={{ fontSize: 11, color: "#fbbf24", fontFamily: ff, lineHeight: 1.5 }}>
                      One or more parts are no longer in the catalogue, so their cost is not included in the total above.
                    </p>
                  )}

                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginTop: 2 }}>
                    Parts used (one per line) — printed on the receipt
                  </p>
                  <textarea placeholder="e.g. iPhone 13 Rear Camera Module" value={partsUsedText} onChange={e => setPartsUsedText(e.target.value)} rows={2} style={inputStyle} />
                  </>
                  )}
                </div>

                {/*
                  Outside the fold on purpose. It refuses the submit until it is
                  answered, and a blocker hidden inside a collapsed section is a
                  button that will not work for a reason nobody can see.
                */}
                {needsLossAck && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{
                      padding: "11px 13px", borderRadius: 10,
                      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.4)",
                      fontFamily: ff, display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                          This job costs <strong style={{ color: "#f87171" }}>Rs. {jobCost.toLocaleString()}</strong>
                          {labourCost > 0 ? ` (Rs. ${partsCost.toLocaleString()} parts + Rs. ${labourCost.toLocaleString()} labour)` : ""} but
                          you are charging <strong>Rs. {revisedNum.toLocaleString()}</strong> — the shop loses{" "}
                          <strong style={{ color: "#f87171" }}>Rs. {Math.abs(jobMargin).toLocaleString()}</strong> on this
                          repair. Raise the final cost above, or confirm the loss is intended.
                        </p>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                        <input type="checkbox" checked={lossAccepted} onChange={e => setLossAccepted(e.target.checked)} style={{ cursor: "pointer" }} />
                        <span style={{ color: "var(--text-secondary)" }}>Complete anyway at a loss</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Future faults — worth recording when spotted, never worth
                    blocking a finished job on, so it folds away with the rest
                    of the optional detail. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: "1 / -1" }}>
                  <button
                    onClick={() => setExtrasOpen(o => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      minHeight: 44, padding: "0 12px", borderRadius: 9, cursor: "pointer",
                      fontFamily: ff, textAlign: "left",
                      background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Future Faults Spotted
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: futureFaults.trim() ? TA : "var(--text-muted)" }}>
                      {futureFaults.trim() ? "Noted" : "Optional"}
                    </span>
                    <ChevronDown
                      size={14}
                      style={{ color: "var(--text-muted)", transform: extrasOpen ? "rotate(180deg)" : undefined, transition: "transform 0.18s" }}
                    />
                  </button>
                  {extrasOpen && (
                    <textarea placeholder="e.g. Battery health at 82% — may need replacement soon" value={futureFaults} onChange={e => setFutureFaults(e.target.value)} rows={2} style={inputStyle} />
                  )}
                </div>

                {/* Functional tests — collapsed by default.
                    Eleven checks are worth having on a screen replacement and
                    pointless on a software reset, so this opens on demand
                    rather than standing between every job and its Complete
                    button. The header carries the count, so a technician can
                    see at a glance whether anything was recorded. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: "1 / -1" }}>
                  <button
                    onClick={() => setTestsOpen(o => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "10px 12px", borderRadius: 9, cursor: "pointer", fontFamily: ff,
                      background: "var(--bg-secondary)", border: "1px solid var(--border)",
                      textAlign: "left",
                    }}
                  >
                    <CheckSquare size={13} color={TA} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Functional Test Checklist
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: testsAnswered === 0 ? "var(--text-muted)" : testsFailed > 0 ? "#f87171" : TA }}>
                      {testsAnswered === 0 ? "Not filled in" : `${testsPassed}/${testsTotal} passed`}
                    </span>
                    <ChevronDown
                      size={14}
                      style={{ color: "var(--text-muted)", transform: testsOpen ? "rotate(180deg)" : undefined, transition: "transform 0.18s" }}
                    />
                  </button>

                  {testsOpen && (<>

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
                  </>)}
                </div>

                {/* Warranty */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: "1 / -1" }}>
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
                  {warrantyDays === CHECKING_WARRANTY && (
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
                      No warranty is issued yet — the counter settles it at handover. Pick a period
                      here if you already know what this repair should carry.
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

            {/*
              Stuck to the bottom of the sheet.

              Finishing a job asks for one required thing and eight optional
              ones, and the button sat under all nine — so the quick case, where
              nothing needs changing, still meant scrolling the whole form to
              reach it. It stays on screen now, and says what it is about to
              record, so the technician can read the two numbers and press once.
            */}
            <div style={{
              position: "sticky", bottom: 0, zIndex: 2,
              display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center",
              flexWrap: "wrap", marginTop: 4, padding: "12px 0 2px",
              background: "var(--bg-card)", borderTop: "1px solid var(--border)",
            }}>
              {selectedNext === "Completed" && !blockedBecause && (
                <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>
                    Customer pays{" "}
                    <strong style={{ fontSize: 14, color: chargeable ? "var(--text-primary)" : "#fbbf24" }}>
                      {chargeable ? `Rs. ${revisedNum.toLocaleString()}` : "nothing"}
                    </strong>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>
                    You charge{" "}
                    <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>Rs. {labourCost.toLocaleString()}</strong>
                  </span>
                </div>
              )}
              {blockedBecause && (
                <p style={{ flex: 1, minWidth: 180, fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
                  {blockedBecause}
                </p>
              )}
              <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 9, fontSize: 13, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
              <button onClick={handleSubmit} disabled={!canSubmit} style={{
                padding: "10px 24px", borderRadius: 9, fontSize: 13.5, fontWeight: 700,
                background: canSubmit ? TA : "var(--bg-secondary)",
                border: `1px solid ${canSubmit ? TA : "var(--border)"}`,
                color: canSubmit ? "#000" : "var(--text-muted)",
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontFamily: ff, transition: "all 0.15s",
              }}>
                {selectedNext === "Completed" ? "Finish job" : "Confirm update"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
