"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  trackJob, trackJobHistory, approveJobEstimate,
  type TrackedJob, type TrackedJobHistoryEntry,
} from "@/lib/repair/api";
import { trackWarranty, type TrackedWarranty } from "@/lib/warranty/api";
import type { WarrantyStatus, ClaimStatus } from "@/cashier/contexts/WarrantyContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { SHOP_DETAILS } from "@/lib/shop";
import type { ConditionGrade } from "@/cashier/contexts/RepairContext";

/**
 * The public "Repair & Service Summary" page — what a customer sees when
 * they follow {track_link} from an SMS/email, scan the QR code on their
 * intake slip, or type their job number in at /track directly.
 *
 * Every section here is backed by something real in the database (via
 * track_job()/track_job_history()/track_warranty(), see the migrations
 * alongside this file). A few things a fuller version of this page could
 * show — a diagnosis write-up, categorised "fixed / found / suggested"
 * advisories, a functional-test checklist, before/after photo pairs, an
 * itemised invoice — aren't included, because none of that is actually
 * captured anywhere in the app today; showing them would mean inventing data
 * rather than reporting it. Warranty used to be excluded for the same
 * reason (it was a localStorage-only record on whichever staff browser
 * issued it) until warranties moved into Supabase — see
 * supabase/migrations/20260902000002_warranties.sql.
 */

const ff = "'Plus Jakarta Sans', sans-serif";

