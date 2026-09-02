"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useDeviceModelLookup } from "@/lib/repair/deviceModels";
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

export interface DeviceDraft {
  modelNumber: string;
  brand: string;
  model: string;
  imei: string;
}

export const draftFromJob = (job: RepairJob): DeviceDraft => ({
  modelNumber: job.modelNumber ?? "",
  brand: job.brand ?? "",
  model: job.model ?? "",
  imei: job.imei ?? "",
});

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

  const need = missingOn(job);

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
    } else {
      onChange({ ...value, modelNumber: raw });
      setLookupResult(raw.trim() ? "no-match" : null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {need.modelNumber && (
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
              <input
                value={value.brand}
                onChange={e => onChange({ ...value, brand: e.target.value })}
                placeholder="e.g. Samsung"
                autoComplete="off"
                style={inputStyle}
              />
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

      {need.imei && (
        <div>
          <p style={cap}>IMEI</p>
          <input
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
