"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Play, Pause, CheckCircle, Package, MoreHorizontal,
  Stethoscope, StickyNote, AlertTriangle, Send, MessageSquare, History, Hand, Smartphone,
} from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { isUnassigned } from "@/lib/repair/api";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * One job on the bench.
 *
 * Everything a technician does to a job in a normal day is on the card itself —
 * start it, pause it, finish it, ask for a part. The six things they do
 * occasionally live behind one ⋯ button, because eight equally-weighted
 * actions per job is what made the old screen unusable: nothing looked more
 * important than anything else, so every job needed reading before it could be
 * acted on.
 *
 * Touch targets are 44px minimum throughout — the bench uses phones, tablets
 * and desktops roughly equally, and a target sized for a mouse is a target a
 * thumb misses.
 */

export type BenchAction =
  | "start" | "claim" | "pause" | "resume" | "complete" | "parts"
  | "device" | "diagnostic" | "notes" | "escalate" | "transfer" | "message" | "activity";

const PRIORITY: Record<string, { color: string; bg: string }> = {
  Low:    { color: "#94a3b8", bg: "rgba(148,163,184,0.10)" },
  Normal: { color: "#60a5fa", bg: "rgba(96,165,250,0.10)"  },
  High:   { color: "#fbbf24", bg: "rgba(251,191,36,0.10)"  },
  Urgent: { color: "#f87171", bg: "rgba(248,113,113,0.10)" },
};

const OVERFLOW: { id: BenchAction; label: string; icon: typeof StickyNote }[] = [
  // First, because it is the one that has to be done while the phone is in
  // your hand — the rest can wait until it is back on the shelf.
  { id: "device",     label: "Device details",    icon: Smartphone    },
  { id: "diagnostic", label: "Diagnostic",        icon: Stethoscope   },
  { id: "notes",      label: "Internal notes",    icon: StickyNote    },
  { id: "escalate",   label: "Escalate",          icon: AlertTriangle },
  { id: "transfer",   label: "Send to agent",     icon: Send          },
  { id: "message",    label: "Message customer",  icon: MessageSquare },
  { id: "activity",   label: "Activity log",      icon: History       },
];

/** One line, cut with an ellipsis. Every cell in the list row needs it: a
 *  fault description is as long as the technician typed it. */
const clip: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

