"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";
import { previewNextJobNo, checkDealerJobNo, type DealerJobNoCheck } from "@/lib/repair/api";
import { useRepair, IN_HOUSE_DEALER, type ConditionGrade, type DeviceConditionMap, type JobPriority, type RepairJob, type RepairDealer } from "@/cashier/contexts/RepairContext";
import { useWarranty, effectiveStatus } from "@/cashier/contexts/WarrantyContext";
import { usePersistentState } from "@/cashier/hooks/usePersistentState";
import { useRepairDrafts, newDraftId, fmtSaved, type RepairDraft, type RepairFormData as FormData } from "@/cashier/hooks/useRepairDrafts";
import SignaturePad from "@/cashier/components/shared/SignaturePad";
import JobReceiptPrintable from "@/cashier/components/repair/JobReceiptPrintable";
import { uploadIntakePhotos } from "@/lib/repair/api";
import { useToast } from "@/lib/ui/toast";
import { useTechnicians, type Technician } from "@/lib/repair/technicians";
import Combobox from "@/cashier/components/shared/Combobox";
import BarcodeLabelModal from "@/cashier/components/shared/BarcodeLabelModal";
import { lookupModelNumber } from "@/cashier/data/modelNumbers";
import { ShieldCheck, Camera, Lock, X as XIcon, Hash, Printer, CheckCircle2, AlertCircle, FileClock } from "lucide-react";

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

const COMMON_FAULTS = [
  "Screen Cracked / Broken",
  "Screen Not Displaying",
  "Touch Not Working",
  "Battery Draining Fast",
  "Won't Turn On / Dead",
  "Charging Port Faulty",
  "Speaker / Mic Issue",
  "Camera Not Working",
  "Software / Bootloop",
  "Water Damage",
  "Overheating",
  "Signal / Network Issue",
];

const DEVICE_MODELS: string[] = [];

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Dealer & Customer" },
  { num: 2, label: "Device & Faults" },
  { num: 3, label: "Costs & Job Info" },
  { num: 4, label: "Assign Repairman" },
  { num: 5, label: "Evidence & Sign" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 18 }}>
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
  | "deviceModel"                        // step 2
  | "estimatedCost"                      // step 3
  | "termsAccepted";                     // step 5

// Intake photos and the customer signature are deliberately absent: they are
// strongly recommended evidence, but a job can be booked in without them.
// Terms acceptance is the one thing step 5 blocks on.
const REQUIRED_BY_STEP: Record<number, RequiredField[]> = {
  1: ["jobNumber", "dealerJobNo", "customerName", "customerContact"],
  2: [],
  3: ["estimatedCost"],
  5: ["termsAccepted"],
};

