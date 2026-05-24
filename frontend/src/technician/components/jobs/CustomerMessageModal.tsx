"use client";

import { useState } from "react";
import { X, MessageCircle, Copy, CheckCircle } from "lucide-react";
import { useTech } from "@/technician/contexts/TechContext";
import type { RepairJob } from "@/cashier/contexts/RepairContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

const TEMPLATES = [
  {
    id: "ready",
    label: "Device Ready for Pickup",
    color: TA,
    body: (job: RepairJob) =>
      `Hello ${job.customerName},\n\nYour ${job.brand} ${job.model} (Ref: ${job.id}) is ready for pickup at Mano Mobile.\n\nOutstanding balance: Rs. ${(job.estimatedCost - job.advancePaid).toLocaleString()}\n\nPlease bring your receipt. We're open Sat–Thu, 9 AM – 7 PM.\n\nThank you!`,
  },
  {
    id: "additional_issue",
    label: "Additional Issue Found",
    color: "#fbbf24",
    body: (job: RepairJob) =>
      `Hello ${job.customerName},\n\nWhile repairing your ${job.brand} ${job.model} (Ref: ${job.id}), our technician found an additional issue.\n\nPlease call us at [SHOP NUMBER] to discuss the options before we proceed.\n\nThank you for your understanding.`,
  },
  {
    id: "in_progress",
    label: "Repair In Progress",
    color: "#60a5fa",
    body: (job: RepairJob) =>
      `Hello ${job.customerName},\n\nJust an update — your ${job.brand} ${job.model} (Ref: ${job.id}) is currently being repaired by our technician.\n\nWe'll notify you once it's ready for pickup.\n\nMano Mobile`,
  },
  {
    id: "awaiting_parts",
    label: "Awaiting Parts",
    color: "#a78bfa",
    body: (job: RepairJob) =>
      `Hello ${job.customerName},\n\nWe've ordered the parts needed to repair your ${job.brand} ${job.model} (Ref: ${job.id}). The parts are expected to arrive within 1–3 business days.\n\nWe'll start the repair as soon as they arrive.\n\nThank you for your patience!`,
  },
];

interface Props { job: RepairJob; onClose: () => void; }

export default function CustomerMessageModal({ job, onClose }: Props) {
  const { addActivity } = useTech();
  const [selected, setSelected] = useState(TEMPLATES[0].id);
  const [copied, setCopied]     = useState(false);

  const tpl = TEMPLATES.find(t => t.id === selected)!;
  const [msg, setMsg] = useState(tpl.body(job));

  const handleSelect = (id: string) => {
    setSelected(id);
    const t = TEMPLATES.find(t => t.id === id)!;
    setMsg(t.body(job));
    setCopied(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      addActivity({ jobId: job.id, type: "message_sent", description: `Customer message copied: "${tpl.label}"` });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 520, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 71,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)", fontFamily: ff,
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MessageCircle size={16} color="#60a5fa" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Customer Message</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{job.customerName} · {job.phone}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Template selector */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Template</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => handleSelect(t.id)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                  border: `1px solid ${selected === t.id ? t.color + "40" : "var(--border)"}`,
                  background: selected === t.id ? t.color + "10" : "var(--bg-secondary)", fontFamily: ff,
                  transition: "all 0.12s",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, fontWeight: selected === t.id ? 600 : 400, color: selected === t.id ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: ff }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message editor */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff, marginBottom: 8 }}>Message (editable)</p>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={7}
              style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--text-primary)", fontFamily: ff, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copy} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "10px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
              background: copied ? TA : "#60a5fa", color: "#000", cursor: "pointer", fontFamily: ff,
              transition: "background 0.2s",
            }}>
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Message"}
            </button>
            <a
              href={`https://wa.me/${job.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`}
              target="_blank" rel="noopener noreferrer"
              onClick={() => addActivity({ jobId: job.id, type: "message_sent", description: `WhatsApp message opened: "${tpl.label}"` })}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "10px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
                background: "#25d366", color: "#fff", cursor: "pointer", fontFamily: ff, textDecoration: "none",
              }}
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
