import {
  Play, Pause, CheckCircle, Package, Eye, Hand, PackageCheck, type LucideIcon,
} from "lucide-react";
import type { RepairJob } from "@/cashier/contexts/RepairContext";
import { isUnassigned } from "@/lib/repair/api";
import type { BenchAction } from "@/technician/components/bench/BenchCard";

/**
 * What a job offers, given where it is and who is looking.
 *
 * This used to live inside BenchCard's markup as a run of conditional blocks,
 * which was fine while the card was the only thing that could act on a job.
 * The table view is a second one, and the fiddly part of a bench is exactly
 * this — a device at an agent offers nothing but "received back", an unclaimed
 * job offers two different ways to take it, a finished one offers nothing at
 * all. Two copies of that would agree on the day they were written and not
 * much longer.
 *
 * Presentation stays with each view. This only answers which actions exist,
 * in what order, and how loud each one is.
 */

export interface BenchActionSpec {
  id: BenchAction;
  label: string;
  icon: LucideIcon;
  tone: "primary" | "quiet" | "warn";
  /** Hover text, where the label alone does not say enough. */
  title?: string;
  /**
   * Droppable when space is short.
   *
   * The one-line row cannot hold three labelled buttons, and this is the one
   * to lose: parts can be requested from the job sheet a moment later, where
   * finishing and pausing are what the technician came to the row to do.
   */
  secondary?: boolean;
}

export interface BenchActionContext {
  /** The open transfer, when the device is out at an outside workshop. */
  atAgent?: { agentName: string | null } | null;
  /** Somebody else's job: seeing across the workshop is not changing it. */
  readOnly?: boolean;
}

export function benchActions(job: RepairJob, ctx: BenchActionContext = {}): BenchActionSpec[] {
  const { atAgent, readOnly } = ctx;

  if (readOnly) {
    // Dropped, not disabled: a greyed-out Complete invites a second click and
    // a question about why it is refused, where one quiet button reads as what
    // it is.
    return [{ id: "info", label: "More info", icon: Eye, tone: "quiet", title: "View this job" }];
  }

  // Out of the building beats every status. Complete, Start, Resume and Pause
  // are all things you do to a phone you are holding.
  if (atAgent) {
    return [{
      id: "receive",
      label: "Received back",
      icon: PackageCheck,
      tone: "primary",
      title: `At ${atAgent.agentName ?? "an agent"} — record it back in the shop`,
    }];
  }

  const inProgress = job.status === "Issued";
  const paused     = job.status === "Pending";
  const done       = job.status === "Completed" || job.status === "Delivered";
  const notStarted = !inProgress && !paused && !done;

  if (inProgress) {
    return [
      { id: "complete", label: "Complete", icon: CheckCircle, tone: "primary" },
      { id: "pause",    label: "Pause",    icon: Pause,       tone: "warn" },
      { id: "parts",    label: "Parts",    icon: Package,     tone: "quiet", secondary: true },
    ];
  }

  if (paused) {
    return [
      { id: "resume", label: "Resume", icon: Play,    tone: "primary" },
      { id: "parts",  label: "Parts",  icon: Package, tone: "quiet", secondary: true },
    ];
  }

  if (notStarted) {
    // Two ways to take a job off the pile, because they are two different
    // intentions and the shop does both. Claiming puts your name on it;
    // claiming and starting also says you have picked the phone up now.
    // Rolling them into one would either start the clock on work nobody has
    // touched, or make every technician press twice for the common case.
    if (isUnassigned(job.technician)) {
      return [
        { id: "claim",      label: "Claim only",   icon: Hand, tone: "quiet",   title: "Claim only — put your name on it without starting the clock" },
        { id: "claimStart", label: "Claim & start", icon: Play, tone: "primary", title: "Claim and start working on it now" },
      ];
    }
    return [{ id: "start", label: "Start", icon: Play, tone: "primary" }];
  }

  // Finished. Nothing for the bench to do — the counter hands it over.
  return [];
}
