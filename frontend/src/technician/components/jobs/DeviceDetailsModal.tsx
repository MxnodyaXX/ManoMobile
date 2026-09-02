"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Smartphone, Check } from "lucide-react";
import { useRepair, type RepairJob } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import DeviceDetailsFields, { draftFromJob, missingOn, type DeviceDraft } from "./DeviceDetailsFields";

/**
 * Record the model number and IMEI once the device is open.
 *
 * Most phones do not carry either on the outside — no printed IMEI, no model
 * number under the battery cover on a sealed handset — so intake books them in
 * blank and they stay blank. The technician is the first person who can read
 * them: off the boot screen, out of the settings menu, or from the label under
 * a shield once the back is off.
 *
 * The same panel is offered from the bench card and again at completion, so
 * whichever moment the technician has the phone open is the one that works.
 */

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

export default function DeviceDetailsModal({ job, onClose }: {
  job: RepairJob;
  onClose: () => void;
}) {
  const { updateJob } = useRepair();
  const { addActivity } = useTech();

  const [draft, setDraft] = useState<DeviceDraft>(() => draftFromJob(job));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const need = missingOn(job);
  const before = draftFromJob(job);
  const changed = (Object.keys(draft) as (keyof DeviceDraft)[])
    .some(k => draft[k].trim() !== before[k].trim());

  const save = async () => {
    setBusy(true);
    setError(null);

    // Only what this job was actually asked for, and only when filled in. A
    // blank box means the technician could not read it either — never an
    // instruction to erase something already on the record.
    const patch: Partial<RepairJob> = {};
    if (need.modelNumber) {
      if (draft.modelNumber.trim()) patch.modelNumber = draft.modelNumber.trim();
      if (draft.brand.trim()) patch.brand = draft.brand.trim();
      if (draft.model.trim()) patch.model = draft.model.trim();
    }
    if (need.imei && draft.imei.trim()) patch.imei = draft.imei.trim();

    const res = await updateJob(job.id, patch);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Those details could not be saved."); return; }

    addActivity({
      jobId: job.id,
      type: "status_change",
      description: `Device details recorded${patch.imei ? ` — IMEI ${patch.imei}` : ""}`,
    });
    onClose();
  };

  const input: React.CSSProperties = {
    width: "100%", minHeight: 44, padding: "0 12px", borderRadius: 9,
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: 15, outline: "none",
    fontFamily: ff, boxSizing: "border-box",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: "min(440px, calc(100vw - 24px))", boxShadow: "0 24px 64px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${TA}14`, border: `1px solid ${TA}35`, display: "flex", alignItems: "center", justifyContent: "center", color: TA, flexShrink: 0 }}>
              <Smartphone size={14} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Device Details</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {job.id} · {job.brand} {job.model}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.55 }}>
            Neither is printed on most handsets, so intake often books them in blank.
            Fill in whatever the device shows now that you have it open.
          </p>

          <DeviceDetailsFields job={job} value={draft} onChange={setDraft} inputStyle={input} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          {error && (
            <p style={{ flex: 1, fontSize: 11.5, color: "#f87171", fontFamily: ff, lineHeight: 1.5 }}>{error}</p>
          )}
          <button onClick={onClose} style={{ minHeight: 38, padding: "0 16px", borderRadius: 9, fontSize: 13, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!changed || busy}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              minHeight: 38, padding: "0 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: changed && !busy ? TA : "var(--bg-card)",
              border: `1px solid ${changed && !busy ? TA : "var(--border)"}`,
              color: changed && !busy ? "#000" : "var(--text-muted)",
              cursor: changed && !busy ? "pointer" : "not-allowed",
              fontFamily: ff,
            }}
          >
            <Check size={14} />{busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
