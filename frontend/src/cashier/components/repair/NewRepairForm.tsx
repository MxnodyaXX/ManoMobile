"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { previewNextJobNo, checkDealerJobNo, fetchJobsByImei, type DealerJobNoCheck } from "@/lib/repair/api";
import { useRepair, isInHouseDealer, IN_HOUSE_DEALER, type ConditionGrade, type DeviceConditionMap, type JobPriority, type RepairJob, type RepairDealer } from "@/cashier/contexts/RepairContext";
import { useAuth } from "@/lib/auth/AuthContext";
import DeviceHistoryModal from "@/cashier/components/repair/DeviceHistoryModal";
import { useWarranty, effectiveStatus } from "@/cashier/contexts/WarrantyContext";
import { useRepairDrafts, newDraftId, fmtSaved, type RepairDraft, type RepairFormData as FormData } from "@/cashier/hooks/useRepairDrafts";
import SignaturePad from "@/cashier/components/shared/SignaturePad";
import JobReceiptPrintable from "@/cashier/components/repair/JobReceiptPrintable";
import { uploadIntakePhotos } from "@/lib/repair/api";
import { useToast } from "@/lib/ui/toast";
import { useTechnicians, type Technician } from "@/lib/repair/technicians";
import Combobox from "@/cashier/components/shared/Combobox";
import BarcodeLabelModal from "@/cashier/components/shared/BarcodeLabelModal";
import { lookupModelNumber, normaliseModelNumber, type ModelInfo } from "@/cashier/data/modelNumbers";
import { useDeviceModelLookup, rememberDeviceModel } from "@/lib/repair/deviceModels";
import { fetchStaffRules } from "@/lib/settings/staffRules";
import { useDeviceFaults, FALLBACK_FAULTS } from "@/lib/repair/deviceFaults";
import { ShieldCheck, Camera, Lock, X as XIcon, Hash, Printer, CheckCircle2, AlertCircle, FileClock, ChevronDown, History } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const CONDITION_ZONES: { key: keyof Omit<DeviceConditionMap, "notes">; label: string }[] = [
  { key: "front",   label: "Front / Screen" },
  { key: "back",    label: "Back" },
  { key: "frame",   label: "Frame / Sides" },
  { key: "camera",  label: "Camera Glass" },
  { key: "ports",   label: "Ports" },
  { key: "buttons", label: "Buttons" },
];

const GRADES: { value: ConditionGrade; color: string }[] = [
  { value: "Pristine", color: "#4ade80" },
  { value: "Good",     color: "#60a5fa" },
  { value: "Worn",     color: "#fbbf24" },
  { value: "Damaged",  color: "#f87171" },
];

const TERMS_VERSION = "v1.0";

// ─── Sample Data ──────────────────────────────────────────────────────────────



const RECEIVED_ITEMS = ["SIM Card", "Back Cover", "Charger", "Data Cable", "Earphones", "Memory Card", "SIM Tray", "Battery", "Box", "Other Accessories"];

// The Device Faults checklist is now admin-managed (Admin Control -> Device
// Faults) rather than hardcoded here — see deviceFaults.ts. FALLBACK_FAULTS
// only covers the gap before that loads (or if Supabase isn't configured).
//
// Device models work the same way as faults conceptually, but with no admin
// screen of their own — the shop's own job history *is* the catalogue.
// See historicalModels/modelNumberLookup below.

// ─── Step Indicator ───────────────────────────────────────────────────────────

// Device & Faults, Assign Repairman, and Evidence & Sign used to each be
// their own step. None of that blocks moving on except the device model/
// brand, the cost estimate, and terms acceptance, so it's all folded down
// to two steps: everything about the dealer, customer, and device up
// front (the device is right there in the cashier's hands at intake
// anyway), then costs and the optional evidence/assignment accordions.
const STEPS = [
  { num: 1, label: "Dealer, Customer & Device" },
  { num: 2, label: "Costs & Evidence" },
];

