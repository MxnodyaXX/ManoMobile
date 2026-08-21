"use client";

import { useEffect, useState } from "react";
import { AlertCircle, FileText, Plus, Check, Star } from "lucide-react";
import { useToast } from "@/lib/ui/toast";
import ReceiptCanvas from "@/admin/components/barcode/ReceiptCanvas";
import {
  useReceiptTemplates, createReceiptTemplate, updateReceiptTemplate,
  deleteReceiptTemplate, setDefaultReceiptTemplate, type ReceiptTemplate,
} from "@/lib/repair/receiptTemplates";
import { scaleReceiptElements, type ReceiptElement, type TemplateKind } from "@/lib/repair/receiptElements";

const ff = "'Plus Jakarta Sans', sans-serif";

const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)",
  fontSize: 13, width: "100%", outline: "none", fontFamily: ff, boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, display: "block",
};
const btnAccent: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
  borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
  cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: ff, whiteSpace: "nowrap",
};

type Draft = Omit<ReceiptTemplate, "id" | "isDefault">;

// Receipt: a full A5 landscape sheet — the print CSS sets @page margin:0 for
// the receipt, so the design itself is what has to fill the physical page.
// Issue invoice: A4 portrait with its existing 15mm print margin left in
// place (not reported as broken), so the design only needs to fill the
// content area inside that margin — 210x297 minus 15mm each side.
const BLANK_BY_KIND: Record<TemplateKind, Draft> = {
  receipt: { name: "", kind: "receipt", pageWidthMm: 210, pageHeightMm: 148, elements: [] },
  issue: { name: "", kind: "issue", pageWidthMm: 180, pageHeightMm: 267, elements: [] },
};

const COPY: Record<TemplateKind, {
  title: string; listEmpty: string; description: string; pageNote: string; migrationFile: string;
}> = {
  receipt: {
    title: "Job Receipt Templates",
    listEmpty: "No receipt templates yet — click New Template to design one.",
    description: "Design the printed job receipt — logo, invoice header, QR tracking code, customer and job blocks, the priced "
      + "job details table, and the bank-transfer box. An empty design (no elements added yet) keeps printing the "
      + "plain built-in receipt, so nothing changes until you build one here.",
    pageNote: "A5 landscape prints at 210 × 148mm with no page margin — the design has to fill that itself for the receipt to reach the edges of the paper.",
    migrationFile: "20260819000014_receipt_templates.sql",
  },
  issue: {
    title: "Job Issue Invoice Templates",
    listEmpty: "No invoice templates yet — click New Template to design one.",
    description: "Design the sales invoice printed when a repaired device is handed back to the customer — logo, invoice "
      + "number, customer details, the priced invoice table, totals and payment status. An empty design (no elements "
      + "added yet) keeps printing the plain built-in invoice, so nothing changes until you build one here.",
    pageNote: "A4 portrait prints with a 15mm page margin — 180 × 267mm is the content area inside that margin.",
    migrationFile: "20260819000017_issue_invoice_templates.sql",
  },
};

/**
 * A canvas designer for either printable this table holds — the job-intake
 * receipt or the job-issue sales invoice, picked by `kind`. Same idea as
 * BarcodeManager's Label Templates, one page over. See ReceiptCanvas /
 * ReceiptRender / receiptElements.ts for the shared building blocks.
 */