const FIELD_LABELS: Record<RequiredField, string> = {
  jobNumber: "Job Number",
  dealerJobNo: "Dealer's Job Number",
  customerName: "Full Name",
  customerContact: "Contact Number",
  deviceModel: "Device Model",
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

function Step1({ data, onChange, isMobile, dealers, errors, nextJobNo, dealerNoCheck, checkingDealerNo }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; dealers: RepairDealer[]; errors: RequiredField[]; nextJobNo: string | null; dealerNoCheck: DealerJobNoCheck | null; checkingDealerNo: boolean }) {
  const dealer = dealers.find((d) => d.id.toString() === data.dealerId);
  const bad = (f: RequiredField) => errors.includes(f);

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      {/* Left: Dealer */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🏪 Dealer Information</div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Select Dealer</label>
          <Combobox
            value={dealer?.name ?? ""}
            options={dealers.map((d) => d.name)}
            allowAdd={false}
            placeholder={dealers.length ? "— Choose a dealer —" : "No dealers — add them in Admin Control"}
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
          <div>
            <label style={labelStyle}>Address</label>
            <input readOnly style={{ ...inputStyle, background: "var(--bg-primary)" }} value={dealer?.address ?? ""} placeholder="Select dealer above" />
          </div>
          <div>
            <label style={labelStyle}>Contact Number</label>
            <input readOnly style={{ ...inputStyle, background: "var(--bg-primary)" }} value={dealer?.contact ?? ""} placeholder="—" />
          </div>
          <div>
            <label style={labelStyle}>Joining Date</label>
            <input readOnly style={{ ...inputStyle, background: "var(--bg-primary)" }} value={dealer ? fmtJoined(dealer.joinedAt) : ""} placeholder="—" />
          </div>
          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea
              readOnly
              style={{ ...inputStyle, background: "var(--bg-primary)", resize: "none", minHeight: 64 }}
              value={dealer?.remarks ?? ""}
            />
          </div>
        </div>
      </div>

      {/* Right: this job — the numbers it is filed under, then whose it is.
          The left panel is about the dealer as a business; these two belong to
          the repair in front of you, which is why they sit together here.

          Below them: our own walk-ins get the full customer form. A device sent
          by another shop belongs to that shop as far as we are concerned — they
          booked it, they collect it, they are who we ring — so asking for an end
          customer we will never meet is a field nobody can fill in. */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>📄 Job & Customer Details</div>
        {/* ── Job number ── */}
        <div style={{ marginBottom: 14 }} data-field="jobNumber" className={bad("jobNumber") ? "field-shake" : undefined}>
          <label style={labelStyle}>Job Number</label>
          <input
            style={{
              ...inputStyle,
              ...(bad("jobNumber") ? invalidStyle : {}),
              ...(data.autoJobNumber ? { background: "var(--bg-primary)", color: "var(--text-secondary)" } : {}),
            }}
            // While auto-generating, fall back to the preview so the box shows
            // the number that is coming rather than sitting blank. Derived
            // rather than written into state: nothing needs saving, and the
            // real number is still assigned by the sequence on insert.
            value={data.autoJobNumber ? (data.jobNumber || nextJobNo || "") : data.jobNumber}
            placeholder={data.autoJobNumber ? "Assigned on save" : "e.g. 54000 — the dealer's own number"}
            onChange={(e) => {
              // Typing is itself the decision to supply a number, so the tick
              // clears rather than the box being locked until it is unticked.
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

          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5, lineHeight: 1.5 }}>
            {data.autoJobNumber
              ? <>The next number in our own sequence{nextJobNo ? <> — likely <strong>{nextJobNo}</strong></> : null}. The database assigns it on save, so two counters can never take the same one.</>
              : <>Our internal number for this repair. It goes on the tag and must not already be in use.</>}
          </div>
          <FieldError show={bad("jobNumber")}>Enter the job number, or tick to generate one</FieldError>
        </div>

        {/* ── The dealer's own number, when the device came from another shop ── */}
        {dealer && !dealer.inHouse && (
          <div style={{ marginBottom: 14 }} data-field="dealerJobNo" className={bad("dealerJobNo") ? "field-shake" : undefined}>
            <label style={labelStyle}>{dealer.name}&apos;s Job Number</label>
            <input
              // Red the moment a clash is known, without waiting for a failed
              // Next — the number is wrong now, not when the wizard says so.
              style={{ ...inputStyle, ...(bad("dealerJobNo") || dealerNoCheck?.existing ? invalidStyle : {}) }}
              value={data.dealerJobNo}
              placeholder="e.g. 54000 — the number on their docket"
              onChange={(e) => onChange({ dealerJobNo: e.target.value })}
            />
            {/* Caught while typing, not at save: correcting a digit here beats
                redoing five steps of intake after the constraint rejects it. */}
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
            ) : (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5, lineHeight: 1.5 }}>
                {checkingDealerNo
                  ? "Checking…"
                  : <>Searchable alongside our own number, so the phone can be found by whichever one is quoted.
                      Two dealers may use the same number; it only has to be unique within {dealer.name}.</>}
              </div>
            )}
            <FieldError show={bad("dealerJobNo") && !dealerNoCheck?.existing}>Enter the number on {dealer.name}&apos;s docket</FieldError>
          </div>
        )}

      {(!dealer || dealer.inHouse) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div data-field="customerName" className={bad("customerName") ? "field-shake" : undefined}>
            <label style={labelStyle}>Full Name *</label>
            <input
              style={{ ...inputStyle, ...(bad("customerName") ? invalidStyle : {}) }}
              placeholder="e.g. Kasun Perera"
              value={data.customerName}
              onChange={(e) => onChange({ customerName: e.target.value })}
            />
            <FieldError show={bad("customerName")}>Enter the customer&apos;s full name</FieldError>
          </div>
          <div>
            <label style={labelStyle}>NIC Number</label>
            <input
              style={inputStyle}
              placeholder="e.g. 199912345678"
              value={data.customerNIC}
              onChange={(e) => onChange({ customerNIC: e.target.value })}
            />
          </div>
          <div data-field="customerContact" className={bad("customerContact") ? "field-shake" : undefined}>
            <label style={labelStyle}>Contact Number *</label>
            <input
              style={{ ...inputStyle, ...(bad("customerContact") ? invalidStyle : {}) }}
              placeholder="e.g. 077 123 4567"
              value={data.customerContact}
              onChange={(e) => onChange({ customerContact: e.target.value })}
            />
            <FieldError show={bad("customerContact")}>Enter a contact number</FieldError>
          </div>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              style={inputStyle}
              placeholder="e.g. customer@email.com"
              type="email"
              value={data.customerEmail}
              onChange={(e) => onChange({ customerEmail: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            This device was sent in by <strong style={{ color: "var(--text-primary)" }}>{dealer.name}</strong>,
            so they are recorded as the customer on the job — updates and the receipt go to them,
            not to whoever owns the phone.
          </p>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--text-muted)", minWidth: 62 }}>Contact</span>
              <span style={{ color: "var(--text-primary)" }}>{dealer.contact || "— none on file"}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--text-muted)", minWidth: 62 }}>Address</span>
              <span style={{ color: "var(--text-primary)" }}>{dealer.address || "— none on file"}</span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.55 }}>
            Edit these under Admin Control → Repair Dealers.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Step 2: Device & Faults ──────────────────────────────────────────────────

