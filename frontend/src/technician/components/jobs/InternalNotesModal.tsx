"use client";

import { useState, useRef } from "react";
import { X, FileText, Camera, Trash2, Send } from "lucide-react";
import { useTech } from "@/technician/contexts/TechContext";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

function fmtTs(d: Date) {
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Props { job: RepairJob; onClose: () => void; }

export default function InternalNotesModal({ job, onClose }: Props) {
  const { notes, addNote, addActivity } = useTech();
  const fileRef = useRef<HTMLInputElement>(null);
  const jobNotes = [...(notes[job.id] ?? [])].reverse();

  const [text, setText]     = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(f => {
      const r = new FileReader();
      r.onload = ev => setPhotos(p => [...p, ev.target?.result as string]);
      r.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const submit = () => {
    if (!text.trim() && photos.length === 0) return;
    addNote({ jobId: job.id, text: text.trim(), photos });
    addActivity({ jobId: job.id, type: "note_added", description: text.trim() || `Photo note added (${photos.length} image${photos.length > 1 ? "s" : ""})` });
    setText("");
    setPhotos([]);
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 70 }} onClick={onClose} />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 420,
        background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 71,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.3)", fontFamily: ff,
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={16} color="#fbbf24" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Repair Notes</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{job.id} · {job.brand} {job.model}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        {/* Notes list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {jobNotes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <FileText size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff }}>No notes yet. Add your first note below.</p>
            </div>
          ) : jobNotes.map(n => (
            <div key={n.id} style={{ padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: ff, marginBottom: 5 }}>{fmtTs(n.createdAt)}</p>
              {n.text && <p style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, lineHeight: 1.55, marginBottom: n.photos.length > 0 ? 8 : 0 }}>{n.text}</p>}
              {n.photos.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {n.photos.map((src, i) => (
                    <img key={i} src={src} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 7, border: "1px solid var(--border)" }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Composer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: "relative", width: 56, height: 56 }}>
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                  <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{
                    position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: "50%",
                    background: "#f87171", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Trash2 size={9} color="#fff" /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              value={text} onChange={e => setText(e.target.value)} rows={2}
              placeholder="Add a repair note…"
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
              style={{ flex: 1, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none", resize: "none" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={() => fileRef.current?.click()} title="Attach photo" style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                <Camera size={14} />
              </button>
              <button onClick={submit} disabled={!text.trim() && photos.length === 0} title="Post note (Ctrl+Enter)" style={{
                width: 36, height: 36, borderRadius: 8, border: "none",
                background: (text.trim() || photos.length > 0) ? TA : "var(--bg-secondary)",
                cursor: (text.trim() || photos.length > 0) ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Send size={14} color={(text.trim() || photos.length > 0) ? "#000" : "var(--text-muted)"} />
              </button>
            </div>
          </div>
          <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff, marginTop: 4 }}>Ctrl+Enter to post</p>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhoto} />
        </div>
      </div>
    </>
  );
}
