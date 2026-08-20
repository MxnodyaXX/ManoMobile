"use client";

import { useCallback } from "react";
import { usePersistentState } from "./usePersistentState";
import type { ConditionGrade, DeviceConditionMap, JobPriority } from "@/cashier/contexts/RepairContext";

/** Every field the new-repair wizard collects. */
export interface RepairFormData {
  // Step 1
  dealerId: string;
  /** The job number this repair is filed under. For an in-house job that is
   *  the auto-generated RM-nnn; for a dealer's device it is THEIR number, so
   *  staff can find the phone by the number the dealer quotes at them. */
  jobNumber: string;
  /** True: let the database assign the next RM-nnn and ignore jobNumber. */
  autoJobNumber: boolean;
  /** The originating dealer's own number, when the device came from another
   *  shop. Stored beside our number, never instead of it. */
  dealerJobNo: string;
  customerName: string;
  customerNIC: string;
  customerContact: string;
  customerEmail: string;

  // Step 2
  deviceModel: string;
  deviceModelNumber: string;
  deviceIMEI: string;
  receivedItems: string[];
  faultCheckboxes: string[];
  faultDescription: string;

  // Step 3
  estimatedCost: string;
  advancePaid: string;
  paymentMethod: string;
  /** Must stay in step with the job_priority enum — a value outside it
   *  is only rejected at save time, once the whole form has been filled in. */
  jobPriority: JobPriority;
  jobNotes: string;

  // Step 4
  assignedRepairman: string;
  estimatedCompletion: string;

  // Step 5 — Evidence & Sign
  condition: DeviceConditionMap;
  intakePhotos: string[];
  passcodeType: "PIN" | "Pattern" | "Password" | "None" | "Provided Separately";
  passcode: string;
  signature: string;
  termsAccepted: boolean;
}

export type { ConditionGrade };

/**
 * An unfinished intake, kept in localStorage so a refresh — or a hop to another
 * tab mid-job — doesn't throw the work away. Intake photos are deliberately NOT
 * stored: a few camera data-URLs would blow the ~5MB storage quota on their own,
 * so a resumed draft asks for the photos again and says how many were dropped.
 */
export interface RepairDraft {
  id: string;
  step: number;
  updatedAt: string;
  photoCount: number;
  form: RepairFormData;
}

export const DRAFTS_KEY = "mano_repair_drafts";
const MAX_DRAFTS = 8;

export const newDraftId = () =>
  `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const draftTitle = (f: RepairFormData) =>
  f.customerName.trim() || f.customerContact.trim() || "Unnamed customer";

export const draftSubtitle = (f: RepairFormData) =>
  [f.deviceModel.trim(), f.deviceIMEI.trim()].filter(Boolean).join(" · ") || "No device entered yet";

/** "just now" · "6 min ago" · "3 hr ago" · "05 Aug, 14:30" */
export function fmtSaved(iso: string) {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} hr ago`;
  return new Date(then).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Read/write the saved drafts. Each caller keeps its own React copy of the list
 * and both read the same localStorage key, so a component picks up the current
 * set when it mounts (the drafts list and the wizard are never on screen together).
 */
export function useRepairDrafts() {
  const [drafts, setDrafts] = usePersistentState<RepairDraft[]>(DRAFTS_KEY, []);

  const saveDraft = useCallback(
    (d: RepairDraft) => setDrafts((prev) => [d, ...prev.filter((x) => x.id !== d.id)].slice(0, MAX_DRAFTS)),
    [setDrafts],
  );

  const removeDraft = useCallback(
    (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id)),
    [setDrafts],
  );

  return { drafts, saveDraft, removeDraft };
}