function fmtElapsed(startedAt: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

export default function BenchCard({ job, startedAt, partsPending, onAction, variant = "card", showTimer = true }: {
  job: RepairJob;
  /** When the timer started, for a job in progress. */
  startedAt?: Date;
  /** Part requests on this job still waiting on Admin. */
  partsPending?: number;
  onAction: (action: BenchAction, job: RepairJob) => void;
  /** Whether the shop times its jobs — see the trackJobTime work rule. */
  showTimer?: boolean;
  /**
   * "card" is the tile. "row" is the dense one-line form the list view
   * stacks. "compact" is that same line narrowed enough to sit three to five
   * across in a grid: the customer name goes and the buttons drop to icons,
   * because at a fifth of the width there is room for what the job is and
   * what to do about it, and nothing else.
   *
   * All three are this one component on purpose — which action a job offers
   * is the fiddly part, and a second component would have had to reimplement
   * it and then drift from it.
   */
  variant?: "card" | "row" | "compact";
}) {
  /**
   * The ⋯ menu is rendered into document.body, not inside the card.
   *
   * Inside, it was clipped: the accordion section around these cards has
   * overflow:hidden to keep its rounded corners, so a menu taller than the
   * space above the button simply got cut in half. A portal cannot be clipped
   * by an ancestor's overflow, and is immune to the same problem from any
   * transform or stacking context added later.
   *
   * Position is measured from the button and held in state, so it opens
   * upward or downward depending on which way there is room.
   */
  const [menu, setMenu] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuOpen = menu !== null;

  const MENU_W = 210;
  const MENU_H = OVERFLOW.length * 42 + 12;

  const toggleMenu = () => {
    if (menuOpen) { setMenu(null); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + MENU_H > window.innerHeight && r.top > MENU_H;
    setMenu({
      // Right-aligned to the button, then pulled back inside the viewport so a
      // card at the right edge does not open a menu half off-screen.
      left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)),
      top: up ? r.top - MENU_H - 6 : r.bottom + 6,
      up,
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setMenu(null);
    };
    // Fixed position cannot follow the page, so scrolling closes it rather
    // than leaving the menu floating away from its own card.
    const onScrollOrResize = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const inProgress = job.status === "Issued";
  const paused     = job.status === "Pending";
  // Finished and waiting for the counter to hand over. Nothing for the
  // technician to do, so it gets no primary action — offering "Start" on a
  // completed repair, which is what a plain else-branch does, is worse than
  // offering nothing.
  const done       = job.status === "Completed" || job.status === "Delivered";
  const notStarted = !inProgress && !paused && !done;
  // Nobody's job yet. Claiming and starting are different acts — one takes
  // responsibility for the device, the other says work has begun — and rolling
  // them together would put a technician on the clock for a phone they only
  // meant to pick up off the pile.
  const unclaimed  = isUnassigned(job.technician);
  const device     = [job.brand, job.model].filter(Boolean).join(" ") || "Device";
  const pc         = PRIORITY[job.priority] ?? PRIORITY.Normal;

  // Compact keeps the card's stacked layout — squeezing it onto one line left
  // roughly 50px for the device and the fault together, which is no view at
  // all. It is the card with the padding and the type pulled in and the
  // customer name dropped, three to five across instead of four.
  const compact = variant === "compact";
  const row = variant === "row";

  const btn = (kind: "primary" | "quiet" | "warn"): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    // 44px is the thumb-sized target the card is built around. A list row is
    // a scanning view rather than a working one, so it trades a little of
    // that for fitting fifty jobs on a screen — still above the 38px where
    // taps start being missed.
    minHeight: row || compact ? 36 : 44, padding: row || compact ? "0 11px" : "0 14px",
    borderRadius: row || compact ? 9 : 11,
    fontSize: row || compact ? 12.5 : 13, fontWeight: 700, fontFamily: ff, cursor: "pointer",
    // A compact tile carries its actions as icons alone. Four labelled
    // buttons wrapped onto a second line, which was most of the height the
    // tile was spending on empty space; four squares fit on one.
    ...(compact ? { width: 36, padding: 0, flex: "0 0 auto" } : null),
    // Grows to fill the row but never shrinks below a readable label — in a
    // narrow column the buttons wrap to a second line instead of squashing.
    // In list view it is the opposite: hug the label, so the actions column
    // stays the same width down the whole list.
    flex: row ? "0 0 auto" : "1 1 auto", minWidth: row || compact ? 0 : 92, whiteSpace: "nowrap",
    ...(kind === "primary"
      ? { background: TA, border: "none", color: "#04231a" }
      : kind === "warn"
        ? { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.4)", color: "#b45309" }
        : { background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }),
  });

  return (
    <div
      // A paused row has no space for the reason, so it rides on the row
      // itself rather than being dropped.
      title={
        compact
          ? [job.customerName, paused ? job.pauseReason : ""].filter(Boolean).join(" · ") || undefined
          : row && paused ? job.pauseReason || undefined : undefined
      }
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${inProgress ? `${TA}45` : "var(--border)"}`,
        borderRadius: row ? 11 : compact ? 12 : 14,
        padding: row ? "8px 12px" : compact ? "9px 10px" : 14,
        display: "flex", flexDirection: row ? "row" : "column",
        alignItems: row ? "center" : undefined, gap: row ? 14 : compact ? 7 : 12,
      }}>
      {/* What it is */}
      <div style={{ display: "flex", alignItems: row ? "center" : "flex-start", gap: compact ? 8 : 12, flex: row ? "1 1 auto" : undefined, minWidth: 0 }}>
        <div style={{
          flex: 1, minWidth: 0,
          ...(row ? { display: "flex", alignItems: "center", gap: 10 } : null),
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 8, flexWrap: "wrap", marginBottom: row ? 0 : compact ? 2 : 4, flexShrink: 0 }}>
            {/* The dealer's number leads wherever there is one.
                RM-047 is ours; #5846 is the number the dealer says on the
                phone and the number written on the bag the handset came in.
                Ours stays visible but steps back — it is what we type into
                this system, not what anybody asks about. */}
            <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--accent)", fontFamily: ff }}
                  title={job.dealerJobNo ? "The dealer's own job number" : undefined}>
              {job.dealerJobNo ? `#${job.dealerJobNo}` : job.id}
            </span>
            {job.dealerJobNo && (
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }} title="Our internal job number">
                {job.id}
              </span>
            )}
            {/* The list row keeps the priority as a dot: on one line the
                colour is the part that gets read, the word is not. */}
            <span
              title={row ? `${job.priority} priority` : undefined}
              style={row ? {
                width: 8, height: 8, borderRadius: "50%", background: pc.color, flexShrink: 0,
              } : {
                fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                color: pc.color, background: pc.bg, fontFamily: ff,
              }}
            >
              {row ? "" : job.priority}
            </span>
          </div>
          <p style={{
            fontSize: row ? 13.5 : compact ? 14.5 : 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, lineHeight: 1.25,
            ...(row ? { flex: "0 1 auto", minWidth: 0, ...clip } : null),
            ...(compact ? clip : null),
          }}>
            {device}
          </p>
          {/* In a row this is the line that gives, since it is the longest and
              the one a technician is least likely to be scanning for. In a
              compact tile it goes altogether: sharing ~50px with the device
              name leaves both unreadable, and one legible field beats two
              clipped ones. It is on the tile's tooltip instead. */}
          <p style={{
            fontSize: 12, color: "var(--text-secondary)", fontFamily: ff, marginTop: row ? 0 : compact ? 1 : 3,
            ...(row ? { flex: "1 1 auto", minWidth: 0, ...clip } : null),
            // Two lines on a compact tile, then an ellipsis: a fault is often
            // longer than one line and the second line is usually the half
            // that says what is actually wrong.
            ...(compact ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35 } : null),
          }}>
            {job.issue || "No fault recorded"}
          </p>
          {/* The one field a compact tile drops — it is on the tooltip, and
              the dealer's number above already says whose job this is. */}
          {!compact && (
            <p style={{
              fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, marginTop: row ? 0 : 2,
              ...(row ? { flex: "0 1 auto", minWidth: 0, ...clip } : null),
            }}>
              {job.customerName}
            </p>
          )}
        </div>

        {/* Timer, or why it is waiting */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {inProgress && startedAt && showTimer && (
            <>
              <p className="stat-number" style={{ fontSize: row ? 14 : compact ? 17 : 24, color: TA, fontFamily: ff, letterSpacing: "-0.02em" }}>
                {fmtElapsed(startedAt)}
              </p>
              {!row && !compact && <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff }}>on this job</p>}
            </>
          )}
          {!!partsPending && (
            <p title={`${partsPending} part${partsPending > 1 ? "s" : ""} awaiting approval`}
               style={{ fontSize: 11, color: "#a78bfa", fontFamily: ff, marginTop: row ? 0 : 4, whiteSpace: "nowrap" }}>
              {partsPending} part{partsPending > 1 ? "s" : ""}{row || compact ? "" : " awaiting approval"}
            </p>
          )}
        </div>
      </div>

      {/* Why it stopped — the one thing worth reading on a paused card. In a
          row it moves to the row's tooltip; there is no line to spare. */}
      {paused && !row && (
        <p style={{
          fontSize: 12, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.5,
          padding: "9px 11px", borderRadius: 9,
          background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)",
        }}>
          {job.pauseReason || "On hold — no reason recorded"}
        </p>
      )}

      {/* What to do about it */}
      <div style={{ display: "flex", gap: row || compact ? 6 : 8, alignItems: "stretch", flexWrap: row || compact ? "nowrap" : "wrap", flexShrink: 0 }}>
        {inProgress && (
          <>
            <button onClick={() => onAction("complete", job)} title="Complete" style={btn("primary")}>
              <CheckCircle size={16} />{!compact && " Complete"}
            </button>
            <button onClick={() => onAction("pause", job)} title="Pause" style={btn("warn")}>
              <Pause size={16} />{!compact && " Pause"}
            </button>
            {/* Dropped only from the one-line row, where three labelled
                buttons do not fit. It is the least urgent of the three. */}
            {!row && (
              <button onClick={() => onAction("parts", job)} title="Parts" style={btn("quiet")}>
                <Package size={16} />{!compact && " Parts"}
              </button>
            )}
          </>
        )}
        {notStarted && unclaimed && (
          <button onClick={() => onAction("claim", job)} title="Claim" style={btn("primary")}>
            <Hand size={13} strokeWidth={2.4} />
            {!compact && "Claim"}
          </button>
        )}

        {notStarted && !unclaimed && (
          <button onClick={() => onAction("start", job)} title="Start" style={btn("primary")}>
            <Play size={16} />{!compact && " Start"}
          </button>
        )}
        {done && (
          <span title="Waiting for collection" style={{
            display: "flex", alignItems: "center", gap: 7, flex: row ? "0 0 auto" : "1 1 auto",
            minHeight: row || compact ? 36 : 44, padding: row || compact ? "0 11px" : "0 14px",
            borderRadius: row || compact ? 9 : 11,
            fontSize: 12.5, fontFamily: ff, color: "var(--text-muted)", whiteSpace: "nowrap",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            ...(compact ? { width: 36, padding: 0, flex: "0 0 auto", justifyContent: "center" } : null),
          }}>
            <CheckCircle size={15} color="#60a5fa" />{compact ? "" : row ? " Collect" : " Waiting for collection"}
          </span>
        )}
        {paused && (
          <>
            <button onClick={() => onAction("resume", job)} title="Resume" style={btn("primary")}>
              <Play size={16} />{!compact && " Resume"}
            </button>
            {!row && (
              <button onClick={() => onAction("parts", job)} title="Parts" style={btn("quiet")}>
                <Package size={16} />{!compact && " Parts"}
              </button>
            )}
          </>
        )}

        {/* The occasional six, out of the way but one tap deep */}
        <button
          ref={btnRef}
          onClick={toggleMenu}
          aria-label="More actions"
          aria-expanded={menuOpen}
          style={{ ...btn("quiet"), flex: "0 0 auto", width: row || compact ? 36 : 48, minWidth: row || compact ? 36 : 48, padding: 0 }}
        >
          <MoreHorizontal size={18} />
        </button>
        {menu && typeof document !== "undefined" && createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed", left: menu.left, top: menu.top, zIndex: 3000,
              width: MENU_W, padding: 6, borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
            }}
          >
            {OVERFLOW.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setMenu(null); onAction(item.id, job); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    minHeight: 42, padding: "0 12px", borderRadius: 8,
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, color: "var(--text-primary)", fontFamily: ff, textAlign: "left",
                  }}
                >
                  <Icon size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
