"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Type, Image as ImageIcon, Barcode as BarcodeIcon, Minus,
  Trash2, Copy, ArrowUp, ArrowDown, Upload, ClipboardCopy, X,
} from "lucide-react";
import LabelRender from "@/cashier/components/shared/LabelRender";
import { SHOP_DETAILS } from "@/lib/shop";
import {
  blankElement, clampElement, copyDesign, LABEL_TOKENS,
  type LabelElement, type LabelElementType, type LabelData,
} from "@/lib/inventory/labelElements";

const ff = "'Plus Jakarta Sans', sans-serif";
/** Editor zoom. 8px per mm makes a 50mm label 400px — big enough to drag
 *  small text boxes accurately without needing a scroll container. */
const PX_PER_MM = 8;
/** Uploaded images are inlined as data URIs into the template row, so they
 *  have to stay small. A logo well under this is normal; a photo is not. */
const MAX_IMAGE_BYTES = 200_000;

/** Stand-in values so the design can be judged against realistic content
 *  rather than against empty boxes. */
const SAMPLE: LabelData = {
  code: "RM-011",
  jobId: "RM-011",
  customer: "Wijaya Kumara",
  device: "Xiaomi Redmi 9C",
  imei: "356938035643809",
  date: new Date().toLocaleDateString("en-GB"),
  shopName: SHOP_DETAILS.name,
  shopPhone: SHOP_DETAILS.phone,
  shopAddress: SHOP_DETAILS.address,
};

/** Another template whose design can be copied onto this one. */
export interface DesignSource {
  id: string;
  name: string;
  layoutLabel: string;
  widthMm: number;
  heightMm: number;
  format: "CODE128" | "CODE39" | "EAN13";
  barWidth: number;
  elements: LabelElement[];
}

interface LabelCanvasProps {
  elements: LabelElement[];
  onChange: (els: LabelElement[]) => void;
  widthMm: number;
  heightMm: number;
  format: "CODE128" | "CODE39" | "EAN13";
  barWidth: number;
  /** Templates that already have a design, for "Copy design from". */
  sources?: DesignSource[];
}