const CSS = `
:root{
  --bg:#F5F5F3; --card:#FFFFFF; --ink:#141414; --ink-2:#3A3A3A; --muted:#7A7A78; --line:#E7E5E0;
  /* Strictly black, white and grey — no accent colour. Red and green are
     kept, but only as status signals (needs attention / good outcome),
     never as decoration. "warn" is folded into the red family so there
     are just two meaningful hues on the page. */
  --brand:#1A1A1A; --brand-deep:#000000; --tint:#F2F2F0;
  --ok:#0FA96B; --ok-tint:#E4F7EF; --warn:#C23B32; --warn-tint:#FBEAE8; --bad:#C23B32; --bad-tint:#FBEAE8;
  --radius:18px; --radius-sm:12px;
  --shadow-sm:0 1px 2px rgba(0,0,0,.06);
}
*{box-sizing:border-box}
.tp *{box-sizing:border-box}
.tp{background:var(--bg);color:var(--ink);font-family:${ff};font-size:15px;line-height:1.55;padding-bottom:96px;min-height:100vh}
.tp h1,.tp h2,.tp h3,.tp h4{margin:0;line-height:1.25;letter-spacing:-.015em}
.tp p{margin:0}
.tp button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.tp a{color:var(--brand);text-decoration:none}

.tp .topbar{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.92);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line);padding:12px 18px;display:flex;align-items:center;gap:12px}
.tp .logo{width:34px;height:34px;border-radius:10px;flex:none;background:#fff;border:1px solid var(--line);display:grid;place-items:center;padding:5px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.tp .logo img{width:100%;height:100%;object-fit:contain}
.tp .brand-name{font-weight:800;font-size:15px;letter-spacing:-.02em}
.tp .brand-sub{font-size:11.5px;color:var(--muted);font-weight:500;margin-top:-2px}
.tp .secure{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--ok);background:var(--ok-tint);padding:5px 10px;border-radius:999px}
.tp .shell{max-width:1180px;margin:0 auto;padding:20px 16px 24px;display:grid;gap:16px}
.tp .rail{display:none}
@media(min-width:1000px){
  .tp .shell{grid-template-columns:minmax(0,1fr) 316px;align-items:start;gap:22px;padding:28px 24px 40px}
  .tp .col-main{display:grid;gap:16px;min-width:0}
  .tp .rail{display:grid;gap:14px;position:sticky;top:78px}
}
@media(max-width:999px){ .tp .col-main{display:grid;gap:16px} }

.tp .page-title h1{font-size:26px;font-weight:800}
.tp .page-title p{color:var(--muted);font-size:13.5px;margin-top:4px}

.tp .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow-sm);padding:18px}
.tp .card>header{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}
.tp .card>header h2{font-size:16px;font-weight:700}
.tp .card>header .hint{font-size:12px;color:var(--muted);margin-left:auto;font-weight:500}

.tp .hero{position:relative;overflow:hidden;color:#fff;border-radius:var(--radius);background:linear-gradient(135deg,#232323 0%,#141414 55%,#000000 100%);padding:22px 20px;box-shadow:0 14px 34px rgba(0,0,0,.32)}
.tp .hero .blob{position:absolute;inset:auto -60px -110px auto;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.12),rgba(255,255,255,0) 65%);pointer-events:none}
.tp .hero-label{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.72)}
.tp .hero-job{display:flex;align-items:center;gap:10px;margin:4px 0 2px}
.tp .hero-job strong{font-size:27px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.tp .copy-btn{width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.16);display:grid;place-items:center;color:#fff;flex:none;transition:background .16s}
.tp .copy-btn:hover{background:rgba(255,255,255,.28)}
.tp .hero-device{font-size:13.5px;color:rgba(255,255,255,.84);font-weight:500}
.tp .hero-status{display:inline-flex;align-items:center;gap:7px;margin-top:14px;font-weight:700;font-size:12.5px;padding:7px 13px;border-radius:999px}
.tp .hero-status .dot{width:7px;height:7px;border-radius:50%}
.tp .hero-foot{margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.18);display:flex;gap:18px;flex-wrap:wrap}
.tp .hero-foot div{min-width:96px}
.tp .hero-foot span{display:block;font-size:11px;color:rgba(255,255,255,.66);font-weight:500}
.tp .hero-foot b{font-size:14px;font-weight:700}

.tp .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px 16px}
.tp .kv>div{min-width:0}
.tp .kv span{display:block;font-size:11.5px;color:var(--muted);font-weight:600;margin-bottom:2px}
.tp .kv b{font-size:14px;font-weight:600;word-break:break-word}
.tp .kv .mono{font-variant-numeric:tabular-nums;letter-spacing:.02em}

.tp .pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap}
.tp .pill.ok{background:var(--ok-tint);color:var(--ok)}
.tp .pill.warn{background:var(--warn-tint);color:var(--warn)}
.tp .pill.bad{background:var(--bad-tint);color:var(--bad)}
.tp .pill.neutral{background:#F1F2F7;color:var(--muted)}

.tp .tl{display:grid;gap:0}
.tp .tl-step{display:grid;grid-template-columns:26px 1fr;gap:14px;position:relative;padding-bottom:16px}
.tp .tl-step:last-child{padding-bottom:0}
.tp .tl-step .rail-line{position:absolute;left:12.5px;top:22px;bottom:0;width:2px;background:var(--line);border-radius:2px}
.tp .tl-step.done .rail-line{background:var(--brand)}
.tp .tl-step:last-child .rail-line{display:none}
.tp .node{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;z-index:1;flex:none;background:#fff;border:2px solid var(--line);color:transparent}
.tp .tl-step.done .node{background:var(--brand);border-color:var(--brand);color:#fff}
.tp .tl-step.current .node{background:#fff;border-color:var(--brand-deep);box-shadow:0 0 0 4px rgba(0,0,0,.10)}
.tp .tl-step.current .node::after{content:"";width:8px;height:8px;border-radius:50%;background:var(--brand-deep)}
.tp .tl-body h4{font-size:14px;font-weight:700}
.tp .tl-step.todo .tl-body h4{color:#A2A7BA;font-weight:600}
.tp .tl-body time{display:block;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;margin-top:1px}
.tp .tl-body .note{font-size:12.5px;color:var(--ink-2);margin-top:4px}
.tp .tl-step.current .tl-body h4{color:var(--brand-deep)}

.tp .cond{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:8px}
.tp .cond-item{display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:var(--radius-sm);background:#FAFBFE;border:1px solid var(--line)}
.tp .cond-item .ci-l{font-size:12.5px;color:var(--ink-2);font-weight:600}
.tp .cond-item .ci-v{margin-left:auto;font-size:11.5px;font-weight:700}
.tp .ci-good{color:var(--ok)} .tp .ci-warn{color:var(--warn)} .tp .ci-bad{color:var(--bad)}

.tp .notebox{margin-top:14px;padding:13px 15px;border-radius:var(--radius-sm);background:#FAFBFE;border:1px solid var(--line);font-size:13.5px;color:var(--ink-2)}
.tp .notebox strong{display:block;color:var(--ink);font-size:12.5px;margin-bottom:3px}

.tp .rows{display:grid;gap:8px}
.tp .row{border:1px solid var(--line);border-radius:var(--radius-sm);overflow:hidden;transition:border-color .16s,box-shadow .16s}
.tp .row.open{border-color:var(--brand-deep);box-shadow:0 6px 20px rgba(0,0,0,.10)}
.tp .row-head{width:100%;display:flex;align-items:center;gap:11px;padding:13px 14px;text-align:left}
.tp .row.open .row-head{background:var(--brand);color:#fff}
.tp .row-title{font-size:13.5px;font-weight:700;min-width:0}
.tp .row-title small{display:block;font-weight:500;font-size:11.5px;color:var(--muted);margin-top:1px}
.tp .row.open .row-title small{color:rgba(255,255,255,.78)}
.tp .row-amt{margin-left:auto;font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.tp .chev{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:#F1F2F7;color:var(--muted);flex:none;transition:transform .2s}
.tp .row.open .chev{background:rgba(255,255,255,.2);color:#fff;transform:rotate(180deg)}
.tp .row-body{display:none;padding:14px;border-top:1px solid var(--line);background:#FAFBFE}
.tp .row.open .row-body{display:block}

.tp .parts-list{display:grid;gap:6px}
.tp .parts-list li{list-style:none;display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:var(--radius-sm);background:#FAFBFE;border:1px solid var(--line);font-size:13px;color:var(--ink-2)}
.tp .parts-list li svg{flex:none;color:var(--brand)}

.tp .gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.tp .shot{border:1px solid var(--line);border-radius:var(--radius-sm);overflow:hidden;background:#fff}
.tp .shot img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}

.tp .totals{display:grid;gap:0;margin-top:2px}
.tp .trow{display:flex;align-items:center;gap:12px;padding:10px 0;font-size:13.5px;color:var(--ink-2)}
.tp .trow+.trow{border-top:1px dashed var(--line)}
.tp .trow b{margin-left:auto;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.tp .trow.credit b{color:var(--ok)}

.tp .warranty-headline{font-size:22px;font-weight:800;letter-spacing:-.02em;margin-top:2px}
.tp .warranty-sub{font-size:12.5px;color:var(--muted);margin-top:3px}
.tp .wbar{margin-top:14px;height:8px;border-radius:999px;background:#F1F2F7;overflow:hidden}
.tp .wbar-fill{height:100%;background:var(--brand-deep);border-radius:999px}
.tp .warranty-dates{display:flex;justify-content:space-between;margin-top:9px;font-size:11.5px;color:var(--muted);font-weight:600}
.tp .grand{margin-top:14px;padding:16px 18px;border-radius:var(--radius-sm);background:linear-gradient(135deg,#232323,#000000);color:#fff;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.tp .grand span{font-size:12px;color:rgba(255,255,255,.72);font-weight:600;display:block}
.tp .grand .amt{font-size:24px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tp .grand .due{margin-left:auto;text-align:right}
.tp .grand .due .amt{font-size:19px}

.tp .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;border-radius:12px;font-size:13.5px;font-weight:700;transition:transform .12s,background .16s,box-shadow .16s}
.tp .btn:active{transform:scale(.985)}
.tp .btn-primary{background:var(--brand-deep);color:#fff;box-shadow:0 6px 16px rgba(0,0,0,.28)}
.tp .btn-primary:hover{background:#262626}
.tp .btn-ghost{background:#F1F2F7;color:var(--ink)}
.tp .btn-ghost:hover{background:#E8EAF3}
.tp .btn-wa{background:#20BA5A;color:#fff}
.tp .btn-block{width:100%}
.tp .btn:disabled{opacity:.55;cursor:not-allowed}

.tp .support-grid{display:grid;gap:9px}
.tp .support-grid .btn{justify-content:flex-start}
.tp .ref-note{margin-top:12px;font-size:12px;color:var(--muted);text-align:center}
.tp .ref-note b{color:var(--ink);font-variant-numeric:tabular-nums}

.tp .rail .card{padding:16px}
.tp .rail h3{font-size:13.5px;font-weight:700;margin-bottom:12px}

.tp .dock{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-top:1px solid var(--line);padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tp .dock .btn{padding:11px 8px;font-size:12.5px}
@media(min-width:1000px){ .tp .dock{display:none} .tp{padding-bottom:0} }

.tp .seclist{display:grid;gap:9px}
.tp .seclist>div{display:grid;grid-template-columns:18px 1fr;gap:9px;font-size:12.5px;color:var(--ink-2)}
.tp .linkbox{margin-top:12px;padding:10px 12px;border-radius:10px;background:#FAFBFE;border:1px dashed var(--line);font-size:11.5px;color:var(--muted);word-break:break-all}
.tp footer.legal{text-align:center;font-size:11.5px;color:var(--muted);padding:6px 0 4px;line-height:1.7}

.tp .toast{position:fixed;left:50%;bottom:96px;transform:translate(-50%,14px);z-index:70;background:var(--ink);color:#fff;padding:10px 16px;border-radius:999px;font-size:12.5px;font-weight:600;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.tp .toast.show{opacity:1;transform:translate(-50%,0)}

.tp .searchwrap{display:flex;gap:8px}
.tp .searchwrap input{flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;color:var(--ink);font-family:${ff};outline:none;box-sizing:border-box}
`;

