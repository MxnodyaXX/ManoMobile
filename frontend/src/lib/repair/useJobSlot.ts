"use client";

import { useState } from "react";
import { useRepair, type RepairJob } from "@/cashier/contexts/RepairContext";

/**
 * "The job this sheet is open on" — read live, not remembered.
 *
 * Every modal in this app was opened by handing it a job object:
 *
 *   const [detailsJob, setDetailsJob] = useState<RepairJob | null>(null);
 *   <JobDetailsModal job={detailsJob} … />
 *
 * That object is a copy taken at the moment of the click. Save an edit and the
 * register updates, the table behind updates, and the open sheet goes on
 * showing what it was handed — so an IMEI typed into Ctrl+E looks like it did
 * not save until the page is reloaded. It did save. The screen was reading a
 * photograph of it.
 *
 * Holding the id and looking the job up on every render fixes the whole class
 * at once, and it fixes more than the caller's own edits: a change made by
 * another machine arrives through realtime into the same register, so an open
 * sheet now follows that too.
 *
 * A drop-in replacement for the useState it replaces — the setter still takes
 * a job, so no call site changes.
 *
 * ── The fallback ────────────────────────────────────────────────────────────
 * If the id is no longer in the register, the snapshot is returned rather than
 * null. A sheet vanishing mid-edit because a row was filtered, cancelled or
 * deleted elsewhere is worse than one showing its last known state — the
 * person is in the middle of something, and the close button is theirs to
 * press.
 */
export function useJobSlot(
  initial?: RepairJob | null | (() => RepairJob | null),
): [RepairJob | null, (job: RepairJob | null) => void] {
  const { jobs } = useRepair();
  const [held, setHeld] = useState<RepairJob | null>(initial ?? null);
  const live = held ? jobs.find(j => j.id === held.id) ?? held : null;
  return [live, setHeld];
}