export default function LabelCanvas({
  elements, onChange, widthMm, heightMm, format, barWidth, sources = [],
}: LabelCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Drag state lives in a ref: a pointermove firing 60 times a second must not
  // queue 60 renders of the properties panel.
  const drag = useRef<{ id: string; mode: "move" | "resize"; startX: number; startY: number; orig: LabelElement } | null>(null);

  const selected = elements.find(e => e.id === selectedId) ?? null;
  const label = { w: widthMm, h: heightMm };

  const update = useCallback((id: string, patch: Partial<LabelElement>) => {
    onChange(elements.map(e => (e.id === id ? clampElement({ ...e, ...patch } as LabelElement, label) : e)));
  }, [elements, onChange, label]);

  const add = (type: LabelElementType) => {
    const el = clampElement(blankElement(type, label), label);
    onChange([...elements, el]);
    setSelectedId(el.id);
  };

  const remove = (id: string) => {
    onChange(elements.filter(e => e.id !== id));
    setSelectedId(null);
  };

  const duplicate = (el: LabelElement) => {
    const copy = clampElement({ ...el, id: `${el.id}-c${Date.now().toString(36)}`, x: el.x + 2, y: el.y + 2 }, label);
    onChange([...elements, copy]);
    setSelectedId(copy.id);
  };

  /** Order in the array is paint order, so this is what puts the logo behind
   *  the text rather than on top of it. */
  const reorder = (id: string, dir: -1 | 1) => {
    const i = elements.findIndex(e => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= elements.length) return;
    const next = [...elements];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  // ── Dragging ──
  const onPointerDown = (e: React.PointerEvent, el: LabelElement, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.id);
    drag.current = { id: el.id, mode, startX: e.clientX, startY: e.clientY, orig: el };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dxMm = (e.clientX - d.startX) / PX_PER_MM;
      const dyMm = (e.clientY - d.startY) / PX_PER_MM;
      // Snapped to 0.5mm: free-floating decimals make it impossible to line
      // two boxes up by eye, and 0.5mm is finer than a thermal head resolves.
      const snap = (v: number) => Math.round(v * 2) / 2;
      if (d.mode === "move") {
        update(d.id, { x: snap(d.orig.x + dxMm), y: snap(d.orig.y + dyMm) });
      } else {
        update(d.id, { w: snap(d.orig.w + dxMm), h: snap(d.orig.h + dyMm) });
      }
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [update]);

  // Nudge with the arrow keys, since 0.5mm is hard to hit with a mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const step = e.shiftKey ? 1 : 0.5;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      if (e.key in moves) {
        e.preventDefault();
        const [dx, dy] = moves[e.key];
        update(selected.id, { x: selected.x + dx, y: selected.y + dy });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(selected.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onUpload = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) { setUploadError("That file isn't an image."); return; }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(`Image is ${Math.round(file.size / 1024)}KB — keep it under ${MAX_IMAGE_BYTES / 1000}KB. A logo should be a small PNG.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      if (selected?.type === "image") update(selected.id, { src });
      else {
        const el = clampElement({ ...blankElement("image", label), src } as LabelElement, label);
        onChange([...elements, el]);
        setSelectedId(el.id);
      }
    };
    reader.onerror = () => setUploadError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
    fontSize: 12, fontWeight: 600, fontFamily: ff, cursor: "pointer",
    background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: ff }}>

      {/* ── Add ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => add("text")} style={btn}><Type size={13} /> Text</button>
        <button onClick={() => add("barcode")} style={btn}><BarcodeIcon size={13} /> Barcode</button>
        <button onClick={() => add("image")} style={btn}><ImageIcon size={13} /> Logo</button>
        <button onClick={() => add("line")} style={btn}><Minus size={13} /> Line</button>
        <button onClick={() => fileRef.current?.click()} style={btn}><Upload size={13} /> Upload Image</button>
        <input
          ref={fileRef} type="file" accept="image/*" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
        />
        {sources.length > 0 && (
          <button
            onClick={() => setCopyOpen(true)}
            style={{ ...btn, borderColor: "var(--accent-glow)", color: "var(--accent)" }}
          >
            <ClipboardCopy size={13} /> Copy Design From…
          </button>
        )}
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
          Drag to move · corner to resize · arrows to nudge · Delete to remove
        </span>
      </div>

      {copyOpen && (
        <CopyDesignDialog
          sources={sources}
          target={{ w: widthMm, h: heightMm }}
          replacing={elements.length > 0}
          onClose={() => setCopyOpen(false)}
          onCopy={(src, scaleToFit) => {
            onChange(copyDesign(src.elements, { w: src.widthMm, h: src.heightMm }, { w: widthMm, h: heightMm }, scaleToFit));
            setSelectedId(null);
            setCopyOpen(false);
          }}
        />
      )}

      {uploadError && (
        <p style={{ fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>{uploadError}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 250px", gap: 16, alignItems: "start" }}>

        {/* ── The board ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            ref={boardRef}
            onPointerDown={() => setSelectedId(null)}
            style={{
              position: "relative",
              width: widthMm * PX_PER_MM,
              height: heightMm * PX_PER_MM,
              // A chequerboard reads as "canvas" and makes the white label and
              // its edges obvious against the page background in both themes.
              backgroundColor: "#fff",
              backgroundImage:
                "linear-gradient(45deg, #eef1f4 25%, transparent 25%), linear-gradient(-45deg, #eef1f4 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef1f4 75%), linear-gradient(-45deg, transparent 75%, #eef1f4 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
              border: "1px solid var(--border)",
              borderRadius: 4,
              overflow: "hidden",
              maxWidth: "100%",
              touchAction: "none",
            }}
          >
            {/* What actually prints, at editor zoom */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <LabelRender
                elements={elements}
                data={SAMPLE}
                widthMm={widthMm}
                heightMm={heightMm}
                format={format}
                barWidth={barWidth}
                scale={PX_PER_MM / (96 / 25.4)}
              />
            </div>

            {/* Interaction layer: hit boxes over the rendered output, so the
                handles never end up printed. */}
            {elements.map(el => {
              const active = el.id === selectedId;
              return (
                <div
                  key={el.id}
                  onPointerDown={e => onPointerDown(e, el, "move")}
                  style={{
                    position: "absolute",
                    left: el.x * PX_PER_MM, top: el.y * PX_PER_MM,
                    width: Math.max(el.w * PX_PER_MM, 6), height: Math.max(el.h * PX_PER_MM, 6),
                    border: active ? "1.5px solid var(--accent)" : "1px dashed rgba(120,130,150,0.5)",
                    background: active ? "rgba(99,102,241,0.06)" : "transparent",
                    cursor: "move", boxSizing: "border-box",
                  }}
                >
                  {active && (
                    <div
                      onPointerDown={e => onPointerDown(e, el, "resize")}
                      style={{
                        position: "absolute", right: -5, bottom: -5, width: 11, height: 11,
                        borderRadius: 3, background: "var(--accent)", border: "2px solid #fff",
                        cursor: "nwse-resize",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {widthMm} × {heightMm} mm at {PX_PER_MM}× zoom · sample data shown
          </p>
        </div>

        {/* ── Properties ── */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {!selected ? (
            <>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>Elements</p>
              {elements.length === 0 ? (
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                  Nothing on the label yet. Add a barcode, some text and your logo, then drag them into place.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {elements.map((el, i) => (
                    <button
                      key={el.id}
                      onClick={() => setSelectedId(el.id)}
                      style={{ textAlign: "left", padding: "6px 9px", borderRadius: 7, fontSize: 11.5, fontFamily: ff, cursor: "pointer", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >
                      {i + 1}. {el.type === "text" ? `“${el.text.slice(0, 18)}”` : el.type}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                Select an element to edit it. Later items paint on top of earlier ones.
              </p>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", flex: 1, textTransform: "capitalize" }}>{selected.type}</p>
                <button onClick={() => reorder(selected.id, -1)} title="Send back" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}><ArrowDown size={13} /></button>
                <button onClick={() => reorder(selected.id, 1)} title="Bring forward" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}><ArrowUp size={13} /></button>
                <button onClick={() => duplicate(selected)} title="Duplicate" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}><Copy size={13} /></button>
                <button onClick={() => remove(selected.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 2 }}><Trash2 size={13} /></button>
              </div>

              <Row label="Position (mm)">
                <NumIn value={selected.x} onChange={v => update(selected.id, { x: v })} />
                <NumIn value={selected.y} onChange={v => update(selected.id, { y: v })} />
              </Row>
              <Row label="Size (mm)">
                <NumIn value={selected.w} onChange={v => update(selected.id, { w: v })} />
                <NumIn value={selected.h} onChange={v => update(selected.id, { h: v })} />
              </Row>

              {selected.type === "text" && (
                <>
                  <Field label="Text">
                    <textarea
                      value={selected.text}
                      onChange={e => update(selected.id, { text: e.target.value })}
                      rows={2}
                      style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 9px", fontSize: 12, color: "var(--text-primary)", fontFamily: ff, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                    />
                  </Field>
                  <Field label="Insert a field">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {LABEL_TOKENS.map(t => (
                        <button
                          key={t.token}
                          title={t.label}
                          onClick={() => update(selected.id, { text: selected.text + t.token })}
                          style={{ padding: "3px 7px", borderRadius: 5, fontSize: 10, fontFamily: "monospace", cursor: "pointer", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent)" }}
                        >
                          {t.token.replace(/[{}]/g, "")}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Row label="Font (pt)">
                    <NumIn value={selected.fontSize} onChange={v => update(selected.id, { fontSize: Math.max(4, v) })} />
                    <button
                      onClick={() => update(selected.id, { bold: !selected.bold })}
                      style={{ flex: 1, padding: "6px", borderRadius: 7, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: ff, background: selected.bold ? "var(--accent-dim)" : "var(--bg-card)", border: `1px solid ${selected.bold ? "var(--accent-glow)" : "var(--border)"}`, color: selected.bold ? "var(--accent)" : "var(--text-secondary)" }}
                    >
                      Bold
                    </button>
                  </Row>
                  <Field label="Align">
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["left", "center", "right"] as const).map(a => (
                        <button
                          key={a}
                          onClick={() => update(selected.id, { align: a })}
                          style={{ flex: 1, padding: "6px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: ff, textTransform: "capitalize", background: selected.align === a ? "var(--accent-dim)" : "var(--bg-card)", border: `1px solid ${selected.align === a ? "var(--accent-glow)" : "var(--border)"}`, color: selected.align === a ? "var(--accent)" : "var(--text-secondary)" }}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {selected.type === "image" && (
                <>
                  <Field label="Image">
                    <button onClick={() => fileRef.current?.click()} style={{ ...btn, width: "100%", justifyContent: "center" }}>
                      <Upload size={13} /> Replace image
                    </button>
                  </Field>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5, wordBreak: "break-all" }}>
                    {selected.src.startsWith("data:") ? "Uploaded image" : selected.src}
                  </p>
                </>
              )}

              {selected.type === "barcode" && (
                <>
                  <Row label="Code text">
                    <button
                      onClick={() => update(selected.id, { showText: !selected.showText })}
                      style={{ flex: 1, padding: "6px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: ff, background: selected.showText ? "var(--accent-dim)" : "var(--bg-card)", border: `1px solid ${selected.showText ? "var(--accent-glow)" : "var(--border)"}`, color: selected.showText ? "var(--accent)" : "var(--text-secondary)" }}
                    >
                      {selected.showText ? "Shown" : "Hidden"}
                    </button>
                    <NumIn value={selected.fontSize} onChange={v => update(selected.id, { fontSize: Math.max(4, v) })} />
                  </Row>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Prints the job or product code. Format and bar width come from the template settings above.
                  </p>
                </>
              )}

              {selected.type === "line" && (
                <Field label="Colour">
                  <input
                    type="color"
                    value={selected.color}
                    onChange={e => update(selected.id, { color: e.target.value })}
                    style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }}
                  />
                </Field>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Small building blocks ── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>{label}</label>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 6 }}>{children}</div>
    </Field>
  );
}

function NumIn({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      step={0.5}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ flex: 1, minWidth: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "var(--text-primary)", fontFamily: ff, outline: "none" }}
    />
  );
}

/* ── Copy design from another label ── */

/**
 * Picking a design to copy is a visual decision, so each option is shown as
 * the label it produces rather than as a name in a list — "Design 1" tells you
 * nothing about which arrangement it is.
 */
function CopyDesignDialog({ sources, target, replacing, onClose, onCopy }: {
  sources: DesignSource[];
  target: { w: number; h: number };
  replacing: boolean;
  onClose: () => void;
  onCopy: (src: DesignSource, scaleToFit: boolean) => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(sources[0]?.id ?? null);
  const picked = sources.find(s => s.id === pickedId) ?? null;
  const sizeDiffers = !!picked && (picked.widthMm !== target.w || picked.heightMm !== target.h);
  // Only meaningful when the stock differs; defaulted on there, because an
  // unscaled copy onto smaller stock loses whatever falls off the edge.
  const [scaleToFit, setScaleToFit] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 3200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ width: "min(620px, 100%)", maxHeight: "85vh", overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, fontFamily: ff }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardCopy size={15} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Copy Design From</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              Reuse another label&apos;s arrangement on this one. Only the design is copied — this template keeps its own name, size and settings.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sources.map(src => {
              const active = src.id === pickedId;
              // Shown small: enough to recognise the arrangement, not to read.
              const previewScale = Math.min(220 / src.widthMm, 96 / src.heightMm) / (96 / 25.4);
              return (
                <button
                  key={src.id}
                  onClick={() => setPickedId(src.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: 12,
                    cursor: "pointer", textAlign: "left", fontFamily: ff,
                    border: active ? "1px solid var(--accent-glow)" : "1px solid var(--border)",
                    background: active ? "var(--accent-dim)" : "var(--bg-surface)",
                  }}
                >
                  <div style={{
                    width: src.widthMm * previewScale * (96 / 25.4),
                    height: src.heightMm * previewScale * (96 / 25.4),
                    flexShrink: 0, border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden", background: "#fff",
                  }}>
                    <LabelRender
                      elements={src.elements}
                      data={SAMPLE}
                      widthMm={src.widthMm}
                      heightMm={src.heightMm}
                      format={src.format}
                      barWidth={src.barWidth}
                      scale={previewScale}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: active ? "var(--accent)" : "var(--text-primary)" }}>{src.name}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{src.layoutLabel}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {src.widthMm} × {src.heightMm} mm · {src.elements.length} element{src.elements.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {sizeDiffers && picked && (
            <div style={{ padding: "11px 13px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)", display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                That design is laid out for <strong>{picked.widthMm} × {picked.heightMm} mm</strong> and this label is{" "}
                <strong>{target.w} × {target.h} mm</strong>.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={scaleToFit} onChange={e => setScaleToFit(e.target.checked)} style={{ cursor: "pointer" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  Scale it to fit — otherwise sizes stay exact and anything past the edge is pulled back inside.
                </span>
              </label>
            </div>
          )}

          {replacing && (
            <p style={{ fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
              This replaces the design currently on this label.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: ff }}>Cancel</button>
            <button
              onClick={() => picked && onCopy(picked, sizeDiffers ? scaleToFit : false)}
              disabled={!picked}
              style={{ padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: picked ? "var(--accent)" : "var(--bg-secondary)", border: "none", color: picked ? "#fff" : "var(--text-muted)", cursor: picked ? "pointer" : "not-allowed", fontFamily: ff }}
            >
              Copy Design
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
