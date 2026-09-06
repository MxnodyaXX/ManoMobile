"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { useDeviceModelLookup } from "@/lib/repair/deviceModels";
import { useDeviceBrands } from "@/lib/repair/brands";
import { normaliseModelNumber, lookupModelNumber } from "@/cashier/data/modelNumbers";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

/**
 * The device identity fields, but only the ones this job is missing.
 *
 * Most handsets carry neither the model number nor the IMEI anywhere the
 * counter can see, so intake books them in blank. The technician is the first
 * person who can read them — off the boot screen, out of settings, or from the
 * label under a shield once the back is off.
 *
 * What is asked for is decided by the job, not by what has been typed so far:
 * a field must not vanish mid-edit because the value it wanted just arrived.
 * A job that already has both renders nothing at all.
 */

/** Sentinel for the escape option. Not a brand, and never stored as one. */
const TYPE_IT = "__type__";

export interface DeviceDraft {
  modelNumber: string;
  brand: string;
  model: string;
  imei: string;
  /**
   * Why nothing could be read off the device, or "" when it could.
   *
   * Saved instead of the fields, not alongside them: a job that carries both a
   * model number and a reason it has none is telling two stories.
   */
  unavailableReason: string;
}

export const draftFromJob = (job: RepairJob): DeviceDraft => ({
  modelNumber: job.modelNumber ?? "",
  brand: job.brand ?? "",
  model: job.model ?? "",
  imei: job.imei ?? "",
  unavailableReason: job.deviceUnidentifiedReason ?? "",
});

/**
 * Why a device cannot be identified.
 *
 * The four real ones a bench actually meets, then Other. Fixed options because
 * they are worth counting later — "how many dead handsets came in this month"
 * is answerable from a list and not from free text.
 */
export const UNAVAILABLE_REASONS = [
  "Device has no power",
  "Display not working",
  "Device locked / inaccessible",
  "Physical damage prevents identification",
];

/** Which halves this job still needs. Read once from the job, never from the
 *  draft, so the panel does not rearrange itself while it is being filled in. */
export const missingOn = (job: RepairJob) => ({
  modelNumber: !(job.modelNumber ?? "").trim(),
  imei: !(job.imei ?? "").trim(),
});

export const nothingMissing = (job: RepairJob) => {
  const m = missingOn(job);
  return !m.modelNumber && !m.imei;
};

const ff = "'Plus Jakarta Sans', sans-serif";
const TA = "#34d399";