export function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {STEPS.map((step, idx) => {
        const isDone = current > step.num;
        const isActive = current === step.num;
        return (
          <div key={step.num} style={{ display: "flex", alignItems: "center", flex: idx < STEPS.length - 1 ? 1 : "unset" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: isDone ? "var(--accent)" : isActive ? "var(--accent)" : "var(--bg-card)",
                  border: `2px solid ${isDone || isActive ? "var(--accent)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isDone || isActive ? "var(--accent-fg)" : "var(--text-secondary)",
                  fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                {isDone ? "✓" : step.num}
              </div>
              <span style={{
                fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: isActive ? "var(--accent)" : isDone ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 8px", marginBottom: 22,
                background: isDone ? "var(--accent)" : "var(--border)",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text-primary)", fontSize: 13.5,
  fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  transition: "border-color 0.15s", boxSizing: "border-box",
};

/** For fields that only ever display something (the dealer info panel) —
 *  muted text, same white/card background and border as every other field
 *  in the wizard (Device Information, etc.). `--bg-primary` was tried here
 *  first, but it's nearly the same shade as `--border` in light mode, so
 *  the box came out looking borderless/flat — keeping the normal bg-card
 *  background is what actually keeps the border visible; the muted text
 *  (plus `cursor: default`, no focus ring) is what says "read-only". */
const readOnlyInputStyle: React.CSSProperties = {
  ...inputStyle, color: "var(--text-muted)", cursor: "default",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "var(--text-secondary)", marginBottom: 5, display: "block",
  letterSpacing: "0.06em", textTransform: "uppercase",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "var(--accent)", marginBottom: 14, paddingBottom: 8,
  borderBottom: "1px solid var(--border)", letterSpacing: "0.02em",
};

const panelStyle: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)",
  borderRadius: 12, padding: "20px 22px", flex: 1,
};

/** A collapsed-by-default section for content that's genuinely optional —
 *  never gate a required field behind one of these, since nothing here
 *  scrolls-into-view or shakes on validation the way a normal field does.
 *
 *  Open/close is controlled by the parent (not local state) so a whole
 *  group of these can be wired to keep only one open at a time — see
 *  Step2's `openAccordion`. */
function AccordionSection({ title, summary, open, onToggle, children }: {
  title: string; summary?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--bg-card)", flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, padding: "12px 14px", background: "var(--bg-card)", border: "none",
          cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {!open && summary && (
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</span>
          )}
          <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)" }} />
        </span>
      </button>
      {/* The 0fr/1fr grid-row trick animates to/from an unknown content
          height (no JS measuring needed) — the outer track does the
          easing, the inner div just clips whatever doesn't fit yet.
          Children stay mounted the whole time (so the animation has
          something to shrink), which would otherwise leave the collapsed
          content's checkboxes/rows tabbable while invisible — `visibility`
          drops them from the tab order, delayed on close so it only kicks
          in once the fold has finished, not before. */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          visibility: open ? "visible" : "hidden",
          transition: open
            ? "grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1)"
            : "grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear 0.28s",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{
            padding: 16, borderTop: "1px solid var(--border)", background: "var(--bg-card)",
            opacity: open ? 1 : 0, transition: "opacity 0.2s ease",
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Same shell as AccordionSection, minus the fold — for content that sits in
 *  the same stacked list but is short/important enough to stay visible
 *  (Device Unlock's passcode fields), so the list reads as one consistent
 *  rhythm of boxes rather than accordions next to bare sections. */
function StaticSection({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--bg-card)", flexShrink: 0 }}>
      <div style={{
        padding: "12px 14px", background: "var(--bg-card)",
        fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        {title}
      </div>
      <div style={{ padding: 16, borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}>{children}</div>
    </div>
  );
}

const checkboxItemStyle = (checked: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
  borderRadius: 7, border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
  background: checked ? "rgba(var(--accent-rgb, 232,232,232), 0.08)" : "transparent",
  cursor: "pointer", transition: "all 0.15s", userSelect: "none",
});

/** These checkbox rows are plain divs, not <input>s — without this they're
 *  invisible to Tab entirely, so it jumps straight from IMEI to the textarea
 *  below both grids instead of flowing through each checkbox in order. */
const onCheckboxKeyDown = (toggle: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    toggle();
  }
};

// ─── Validation ───────────────────────────────────────────────────────────────

/** The fields the wizard refuses to move past, per step. */
type RequiredField =
  | "jobNumber"                          // step 1, only when not auto-generated
  | "dealerJobNo"                        // step 1, only for another shop's device
  | "customerName" | "customerContact"   // step 1
  | "deviceModel" | "deviceBrand"        // step 1
  | "estimatedCost"                      // step 2
  | "termsAccepted";                     // step 2

// Intake photos and the customer signature are deliberately absent: they are
// strongly recommended evidence, but a job can be booked in without them.
// Terms acceptance is the one thing the final step blocks on.
//
// dealerJobNo is deliberately NOT required, even for another shop's device —
// some dealers just don't hand over their own number for a given drop-off.
// Our own RM-nnn is what actually identifies the job either way; theirs, when
// given, is only ever an extra cross-reference (still clash-checked while
// typing — see dealerNoCheck — that part is unaffected by this).
//
// deviceBrand is required — not just guessed from deviceModel on save — so a
// bare model number like "TA-1174" (no brand hint in the text at all) can
// never silently end up filed as "Other"; the cashier has to actually pick
// or type one. deviceModel already had full error-UI wired up but was never
// actually enforced here — that looks like an oversight, fixed alongside it.
const REQUIRED_BY_STEP: Record<number, RequiredField[]> = {
  1: ["jobNumber", "customerName", "customerContact", "deviceModel", "deviceBrand"],
  2: ["estimatedCost", "termsAccepted"],
};

const FIELD_LABELS: Record<RequiredField, string> = {
  jobNumber: "Job Number",
  dealerJobNo: "Dealer's Job Number",
  customerName: "Full Name",
  customerContact: "Contact Number",
  deviceModel: "Device Model",
  deviceBrand: "Device Brand",
  estimatedCost: "Estimated Repair Cost",
  termsAccepted: "Terms Acceptance",
};

/**
 * Red border + glow, merged over the normal input style when a field is flagged.
 * Uses the `border` shorthand — not `borderColor` — because the styles it merges
 * over set the shorthand, and mixing the two makes React warn on un-flagging.
 */
const invalidStyle: React.CSSProperties = {
  border: "1px solid var(--danger)",
  boxShadow: "0 0 0 3px rgba(248, 113, 113, 0.16)",
};

function FieldError({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <p style={{
      display: "flex", alignItems: "center", gap: 5, marginTop: 5,
      fontSize: 11, fontWeight: 600, color: "var(--danger)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <AlertCircle size={11} style={{ flexShrink: 0 }} /> {children}
    </p>
  );
}

// ─── Step 1: Dealer & Customer ────────────────────────────────────────────────

/** "2021-07-05" → "05 Jul 2021". */
function fmtJoined(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Step1({ data, onChange, isMobile, dealers, errors, nextJobNo, dealerNoCheck, checkingDealerNo, models, onAddModel, modelNumberLookup, deviceModelLookup, modelBrandLookup, brands, onAddBrand, imeiHistory, checkingImei, onViewHistory }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; dealers: RepairDealer[]; errors: RequiredField[]; nextJobNo: string | null; dealerNoCheck: DealerJobNoCheck | null; checkingDealerNo: boolean; models: string[]; onAddModel: (m: string) => void; modelNumberLookup: Map<string, ModelInfo>; deviceModelLookup: Map<string, ModelInfo>; modelBrandLookup: Map<string, string>; brands: string[]; onAddBrand: (b: string) => void; imeiHistory: RepairJob[]; checkingImei: boolean; onViewHistory: () => void }) {
  const dealer = dealers.find((d) => d.id.toString() === data.dealerId);
  const bad = (f: RequiredField) => errors.includes(f);
  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  // A returning customer's contact number is already in our own job
  // history — matched on the last 7 digits (same tolerance the active-
  // warranty check below uses) so formatting differences (spaces, a
  // leading 0 vs +94) don't stop it from finding them. jobs is newest-
  // first, so the first hit is also their most recent visit.
  const { jobs } = useRepair();
  const [customerMatch, setCustomerMatch] = useState<string | null>(null);
  const handleCustomerContact = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const match = digits.length >= 7
      ? jobs.find(j => (j.phone || "").replace(/\D/g, "").endsWith(digits.slice(-7)))
      : undefined;
    setCustomerMatch(match ? match.customerName : null);
    onChange({
      customerContact: raw,
      // Never overwrite something the cashier already typed on purpose —
      // this only fills in what's still blank.
      ...(match && !data.customerName.trim() ? { customerName: match.customerName } : {}),
      ...(match?.customerEmail && !data.customerEmail.trim() ? { customerEmail: match.customerEmail } : {}),
    });
  };

  // Admin-managed (Admin Control -> Device Faults) — falls back to the fixed
  // list while it's still loading, when Supabase isn't configured, or if
  // nothing's been seeded yet, so the checklist is never just empty.
  const { faults: faultRows } = useDeviceFaults();
  const commonFaults = faultRows.length > 0 ? faultRows.map(f => f.label) : FALLBACK_FAULTS;

  // When a model number is entered, try to resolve the device model — the
  // small offline table first (currently empty, but free to extend), then
  // whatever this shop's own past jobs have already recorded for that
  // number.
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const handleModelNumber = (raw: string) => {
    onChange({ deviceModelNumber: raw });
    // Reference table first, then this shop's own past jobs, then the small
    // offline table. History is the least trustworthy of the three — it is
    // where the wrong answers come from — so it is asked last, not first.
    const key = normaliseModelNumber(raw);
    const hit = deviceModelLookup.get(key)
      ?? lookupModelNumber(raw)
      ?? modelNumberLookup.get(key)
      ?? null;
    if (hit) {
      onChange({ deviceModelNumber: raw, deviceModel: hit.model, deviceBrand: hit.brand });
      // make sure the resolved model is in the combobox list
      if (!models.includes(hit.model)) onAddModel(hit.model);
      setLookupResult(`${hit.brand} ${hit.model}`);
    } else {
      setLookupResult(raw.trim() ? "no-match" : null);
    }
  };

  /** Picking (or typing) a model that's already got a known brand fills it
   *  in automatically — only when Brand is still blank, so this never
   *  overwrites something the cashier already chose on purpose. */
  const handleDeviceModel = (m: string) => {
    const knownBrand = modelBrandLookup.get(m);
    onChange(knownBrand && !data.deviceBrand.trim() ? { deviceModel: m, deviceBrand: knownBrand } : { deviceModel: m });
  };

  // "Items Received With Device" is the one part of the device panel that's
  // genuinely optional and rarely revisited once set, so it folds like the
  // accordions in Step 2 — keeping the newly-merged-in device column from
  // outgrowing the dealer/job column beside it.
  const [itemsOpen, setItemsOpen] = useState(false);
  const receivedCount = data.receivedItems.length;

  return (
    // Bounded to the wizard's content area on desktop (same fix as Step 2's
    // accordion column) so the Device Info/Faults column on the right can
    // scroll on its own when "Items Received" expands, instead of the whole
    // step — and the page — growing taller and scrolling underneath it.
    <div style={{
      display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20,
      alignItems: "stretch", height: isMobile ? "auto" : "100%", minHeight: 0,
    }}>
      {/* A single stacked column — Dealer Information on top, Job & Customer
          Details directly below it — capped to a comfortable form width
          instead of stretching to fill the row. alignSelf keeps it sized to
          its own (shorter) content rather than stretching the full row
          height, which the right column needs for its own scrollbar. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: isMobile ? "100%" : undefined, flex: isMobile ? "none" : "0 1 640px", alignSelf: isMobile ? "stretch" : "flex-start" }}>
      {/* Dealer */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🏪 Dealer Information</div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Select Dealer</label>
          <Combobox
            value={dealer?.name ?? ""}
            options={dealers.map((d) => d.name)}
            allowAdd={false}
            placeholder=""
            onChange={(name) => {
              const match = dealers.find((d) => d.name === name);
              // Switching dealer resets the job number, because the right
              // answer differs entirely: our own device gets our next RM
              // number, another shop's device keeps the number on their docket.
              // Our number is always ours to assign, whoever the device came
              // from — it is what the tag encodes and what a scan resolves.
              // Only the dealer's own reference changes with the dealer.
              onChange({
                dealerId: match ? String(match.id) : "",
                dealerJobNo: "",
              });
            }}
          />
          {dealers.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
              Add repair dealers under Admin Control → Repair Dealers.
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: dealer ? 1 : 0.4, transition: "opacity 0.2s" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Address</label>
              <input readOnly style={readOnlyInputStyle} value={dealer?.address ?? ""} />
            </div>
            <div>
              <label style={labelStyle}>Contact Number</label>
              <input readOnly style={readOnlyInputStyle} value={dealer?.contact ?? ""} />
            </div>
            <div>
              <label style={labelStyle}>Joining Date</label>
              <input readOnly style={readOnlyInputStyle} value={dealer ? fmtJoined(dealer.joinedAt) : ""} />
            </div>
          </div>
        </div>
      </div>

      {/* This job — the numbers it is filed under, then whose it is. The
          panel above is about the dealer as a business; this one is about
          the repair in front of you, which is why it sits directly below.

          Our own walk-ins get the full customer form. A device sent by
          another shop belongs to that shop as far as we're concerned — they
          booked it, they collect it, they are who we ring — so there's no
          end-customer form to fill in, just the two job numbers. */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>📄 Job & Customer Details</div>
        {(() => {
          // Both branches below need the Job Number field, just laid out
          // differently — side-by-side with the dealer's own number for an
          // outside dealer, or on its own row above the customer form for
          // an in-house job — so it's built once here rather than twice.
          const jobNumberField = (
            <div data-field="jobNumber" className={bad("jobNumber") ? "field-shake" : undefined}>
              <label style={labelStyle}>Job Number</label>
              <input
                style={{
                  ...inputStyle,
                  ...(bad("jobNumber") ? invalidStyle : {}),
                  // Muted text only, same bg-card background as every other
                  // field — var(--bg-primary) here made the border all but
                  // disappear (it's nearly the same shade as var(--border)).
                  ...(data.autoJobNumber ? { color: "var(--text-muted)" } : {}),
                }}
                // While auto-generating, fall back to the preview so the box
                // shows the number that is coming rather than sitting blank.
                // Derived rather than written into state: nothing needs
                // saving, and the real number is still assigned by the
                // sequence on insert.
                value={data.autoJobNumber ? (data.jobNumber || nextJobNo || "") : data.jobNumber}
                onChange={(e) => {
                  // Typing is itself the decision to supply a number, so the
                  // tick clears rather than the box being locked until it is
                  // unticked.
                  onChange({ jobNumber: e.target.value, autoJobNumber: false });
                }}
              />

              <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={data.autoJobNumber}
                  onChange={(e) => onChange({
                    autoJobNumber: e.target.checked,
                    jobNumber: e.target.checked ? (nextJobNo ?? "") : "",
                  })}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Generate the job number automatically</span>
              </label>

              <FieldError show={bad("jobNumber")}>Enter the job number, or tick to generate one</FieldError>
            </div>
          );

          // Outside dealer: just the two job numbers, side by side, then
          // nothing else — there's no end customer to take details for.
          if (dealer && !dealer.inHouse) {
            return (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
                {jobNumberField}
                <div data-field="dealerJobNo" className={bad("dealerJobNo") ? "field-shake" : undefined}>
                  <label style={labelStyle}>{dealer.name}&apos;s Job Number (Optional)</label>
                  <input
                    // Red the moment a clash is known, without waiting for a
                    // failed Next — the number is wrong now, not when the
                    // wizard says so.
                    style={{ ...inputStyle, ...(bad("dealerJobNo") || dealerNoCheck?.existing ? invalidStyle : {}) }}
                    value={data.dealerJobNo}
                    onChange={(e) => onChange({ dealerJobNo: e.target.value })}
                  />
                  {/* Caught while typing, not at save: correcting a digit here
                      beats redoing five steps of intake after the constraint
                      rejects it. */}
                  {dealerNoCheck?.existing ? (
                    <div style={{
                      marginTop: 8, padding: "11px 13px", borderRadius: 9,
                      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.45)",
                    }}>
                      <p style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 700, marginBottom: 4 }}>
                        {dealer.name} already has job {dealerNoCheck.existing.dealerJobNo}
                      </p>
                      <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                        {dealerNoCheck.existing.customerName} · {dealerNoCheck.existing.device} ·
                        {" "}booked {fmtJoined(dealerNoCheck.existing.createdAt)} · {dealerNoCheck.existing.status}
                        {" "}(our number {dealerNoCheck.existing.id})
                      </p>
                      {dealerNoCheck.suggestion && (
                        <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                            Same device back again?
                          </span>
                          <button
                            onClick={() => onChange({ dealerJobNo: dealerNoCheck.suggestion! })}
                            style={{
                              padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                              background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer",
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                            }}
                          >
                            Book it as {dealerNoCheck.suggestion}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : checkingDealerNo ? (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>Checking…</div>
                  ) : null}
                </div>
              </div>
            );
          }

          // In-house / no dealer yet: Job Number on its own row, then the
          // customer form laid out as a 2x2 grid — four columns left each
          // field too narrow for its placeholder/error text to fit on one
          // line, and left the panel awkwardly short next to the empty
          // space below it.
          return (
            <>
              <div style={{ marginBottom: 20 }}>{jobNumberField}</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 20 }}>
                {/* Contact number comes first — typing a number already in
                    our job history fills in the rest below, so it's worth
                    asking for before the fields it can fill. */}
                <div data-field="customerContact" className={bad("customerContact") ? "field-shake" : undefined}>
                  <label style={labelStyle}>Contact Number *</label>
                  <input
                    style={{ ...inputStyle, ...(bad("customerContact") ? invalidStyle : {}) }}
                    value={data.customerContact}
                    onChange={(e) => handleCustomerContact(e.target.value)}
                  />
                  {customerMatch && (
                    <p style={{ fontSize: 11, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} /> Returning customer: <strong>{customerMatch}</strong>
                    </p>
                  )}
                  <FieldError show={bad("customerContact")}>Enter a contact number</FieldError>
                </div>
                <div>
                  <label style={labelStyle}>NIC Number</label>
                  <input
                    style={inputStyle}
                    value={data.customerNIC}
                    onChange={(e) => onChange({ customerNIC: e.target.value })}
                  />
                </div>
                <div data-field="customerName" className={bad("customerName") ? "field-shake" : undefined}>
                  <label style={labelStyle}>Full Name *</label>
                  <input
                    style={{ ...inputStyle, ...(bad("customerName") ? invalidStyle : {}) }}
                    value={data.customerName}
                    onChange={(e) => onChange({ customerName: e.target.value })}
                  />
                  <FieldError show={bad("customerName")}>Enter the customer&apos;s full name</FieldError>
                </div>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    style={inputStyle}
                    type="email"
                    value={data.customerEmail}
                    onChange={(e) => onChange({ customerEmail: e.target.value })}
                  />
                </div>
              </div>
            </>
          );
        })()}
      </div>
      </div>

      {/* Right: Device Information + Device Faults — used to be their own
          step; the device is right there in front of the cashier at the
          same time as the dealer and customer, so there's no real reason
          it needed a separate page. Items Received folds since it's the
          one part nobody needs to see twice. Scrolls on its own, bounded to
          the row's height, so expanding it never grows the page. */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 20, flex: isMobile ? "none" : 1,
        minWidth: isMobile ? undefined : 280, minHeight: 0,
        overflowY: isMobile ? "visible" : "auto", paddingRight: isMobile ? 0 : 6,
      }}>
        {/* flex: "0 0 auto" — panelStyle's own flex: 1 would otherwise still
            grow this to fill any leftover height in the column (empty space
            below the content), on top of the flexShrink: 0 this needs so it
            doesn't get squashed instead of the column scrolling (same issue
            the Step 2 accordions hit; see AccordionSection). */}
        <div style={{ ...panelStyle, flex: "0 0 auto" }}>
          <div style={sectionHeaderStyle}>📱 Device Information</div>
          <label style={{
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            marginBottom: 14, fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            <input
              type="checkbox"
              checked={data.modelNumberUnavailable}
              onChange={(e) => onChange({
                modelNumberUnavailable: e.target.checked,
                // Clear what can no longer be seen, so a half-typed number
                // cannot be saved against a device the cashier just said has
                // none. Unticking gives back empty fields, not stale ones.
                ...(e.target.checked ? { deviceModelNumber: "", deviceBrand: "" } : {}),
              })}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
              Model number not available
              <span style={{ color: "var(--text-muted)" }}> — no readable number or brand on the device</span>
            </span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
            {/* Unidentifiable device: no readable number, no brand mark. The
                two fields that cannot be answered come away entirely, rather
                than sitting there as blanks somebody has to argue with. */}
            {!data.modelNumberUnavailable && (
              <div>
                <label style={labelStyle}><Hash size={11} style={{ verticalAlign: "-1px" }} /> Model Number</label>
                <input
                  style={inputStyle}
                  value={data.deviceModelNumber}
                  onChange={(e) => handleModelNumber(e.target.value)}
                />
                {lookupResult && lookupResult !== "no-match" && (
                  <p style={{ fontSize: 11, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={12} /> Identified: <strong>{lookupResult}</strong>
                  </p>
                )}
                {lookupResult === "no-match" && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4 }}>
                    Not in the local database — select or type the model below.
                  </p>
                )}
              </div>
            )}

            {/* Brand before model: the brand narrows what the model list
                offers, so asking for it second meant scrolling every model the
                shop has ever seen to find the one you already knew the make of. */}
            {!data.modelNumberUnavailable && (
              <div data-field="deviceBrand" className={bad("deviceBrand") ? "field-shake" : undefined}>
                <label style={labelStyle}>Device Brand</label>
                <Combobox
                  value={data.deviceBrand}
                  options={brands}
                  onAddOption={onAddBrand}
                  placeholder=""
                  inputStyle={bad("deviceBrand") ? invalidStyle : undefined}
                  onChange={(b) => onChange({ deviceBrand: b })}
                />
                <FieldError show={bad("deviceBrand")}>Select or type the brand</FieldError>
              </div>
            )}

            <div data-field="deviceModel" className={bad("deviceModel") ? "field-shake" : undefined}>
              <label style={labelStyle}>
                {data.modelNumberUnavailable ? "Device (as written on the docket)" : "Device Model"}
              </label>
              {data.modelNumberUnavailable ? (
                // Free text, not the combobox: with no brand to narrow it the
                // list is every model in the shop, and the whole reason this
                // box exists is that the device does not match any of them.
                <input
                  style={{ ...inputStyle, ...(bad("deviceModel") ? invalidStyle : {}) }}
                  value={data.deviceModel}
                  placeholder="e.g. Chinese clone, no markings"
                  onChange={(e) => onChange({ deviceModel: e.target.value })}
                />
              ) : (
                <Combobox
                  value={data.deviceModel}
                  options={models}
                  onAddOption={onAddModel}
                  placeholder=""
                  inputStyle={bad("deviceModel") ? invalidStyle : undefined}
                  onChange={handleDeviceModel}
                />
              )}
              <FieldError show={bad("deviceModel")}>
                {data.modelNumberUnavailable ? "Describe the device" : "Select or type the model"}
              </FieldError>
            </div>
            <div>
              <label style={labelStyle}>IMEI Number</label>
              <input
                style={{
                  ...inputStyle,
                  borderColor: imeiHistory.length > 0 ? "#fbbf24" : inputStyle.borderColor as string,
                }}
                maxLength={15}
                inputMode="numeric"
                value={data.deviceIMEI}
                onChange={(e) => onChange({ deviceIMEI: e.target.value.replace(/\D/g, "") })}
              />

              {/*
                The check runs itself once all fifteen digits are in — no button,
                because a button is a thing to forget, and the one moment this
                matters is before the new job is written.
              */}
              {checkingImei && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Checking this IMEI…
                </p>
              )}

              {!checkingImei && imeiHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onViewHistory}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: 6,
                    padding: "9px 11px", borderRadius: 9, cursor: "pointer", textAlign: "left",
                    background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <History size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fbbf24", display: "block" }}>
                      Seen before — {imeiHistory.length} previous {imeiHistory.length === 1 ? "repair" : "repairs"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Last: {imeiHistory[0].id} · {imeiHistory[0].issue || "no fault recorded"}
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fbbf24", flexShrink: 0 }}>View</span>
                </button>
              )}

              {!checkingImei && imeiHistory.length === 0 && data.deviceIMEI.replace(/\D/g, "").length === 15 && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  No previous repair on this IMEI.
                </p>
              )}
            </div>
          </div>

          <AccordionSection
            title="📦 Items Received With Device"
            summary={receivedCount > 0 ? `${receivedCount} item${receivedCount !== 1 ? "s" : ""}` : "None selected"}
            open={itemsOpen}
            onToggle={() => setItemsOpen(o => !o)}
          >
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6 }}>
              {RECEIVED_ITEMS.map((item) => {
                const checked = data.receivedItems.includes(item);
                const toggle = () => onChange({ receivedItems: toggleItem(data.receivedItems, item) });
                return (
                  <div
                    key={item}
                    role="checkbox"
                    aria-checked={checked}
                    tabIndex={0}
                    style={checkboxItemStyle(checked)}
                    onClick={toggle}
                    onKeyDown={onCheckboxKeyDown(toggle)}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                      background: checked ? "var(--accent)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "all 0.15s",
                    }}>
                      {checked && <span style={{ color: "var(--accent-fg)", fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}>{item}</span>
                  </div>
                );
              })}
            </div>
          </AccordionSection>
        </div>

        <div style={{ ...panelStyle, flex: "0 0 auto" }}>
          <div style={sectionHeaderStyle}>🔧 Device Faults</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 6, marginBottom: 18 }}>
            {commonFaults.map((fault) => {
              const checked = data.faultCheckboxes.includes(fault);
              const toggle = () => onChange({ faultCheckboxes: toggleItem(data.faultCheckboxes, fault) });
              return (
                <div
                  key={fault}
                  role="checkbox"
                  aria-checked={checked}
                  tabIndex={0}
                  style={checkboxItemStyle(checked)}
                  onClick={toggle}
                  onKeyDown={onCheckboxKeyDown(toggle)}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? "#ff6b6b" : "var(--border)"}`,
                    background: checked ? "#ff6b6b" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "all 0.15s",
                  }}>
                    {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)" }}>{fault}</span>
                </div>
              );
            })}
          </div>

          <div>
            <label style={labelStyle}>Additional Fault Description</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
              value={data.faultDescription}
              onChange={(e) => onChange({ faultDescription: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Costs & Evidence ─────────────────────────────────────────────────
//
// Cost & Payment is the one thing that's actually required here, so it stays
// permanently visible on the left. Everything else that used to be spread
// across "Assign Repairman" and "Evidence & Sign" — Job Details, Available
// Repairmen, Device Cosmetic Condition, Intake Photos — is optional at intake
// and now lives folded up on the right, opened only when needed. Device
// Unlock and Terms & Conditions stay unfolded: the former is short enough
// not to need hiding, the latter is what the final step blocks on.

/**
 * "Ready in how long?" is the question the counter actually asks.
 *
 * The field is a date picker, so answering "three days" meant working out what
 * date that is and clicking through a calendar — dozens of times a day, for an
 * answer that is nearly always one of five spans.
 *
 * Dates are built in local time. Adding days to an ISO string built from
 * toISOString() is off by a day for half of every day in Sri Lanka (UTC+5:30),
 * and "ready tomorrow" landing on today is exactly the kind of promise the shop
 * cannot keep.
 */
const ETA_SHORTCUTS: { label: string; days: number }[] = [
  { label: "1 day",  days: 1 },
  { label: "2 days", days: 2 },
  { label: "3 days", days: 3 },
  { label: "5 days", days: 5 },
  { label: "1 week", days: 7 },
];

function isoLocalDate(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function etaFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoLocalDate(d);
}

function Step2({ data, onChange, isMobile, errors, dealers, technicians, techLoading }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; errors: RequiredField[]; dealers: RepairDealer[]; technicians: Technician[]; techLoading: boolean }) {
  const bad = (f: RequiredField) => errors.includes(f);
  // Only one of the accordions below is ever open at a time — opening one
  // closes whichever else was open, so the list doesn't grow tall with
  // several expanded sections at once.
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  /**
   * Which shortcut is showing as chosen.
   *
   * Held here rather than derived by comparing the date against today. Working
   * out "is this date three days away" needs today's date during render, which
   * is exactly the impure read React's rules forbid — and a module-level
   * constant would quietly go stale on a till left open overnight.
   */
  const [etaPick, setEtaPick] = useState<number | "unsure" | null>(null);
  const toggleAccordion = (id: string) => setOpenAccordion(o => o === id ? null : id);
  const estimated = parseFloat(data.estimatedCost) || 0;
  const advance = parseFloat(data.advancePaid) || 0;
  const balance = estimated - advance;
  // Another shop's device is billed on their own docket — the cost isn't
  // required here the way it is for a job we're quoting and charging for
  // ourselves. Mirrors the same check in isBlank().
  const picked = dealers.find(d => String(d.id) === data.dealerId);
  const fromAnotherShop = !!picked && !picked.inHouse;

  const { jobs } = useRepair();
  // Live workload rather than a hard-coded number, so the cashier can see who is
  // actually loaded up before assigning.
  const workload = (name: string) =>
    jobs.filter(j => j.technician === name && (j.status === "Issued" || j.status === "Pending")).length;
  const assignedTech = technicians.find((r) => r.id === data.assignedRepairman);

  const fileRef = useRef<HTMLInputElement>(null);
  const setCond = (key: keyof Omit<DeviceConditionMap, "notes">, grade: ConditionGrade) =>
    onChange({ condition: { ...data.condition, [key]: grade } });
  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 6).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => onChange({ intakePhotos: [...data.intakePhotos, reader.result as string] });
      reader.readAsDataURL(file);
    });
  };
  const removePhoto = (i: number) =>
    onChange({ intakePhotos: data.intakePhotos.filter((_, idx) => idx !== i) });

  // On desktop this row is pinned to exactly the height Step 1/2 already get
  // from the wizard's content area (not left to grow with it) — Cost &
  // Payment sizes to its own content as before, and the accordion stack gets
  // its own internal scrollbar instead of pushing the whole step taller.
  return (
    <div style={{
      display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20,
      alignItems: "stretch", height: isMobile ? "auto" : "100%", minHeight: 0,
    }}>
      {/* Left: Cost & Payment — the only required content on this step, so it
          never folds. alignSelf overrides the row's stretch (which the right
          column still needs, for its own scrollbar) so this panel sizes to
          its own short content instead of stretching into empty space all
          the way down to the footer. */}
      <div style={{ ...panelStyle, alignSelf: "flex-start" }}>
        <div style={sectionHeaderStyle}>💰 Cost & Payment</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div data-field="estimatedCost" className={bad("estimatedCost") ? "field-shake" : undefined}>
            <label style={labelStyle}>Estimated Repair Cost (LKR){fromAnotherShop ? "" : " *"}</label>
            <input
              style={{ ...inputStyle, ...(bad("estimatedCost") ? invalidStyle : {}) }}
              type="number"
              min={0}
              value={data.estimatedCost}
              onChange={(e) => onChange({ estimatedCost: e.target.value })}
            />
            {fromAnotherShop ? (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Optional — this device is billed on {picked?.name ?? "the dealer"}'s own docket.
              </p>
            ) : (
              <FieldError show={bad("estimatedCost")}>Enter an estimated cost (0 if not yet quoted)</FieldError>
            )}
          </div>
          <div>
            <label style={labelStyle}>Estimated Completion Date</label>
            <input
              type="date"
              style={inputStyle}
              value={data.estimatedCompletion}
              onChange={(e) => { setEtaPick(null); onChange({ estimatedCompletion: e.target.value }); }}
            />

            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
              {ETA_SHORTCUTS.map(({ label, days }) => {
                const active = etaPick === days;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setEtaPick(days); onChange({ estimatedCompletion: etaFromToday(days) }); }}
                    style={{
                      minHeight: 28, padding: "0 10px", borderRadius: 7, fontSize: 11.5,
                      fontWeight: active ? 700 : 500, cursor: "pointer",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      background: active ? "var(--accent-dim)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}

              {/*
                Not the same as leaving the field blank by accident, which is
                why it is a button you press. A device that has to be opened
                before anyone can say how long it will take is a real and common
                answer, and pretending otherwise puts a date on the customer's
                slip that the shop never meant to promise.
              */}
              <button
                type="button"
                onClick={() => { setEtaPick("unsure"); onChange({ estimatedCompletion: "" }); }}
                style={{
                  minHeight: 28, padding: "0 10px", borderRadius: 7, fontSize: 11.5,
                  fontWeight: etaPick === "unsure" ? 700 : 500, cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  border: `1px solid ${etaPick === "unsure" ? "#fbbf24" : "var(--border)"}`,
                  background: etaPick === "unsure" ? "rgba(251,191,36,0.1)" : "transparent",
                  color: etaPick === "unsure" ? "#fbbf24" : "var(--text-secondary)",
                }}
              >
                Not sure yet
              </button>
            </div>

            {etaPick === "unsure" && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                No date goes on the job or the customer&apos;s slip. Set one once the technician
                has looked at it.
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Advance Received (LKR)</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={data.advancePaid}
              onChange={(e) => onChange({ advancePaid: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Payment Method</label>
            <Combobox
              value={data.paymentMethod}
              options={["Cash", "Card", "Bank Transfer", "Online Payment"]}
              allowAdd={false}
              placeholder=""
              onChange={(m) => onChange({ paymentMethod: m })}
            />
          </div>

          {/* Balance Summary Card */}
          <div style={{
            marginTop: 8, padding: "16px 18px", borderRadius: 10,
            background: "var(--bg-primary)", border: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Estimated Cost</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                LKR {estimated.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Advance Paid</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                − LKR {advance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Balance Due</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: balance > 0 ? "var(--accent)" : "#4ade80", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                LKR {balance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: everything else, stacked — folded by default except Device
          Unlock and Terms & Conditions. Scrolls on its own, bounded to the
          same height as the Cost & Payment panel beside it, so this list
          never grows the step (or the page) taller than it was before. */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", gap: 14, minWidth: 0,
        minHeight: 0, overflowY: isMobile ? "visible" : "auto", paddingRight: isMobile ? 0 : 6,
      }}>
        <AccordionSection title="📋 Job Details" summary={data.jobPriority} open={openAccordion === "job-details"} onToggle={() => toggleAccordion("job-details")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Job Priority</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* These four are the job_priority enum. Anything else is
                    rejected by the database at save time, after the whole intake
                    has been filled in — so the picker must not offer it. Colours
                    match the priority chips in JobsTable. */}
                {(["Low", "Normal", "High", "Urgent"] as JobPriority[]).map((p) => {
                  const colors: Record<JobPriority, string> = { Low: "#94a3b8", Normal: "#60a5fa", High: "#fbbf24", Urgent: "#f87171" };
                  const isActive = data.jobPriority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => onChange({ jobPriority: p })}
                      style={{
                        padding: "7px 18px", borderRadius: 7, border: `1px solid ${isActive ? colors[p] : "var(--border)"}`,
                        background: isActive ? colors[p] : "transparent",
                        color: isActive ? "var(--accent-fg)" : "var(--text-secondary)",
                        fontWeight: isActive ? 700 : 400, fontSize: 12, cursor: "pointer",
                        fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Job / Internal Notes</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
                value={data.jobNotes}
                onChange={(e) => onChange({ jobNotes: e.target.value })}
              />
            </div>

            <div style={{
              padding: "12px 14px", borderRadius: 8,
              background: "rgba(var(--accent-rgb, 232,232,232), 0.06)",
              border: "1px dashed var(--accent)",
            }}>
              <p style={{ margin: 0, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                💡 A job card will be auto-generated with a unique reference number upon submission. The customer will be notified via SMS if a contact number is provided.
              </p>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          title="🛠️ Available Repairmen"
          summary={assignedTech ? `${assignedTech.name}${data.estimatedCompletion ? ` · Due ${data.estimatedCompletion}` : ""}` : "Not assigned yet"}
          open={openAccordion === "repairmen"}
          onToggle={() => toggleAccordion("repairmen")}
        >
          <div>
            {techLoading && (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "10px 0" }}>
                Loading technicians…
              </p>
            )}

            {/* An empty roster is a setup problem, not "no one is free" — say so. */}
            {!techLoading && technicians.length === 0 && (
              <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)" }}>
                <AlertCircle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
                  No technicians in the staff directory yet. Add staff with the{" "}
                  <strong>Technician</strong> role in Supabase (or Admin Control), or skip this step and
                  let any technician pick the job up.
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {technicians.map((r) => {
                const isSelected = data.assignedRepairman === r.id;
                const canSelect = r.available;
                const toggle = () => canSelect && onChange({ assignedRepairman: isSelected ? "" : r.id });
                return (
                  <div
                    key={r.id}
                    // Clicking the assigned repairman again unassigns them, so a
                    // misclick can be undone and the step left as "Skip".
                    onClick={toggle}
                    onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } }}
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={!canSelect}
                    tabIndex={canSelect ? 0 : -1}
                    title={!canSelect ? `${r.name} is busy` : isSelected ? "Click to unassign" : `Assign to ${r.name}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                      borderRadius: 10, border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      background: isSelected ? "rgba(var(--accent-rgb, 232,232,232), 0.06)" : "var(--bg)",
                      cursor: canSelect ? "pointer" : "not-allowed",
                      opacity: canSelect ? 1 : 0.5, transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: isSelected ? "var(--accent)" : "var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 700, flexShrink: 0,
                      color: isSelected ? "var(--accent-fg)" : "var(--text-secondary)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}>
                      {r.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)", marginBottom: 3 }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {r.speciality} · {workload(r.name)} active job{workload(r.name) !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: r.available ? "rgba(74, 222, 128, 0.12)" : "rgba(239, 68, 68, 0.12)",
                      color: r.available ? "#4ade80" : "#ef4444",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}>
                      {r.available ? "Available" : "Busy"}
                    </div>
                    {isSelected && (
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", background: "var(--accent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, color: "var(--accent-fg)", fontWeight: 700,
                      }}>✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </AccordionSection>

        <AccordionSection title="🩹 Device Cosmetic Condition" summary={data.condition.notes?.trim() ? "Notes added" : "At drop-off"} open={openAccordion === "condition"} onToggle={() => toggleAccordion("condition")}>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 12, lineHeight: 1.5 }}>
            Record the device&apos;s condition <strong>at drop-off</strong> — this protects both the
            customer and the shop in any dispute.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
            {CONDITION_ZONES.map(zone => (
              <div key={zone.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", width: isMobile ? 90 : 110, flexShrink: 0 }}>{zone.label}</span>
                <div style={{ display: "flex", gap: 4, flex: 1 }}>
                  {GRADES.map(g => {
                    const active = data.condition[zone.key] === g.value;
                    return (
                      <button key={g.value} type="button" onClick={() => setCond(zone.key, g.value)}
                        style={{
                          flex: 1, padding: "5px 4px", borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                          border: `1px solid ${active ? g.color : "var(--border)"}`,
                          background: active ? `${g.color}1e` : "transparent",
                          color: active ? g.color : "var(--text-muted)",
                          cursor: "pointer", transition: "all 0.12s", fontFamily: "'Plus Jakarta Sans', sans-serif",
                        }}>
                        {g.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>Condition Notes</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 56 }}
              value={data.condition.notes ?? ""}
              onChange={e => onChange({ condition: { ...data.condition, notes: e.target.value } })}
            />
          </div>
        </AccordionSection>

        <StaticSection title={<><Lock size={12} style={{ verticalAlign: "-1px" }} /> Device Unlock</>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={labelStyle}>Passcode Type</label>
              <select
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                value={data.passcodeType}
                onChange={e => onChange({ passcodeType: e.target.value as FormData["passcodeType"] })}
              >
                {["None", "PIN", "Pattern", "Password", "Provided Separately"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {(data.passcodeType === "PIN" || data.passcodeType === "Pattern" || data.passcodeType === "Password") && (
              <div>
                <label style={labelStyle}>{data.passcodeType} (visible only to technician)</label>
                <input
                  style={inputStyle}
                  value={data.passcode}
                  onChange={e => onChange({ passcode: e.target.value })}
                />
              </div>
            )}
          </div>
        </StaticSection>

        <AccordionSection title="📷 Intake Photos" summary={`${data.intakePhotos.length} photo${data.intakePhotos.length !== 1 ? "s" : ""}`} open={openAccordion === "photos"} onToggle={() => toggleAccordion("photos")}>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={e => onFiles(e.target.files)} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, marginBottom: 8 }}>
            {data.intakePhotos.map((src, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`intake ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button type="button" onClick={() => removePhoto(i)} style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <XIcon size={11} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ aspectRatio: "1", borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 10.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Camera size={18} /> Add
            </button>
          </div>
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 16 }}>
            Optional, but strongly recommended: front, back, and both sides — photos are your
            evidence of the device&apos;s state at drop-off.
          </p>
          <SignaturePad value={data.signature} onChange={s => onChange({ signature: s })} label="Customer Signature" />
        </AccordionSection>

        {/* Terms — always visible; it's what the final Create Job click blocks on. */}
        <div data-field="termsAccepted" className={bad("termsAccepted") ? "field-shake" : undefined} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-primary)", border: `1px solid ${bad("termsAccepted") ? "var(--danger)" : "var(--border)"}`, flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>Terms &amp; Conditions ({TERMS_VERSION})</p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.6 }}>
            <li>Repair warranty covers only the parts/labour listed on completion.</li>
            <li>The shop is not liable for data loss; please back up your device.</li>
            <li>Devices uncollected after 90 days may be disposed of to recover costs.</li>
            <li>Condition above is agreed as the device&apos;s state at drop-off.</li>
          </ul>
          <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10, cursor: "pointer" }}>
            <div onClick={() => onChange({ termsAccepted: !data.termsAccepted })} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${data.termsAccepted ? "var(--accent)" : "var(--border)"}`, background: data.termsAccepted ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {data.termsAccepted && <span style={{ color: "var(--accent-fg)", fontSize: 11, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Customer has read and accepts the terms above</span>
          </label>
          <FieldError show={bad("termsAccepted")}>The customer must accept the terms</FieldError>
        </div>
      </div>
    </div>
  );
}

// ─── Main Form Component ──────────────────────────────────────────────────────

/** Where the last-used dealer is remembered. Per browser: see lastDealerId. */
const LAST_DEALER_KEY = "mano_last_dealer";

const INITIAL: FormData = {
  dealerId: "", jobNumber: "", autoJobNumber: true, dealerJobNo: "",
  customerName: "", customerNIC: "", customerContact: "", customerEmail: "",
  deviceBrand: "", deviceModel: "", deviceModelNumber: "", modelNumberUnavailable: false, deviceIMEI: "", receivedItems: [], faultCheckboxes: [], faultDescription: "",
  estimatedCost: "", advancePaid: "", paymentMethod: "", jobPriority: "Normal", jobNotes: "",
  assignedRepairman: "", estimatedCompletion: "",
  condition: { front: "Good", back: "Good", frame: "Good", camera: "Good", ports: "Good", buttons: "Good" },
  intakePhotos: [], passcodeType: "None", passcode: "", signature: "", termsAccepted: true,
};

/** A blank wizard is never worth saving as a draft. */
const isPristine = (f: FormData) => JSON.stringify(f) === JSON.stringify(INITIAL);

// Fallback only, for when the cashier leaves Device Brand blank — guessing
// from keywords inside the model text works for something like "iPhone 13"
// but silently gives up on a bare model number like "A10" (Samsung, Oppo and
// half a dozen other brands all sell an "A10"), which is exactly why Device
// Brand is now its own field instead of the only source of truth.
function detectBrand(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("iphone") || m.includes("ipad") || m.includes("macbook")) return "Apple";
  if (m.includes("samsung") || m.includes("galaxy")) return "Samsung";
  if (m.includes("xiaomi") || m.includes("redmi") || m.includes("poco")) return "Xiaomi";
  if (m.includes("oppo")) return "OPPO";
  if (m.includes("oneplus")) return "OnePlus";
  if (m.includes("realme")) return "Realme";
  if (m.includes("huawei") || m.includes("honor")) return "Huawei";
  if (m.includes("vivo")) return "Vivo";
  if (m.includes("nokia")) return "Nokia";
  return "Other";
}

/** A sensible floor for the Device Brand combobox before this shop has any
 *  job history of its own to draw on — same names detectBrand recognises. */
const BRAND_OPTIONS = ["Apple", "Samsung", "Xiaomi", "OPPO", "OnePlus", "Realme", "Huawei", "Vivo", "Nokia", "Other"];

/**
 * `initialDraft` resumes a saved intake — the Drafts section passes one in and
 * switches to this tab, and the wizard opens on the step it was left at. Photos
 * are never part of a draft, so they always start empty.
 */
export default function NewRepairForm({ onClose, initialDraft, onStepChange }: { onClose?: () => void; initialDraft?: RepairDraft | null; onStepChange?: (step: number) => void }) {
  const { addJob, updateJob, dealers, jobs } = useRepair();

  /**
   * Whether this account can actually book a job in.
   *
   * Postgres refuses the insert for anyone who is not a Cashier or an Admin
   * (see jobs_insert, migration 20260831000008), and it refuses at the very
   * end — after four steps of typing, an IMEI, a fault checklist and a
   * signature. Saying so at the top is the difference between a two-second
   * correction and a lost intake.
   *
   * Only a warning, not a block: the database is the control, and a role that
   * cannot be read must not stop a counter from working.
   */
  const { profile } = useAuth();
  const wrongRole = !!profile && profile.role !== "Cashier" && profile.role !== "Admin";
  // The corrected model-number reference table. Preferred over job history,
  // which learned from every typo anyone ever entered.
  const { lookup: deviceModelLookup, models: deviceModels, reload: reloadDeviceModels } = useDeviceModelLookup();

  /**
   * The main technician, pre-selected on Step 4 so the usual assignment is
   * already made. Applied once, and only to a blank field: it must never
   * overwrite a choice the cashier made, or reappear after they deliberately
   * cleared it to leave the job in the pool.
   */
  const [defaultTechId, setDefaultTechId] = useState<string | null>(null);
  const defaultApplied = useRef(false);

  /**
   * The dealer this counter used last.
   *
   * Devices arrive from a dealer in batches — ten phones from Phone House get
   * booked in one after another — and picking the same name every time is the
   * most repeated action in the whole intake. Remembered per browser rather
   * than in the database: it is which batch this counter is working through
   * right now, not a fact about the shop, and two counters can be on different
   * dealers at the same moment.
   */
  const [lastDealerId, setLastDealerId] = useState<string>("");
  const dealerApplied = useRef(false);
  useEffect(() => {
    try {
      setLastDealerId(window.localStorage.getItem(LAST_DEALER_KEY) ?? "");
    } catch { /* private mode; the cashier picks as before */ }
  }, []);
  useEffect(() => {
    let active = true;
    fetchStaffRules()
      .then(rows => {
        if (active) setDefaultTechId(rows.find(r => r.isDefaultTechnician)?.profileId ?? null);
      })
      .catch(() => { /* no pre-selection; the cashier picks as before */ });
    return () => { active = false; };
  }, []);
  // Shown in the job-number box so the cashier can see what will be assigned.
  // Advisory only — the sequence, not this value, decides on save.
  /**
   * Previous repairs on the IMEI being typed.
   *
   * Fires on its own the moment fifteen digits are in. A device that has been
   * here before changes the quote, the warranty question and often the fault
   * itself, and the counter has to know that before writing the new job — not
   * after the customer has left.
   *
   * Keyed by the digits it ran for, so a result can never be shown against a
   * different number than the one that produced it.
   */
  const [imeiCheck, setImeiCheck] = useState<{ digits: string; jobs: RepairJob[] }>({ digits: "", jobs: [] });
  const [showHistory, setShowHistory] = useState(false);

  const [nextJobNo, setNextJobNo] = useState<string | null>(null);

  /**
   * Re-read what the next number will be.
   *
   * Has to be callable, not a mount-only effect. After a job is saved the
   * wizard resets to Step 1 for the next device, and a number fetched once on
   * mount still showed the one that had just been used — so the cashier was
   * looking at RM-044 while the sequence was already on RM-045.
   */
  const refreshNextJobNo = useCallback(() => {
    let active = true;
    previewNextJobNo()
      .then(v => { if (active) setNextJobNo(v); })
      .catch(() => { /* the box just shows a placeholder instead */ });
    return () => { active = false; };
  }, []);

  useEffect(() => refreshNextJobNo(), [refreshNextJobNo]);
  const { technicians, loading: techLoading } = useTechnicians();
  const toast = useToast();
  const { warranties } = useWarranty();
  // A brand-new model typed this session, before it's saved as a real job —
  // kept in memory only (not persisted) so it's immediately reusable while
  // filling in several intakes back to back; once the job saves, it's part
  // of `jobs` and shows up in historicalModels on its own from then on.
  const [sessionModels, setSessionModels] = useState<string[]>([]);
  // Clamped to 2: a draft saved before Device & Faults folded into Step 1
  // (and before that, Assign Repairman / Evidence & Sign folding into what's
  // now Step 2) could still carry an old step 3, 4, or 5, none of which
  // exist any more.
  const [step, setStep] = useState(Math.min(initialDraft?.step ?? 1, 2));
  // The step indicator now renders in RepairManagement's header row (next to
  // the section card, not stacked below it) — this is how it finds out which
  // step to highlight, since `step` itself stays owned here.
  useEffect(() => { onStepChange?.(step); }, [step, onStepChange]);
  const [form, setForm] = useState<FormData>(
    initialDraft ? { ...INITIAL, ...initialDraft.form, intakePhotos: [] } : INITIAL,
  );

  // Fifteen digits is a complete IMEI; anything shorter is somebody still
  // typing, and searching on a partial number would match the wrong handset.
  const imeiDigits = form.deviceIMEI.replace(/\D/g, "");
  useEffect(() => {
    if (imeiDigits.length !== 15) return;
    let active = true;
    fetchJobsByImei(imeiDigits)
      .then(jobs => { if (active) setImeiCheck({ digits: imeiDigits, jobs }); })
      // A lookup that cannot run must not stop an intake. The worst case is the
      // counter not being told about a repeat, which is where it was before
      // this existed.
      .catch(() => { if (active) setImeiCheck({ digits: imeiDigits, jobs: [] }); })
    return () => { active = false; };
  }, [imeiDigits]);

  /**
   * Both derived from the one stamped result rather than tracked separately.
   *
   * A second "checking" flag would need setting inside the effect body, which
   * costs an extra render on every keystroke — and the stamp already answers
   * the question: a complete number with no result yet IS the loading state,
   * and a result stamped with different digits is never shown at all.
   */
  const imeiHistory = imeiCheck.digits === imeiDigits ? imeiCheck.jobs : [];
  const checkingImei = imeiDigits.length === 15 && imeiCheck.digits !== imeiDigits;

  // Pre-select the remembered dealer, once, on a fresh intake only. Skipped if
  // that dealer has since been deleted, so a stale id never leaves the form
  // pointing at nothing.
  useEffect(() => {
    if (!lastDealerId || dealerApplied.current || initialDraft) return;
    if (!dealers.some(d => String(d.id) === lastDealerId)) return;
    dealerApplied.current = true;
    setForm(f => (f.dealerId ? f : { ...f, dealerId: lastDealerId }));
  }, [lastDealerId, dealers, initialDraft]);

  // Fill the main technician in once the lookup lands, and only into an empty
  // field on a fresh intake. A resumed draft keeps whatever it was saved with,
  // including a deliberately blank assignment.
  useEffect(() => {
    if (!defaultTechId || defaultApplied.current || initialDraft) return;
    defaultApplied.current = true;
    setForm(f => (f.assignedRepairman ? f : { ...f, assignedRepairman: defaultTechId }));
  }, [defaultTechId, initialDraft]);

  /**
   * Live clash check on the dealer's number, debounced so a four-digit entry
   * is one query rather than four. `active` guards the response: typing 1 then
   * 12 must not have the slower answer for "1" arrive last and flag a number
   * that is no longer in the box.
   */
  const [dealerNoCheck, setDealerNoCheck] = useState<DealerJobNoCheck | null>(null);
  const [checkingDealerNo, setCheckingDealerNo] = useState(false);
  useEffect(() => {
    const dealerId = Number(form.dealerId);
    const value = form.dealerJobNo.trim();
    if (!dealerId || !value) { setDealerNoCheck(null); setCheckingDealerNo(false); return; }

    let active = true;
    setCheckingDealerNo(true);
    const t = setTimeout(() => {
      checkDealerJobNo(dealerId, value)
        .then(r => { if (active) setDealerNoCheck(r); })
        .catch(() => { if (active) setDealerNoCheck(null); })
        .finally(() => { if (active) setCheckingDealerNo(false); });
    }, 400);

    return () => { active = false; clearTimeout(t); };
  }, [form.dealerId, form.dealerJobNo]);

  const [createdJob, setCreatedJob] = useState<RepairJob | null>(null);
  // Set the instant a job is created, cleared once the silent print fires —
  // see BarcodeLabelModal's `silent` mode. Separate from createdJob so the
  // receipt popup and the tag print are independent: closing one doesn't
  // touch the other.
  const [autoPrintJob, setAutoPrintJob] = useState<RepairJob | null>(null);
  const [errors, setErrors] = useState<RequiredField[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Bumped on every blocked click so the summary re-shakes even when the same
  // fields are still missing (a CSS animation only replays on a fresh element).
  const [attempt, setAttempt] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Land keyboard focus on the first field of whichever step just became
  // active — Next Step / Back otherwise leave focus sitting on the button
  // that was clicked, so typing (or Tab) does nothing until the cashier
  // clicks into the form again. Includes custom controls like the technician
  // rows and Step 1's checkbox grids (real <input>/<textarea>/<select> only
  // covers text fields — a step whose first control is one of those custom
  // rows, e.g. the technician list inside Step 2's accordions, needs its own
  // tabIndex to be found here in DOM order instead.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      contentRef.current?.querySelector<HTMLElement>('input, textarea, select, [tabindex="0"]')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [step]);

  // ── Draft autosave ──
  const { drafts, saveDraft, removeDraft } = useRepairDrafts();
  // Resuming keeps the draft's own id, so edits update it instead of piling up copies.
  const [draftId, setDraftId] = useState(() => initialDraft?.id ?? newDraftId());

  // Every device model any past job has recorded — the dropdown's catalogue
  // is the shop's own history, not a hardcoded list. jobs is already
  // in-memory (RepairContext), so this is a client-side derive, not a
  // separate query.
  const historicalModels = useMemo(
    () => Array.from(new Set(jobs.map(j => j.model).filter((m): m is string => !!m?.trim()))),
    [jobs],
  );
  /**
   * Which models belong to which brand, from the reference table first and
   * this shop's own history second — the same order of trust the model-number
   * lookup uses, since history is where the wrong answers live.
   */
  const modelsByBrand = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (brand?: string, model?: string) => {
      const b = (brand ?? "").trim().toLowerCase();
      const m = (model ?? "").trim();
      if (!b || !m || b === "other") return;
      if (!map.has(b)) map.set(b, new Set());
      map.get(b)!.add(m);
    };
    for (const d of deviceModels) add(d.brand, d.model);
    for (const j of jobs) add(j.brand, j.model);
    return map;
  }, [deviceModels, jobs]);

  /**
   * Pick Samsung and the model list is Samsung's models, not all four hundred
   * the shop has ever seen. Falls back to everything when the brand is blank,
   * unrecognised, or has nothing recorded yet — an empty dropdown would be
   * worse than an unfiltered one, since the cashier could not even type past it.
   */
  const modelOptions = useMemo(() => {
    const all = Array.from(new Set([...historicalModels, ...sessionModels])).sort();
    const forBrand = modelsByBrand.get(form.deviceBrand.trim().toLowerCase());
    if (!forBrand || forBrand.size === 0) return all;
    return Array.from(new Set([...forBrand, ...sessionModels])).sort();
  }, [historicalModels, sessionModels, modelsByBrand, form.deviceBrand]);
  const addModel = (m: string) => {
    const v = m.trim();
    if (v && !historicalModels.includes(v) && !sessionModels.includes(v)) {
      setSessionModels((prev) => [...prev, v]);
    }
  };

  // Model-number → brand/model, learned the same way: whichever job most
  // recently recorded a given model number wins (jobs is ordered newest
  // first), so a number that was mis-typed once and corrected later doesn't
  // keep auto-filling the wrong device.
  const modelNumberLookup = useMemo(() => {
    const map = new Map<string, ModelInfo>();
    for (const j of jobs) {
      const raw = j.modelNumber?.trim();
      if (!raw) continue;
      const key = normaliseModelNumber(raw);
      if (!map.has(key)) map.set(key, { brand: j.brand, model: j.model });
    }
    return map;
  }, [jobs]);

  // Device model → brand, for suggesting a brand the moment a known model is
  // picked. Self-healing: a model's brand only ever gets recorded as "Other"
  // when nobody has typed the real one in yet, so the first *real* brand
  // found for that model (jobs is newest-first) always wins over "Other" —
  // one correct entry fixes the suggestion for every job after it, even
  // though older rows for the same model stay stuck at whatever they were
  // saved with.
  const modelBrandLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of jobs) {
      if (!j.model?.trim()) continue;
      const cur = map.get(j.model);
      if (cur === undefined) map.set(j.model, j.brand);
      else if (cur === "Other" && j.brand && j.brand !== "Other") map.set(j.model, j.brand);
    }
    return map;
  }, [jobs]);

  const historicalBrands = useMemo(
    () => Array.from(new Set(jobs.map(j => j.brand).filter((b): b is string => !!b?.trim() && b !== "Other"))),
    [jobs],
  );
  const [sessionBrands, setSessionBrands] = useState<string[]>([]);
  const brandOptions = useMemo(
    () => Array.from(new Set([...BRAND_OPTIONS, ...historicalBrands, ...sessionBrands])).sort(),
    [historicalBrands, sessionBrands],
  );
  const addBrand = (b: string) => {
    const v = b.trim();
    if (v && !brandOptions.includes(v)) setSessionBrands((prev) => [...prev, v]);
  };

  // Save the in-progress intake shortly after each edit. Debounced so a burst of
  // typing writes once, and skipped entirely for a blank or already-submitted form.
  useEffect(() => {
    if (createdJob || isPristine(form)) return;
    const t = setTimeout(() => {
      saveDraft({
        id: draftId,
        step,
        updatedAt: new Date().toISOString(),
        photoCount: form.intakePhotos.length,
        form: { ...form, intakePhotos: [] },
      });
    }, 700);
    return () => clearTimeout(t);
  }, [form, step, createdJob, draftId, saveDraft]);

  const savedDraft = drafts.find((d) => d.id === draftId);

  // Editing a flagged field clears its highlight straight away, so the warnings
  // fade as the cashier fills things in rather than lingering until the next click.
  const update = (partial: Partial<FormData>) => {
    setForm((f) => ({ ...f, ...partial }));
    setErrors((prev) => prev.filter((k) => !(k in partial)));
  };

  // Warranty lookup — does this device already have an active warranty?
  const existingWarranty = (() => {
    const imei = form.deviceIMEI.replace(/\s/g, "");
    const phone = form.customerContact.replace(/\s/g, "");
    if (!imei && !phone) return undefined;
    return warranties.find(w =>
      effectiveStatus(w) === "Active" &&
      ((imei && w.imei?.replace(/\s/g, "") === imei) ||
       (phone.length >= 7 && w.customerPhone.replace(/\s/g, "").endsWith(phone.slice(-7)))),
    );
  })();

  const isBlank = (f: RequiredField) => {
    // The job number is only required when the cashier is supplying it. With
    // auto-generate ticked the database picks it, so an empty box is correct.
    if (f === "jobNumber") return !form.autoJobNumber && form.jobNumber.trim() === "";
    const picked = dealers.find(x => String(x.id) === form.dealerId);
    const fromAnotherShop = !!picked && !picked.inHouse;
    // The customer panel is hidden for another shop's device, so requiring
    // fields nobody can see would trap the wizard on a step with nothing to fix.
    if (f === "customerName" || f === "customerContact") {
      if (fromAnotherShop) return false;
    }
    // The brand field is not on screen for an unidentifiable device, so
    // requiring it would block the wizard on a field nobody can fill in.
    if (f === "deviceBrand" && form.modelNumberUnavailable) return false;
    // Another shop's device is billed on their own docket, not ours — the
    // cost isn't necessarily known (or ours to quote) at intake, so it isn't
    // required the way it is for a job we're estimating and charging for.
    if (f === "estimatedCost" && fromAnotherShop) return false;
    const v = form[f];
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "boolean") return !v;
    return String(v ?? "").trim() === "";
  };

  /** Which required fields of a step are still empty. */
  const missingIn = (s: number) => (REQUIRED_BY_STEP[s] ?? []).filter(isBlank);

  /**
   * Flag the empty fields and take the cashier to the first one. The nav buttons
   * stay clickable — clicking is how you find out what's missing.
   */
  const flagMissing = (missing: RequiredField[]) => {
    setErrors(missing);
    setAttempt((a) => a + 1);
    requestAnimationFrame(() => {
      const el = contentRef.current?.querySelector<HTMLElement>(`[data-field="${missing[0]}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true });
    });
  };

  const handleNext = () => {
    const missing = missingIn(step);
    if (missing.length) { flagMissing(missing); return; }
    // A number this dealer has already used is as blocking as an empty one,
    // and cheaper to fix here than after the constraint rejects the insert.
    if (step === 1 && dealerNoCheck?.existing) { flagMissing(["dealerJobNo"]); return; }
    setErrors([]);
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    const missing = missingIn(2);
    if (missing.length) { flagMissing(missing); return; }
    if (dealerNoCheck?.existing) { setStep(1); flagMissing(["dealerJobNo"]); return; }
    setErrors([]);
    setSaving(true);
    setSaveError(null);

    const repairman = technicians.find(r => r.id === form.assignedRepairman);
    // The dealer picked in step 1 travels with the job — it drives the dealer
    // panel in Repair Management and whether the slip prints as a job receipt
    // (in-house) or a sales invoice billed to the dealer.
    const dealer = dealers.find(d => String(d.id) === form.dealerId);
    const issueFaults = [
      ...form.faultCheckboxes,
      ...(form.faultDescription.trim() ? [form.faultDescription.trim()] : []),
    ].join(", ") || "General Repair";

    try {
      const job = await addJob({
        // Omitted when auto-generating, so the column default assigns the next
        // RM number — the browser must not pick it or two counters could clash.
        ...(form.autoJobNumber ? {} : { id: form.jobNumber.trim() }),
      // A device from another shop has no end customer on file: the dealer
      // booked it, collects it, and is who we ring about it. Their details go
      // on the job so the receipt, the jobs list and every SMS still have a
      // real name and number rather than an empty column.
      customerName: form.customerName.trim()
        || (dealer && !dealer.inHouse ? dealer.name : "")
        || "Walk-in",
      phone: form.customerContact.trim() || (dealer && !dealer.inHouse ? dealer.contact : "") || "",
      // Optional: blank stays undefined so the column is NULL rather than an
      // empty string, which would look like an address the send path could use.
      customerEmail: form.customerEmail.trim() || undefined,
      // An unidentifiable device is "Other", full stop. Left to detectBrand,
      // a description like "Samsung clone" would be filed as a genuine Samsung
      // — and would then teach the model lookup that too.
      brand: form.modelNumberUnavailable
        ? "Other"
        : form.deviceBrand.trim() || detectBrand(form.deviceModel),
      model: form.deviceModel,
      modelNumber: form.deviceModelNumber || undefined,
      issue: issueFaults,
      technician: repairman?.name ?? "Unassigned",
      // Picked at the counter, so the technician stage records it as handed to
      // them rather than self-taken.
      assignmentSource: repairman ? "Assigned" : undefined,
      status: "Non-Issued",
      priority: form.jobPriority || "Normal",
      estimatedCost: parseFloat(form.estimatedCost) || 0,
      originalEstimate: parseFloat(form.estimatedCost) || 0,
      advancePaid: parseFloat(form.advancePaid) || 0,
      createdAt: new Date().toISOString().slice(0, 10),
      // Empty stays empty. It used to fall back to today, which turned "we do
      // not know yet" into "ready today" on the job card and the customer's
      // slip — a promise nobody made. Every date formatter already renders an
      // empty value as a dash.
      estimatedCompletion: form.estimatedCompletion,
      imei: form.deviceIMEI || undefined,
      dealer: dealer?.name ?? IN_HOUSE_DEALER,
      dealerId: dealer?.id,
      dealerJobNo: form.dealerJobNo.trim() || undefined,
      receivedItems: form.receivedItems.length ? form.receivedItems : undefined,
      cosmeticCondition: form.condition,
      // Photos are uploaded after the insert — the storage path needs the job
      // number, which the database assigns.
      intakePhotos: undefined,
      passcodeType: form.passcodeType,
      devicePasscode: form.passcode || undefined,
      customerConsentSignature: form.signature || undefined,
      termsVersionAccepted: form.termsAccepted ? TERMS_VERSION : undefined,
      });

      if (form.intakePhotos.length) {
        const paths = await uploadIntakePhotos(job.id, form.intakePhotos);
        if (paths.length) {
          updateJob(job.id, { intakePhotos: paths });
          job.intakePhotos = paths;
        }
      }

      // The device tag prints itself — no click needed. True zero-dialog
      // silence depends on the browser being launched with silent/kiosk
      // printing to the label printer; this just removes every step on our
      // side of that regardless.
      setAutoPrintJob(job);
      // The intake is now a real job — its draft has served its purpose.
      removeDraft(draftId);

      // Remember the dealer for the next intake. Written on success only: an
      // abandoned form should not change what the next one starts with.
      if (form.dealerId) {
        setLastDealerId(form.dealerId);
        try { window.localStorage.setItem(LAST_DEALER_KEY, form.dealerId); } catch { /* ignore */ }
      }

      // Teach the lookup what this model number turned out to be, so the next
      // device with the same number fills itself in. Deliberately fire and
      // forget, and deliberately picky about what counts as identified — see
      // rememberDeviceModel. A reference table that could not be updated must
      // never cost the shop a job it has already taken in.
      void rememberDeviceModel(job.modelNumber, job.brand, job.model)
        .then(() => reloadDeviceModels())
        .catch(() => { /* next intake tries again */ });

      if (dealer && !dealer.inHouse) {
        // An outside dealer's own docket is what they hand the customer —
        // our Job Receipt popup doesn't apply to their intake, so skip it
        // and go straight back to a blank wizard instead of waiting on a
        // "+ New Repair" click from a popup that never shows.
        toast.dialog("success", `Job ${job.id} created`, `${job.customerName} — ${job.brand} ${job.model}. The device tag will print automatically.`);
        startNewRepair();
      } else {
        toast.dialog("success", `Job ${job.id} created`, `${job.customerName} — ${job.brand} ${job.model}. Print the receipt or hand over the job number.`);
        setCreatedJob(job);
      }
    } catch (e) {
      // The wizard stays filled in and the draft survives, so nothing is lost
      // and the cashier can simply press Create again.
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(msg);
      toast.dialog("error", "Job not saved", msg, "Try again");
    } finally {
      setSaving(false);
    }
  };

  const startNewRepair = () => {
    // Straight into the next device from the same dealer — the case this whole
    // feature exists for. Set here rather than left to the effect above, whose
    // one-shot guard has already fired. Same existence check: a dealer deleted
    // mid-session must not leave the form pointing at nothing.
    const stillExists = dealers.some(d => String(d.id) === lastDealerId);
    setForm({ ...INITIAL, dealerId: stillExists ? lastDealerId : "" });
    // The job just saved moved the sequence on; the box has to follow it.
    refreshNextJobNo();
    setStep(1);
    setCreatedJob(null);
    setErrors([]);
    setDraftId(newDraftId());
  };

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        flex: 1, minHeight: 0,
        background: "var(--bg-primary)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >

      {showHistory && (
        <DeviceHistoryModal imei={imeiDigits} jobs={imeiHistory} onClose={() => setShowHistory(false)} />
      )}


      {wrongRole && (
        <div style={{
          display: "flex", gap: 10, padding: "12px 15px", borderRadius: 11,
          background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.4)",
        }}>
          <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <strong style={{ color: "#f87171" }}>You are signed in as {profile?.role}.</strong>{" "}
            Only a Cashier or an Admin can book in a repair — the database will refuse this job when
            you try to save it. Sign out and back in as the counter account first.
          </p>
        </div>
      )}
      {/* Active-warranty alert — surfaced once IMEI / phone is known */}
      {existingWarranty && (
        <div style={{ margin: "0 0 10px", display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderRadius: 10, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.3)" }}>
          <ShieldCheck size={15} color="#a78bfa" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
            <strong style={{ color: "#a78bfa" }}>Active warranty found</strong> — {existingWarranty.id} covering{" "}
            {existingWarranty.partsCovered.join(", ")} (expires {existingWarranty.expiresAt?.slice(0, 10)}). If this
            is the same fault, open a <strong>warranty claim</strong> in the Warranty Center instead of a paid job.
          </p>
        </div>
      )}

      {/* Step Content. No left padding — the "New Repair" card and step
          indicator above (rendered by RepairManagement, outside this
          component) sit flush against the page's own left margin with no
          inset of their own, so matching that here is what actually lines
          the panels up with them; padding on this side just pushed
          everything an extra 16–28px to the right of that reference. */}
      <div ref={contentRef} className="repair-wizard" style={{ flex: isMobile ? "none" : 1, padding: 0, minHeight: 0, overflowY: isMobile ? "visible" : "auto" }}>
        {step === 1 && <Step1 data={form} onChange={update} isMobile={isMobile} dealers={dealers} errors={errors} nextJobNo={nextJobNo} dealerNoCheck={dealerNoCheck} checkingDealerNo={checkingDealerNo} models={modelOptions} onAddModel={addModel} modelNumberLookup={modelNumberLookup} deviceModelLookup={deviceModelLookup} modelBrandLookup={modelBrandLookup} brands={brandOptions} onAddBrand={addBrand} imeiHistory={imeiHistory} checkingImei={checkingImei} onViewHistory={() => setShowHistory(true)} />}
        {step === 2 && <Step2 data={form} onChange={update} isMobile={isMobile} errors={errors} dealers={dealers} technicians={technicians} techLoading={techLoading} />}
      </div>

      {/* Backend failure — the form keeps its contents so Create can be retried */}
      {saveError && (
        <div style={{
          margin: "10px 0 0", padding: "10px 14px",
          display: "flex", alignItems: "flex-start", gap: 9, borderRadius: 10,
          background: "rgba(248, 113, 113, 0.08)", border: "1px solid rgba(248, 113, 113, 0.35)",
          flexShrink: 0,
        }}>
          <AlertCircle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--danger)" }}>Could not save this job:</strong> {saveError}
            <br />Nothing was lost — the intake is still here (and saved as a draft). Press Create again to retry.
          </p>
        </div>
      )}

      {/* Missing-field summary — appears only after a blocked Next / Create click */}
      {errors.length > 0 && (
        <div
          key={attempt}
          className="field-shake"
          style={{
            margin: "10px 0 0", padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 9, borderRadius: 10,
            background: "rgba(248, 113, 113, 0.08)", border: "1px solid rgba(248, 113, 113, 0.35)",
            flexShrink: 0,
          }}
        >
          <AlertCircle size={15} color="var(--danger)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--danger)" }}>Still needed:</strong>{" "}
            {errors.map((f) => FIELD_LABELS[f]).join(", ")}
          </p>
        </div>
      )}

      {/* Footer Navigation — horizontal padding dropped entirely to match
          the step content above (see contentRef's comment), so Back and
          Next Step line up flush with the panels on both sides instead of
          sitting inset from them. */}
      <div style={{
        padding: isMobile ? "12px 0" : "14px 0",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-card)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: isMobile ? 16 : 0,
      }}>
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          style={{
            padding: "9px 22px", borderRadius: 8, border: "1px solid var(--border)",
            background: "transparent", color: step === 1 ? "var(--border)" : "var(--text-secondary)",
            cursor: step === 1 ? "not-allowed" : "pointer", fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, transition: "all 0.15s",
          }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2].map((s) => (
              <div key={s} style={{
                width: s === step ? 20 : 6, height: 6, borderRadius: 3,
                background: s <= step ? "var(--accent)" : "var(--border)",
                transition: "all 0.2s",
              }} />
            ))}
          </div>
          {savedDraft && !createdJob && (
            <span style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 10,
              color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif",
              whiteSpace: "nowrap",
            }}>
              <FileClock size={10} /> Draft saved {fmtSaved(savedDraft.updatedAt)}
            </span>
          )}
        </div>

        {step < 2 ? (
          <button
            onClick={handleNext}
            style={{
              padding: "9px 22px", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "var(--accent-fg)",
              cursor: "pointer",
              fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700,
              transition: "all 0.15s",
            }}
          >
            Next Step →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "var(--accent-fg)",
              cursor: saving ? "wait" : "pointer", opacity: saving ? 0.75 : 1,
              fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700, transition: "all 0.15s",
            }}
          >
            {saving ? "Saving…" : "✓ Create Repair Job"}
          </button>
        )}
      </div>

      {createdJob && <JobReceiptPopup job={createdJob} onNew={startNewRepair} onClose={onClose} />}
      {autoPrintJob && (
        <BarcodeLabelModal
          silent
          variant="repair"
          jobId={autoPrintJob.id}
          dealerJobNo={autoPrintJob.dealerJobNo}
          outsideDealer={!isInHouseDealer(dealers, autoPrintJob)}
          code={autoPrintJob.id}
          title={`${autoPrintJob.brand} ${autoPrintJob.model}`.trim()}
          subtitle={autoPrintJob.customerName}
          onClose={() => setAutoPrintJob(null)}
        />
      )}
    </div>
  );
}