export default function ReceiptTemplateManager({ kind }: { kind: TemplateKind }) {
  const { templates, loading, error, configured, reload } = useReceiptTemplates(kind);
  const toast = useToast();
  const BLANK = BLANK_BY_KIND[kind];
  const copy = COPY[kind];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const asDraft = (t: ReceiptTemplate): Draft => ({
    name: t.name, kind: t.kind, pageWidthMm: t.pageWidthMm, pageHeightMm: t.pageHeightMm, elements: t.elements,
  });

  // Land on the default template once the list arrives, so the panel is never
  // blank and the thing being edited is the thing that actually prints.
  useEffect(() => {
    if (draft || templates.length === 0) return;
    const first = templates.find(t => t.isDefault) ?? templates[0];
    setSelectedId(first.id);
    setDraft(asDraft(first));
  }, [templates, draft]);

  const selected = templates.find(t => t.id === selectedId) ?? null;
  const s = draft;
  const dirty = !!s && (!selected || JSON.stringify(asDraft(selected)) !== JSON.stringify(s));

  const pick = (t: ReceiptTemplate) => {
    if (dirty && !confirm("Discard unsaved changes to this template?")) return;
    setSelectedId(t.id);
    setDraft(asDraft(t));
  };

  /** Changing the page size leaves existing elements exactly where they were
   *  in millimetres — fine for a blank template, but on a real design that
   *  either strands them off the new edge or leaves them bunched in a
   *  corner. Offer to scale everything to the new size instead. */
  const resizePage = (w: number, h: number) => {
    setDraft(prev => {
      if (!prev || (w === prev.pageWidthMm && h === prev.pageHeightMm)) return prev;
      const shouldScale = prev.elements.length === 0
        || confirm("Scale the existing design to fit the new page size? Cancel to keep every element's exact position/size instead.");
      const elements = shouldScale
        ? scaleReceiptElements(prev.elements, { w: prev.pageWidthMm, h: prev.pageHeightMm }, { w, h })
        : prev.elements;
      return { ...prev, pageWidthMm: w, pageHeightMm: h, elements };
    });
  };

  const startNew = () => {
    if (dirty && !confirm("Discard unsaved changes to this template?")) return;
    setSelectedId(null);
    setDraft({ ...BLANK });
  };

  const save = async () => {
    if (!s) return;
    if (!s.name.trim()) { toast.dialog("error", "Name the template", "Give it a name you'll recognise, e.g. “Standard Receipt”."); return; }
    setBusy(true);
    try {
      const saved = selectedId
        ? await updateReceiptTemplate(selectedId, s)
        : await createReceiptTemplate(s);
      await reload();
      setSelectedId(saved.id);
      setDraft(asDraft(saved));
      toast.dialog("success", selectedId ? "Template saved" : "Template created", saved.name);
    } catch (e) {
      toast.dialog("error", "Could not save template", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await setDefaultReceiptTemplate(selected.id);
      await reload();
      toast.dialog("success", "Default set", `${selected.name} is now what prints ${kind === "receipt" ? "on job intake" : "on job issue"}.`);
    } catch (e) {
      toast.dialog("error", "Could not set default", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (selected.isDefault) {
      toast.dialog("error", "This is the default template", "Make another template the default first, then delete this one.");
      return;
    }
    if (!confirm(`Delete the template “${selected.name}”?`)) return;
    setBusy(true);
    try {
      await deleteReceiptTemplate(selected.id);
      await reload();
      setSelectedId(null);
      setDraft(null);
      toast.dialog("success", "Template deleted", `${selected.name} has been removed.`);
    } catch (e) {
      toast.dialog("error", "Could not delete template", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {(!configured || error) && (
        <div style={{ display: "flex", gap: 9, padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)", fontFamily: ff }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {!configured
              ? "Connect Supabase to save templates."
              : `${error} — run migration ${copy.migrationFile}.`}
          </p>
        </div>
      )}

      {!configured || !error ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.6 }}>
          {copy.description}
        </p>
      ) : null}

      {/* ── The saved designs ── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={15} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{copy.title}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{templates.length} saved</span>
          <button onClick={startNew} style={{ ...btnAccent, marginLeft: "auto" }}><Plus size={13} /> New Template</button>
        </div>

        <div style={{ padding: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {loading ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, padding: "6px 2px" }}>Loading templates…</p>
          ) : templates.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, padding: "6px 2px" }}>
              {copy.listEmpty}
            </p>
          ) : templates.map(t => {
            const active = t.id === selectedId;
            return (
              <button
                key={t.id}
                onClick={() => pick(t)}
                style={{
                  textAlign: "left", padding: "11px 14px", borderRadius: 11, minWidth: 178, cursor: "pointer",
                  fontFamily: ff, transition: "all 0.15s",
                  border: active ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
                  background: active ? "var(--accent-dim)" : "var(--bg-surface)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--accent)" : "var(--text-primary)" }}>{t.name}</span>
                  {t.isDefault && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 20, background: "var(--accent)", color: "#fff", letterSpacing: "0.04em" }}>DEFAULT</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.elements.length === 0 ? "Built-in layout" : `${t.elements.length} element${t.elements.length === 1 ? "" : "s"}`}</div>
              </button>
            );
          })}
          {!selectedId && s && (
            <div style={{ padding: "11px 14px", borderRadius: 11, minWidth: 178, fontFamily: ff, border: "1px dashed var(--accent-glow)", background: "var(--accent-dim)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 3 }}>{s.name || "Untitled template"}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Not saved yet</div>
            </div>
          )}
        </div>
      </div>

      {!s ? null : (
        <>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                {selectedId ? "Edit Template" : "New Template"}
              </span>
              <div style={{ width: 220 }}>
                <input
                  type="text" value={s.name}
                  onChange={e => setDraft(prev => (prev ? { ...prev, name: e.target.value } : prev))}
                  placeholder="e.g. Standard Receipt"
                  style={{ ...inputStyle, padding: "6px 10px", fontSize: 12.5 }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Page (mm)</label>
                <input
                  type="number" min={50} max={400} value={s.pageWidthMm}
                  onChange={e => resizePage(Number(e.target.value) || s.pageWidthMm, s.pageHeightMm)}
                  style={{ ...inputStyle, width: 64, padding: "6px 8px", fontSize: 12.5 }}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>×</span>
                <input
                  type="number" min={50} max={400} value={s.pageHeightMm}
                  onChange={e => resizePage(s.pageWidthMm, Number(e.target.value) || s.pageHeightMm)}
                  style={{ ...inputStyle, width: 64, padding: "6px 8px", fontSize: 12.5 }}
                />
              </div>
              {dirty && <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", fontFamily: ff }}>Unsaved changes</span>}
              {selected?.isDefault && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--accent)", fontFamily: ff }}>
                  <Star size={11} /> Default
                </span>
              )}
            </div>
            <p style={{ padding: "10px 20px 0", fontSize: 11, color: "var(--text-muted)", fontFamily: ff, lineHeight: 1.55 }}>
              {copy.pageNote}
            </p>
            <div style={{ padding: 20 }}>
              <ReceiptCanvas
                elements={s.elements}
                onChange={(els: ReceiptElement[]) => setDraft(prev => (prev ? { ...prev, elements: els } : prev))}
                widthMm={s.pageWidthMm}
                heightMm={s.pageHeightMm}
                kind={kind}
              />
            </div>
          </div>

          {/* ── Actions ── */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={save} disabled={busy || !dirty} style={{ ...btnAccent, opacity: busy || !dirty ? 0.5 : 1, cursor: busy || !dirty ? "not-allowed" : "pointer" }}>
              <Check size={13} /> {busy ? "Saving…" : selectedId ? "Save Changes" : "Create Template"}
            </button>
            {selected && !selected.isDefault && (
              <button onClick={makeDefault} disabled={busy} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", cursor: busy ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: ff, display: "flex", alignItems: "center", gap: 6 }}>
                <Star size={13} /> Set as Default
              </button>
            )}
            {selected && (
              <button onClick={remove} disabled={busy || selected.isDefault} title={selected.isDefault ? "Make another template default first" : undefined} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.35)", background: "transparent", color: selected.isDefault ? "var(--text-muted)" : "#dc2626", cursor: busy || selected.isDefault ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: ff, opacity: selected.isDefault ? 0.5 : 1 }}>
                Delete Template
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