export default function DeviceDetailsFields({ job, value, onChange, inputStyle }: {
  job: RepairJob;
  value: DeviceDraft;
  onChange: (next: DeviceDraft) => void;
  inputStyle: React.CSSProperties;
}) {
  const { lookup: deviceModelLookup } = useDeviceModelLookup();
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const brandOptions = useDeviceBrands();
  // Set only when the technician picks "Other" — a brand the registry and the
  // job history between them have never seen.
  const [typing, setTyping] = useState(false);
  const imeiRef = useRef<HTMLInputElement>(null);

  const need = missingOn(job);

  // Whether the technician has said the device cannot be read. Derived from
  // the draft rather than held separately, so reopening the form shows what
  // was already recorded instead of an empty checkbox over a saved reason.
  const unavailable = value.unavailableReason !== "";
  const preset = UNAVAILABLE_REASONS.includes(value.unavailableReason);

  const cap: React.CSSProperties = {
    fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 3,
  };

  /**
   * Resolve a model number to a brand and model, the way intake does.
   *
   * Same two sources in the same order: the corrected reference table first,
   * then the built-in list. A number nobody recognises is not an error — plenty
   * of handsets are not in either list, and the technician can still type the
   * brand and model themselves.
   */
  const applyModelNumber = (raw: string) => {
    const key = normaliseModelNumber(raw);
    const hit = deviceModelLookup.get(key) ?? lookupModelNumber(raw) ?? null;
    if (hit) {
      onChange({ ...value, modelNumber: raw, brand: hit.brand, model: hit.model });
      setLookupResult(`${hit.brand} ${hit.model}`);
      // Brand and model are answered, so the only thing left to read off the
      // handset is the IMEI — go there rather than making the technician tab
      // past two fields that just filled themselves in. After paint, because
      // the field is rendered by the same update that resolved the number.
      requestAnimationFrame(() => imeiRef.current?.focus());
    } else {
      onChange({ ...value, modelNumber: raw });
      setLookupResult(raw.trim() ? "no-match" : null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/*
        Not inferred from the reported fault: "no power" at intake is what the
        customer said, and the technician's diagnosis is the fact. The two
        disagree often enough that guessing from the first would be wrong on
        real jobs.

        These fields were already optional, so this changes nothing about what
        is allowed. What it changes is that a blank now says which kind of
        blank it is — nobody has looked yet, or somebody looked and it cannot
        be known.
      */}
      <label style={{
        display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer",
        padding: "9px 11px", borderRadius: 9,
        background: unavailable ? "rgba(251,191,36,0.08)" : "var(--bg-secondary)",
        border: `1px solid ${unavailable ? "rgba(251,191,36,0.4)" : "var(--border)"}`,
      }}>
        <input
          type="checkbox"
          checked={unavailable}
          onChange={e => onChange({
            ...value,
            // Clearing the fields on the way in: a saved model number sitting
            // under "cannot be identified" is a contradiction somebody would
            // have to resolve later without knowing which half was true.
            ...(e.target.checked ? { modelNumber: "", imei: "" } : {}),
            unavailableReason: e.target.checked ? UNAVAILABLE_REASONS[0] : "",
          })}
          style={{ width: 14, height: 14, accentColor: "#fbbf24", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>
            Unable to identify this device
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.5 }}>
            Tick this instead of guessing. Nothing here is required — an invented model number is harder to undo than an empty one.
          </span>
        </span>
      </label>

      {unavailable && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <p style={cap}>Reason</p>
            <select
              value={preset ? value.unavailableReason : "Other"}
              onChange={e => onChange({
                ...value,
                unavailableReason: e.target.value === "Other" ? " " : e.target.value,
              })}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {UNAVAILABLE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>

          {!preset && (
            <div>
              <p style={cap}>What stopped you reading it?</p>
              <input
                value={value.unavailableReason.trim()}
                onChange={e => onChange({ ...value, unavailableReason: e.target.value || " " })}
                placeholder="e.g. Board removed before it reached the bench"
                autoFocus
                style={inputStyle}
              />
            </div>
          )}
        </div>
      )}

      {need.modelNumber && !unavailable && (
        <>
          <div>
            <p style={cap}>Model number</p>
            <div style={{ position: "relative" }}>
              <input
                value={value.modelNumber}
                onChange={e => applyModelNumber(e.target.value)}
                placeholder="e.g. SM-A146P"
                autoComplete="off"
                style={{ ...inputStyle, fontFamily: "monospace", paddingRight: 30 }}
              />
              <Search size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            </div>
            {lookupResult && lookupResult !== "no-match" && (
              <p style={{ fontSize: 11, color: TA, fontFamily: ff, marginTop: 4 }}>
                Recognised as {lookupResult} — brand and model filled in below.
              </p>
            )}
            {lookupResult === "no-match" && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, marginTop: 4, lineHeight: 1.5 }}>
                Not in the model list. Type the brand and model yourself.
              </p>
            )}
          </div>

          {/* The other two come with it, exactly as at intake: a model number is
              only useful once it has resolved to something a person can read,
              and the technician is the one holding the phone. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <p style={cap}>Brand</p>
              {/* A list, because the brand is one of a known set and typing it
                  by hand is how "Samsung", "SAMSUNG" and "Samsang" end up as
                  three brands in the reports. The typed escape below covers
                  the handset nobody has filed yet. */}
              {typing ? (
                <input
                  value={value.brand}
                  onChange={e => onChange({ ...value, brand: e.target.value })}
                  onBlur={() => { if (!value.brand.trim()) setTyping(false); }}
                  placeholder="Type the brand"
                  autoComplete="off"
                  autoFocus
                  style={inputStyle}
                />
              ) : (
                <select
                  value={value.brand}
                  onChange={e => {
                    if (e.target.value === TYPE_IT) { setTyping(true); onChange({ ...value, brand: "" }); return; }
                    onChange({ ...value, brand: e.target.value });
                  }}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="">Select brand…</option>
                  {/* A job already carrying a brand that has since been retired
                      from the registry keeps it, rather than being silently
                      reset to blank the moment this opens. */}
                  {value.brand && !brandOptions.includes(value.brand) && (
                    <option value={value.brand}>{value.brand}</option>
                  )}
                  {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                  <option value={TYPE_IT}>Other — type it…</option>
                </select>
              )}
            </div>
            <div>
              <p style={cap}>Model</p>
              <input
                value={value.model}
                onChange={e => onChange({ ...value, model: e.target.value })}
                placeholder="e.g. Galaxy A14"
                autoComplete="off"
                style={inputStyle}
              />
            </div>
          </div>
        </>
      )}

      {need.imei && !unavailable && (
        <div>
          <p style={cap}>IMEI</p>
          <input
            ref={imeiRef}
            value={value.imei}
            onChange={e => onChange({ ...value, imei: e.target.value })}
            placeholder="Dial *#06# on the device"
            inputMode="numeric"
            autoComplete="off"
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
          {/* 15 digits is normal, 16 with the check digit some phones show.
              Warned about, never blocked — a scratched label should still be
              recordable as whatever can actually be read. */}
          {value.imei.trim() !== "" && (() => {
            const digits = value.imei.replace(/\D/g, "");
            return digits.length < 14 || digits.length > 17 ? (
              <p style={{ fontSize: 11, color: "#fbbf24", fontFamily: ff, marginTop: 4, lineHeight: 1.5 }}>
                That is {digits.length} digits — an IMEI is normally 15. Saved as typed either way.
              </p>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}