// ─── Job-created popup with printable receipt ─────────────────────────────────

/** The dialog gives up and closes itself after this much dead time. */
const RECEIPT_IDLE_MS = 10 * 60 * 1000;

function JobReceiptPopup({ job, onNew, onClose }: { job: RepairJob; onNew: () => void; onClose?: () => void }) {
  const slipRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { backend } = useRepair();

  // Dismissing hands the counter back a blank intake for the next customer; the
  // job itself is already saved, so nothing is lost by closing.
  const dismiss = onClose ?? onNew;
  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; });

  // Close on 10 minutes of no interaction, so a receipt left on screen at the
  // counter doesn't sit there all day. Any input anywhere restarts the clock.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let last = 0;
    const restart = () => {
      const now = Date.now();
      if (now - last < 5000) return; // throttle: mousemove fires constantly
      last = now;
      clearTimeout(timer);
      timer = setTimeout(() => dismissRef.current(), RECEIPT_IDLE_MS);
    };
    restart();
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, restart, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, restart));
    };
  }, []);

  const handlePrint = () => {
    if (!slipRef.current) return;
    const el = document.createElement("div"); el.id = "__jobslip__"; el.innerHTML = slipRef.current.outerHTML;
    document.body.appendChild(el);
    const st = document.createElement("style"); st.id = "__jobslip_style__";
    st.textContent = `@page{size:A5 landscape;margin:0}#__jobslip__{display:none}@media print{body{visibility:hidden}#__jobslip__{display:block!important;visibility:visible;position:fixed;top:0;left:0;width:100%}#__jobslip__ *{visibility:visible}}`;
    document.head.appendChild(st); window.print();
    setTimeout(() => { document.getElementById("__jobslip__")?.remove(); document.getElementById("__jobslip_style__")?.remove(); }, 500);
  };

  // Portalled to <body> like every other modal in the app: the section wrapper
  // this form sits in carries a `.fade-up` transform, and a transformed ancestor
  // becomes the containing block for `position: fixed`, which would otherwise pin
  // the overlay to the panel instead of the viewport.
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
    }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, width: "min(820px, calc(100vw - 24px))", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.55)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ padding: "22px 24px 14px", textAlign: "center", flexShrink: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "2px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <CheckCircle2 size={24} color="#4ade80" />
          </div>
          <p style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)" }}>Repair Job Created</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Job <strong style={{ color: "var(--accent)" }}>{job.id}</strong> · {job.brand} {job.model}
          </p>
          {backend === "local" && (
            <p style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.5,
              background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)",
              color: "var(--text-secondary)",
            }}>
              <strong style={{ color: "var(--warning)" }}>Demo mode — this job was NOT saved.</strong>{" "}
              Supabase isn&apos;t configured, so it exists in this browser tab only and will be gone on reload.
            </p>
          )}
        </div>

        {/* The receipt exactly as it will print — this element is what gets printed */}
        <div style={{
          flex: 1, minHeight: 0, overflow: "auto", margin: "0 20px",
          border: "1px solid var(--border)", borderRadius: 10, background: "#e9e9e9",
          padding: 12, display: "flex", justifyContent: "center",
        }}>
          <div style={{
            // The slip is a fixed 718px (A5 landscape); shrink it to fit narrow screens.
            transform: isMobile ? "scale(0.46)" : "scale(0.98)",
            transformOrigin: "top center",
            width: 718, flexShrink: 0,
            boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
          }}>
            <JobReceiptPrintable ref={slipRef} job={job} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
          <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <Printer size={16} /> Print Job Receipt
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onNew} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              + New Repair
            </button>
            <button onClick={dismiss} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Cancel
            </button>
          </div>
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "center" }}>
            Job <strong>{job.id}</strong> is saved either way — this dialog closes on its own after 10 minutes of inactivity.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}