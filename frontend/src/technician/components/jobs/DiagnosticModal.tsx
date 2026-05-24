"use client";

import { useState, useRef } from "react";
import { X, Camera, CheckCircle, XCircle, Minus, AlertTriangle, Trash2 } from "lucide-react";
import { useTech, type DiagnosticReport, type ScreenCondition } from "@/technician/contexts/TechContext";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

const SCREEN_OPTIONS: { value: ScreenCondition; label: string; color: string }[] = [
  { value: "Good",      label: "Good",      color: TA        },
  { value: "Cracked",   label: "Cracked",   color: "#fbbf24" },
  { value: "Shattered", label: "Shattered", color: "#f97316" },
  { value: "Dead",      label: "Dead",      color: "#f87171" },
];

type TriState = boolean | null;

function TriToggle({ value, onChange, label }: { value: TriState; onChange: (v: TriState) => void; label: string }) {
  const states: TriState[] = [true, false, null];
  const cfg = (v: TriState) =>
    v === true  ? { icon: CheckCircle, color: TA,        bg: `${TA}14`,               border: `${TA}40`               } :
    v === false ? { icon: XCircle,     color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" } :
                  { icon: Minus,       color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" };
  const current = cfg(value);
  const Icon = current.icon;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff }}>{label}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {states.map((s, i) => {
          const c = cfg(s);
          const SI = c.icon;
          const isActive = value === s;
          return (
            <button key={i} onClick={() => onChange(s)} style={{
              width: 30, height: 30, borderRadius: 7, border: `1px solid ${isActive ? c.border : "var(--border)"}`,
              background: isActive ? c.bg : "var(--bg-secondary)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s",
            }}>
              <SI size={13} color={isActive ? c.color : "var(--text-muted)"} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Props { job: RepairJob; onClose: () => void; onComplete?: () => void; }

export default function DiagnosticModal({ job, onClose, onComplete }: Props) {
  const { saveDiagnostic, addActivity } = useTech();
  const fileRef = useRef<HTMLInputElement>(null);

  const [screen, setScreen]       = useState<ScreenCondition>("Good");
  const [powerOn, setPowerOn]     = useState(true);
  const [touch, setTouch]         = useState<TriState>(true);
  const [charging, setCharging]   = useState<TriState>(true);
  const [speaker, setSpeaker]     = useState<TriState>(true);
  const [camera, setCamera]       = useState<TriState>(true);
  const [buttons, setButtons]     = useState<TriState>(true);
  const [waterDmg, setWaterDmg]   = useState(false);
  const [imeiVerif, setImeiVerif] = useState(false);
  const [imeiNum, setImeiNum]     = useState(job.imei ?? "");
  const [addlNotes, setAddlNotes] = useState("");
  const [photos, setPhotos]       = useState<string[]>([]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPhotos(p => [...p, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const submit = () => {
    const report: DiagnosticReport = {
      jobId: job.id, completedAt: new Date(),
      screenCondition: screen, powerOn,
      touchWorking: touch, chargingWorking: charging,
      speakerWorking: speaker, cameraWorking: camera,
      buttonsWorking: buttons, waterDamage: waterDmg,
      imeiVerified: imeiVerif, imeiNumber: imeiNum || undefined,
      additionalNotes: addlNotes || undefined, photos,
    };
    saveDiagnostic(report);
    addActivity({ jobId: job.id, type: "diagnostic_done", description: `Pre-repair diagnostic completed. Screen: ${screen}${waterDmg ? ", Water damage noted" : ""}` });
    onComplete?.();
    onClose();
  };

  const ta = (label: string) => (
    <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>{label}</p>
  );

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 70 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 540, maxHeight: "88vh", background: "var(--bg-card)",
        borderRadius: 16, border: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 71,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Pre-Repair Diagnostic</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.brand} {job.model} — {job.issue}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Screen condition */}
          <div>
            {ta("Screen Condition")}
            <div style={{ display: "flex", gap: 8 }}>
              {SCREEN_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setScreen(o.value)} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${screen === o.value ? o.color + "50" : "var(--border)"}`,
                  background: screen === o.value ? o.color + "14" : "var(--bg-secondary)",
                  color: screen === o.value ? o.color : "var(--text-muted)",
                  cursor: "pointer", transition: "all 0.12s", fontFamily: ff,
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Power on */}
          <div>
            {ta("Power")}
            <div style={{ display: "flex", gap: 8 }}>
              {([true, false] as const).map(v => (
                <button key={String(v)} onClick={() => setPowerOn(v)} style={{
                  flex: 1, padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${powerOn === v ? (v ? TA + "50" : "rgba(248,113,113,0.3)") : "var(--border)"}`,
                  background: powerOn === v ? (v ? `${TA}14` : "rgba(248,113,113,0.1)") : "var(--bg-secondary)",
                  color: powerOn === v ? (v ? TA : "#f87171") : "var(--text-muted)",
                  cursor: "pointer", fontFamily: ff,
                }}>{v ? "Powers On" : "No Power"}</button>
              ))}
            </div>
          </div>

          {/* Component checks */}
          <div>
            {ta("Component Status  ✓ Working · ✕ Faulty · — Not Tested")}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", padding: "4px 12px" }}>
              <TriToggle value={touch}    onChange={setTouch}    label="Touchscreen" />
              <TriToggle value={charging} onChange={setCharging} label="Charging Port" />
              <TriToggle value={speaker}  onChange={setSpeaker}  label="Speaker / Mic" />
              <TriToggle value={camera}   onChange={setCamera}   label="Camera" />
              <TriToggle value={buttons}  onChange={setButtons}  label="Buttons (Volume / Power)" />
            </div>
          </div>

          {/* Flags */}
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "Water Damage Detected", value: waterDmg, set: setWaterDmg, warn: true },
              { label: "IMEI Verified", value: imeiVerif, set: setImeiVerif, warn: false },
            ].map(f => (
              <button key={f.label} onClick={() => f.set(!f.value)} style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 9,
                border: `1px solid ${f.value ? (f.warn ? "rgba(251,191,36,0.35)" : `${TA}40`) : "var(--border)"}`,
                background: f.value ? (f.warn ? "rgba(251,191,36,0.1)" : `${TA}10`) : "var(--bg-secondary)",
                cursor: "pointer", fontFamily: ff,
              }}>
                {f.warn
                  ? <AlertTriangle size={13} color={f.value ? "#fbbf24" : "var(--text-muted)"} />
                  : <CheckCircle size={13} color={f.value ? TA : "var(--text-muted)"} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: f.value ? (f.warn ? "#fbbf24" : TA) : "var(--text-muted)" }}>{f.label}</span>
              </button>
            ))}
          </div>

          {/* IMEI number */}
          {imeiVerif && (
            <div>
              {ta("IMEI Number")}
              <input value={imeiNum} onChange={e => setImeiNum(e.target.value)} placeholder="Enter IMEI…"
                style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          {/* Photos */}
          <div>
            {ta("Intake Photos (optional)")}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                  <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{
                    position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                    background: "#f87171", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Trash2 size={10} color="#fff" /></button>
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()} style={{
                width: 72, height: 72, borderRadius: 8, border: "1px dashed var(--border)",
                background: "var(--bg-secondary)", cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                <Camera size={16} color="var(--text-muted)" />
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: ff }}>Add photo</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhoto} />
            </div>
          </div>

          {/* Additional notes */}
          <div>
            {ta("Additional Notes (optional)")}
            <textarea value={addlNotes} onChange={e => setAddlNotes(e.target.value)} rows={2}
              placeholder="Any other observations before repair begins…"
              style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: ff }}>Skip</button>
          <button onClick={submit} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: TA, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff }}>Save & Continue</button>
        </div>
      </div>
    </>
  );
}