const STATUS_META: Record<string, { label: string; bg: string; fg: string; dot: string; border?: string }> = {
  "Non-Issued": { label: "Job received", bg: "#EDEDEB", fg: "#1A1A1A", dot: "#1A1A1A" },
  "Issued":     { label: "Repair in progress", bg: "#EDEDEB", fg: "#1A1A1A", dot: "#1A1A1A" },
  "Pending":    { label: "On hold", bg: "#FDECEB", fg: "#8A2A24", dot: "#E0483F" },
  // White fill so it pops on the black hero card; a border keeps it a
  // visible badge on the white rail/summary card too, where a plain
  // white fill would otherwise vanish into the card background.
  "Completed":  { label: "Ready for collection", bg: "#FFFFFF", fg: "#0A0A0A", dot: "#0A0A0A", border: "1.5px solid #0A0A0A" },
  "Delivered":  { label: "Collected", bg: "#E4F7EF", fg: "#0B6B47", dot: "#0FA96B" },
  "Cancelled":  { label: "Cancelled", bg: "#FDECEB", fg: "#8A2A24", dot: "#E0483F" },
};

const CHECK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
);

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const GRADE_CLASS: Record<ConditionGrade, string> = {
  Pristine: "ci-good", Good: "ci-good", Worn: "ci-warn", Damaged: "ci-bad",
};
const CONDITION_LABELS: { key: "front" | "back" | "frame" | "camera" | "ports" | "buttons"; label: string }[] = [
  { key: "front", label: "Front / Screen" }, { key: "back", label: "Back" },
  { key: "frame", label: "Frame / Sides" }, { key: "camera", label: "Camera" },
  { key: "ports", label: "Ports" }, { key: "buttons", label: "Buttons" },
];