function Step2({ data, onChange, isMobile, models, onAddModel, errors }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; models: string[]; onAddModel: (m: string) => void; errors: RequiredField[] }) {
  const bad = (f: RequiredField) => errors.includes(f);
  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  // When a model number is entered, try to resolve the device model.
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const handleModelNumber = (raw: string) => {
    onChange({ deviceModelNumber: raw });
    const hit = lookupModelNumber(raw);
    if (hit) {
      onChange({ deviceModelNumber: raw, deviceModel: hit.model });
      // make sure the resolved model is in the combobox list
      if (!models.includes(hit.model)) onAddModel(hit.model);
      setLookupResult(`${hit.brand} ${hit.model}`);
    } else {
      setLookupResult(raw.trim() ? "no-match" : null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      {/* Left: Device Info & Received Items */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>📱 Device Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}><Hash size={11} style={{ verticalAlign: "-1px" }} /> Model Number</label>
            <input
              style={inputStyle}
              placeholder="e.g. M2006C3LMG — auto-fills the model"
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
          <div data-field="deviceModel" className={bad("deviceModel") ? "field-shake" : undefined}>
            <label style={labelStyle}>Device Model</label>
            <Combobox
              value={data.deviceModel}
              options={models}
              onAddOption={onAddModel}
              placeholder="Type or select a model…"
              inputStyle={bad("deviceModel") ? invalidStyle : undefined}
              onChange={(m) => onChange({ deviceModel: m })}
            />
            <FieldError show={bad("deviceModel")}>Select or type the device model</FieldError>
          </div>
          <div>
            <label style={labelStyle}>IMEI Number</label>
            <input
              style={inputStyle}
              placeholder="15-digit IMEI"
              maxLength={15}
              value={data.deviceIMEI}
              onChange={(e) => onChange({ deviceIMEI: e.target.value.replace(/\D/g, "") })}
            />
          </div>
        </div>

        <div style={sectionHeaderStyle}>📦 Items Received With Device</div>
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
      </div>

      {/* Right: Faults */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🔧 Device Faults</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6, marginBottom: 18 }}>
          {COMMON_FAULTS.map((fault) => {
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
            placeholder="Describe any additional issues or customer-reported symptoms in detail..."
            value={data.faultDescription}
            onChange={(e) => onChange({ faultDescription: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Costs & Job Info ─────────────────────────────────────────────────

function Step3({ data, onChange, isMobile, errors }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; errors: RequiredField[] }) {
  const bad = (f: RequiredField) => errors.includes(f);
  const estimated = parseFloat(data.estimatedCost) || 0;
  const advance = parseFloat(data.advancePaid) || 0;
  const balance = estimated - advance;

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      {/* Left: Financials */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>💰 Cost & Payment</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div data-field="estimatedCost" className={bad("estimatedCost") ? "field-shake" : undefined}>
            <label style={labelStyle}>Estimated Repair Cost (LKR) *</label>
            <input
              style={{ ...inputStyle, ...(bad("estimatedCost") ? invalidStyle : {}) }}
              type="number"
              min={0}
              placeholder="0.00"
              value={data.estimatedCost}
              onChange={(e) => onChange({ estimatedCost: e.target.value })}
            />
            <FieldError show={bad("estimatedCost")}>Enter an estimated cost (0 if not yet quoted)</FieldError>
          </div>
          <div>
            <label style={labelStyle}>Advance Received (LKR)</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              placeholder="0.00"
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
              placeholder="— Select Method —"
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

      {/* Right: Job Info */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>📋 Job Details</div>
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
              placeholder="Add any internal notes about this job, special handling instructions, customer preferences, etc."
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
      </div>
    </div>
  );
}

// ─── Step 4: Assign Repairman ─────────────────────────────────────────────────

function Step4({ data, onChange, isMobile, technicians, techLoading }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; technicians: Technician[]; techLoading: boolean }) {
  const { jobs } = useRepair();
  // Live workload rather than a hard-coded number, so the cashier can see who is
  // actually loaded up before assigning.
  const workload = (name: string) =>
    jobs.filter(j => j.technician === name && (j.status === "Issued" || j.status === "Pending")).length;

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      <div style={{ ...panelStyle, flex: 1.3 }}>
        <div style={sectionHeaderStyle}>🛠️ Available Repairmen</div>

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

      <div style={{ ...panelStyle, flex: 1 }}>
        <div style={sectionHeaderStyle}>📅 Schedule & Completion</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Estimated Completion Date</label>
            <input
              type="date"
              style={inputStyle}
              value={data.estimatedCompletion}
              onChange={(e) => onChange({ estimatedCompletion: e.target.value })}
            />
          </div>

          {data.assignedRepairman && (
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: "rgba(var(--accent-rgb, 232,232,232), 0.06)",
              border: "1px solid var(--accent)",
            }}>
              {(() => {
                const r = technicians.find((rm) => rm.id === data.assignedRepairman);
                return r ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Assigned to
                      </span>
                      <button
                        type="button"
                        onClick={() => onChange({ assignedRepairman: "" })}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6,
                          border: "1px solid var(--border)", background: "transparent", cursor: "pointer",
                          fontSize: 10.5, fontWeight: 600, color: "var(--text-secondary)",
                          fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.border = "1px solid var(--danger)"; e.currentTarget.style.color = "var(--danger)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.border = "1px solid var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                      >
                        <XIcon size={10} /> Unassign
                      </button>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-primary)", marginBottom: 4 }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {r.speciality}
                    </div>
                  </>
                ) : null;
              })()}
            </div>
          )}

          <div style={{
            marginTop: "auto", padding: "14px 16px", borderRadius: 10,
            background: "var(--bg-primary)", border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--text-secondary)", marginBottom: 10 }}>
              REPAIR SUMMARY
            </div>
            {[
              ["Repairman", technicians.find((r) => r.id === data.assignedRepairman)?.name ?? "Not assigned"],
              ["Completion", data.estimatedCompletion || "Not set"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Evidence & Sign ──────────────────────────────────────────────────

function Step5({ data, onChange, isMobile, errors }: { data: FormData; onChange: (d: Partial<FormData>) => void; isMobile?: boolean; errors: RequiredField[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const bad = (f: RequiredField) => errors.includes(f);

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

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: isMobile ? "stretch" : "flex-start" }}>
      {/* Left: Condition + Passcode */}
      <div style={panelStyle}>
        <div style={sectionHeaderStyle}>🩹 Device Cosmetic Condition</div>
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
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Condition Notes</label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: 56 }}
            placeholder="e.g. deep scratch top-left corner, small dent on right frame…"
            value={data.condition.notes ?? ""}
            onChange={e => onChange({ condition: { ...data.condition, notes: e.target.value } })}
          />
        </div>

        <div style={sectionHeaderStyle}><Lock size={12} style={{ verticalAlign: "-1px" }} /> Device Unlock</div>
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
                placeholder={data.passcodeType === "Pattern" ? "e.g. 1-2-3-6-9" : "Enter unlock code"}
                value={data.passcode}
                onChange={e => onChange({ passcode: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Photos + Terms + Signature */}
      <div style={panelStyle}>
        <div style={{ marginBottom: 16 }}>
          <div style={sectionHeaderStyle}><Camera size={12} style={{ verticalAlign: "-1px" }} /> Intake Photos</div>
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
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Optional, but strongly recommended: front, back, and both sides — photos are your
            evidence of the device&apos;s state at drop-off.
          </p>
        </div>

        {/* Terms */}
        <div data-field="termsAccepted" className={bad("termsAccepted") ? "field-shake" : undefined} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-primary)", border: `1px solid ${bad("termsAccepted") ? "var(--danger)" : "var(--border)"}`, marginBottom: 14 }}>
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

        <SignaturePad value={data.signature} onChange={s => onChange({ signature: s })} label="Customer Signature" />
      </div>
    </div>
  );
}

// ─── Main Form Component ──────────────────────────────────────────────────────

const INITIAL: FormData = {
  dealerId: "", jobNumber: "", autoJobNumber: true, dealerJobNo: "",
  customerName: "", customerNIC: "", customerContact: "", customerEmail: "",
  deviceModel: "", deviceModelNumber: "", deviceIMEI: "", receivedItems: [], faultCheckboxes: [], faultDescription: "",
  estimatedCost: "", advancePaid: "", paymentMethod: "", jobPriority: "Normal", jobNotes: "",
  assignedRepairman: "", estimatedCompletion: "",
  condition: { front: "Good", back: "Good", frame: "Good", camera: "Good", ports: "Good", buttons: "Good" },
  intakePhotos: [], passcodeType: "None", passcode: "", signature: "", termsAccepted: true,
};

/** A blank wizard is never worth saving as a draft. */
const isPristine = (f: FormData) => JSON.stringify(f) === JSON.stringify(INITIAL);

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

/**
 * `initialDraft` resumes a saved intake — the Drafts section passes one in and
 * switches to this tab, and the wizard opens on the step it was left at. Photos
 * are never part of a draft, so they always start empty.
 */
export default function NewRepairForm({ onClose, initialDraft }: { onClose?: () => void; initialDraft?: RepairDraft | null }) {
  const { addJob, updateJob, dealers } = useRepair();
  // Shown in the job-number box so the cashier can see what will be assigned.
  // Advisory only — the sequence, not this value, decides on save.
  const [nextJobNo, setNextJobNo] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    previewNextJobNo()
      .then(v => { if (active) setNextJobNo(v); })
      .catch(() => { /* the box just shows a placeholder instead */ });
    return () => { active = false; };
  }, []);
  const { technicians, loading: techLoading } = useTechnicians();
  const toast = useToast();
  const { warranties } = useWarranty();
  const [customModels, setCustomModels] = usePersistentState<string[]>("mano_custom_models", []);
  const [step, setStep] = useState(initialDraft?.step ?? 1);
  const [form, setForm] = useState<FormData>(
    initialDraft ? { ...INITIAL, ...initialDraft.form, intakePhotos: [] } : INITIAL,
  );

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
  // rows and Step 2's checkbox grids (real <input>/<textarea>/<select> only
  // covers text fields — a step whose first control is one of those custom
  // rows, e.g. Step 4's technician list ahead of the completion-date input,
  // needs its own tabIndex to be found here in DOM order instead.
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

  // Base catalogue + any models the user has typed/saved before.
  const modelOptions = [...new Set([...DEVICE_MODELS, ...customModels])].sort();
  const addModel = (m: string) => {
    const v = m.trim();
    if (v && !DEVICE_MODELS.includes(v) && !customModels.includes(v)) {
      setCustomModels((prev) => [...prev, v]);
    }
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
    // Only asked for when the device belongs to another shop; our own walk-ins
    // have no dealer docket to copy a number from.
    const picked = dealers.find(x => String(x.id) === form.dealerId);
    const fromAnotherShop = !!picked && !picked.inHouse;
    if (f === "dealerJobNo") return fromAnotherShop && form.dealerJobNo.trim() === "";
    // The customer panel is hidden for another shop's device, so requiring
    // fields nobody can see would trap the wizard on a step with nothing to fix.
    if (f === "customerName" || f === "customerContact") {
      if (fromAnotherShop) return false;
    }
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

  // Step 4 (assigning a repairman) is optional — the job can be booked in and
  // handed to a technician later, so the button says so when nobody is picked.
  const nextLabel = step === 4 && !form.assignedRepairman.trim() ? "Skip This Step →" : "Next Step →";

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
    const missing = missingIn(5);
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
      brand: detectBrand(form.deviceModel),
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
      estimatedCompletion: form.estimatedCompletion || new Date().toISOString().slice(0, 10),
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

      toast.dialog("success", `Job ${job.id} created`, `${job.customerName} — ${job.brand} ${job.model}. Print the receipt or hand over the job number.`);
      setCreatedJob(job);
      // The device tag prints itself — no click needed. True zero-dialog
      // silence depends on the browser being launched with silent/kiosk
      // printing to the label printer; this just removes every step on our
      // side of that regardless.
      setAutoPrintJob(job);
      // The intake is now a real job — its draft has served its purpose.
      removeDraft(draftId);
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
    setForm(INITIAL);
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
      

      {/* Step Indicator */}
      <div style={{ padding: isMobile ? "14px 16px 8px" : "20px 28px 10px", flexShrink: 0 }}>
        <StepIndicator current={step} />
      </div>

      {/* Active-warranty alert — surfaced once IMEI / phone is known */}
      {existingWarranty && (
        <div style={{ margin: isMobile ? "0 16px 10px" : "0 28px 10px", display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderRadius: 10, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.3)" }}>
          <ShieldCheck size={15} color="#a78bfa" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 }}>
            <strong style={{ color: "#a78bfa" }}>Active warranty found</strong> — {existingWarranty.id} covering{" "}
            {existingWarranty.partsCovered.join(", ")} (expires {existingWarranty.expiresAt?.slice(0, 10)}). If this
            is the same fault, open a <strong>warranty claim</strong> in the Warranty Center instead of a paid job.
          </p>
        </div>
      )}

      {/* Step Content */}
      <div ref={contentRef} className="repair-wizard" style={{ flex: isMobile ? "none" : 1, padding: isMobile ? "0 16px" : "0 28px", minHeight: 0, overflowY: isMobile ? "visible" : "auto" }}>
        {step === 1 && <Step1 data={form} onChange={update} isMobile={isMobile} dealers={dealers} errors={errors} nextJobNo={nextJobNo} dealerNoCheck={dealerNoCheck} checkingDealerNo={checkingDealerNo} />}
        {step === 2 && <Step2 data={form} onChange={update} isMobile={isMobile} models={modelOptions} onAddModel={addModel} errors={errors} />}
        {step === 3 && <Step3 data={form} onChange={update} isMobile={isMobile} errors={errors} />}
        {step === 4 && <Step4 data={form} onChange={update} isMobile={isMobile} technicians={technicians} techLoading={techLoading} />}
        {step === 5 && <Step5 data={form} onChange={update} isMobile={isMobile} errors={errors} />}
      </div>

      {/* Backend failure — the form keeps its contents so Create can be retried */}
      {saveError && (
        <div style={{
          margin: isMobile ? "10px 16px 0" : "10px 28px 0", padding: "10px 14px",
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
            margin: isMobile ? "10px 16px 0" : "10px 28px 0", padding: "10px 14px",
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

      {/* Footer Navigation */}
      <div style={{
        padding: isMobile ? "12px 16px" : "14px 28px",
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
            {[1, 2, 3, 4, 5].map((s) => (
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

        {step < 5 ? (
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
            {nextLabel}
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