interface TlStep { label: string; date?: string; note?: string; state: "done" | "current" | "todo"; }

function buildTimeline(job: TrackedJob): TlStep[] {
  const reachedCompleted = job.status === "Completed" || job.status === "Delivered";
  const reachedDelivered = job.status === "Delivered";
  const steps: TlStep[] = [
    { label: "Device received", date: job.createdAt, state: "done" },
    { label: "Repair started", date: job.startedAt, state: job.startedAt ? "done" : job.status === "Non-Issued" ? "current" : "todo" },
  ];
  if (job.approval?.approvedAt) {
    steps.push({ label: "You approved the revised estimate", date: job.approval.approvedAt.slice(0, 10), state: "done" });
  }
  steps.push({ label: "Repair completed", date: job.completedAt, state: job.completedAt ? "done" : job.status === "Issued" ? "current" : "todo" });
  steps.push({
    label: "Ready for collection", date: job.completedAt,
    note: job.status === "Completed" ? "Bring your job number when you collect." : undefined,
    state: reachedDelivered ? "done" : job.status === "Completed" ? "current" : "todo",
  });
  steps.push({ label: "Collected", date: job.handedOverAt, state: reachedDelivered ? "current" : "todo" });
  return steps;
}

const WARRANTY_STATUS_META: Record<WarrantyStatus, { label: string; pill: "ok" | "warn" | "neutral" }> = {
  "Pending Activation": { label: "Awaiting activation", pill: "neutral" },
  "Active":             { label: "Active", pill: "ok" },
  "Expired":            { label: "Expired", pill: "neutral" },
  "Void":               { label: "Void", pill: "warn" },
  "Claimed":            { label: "Claim used", pill: "neutral" },
};

const CLAIM_STATUS_META: Record<ClaimStatus, { label: string; pill: "ok" | "warn" | "neutral" }> = {
  "Open":           { label: "Open", pill: "warn" },
  "Under Review":   { label: "Under review", pill: "warn" },
  "Approved":       { label: "Approved", pill: "ok" },
  "Resolved":       { label: "Resolved", pill: "ok" },
  "Rejected":       { label: "Rejected", pill: "warn" },
};

/** Mirrors WarrantyContext's effectiveStatus() — a page fetched once can sit
 *  open past the expiry date, so this is computed at render time too. */
function effectiveWarrantyStatus(w: TrackedWarranty): WarrantyStatus {
  if (w.status === "Active" && w.expiresAt && new Date(w.expiresAt).getTime() < Date.now()) return "Expired";
  return w.status;
}

function warrantyHeadline(w: TrackedWarranty, status: WarrantyStatus): string {
  if (status === "Active") {
    const remaining = w.expiresAt ? Math.max(0, Math.ceil((new Date(w.expiresAt).getTime() - Date.now()) / 86_400_000)) : 0;
    return `${remaining} day${remaining === 1 ? "" : "s"} remaining`;
  }
  if (status === "Pending Activation") return "Starts on collection";
  if (status === "Expired") return "Expired";
  if (status === "Claimed") return "Claim used on this warranty";
  return "Voided";
}

function warrantySubtitle(scope: TrackedWarranty["scope"]): string {
  if (scope === "Parts Only") return "Covers parts from this job";
  if (scope === "Labour Only") return "Covers workmanship from this job";
  return "Covers parts and workmanship from this job";
}

/** How far through its life the warranty is, 0–100. Null before activation —
 *  there is nothing to show a bar for yet. */
function warrantyProgressPct(w: TrackedWarranty): number | null {
  if (!w.startsAt || !w.expiresAt) return null;
  const start = new Date(w.startsAt).getTime();
  const end = new Date(w.expiresAt).getTime();
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)));
}

function formatDuration(days: number): string {
  if (days > 0 && days % 30 === 0) {
    const months = days / 30;
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** exclusions is a flat list of standalone phrases ("Physical damage after
 *  handover…"); this reads them into one sentence for the Conditions box. */
function formatExclusionsProse(exclusions: string[]): string {
  const items = exclusions.map(e => e.charAt(0).toLowerCase() + e.slice(1));
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

function waLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

function TrackInner() {
  const params = useSearchParams();
  const configured = isSupabaseConfigured();
  const [query, setQuery] = useState(params.get("job") ?? "");
  const [job, setJob] = useState<TrackedJob | null | undefined>(undefined);
  const [history, setHistory] = useState<TrackedJobHistoryEntry[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [warranty, setWarranty] = useState<TrackedWarranty | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approverName, setApproverName] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const lookup = async (id: string) => {
    if (!id.trim() || !configured) return;
    setLoading(true);
    setLookupError(null);
    try {
      const found = await trackJob(id);
      setJob(found);
      if (found) {
        setApproved(!!found.approval);
        void trackJobHistory(found.id).then(setHistory).catch(() => setHistory([]));
        void trackWarranty(found.id).then(setWarranty).catch(() => setWarranty(null));
        if (found.intakePhotos?.length) {
          fetch(`/api/track/photos?job=${encodeURIComponent(found.id)}`)
            .then(r => r.json())
            .then(d => setPhotos(d.urls ?? []))
            .catch(() => setPhotos([]));
        } else {
          setPhotos([]);
        }
      } else {
        setHistory([]);
        setPhotos([]);
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

  const needsApproval = !!job && (job.revisedEstimate ?? 0) > (job.originalEstimate ?? job.estimatedCost) && !approved;
  const balance = job ? Math.max(0, job.estimatedCost - job.advancePaid) : 0;
  const status = job ? STATUS_META[job.status] ?? STATUS_META["Non-Issued"] : STATUS_META["Non-Issued"];
  // wa.me needs the international form with no leading 0 or +; tel: wants the +.
  const shopDigits = SHOP_DETAILS.phone.replace(/\D/g, "").replace(/^0/, "");
  const shopWa = `94${shopDigits}`;
  const shopTel = `+94${shopDigits}`;

  return (
    <div className="tp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="topbar">
        <div className="logo"><img src={SHOP_DETAILS.logo} alt="" /></div>
        <div>
          <div className="brand-name">{SHOP_DETAILS.name}</div>
          <div className="brand-sub">Phone Repair &amp; Service Centre</div>
        </div>
        <span className="secure">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 2 4 6v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V6l-8-4Z" /></svg>
          Secure link
        </span>
      </div>

      <div className="shell">
        <div className="col-main">
          <div className="page-title">
            <h1>Repair &amp; Service Summary</h1>
            <p>Everything that happened to your device, from drop-off to collection.</p>
          </div>

          {!configured && (
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Tracking isn&apos;t connected right now — please call the shop for your repair status.</p>
            </div>
          )}

          {configured && !job && (
            <div className="card">
              <header><h2>Find your repair</h2></header>
              <div className="searchwrap">
                <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup(query)} placeholder="e.g. RM-001" />
                <button className="btn btn-primary" onClick={() => lookup(query)} disabled={loading}>{loading ? "Looking…" : "Track"}</button>
              </div>
              {lookupError && <p style={{ fontSize: 12.5, color: "var(--bad)", marginTop: 10 }}>{lookupError}</p>}
              {job === null && !lookupError && <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>No job found with that number — check the job card and try again.</p>}
            </div>
          )}

          {job && (
            <>
              {/* HERO */}
              <section className="hero">
                <div className="blob" />
                <div className="hero-label">Job number</div>
                <div className="hero-job">
                  <strong>{job.id}</strong>
                  <button className="copy-btn" aria-label="Copy job number" onClick={() => {
                    navigator.clipboard?.writeText(job.id).then(() => showToast("Job number copied")).catch(() => showToast(job.id));
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                  </button>
                </div>
                <div className="hero-device">{[job.brand, job.model].filter(Boolean).join(" ")}{job.customerName ? ` · ${job.customerName}` : ""}</div>
                <div className="hero-status" style={{ background: status.bg, color: status.fg, border: status.border }}>
                  <span className="dot" style={{ background: status.dot }} /> {status.label}
                </div>
                <div className="hero-foot">
                  <div><span>Received</span><b>{fmtDate(job.createdAt) || "—"}</b></div>
                  <div><span>{job.status === "Delivered" ? "Collected" : "Completed"}</span><b>{fmtDate(job.status === "Delivered" ? job.handedOverAt : job.completedAt) || "—"}</b></div>
                  <div><span>Balance due</span><b>Rs. {balance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</b></div>
                </div>
              </section>

              {/* ON HOLD / CANCELLED */}
              {job.status === "Pending" && (
                <div className="card" style={{ borderLeft: "3px solid var(--warn)" }}>
                  <p style={{ fontSize: 13, color: "var(--ink-2)" }}><b style={{ color: "var(--ink)" }}>On hold</b>{job.pauseReason ? ` — ${job.pauseReason}` : " — we'll update this once work resumes."}</p>
                </div>
              )}
              {job.status === "Cancelled" && (
                <div className="card" style={{ borderLeft: "3px solid var(--bad)" }}>
                  <p style={{ fontSize: 13, color: "var(--ink-2)" }}><b style={{ color: "var(--ink)" }}>Job cancelled</b>{job.cancelReason ? ` — ${job.cancelReason}` : ""}{job.cancelledAt ? ` (${fmtDate(job.cancelledAt)})` : ""}</p>
                </div>
              )}

              {/* DEVICE & CUSTOMER */}
              <section className="card">
                <header><h2>Device &amp; customer</h2></header>
                <div className="kv">
                  <div><span>Customer</span><b>{job.customerName || "—"}</b></div>
                  {job.customerPhone && <div><span>Contact</span><b className="mono">{job.customerPhone}</b></div>}
                  <div><span>Device</span><b>{[job.brand, job.model].filter(Boolean).join(" ") || "—"}</b></div>
                  {job.imei && <div><span>IMEI</span><b className="mono">{job.imei}</b></div>}
                  <div><span>Received</span><b>{fmtDate(job.createdAt) || "—"}</b></div>
                  {job.startedAt && <div><span>Repair started</span><b>{fmtDate(job.startedAt)}</b></div>}
                  {job.completedAt && <div><span>Repair completed</span><b>{fmtDate(job.completedAt)}</b></div>}
                  <div><span>Delivered / collected</span><b style={job.handedOverAt ? undefined : { color: "var(--muted)" }}>{fmtDate(job.handedOverAt) || "Awaiting collection"}</b></div>
                  {job.technician && <div><span>Technician</span><b>{job.technician}</b></div>}
                </div>
              </section>

              {/* TIMELINE */}
              <section className="card">
                <header><h2>Repair progress</h2></header>
                <div className="tl">
                  {buildTimeline(job).map((s, i, arr) => (
                    <div key={i} className={`tl-step ${s.state}`}>
                      {i < arr.length - 1 && <div className="rail-line" />}
                      <div className="node">{s.state === "done" ? CHECK : null}</div>
                      <div className="tl-body">
                        <h4>{s.label}</h4>
                        <time>{s.date ? fmtDate(s.date) : s.state === "todo" ? "Pending" : ""}</time>
                        {s.note && <p className="note">{s.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* WHAT YOU REPORTED */}
              {(job.issue || job.cosmeticCondition || job.receivedItems?.length) && (
                <section className="card">
                  <header><h2>What you reported &amp; how we received it</h2></header>
                  {job.issue && (
                    <div className="notebox" style={{ marginTop: 0, marginBottom: job.cosmeticCondition || job.receivedItems?.length ? 14 : 0 }}>
                      <strong>Your reported problem</strong>{job.issue}
                    </div>
                  )}
                  {job.cosmeticCondition && (
                    <div className="cond" style={{ marginBottom: job.receivedItems?.length ? 14 : 0 }}>
                      {CONDITION_LABELS.map(({ key, label }) => {
                        const grade = job.cosmeticCondition?.[key];
                        if (!grade) return null;
                        return (
                          <div key={key} className="cond-item">
                            <span className="ci-l">{label}</span>
                            <span className={`ci-v ${GRADE_CLASS[grade]}`}>{grade}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {job.receivedItems?.length ? (
                    <div className="notebox">
                      <strong>Handed over with the device</strong>{job.receivedItems.join(", ")}
                    </div>
                  ) : null}
                </section>
              )}

              {/* PARTS USED */}
              {job.partsUsed?.length ? (
                <section className="card">
                  <header><h2>Parts used</h2></header>
                  <ul className="parts-list">
                    {job.partsUsed.map((p, i) => (
                      <li key={i}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                        {p}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* PHOTOS */}
              {photos.length > 0 && (
                <section className="card">
                  <header><h2>Photos at drop-off</h2></header>
                  <div className="gallery">
                    {photos.map((src, i) => (
                      <figure className="shot" key={i}><img src={src} alt={`Device at drop-off ${i + 1}`} /></figure>
                    ))}
                  </div>
                </section>
              )}

              {/* COST */}
              <section className="card">
                <header><h2>Cost breakdown</h2><span className={`pill ${balance > 0 ? "warn" : "ok"}`}>{balance > 0 ? "Balance due" : "Fully settled"}</span></header>
                <div className="totals">
                  <div className="trow">Estimated cost <b>Rs. {job.estimatedCost.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</b></div>
                  <div className="trow credit">Advance paid <b>− Rs. {job.advancePaid.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</b></div>
                </div>
                <div className="grand">
                  <div><span>Total</span><div className="amt">Rs. {job.estimatedCost.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</div></div>
                  <div className="due"><span>Balance due on collection</span><div className="amt" style={{ color: balance > 0 ? "#FF6B61" : "#5FE3A6" }}>Rs. {balance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</div></div>
                </div>

                {needsApproval && (
                  <div className="notebox" style={{ marginTop: 14, borderLeft: "3px solid var(--warn)" }}>
                    <strong>Approval needed</strong>
                    After inspection, the repair cost is now Rs. {(job.revisedEstimate ?? 0).toLocaleString("en-LK")} (originally Rs. {(job.originalEstimate ?? job.estimatedCost).toLocaleString("en-LK")}). Please approve to let us proceed.
                    <div style={{ marginTop: 10 }}>
                      <input
                        value={approverName}
                        onChange={e => setApproverName(e.target.value)}
                        placeholder={`Your name (defaults to ${job.customerName})`}
                        style={{ width: "100%", background: "#fff", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "var(--ink)", fontFamily: ff, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                      />
                      <button className="btn btn-primary btn-block" onClick={approve} disabled={approving}>
                        {approving ? "Recording…" : `Approve Rs. ${(job.revisedEstimate ?? 0).toLocaleString("en-LK")}`}
                      </button>
                    </div>
                  </div>
                )}
                {approved && (job.revisedEstimate ?? 0) > 0 && (
                  <div className="notebox" style={{ marginTop: 14, borderLeft: "3px solid var(--ok)" }}>
                    Revised estimate approved — thank you!
                  </div>
                )}
              </section>

              {/* WARRANTY */}
              {warranty && (() => {
                const wStatus = effectiveWarrantyStatus(warranty);
                const wMeta = WARRANTY_STATUS_META[wStatus];
                const pct = warrantyProgressPct(warranty);
                const scopeCoversParts = warranty.scope !== "Labour Only";
                const scopeCoversLabour = warranty.scope !== "Parts Only";
                const items: { label: string; covered: boolean }[] = [
                  ...(job.partsUsed ?? []).map(p => ({ label: p, covered: scopeCoversParts })),
                  { label: "Workmanship", covered: scopeCoversLabour },
                ];
                const conditions = warranty.exclusions.length
                  ? `This warranty covers ${warrantySubtitle(warranty.scope).replace("Covers ", "")}. It does not cover ${formatExclusionsProse(warranty.exclusions)}. Bring this job number when you claim.`
                  : "Bring this job number when you claim.";

                return (
                  <section className="card">
                    <header><h2>Warranty</h2><span className={`pill ${wMeta.pill}`}>{wMeta.label}</span></header>

                    <div className="warranty-headline">{warrantyHeadline(warranty, wStatus)}</div>
                    <p className="warranty-sub">{warrantySubtitle(warranty.scope)}</p>

                    {pct !== null && <div className="wbar"><div className="wbar-fill" style={{ width: `${pct}%` }} /></div>}

                    {warranty.startsAt && warranty.expiresAt && (
                      <div className="warranty-dates">
                        <span>Started {fmtDate(warranty.startsAt)}</span>
                        <span>Expires {fmtDate(warranty.expiresAt)}</span>
                      </div>
                    )}

                    <div className="totals" style={{ marginTop: 14 }}>
                      {items.map((it, i) => (
                        <div className="trow" key={i}>
                          {it.label}
                          <b style={it.covered ? undefined : { color: "var(--muted)" }}>
                            {it.covered ? formatDuration(warranty.durationDays) : "Not covered"}
                          </b>
                        </div>
                      ))}
                    </div>

                    <div className="notebox" style={{ marginTop: 14 }}>
                      <strong>Conditions</strong>{conditions}
                    </div>

                    {warranty.claims.length > 0 && (
                      <div className="rows" style={{ marginTop: 14 }}>
                        {warranty.claims.map(c => {
                          const cMeta = CLAIM_STATUS_META[c.status];
                          return (
                            <div className="row" key={c.id} style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="row-title">{c.reportedIssue}<small>{fmtDate(c.reportedAt)} · Claim {c.id}{c.resolution ? ` · ${c.resolution}` : ""}</small></div>
                                </div>
                                <span className={`pill ${cMeta.pill}`}>{cMeta.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* HISTORY */}
              {history.length > 0 && (
                <section className="card">
                  <header>
                    {/* Only claim it is the same phone when the IMEI says so.
                        Without one this is the same customer's handset of the
                        same make and model — likely, not certain, and a
                        customer reading their own repair history deserves to
                        know which of the two they are looking at. */}
                    <h2>{history[0]?.matchedOn === "imei" ? "Previous repairs on this device" : "Earlier repairs on this model"}</h2>
                    <span className="hint">{history.length} record{history.length !== 1 ? "s" : ""}</span>
                  </header>
                  <div className="rows">
                    {history.map(h => {
                      const open = openRow === h.id;
                      return (
                        <div className={`row${open ? " open" : ""}`} key={h.id}>
                          <button className="row-head" aria-expanded={open} onClick={() => setOpenRow(open ? null : h.id)}>
                            <div className="row-title">{h.issue || "Repair"}<small>{fmtDate(h.completedAt ?? h.createdAt)} · Job {h.id}</small></div>
                            <div className="row-amt">Rs. {h.estimatedCost.toLocaleString("en-LK")}</div>
                            <span className="chev"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span>
                          </button>
                          {open && (
                            <div className="row-body">
                              <div className="kv">
                                <div><span>Device</span><b>{[h.brand, h.model].filter(Boolean).join(" ") || "—"}</b></div>
                                <div><span>Status</span><b>{STATUS_META[h.status]?.label ?? h.status}</b></div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* SUPPORT */}
              <section className="card">
                <header><h2>Questions about this repair?</h2></header>
                <div className="support-grid">
                  <a className="btn btn-wa" href={waLink(shopWa, `Hi ${SHOP_DETAILS.name}, I have a question about job ${job.id}`)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5Z" /></svg>
                    WhatsApp us about this job
                  </a>
                  <a className="btn btn-primary" href={`tel:${shopTel}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></svg>
                    Call {SHOP_DETAILS.name}
                  </a>
                </div>
                <p className="ref-note">Please quote job <b>{job.id}</b> when you contact us.</p>
              </section>

              {/* SECURITY */}
              <section className="card">
                <header><h2>About this link</h2></header>
                <div className="seclist">
                  <div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 3 }}><path d="m5 13 4 4L19 7" /></svg><div>This page was created only for your repair. No account or password is needed.</div></div>
                  <div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 3 }}><path d="m5 13 4 4L19 7" /></svg><div>Your IMEI and phone number are shown partly hidden, and unlock codes or internal notes are never published here.</div></div>
                </div>
              </section>

              <footer className="legal">
                {SHOP_DETAILS.name} · {SHOP_DETAILS.address} · {SHOP_DETAILS.phone}<br />
                © {new Date().getFullYear()} {SHOP_DETAILS.name}. Repair record generated {fmtDate(new Date().toISOString())}.
              </footer>
            </>
          )}
        </div>

        {job && (
          <aside className="rail">
            <div className="card">
              <h3>Job status</h3>
              <div style={{ marginBottom: 12 }}>
                <span className="pill" style={{ background: status.bg, color: status.fg, border: status.border }}>{status.label}</span>
              </div>
              <div className="kv" style={{ gap: 12 }}>
                <div><span>Job</span><b className="mono">{job.id}</b></div>
                <div><span>{job.status === "Delivered" ? "Collected" : "Completed"}</span><b>{fmtDate(job.status === "Delivered" ? job.handedOverAt : job.completedAt) || "—"}</b></div>
              </div>
            </div>
            <div className="card">
              <h3>Payment</h3>
              <div className="totals">
                <div className="trow" style={{ paddingTop: 0 }}>Total <b>Rs. {job.estimatedCost.toLocaleString("en-LK")}</b></div>
                <div className="trow credit">Advance paid <b>− Rs. {job.advancePaid.toLocaleString("en-LK")}</b></div>
              </div>
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: balance > 0 ? "var(--warn-tint)" : "var(--ok-tint)" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: balance > 0 ? "var(--warn)" : "var(--ok)" }}>{balance > 0 ? "Balance due on collection" : "Fully settled"}</span>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }}>Rs. {balance.toLocaleString("en-LK")}</div>
              </div>
            </div>
            <div className="card">
              <h3>Collection</h3>
              <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{SHOP_DETAILS.address}</p>
              <a className="btn btn-wa btn-block" style={{ marginTop: 12 }} href={waLink(shopWa, `Hi ${SHOP_DETAILS.name}, job ${job.id}`)}>WhatsApp us</a>
            </div>
          </aside>
        )}
      </div>

      {job && (
        <div className="dock">
          <a className="btn btn-wa" href={waLink(shopWa, `Hi ${SHOP_DETAILS.name}, job ${job.id}`)}>WhatsApp</a>
          <a className="btn btn-ghost" href={`tel:${shopTel}`}>Call</a>
        </div>
      )}

      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
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
