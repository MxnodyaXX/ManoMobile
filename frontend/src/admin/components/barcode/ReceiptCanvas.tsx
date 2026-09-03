"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Type, Image as ImageIcon, Minus, QrCode, Table2, Square, Circle,
  Trash2, Copy, ArrowUp, ArrowDown, Upload, ClipboardCopy, X, Plus, GripVertical,
} from "lucide-react";
import ReceiptRender from "@/cashier/components/shared/ReceiptRender";
import { SHOP_DETAILS } from "@/lib/shop";
import {
  blankReceiptElement, clampReceiptElement, copyReceiptElements, RECEIPT_TOKENS,
  INVOICE_COLUMNS, invoiceColumns,
  type ReceiptElement, type ReceiptElementType, type ReceiptData, type TemplateKind,
  type InvoiceColumn,
} from "@/lib/repair/receiptElements";
import { FONT_OPTIONS, DEFAULT_FONT_FAMILY } from "@/lib/fonts";

const ff = "'Plus Jakarta Sans', sans-serif";
/** Editor zoom. A5 landscape's ~190mm content area at 3.5px/mm is ~665px —
 *  wide enough to drag things accurately without a scroll container. */
const PX_PER_MM = 3.5;
// A receipt image is a full logo/decorative graphic on an A5 page, not a tiny
// label icon, so it gets a much bigger allowance than LabelCanvas's.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Stand-in values so the design can be judged against realistic content
 *  rather than empty boxes — mirrors LabelCanvas's SAMPLE. */
const SAMPLE: ReceiptData = {
  jobId: "RM-016", customer: "Sumod Themiya", phone: "0777 53 73 83",
  address: "255, Horana Rd, Kurusa Junction",
  device: "Xiaomi Redmi 9C", modelNumber: "M2006C3LMG", imei: "356938035643809",
  fault: "Screen Cracked", estimate: "8,000", advance: "5,000", remarks: "Handle with care",
  technician: "Manodya", estCompletion: new Date().toLocaleDateString("en-GB"),
  priority: "Normal", itemsReceived: "SIM Card, Charger",
  completionDate: new Date().toLocaleDateString("en-GB"), finalAmount: "8,000",
  technicianRemarks: "Screen replaced, tested OK", warrantyPeriod: "3 Months — Parts & Labour",
  balanceDue: "3,000", amountToBePaid: "3,000", dueAfterPayment: "3,000",
  date: new Date().toLocaleDateString("en-GB"), createdBy: "MANOMOBILE",
  trackUrl: typeof window === "undefined" ? "" : `${window.location.origin}/track?job=RM-016`,
  shopName: SHOP_DETAILS.name, shopTagline: SHOP_DETAILS.tagline, shopPhone: SHOP_DETAILS.phone,
  shopEmail: SHOP_DETAILS.email, shopWebsite: SHOP_DETAILS.website, shopAddress: SHOP_DETAILS.address,
  bankName: SHOP_DETAILS.bankName, bankAccountNumber: SHOP_DETAILS.bankAccountNumber,
  bankAccountHolder: SHOP_DETAILS.bankAccountHolder,
  invoiceNo: "RM-016", nic: "912345678V", email: "sumod@example.com",
  warranty: "3 MONTHS WARRANTY [NORMAL]", discount: "0", lineTotal: "8,000",
  paidAmount: "8,000", dueAmount: "0", paymentType: "CASH / FULL", adminApprover: "",
};

/** Another template whose design can be copied onto this one — receipt and
 *  invoice alike, since reusing one document's logo/header arrangement on
 *  the other is exactly the point. */
export interface ReceiptDesignSource {
  id: string;
  name: string;
  kindLabel: string;
  widthMm: number;
  heightMm: number;
  elements: ReceiptElement[];
}

interface ReceiptCanvasProps {
  elements: ReceiptElement[];
  onChange: (els: ReceiptElement[]) => void;
  widthMm: number;
  heightMm: number;
  kind: TemplateKind;
  /** Templates that already have a design, for "Copy Design From". */
  sources?: ReceiptDesignSource[];
}

export default function ReceiptCanvas({ elements, onChange, widthMm, heightMm, kind, sources = [] }: ReceiptCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Drag state lives in a ref: a pointermove firing 60 times a second must not
  // queue 60 renders of the properties panel.
  const drag = useRef<{ id: string; mode: "move" | "resize"; startX: number; startY: number; orig: ReceiptElement } | null>(null);

  const selected = elements.find(e => e.id === selectedId) ?? null;
  const page = { w: widthMm, h: heightMm };

  const update = useCallback((id: string, patch: Partial<ReceiptElement>) => {
    onChange(elements.map(e => (e.id === id ? clampReceiptElement({ ...e, ...patch } as ReceiptElement, page) : e)));
  }, [elements, onChange, page]);

  const add = (type: ReceiptElementType) => {
    const el = clampReceiptElement(blankReceiptElement(type, page), page);
    onChange([...elements, el]);
    setSelectedId(el.id);
  };

  const remove = (id: string) => {
    onChange(elements.filter(e => e.id !== id));
    setSelectedId(null);
  };

  const duplicate = (el: ReceiptElement) => {
    const copy = clampReceiptElement({ ...el, id: `${el.id}-c${Date.now().toString(36)}`, x: el.x + 3, y: el.y + 3 }, page);
    onChange([...elements, copy]);
    setSelectedId(copy.id);
  };

  const reorder = (id: string, dir: -1 | 1) => {
    const i = elements.findIndex(e => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= elements.length) return;
    const next = [...elements];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  // ── Dragging ──
  const onPointerDown = (e: React.PointerEvent, el: ReceiptElement, mode: "move" | "resize") => {
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
      // Snapped to 1mm: fine enough to line boxes up by eye on a page this size.
      const snap = (v: number) => Math.round(v);
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

  // Nudge with the arrow keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const step = e.shiftKey ? 5 : 1;
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
      setUploadError(`Image is ${(file.size / (1024 * 1024)).toFixed(1)}MB — keep it under ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      if (selected?.type === "image") update(selected.id, { src });
      else {
        const el = clampReceiptElement({ ...blankReceiptElement("image", page), src } as ReceiptElement, page);
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
        <button onClick={() => add("image")} style={btn}><ImageIcon size={13} /> Logo/Image</button>
        <button onClick={() => add("line")} style={btn}><Minus size={13} /> Line / Fill</button>
        <button onClick={() => add("shape")} style={btn}><Square size={13} /> Shape</button>
        <button onClick={() => add("qr")} style={btn}><QrCode size={13} /> QR Code</button>
        {kind === "receipt" ? (
          <button onClick={() => add("table")} style={btn}><Table2 size={13} /> Job Details Table</button>
        ) : (
          <button onClick={() => add("invoiceTable")} style={btn}><Table2 size={13} /> Invoice Table</button>
        )}
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
          Drag to move · corner to resize · arrows to nudge (Shift = 5mm) · Delete to remove
        </span>
      </div>

      {copyOpen && (
        <CopyReceiptDesignDialog
          sources={sources}
          target={{ w: widthMm, h: heightMm }}
          replacing={elements.length > 0}
          onClose={() => setCopyOpen(false)}
          onCopy={(src, scaleToFit) => {
            onChange(copyReceiptElements(src.elements, { w: src.widthMm, h: src.heightMm }, { w: widthMm, h: heightMm }, scaleToFit));
            setSelectedId(null);
            setCopyOpen(false);
          }}
        />
      )}

      {uploadError && (
        <p style={{ fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>{uploadError}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", gap: 16, alignItems: "start" }}>

        {/* ── The board ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
          <div
            onPointerDown={() => setSelectedId(null)}
            style={{
              position: "relative",
              width: widthMm * PX_PER_MM,
              height: heightMm * PX_PER_MM,
              flexShrink: 0,
              backgroundColor: "#fff",
              backgroundImage:
                "linear-gradient(45deg, #eef1f4 25%, transparent 25%), linear-gradient(-45deg, #eef1f4 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef1f4 75%), linear-gradient(-45deg, transparent 75%, #eef1f4 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
              border: "1px solid var(--border)",
              borderRadius: 4,
              overflow: "hidden",
              touchAction: "none",
            }}
          >
            {/* What actually prints, at editor zoom */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <ReceiptRender
                elements={elements}
                data={SAMPLE}
                widthMm={widthMm}
                heightMm={heightMm}
                scale={PX_PER_MM / (96 / 25.4)}
              />
            </div>

            {/* Interaction layer: hit boxes over the rendered output. */}
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
            {widthMm} × {heightMm} mm content area at {PX_PER_MM}px/mm · sample job shown
          </p>
        </div>

        {/* ── Properties ── */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {!selected ? (
            <>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>Elements</p>
              {elements.length === 0 ? (
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                  {kind === "receipt"
                    ? "Nothing on the receipt yet. Add your logo, some text, the QR code and the job details table, then drag them into place."
                    : "Nothing on the invoice yet. Add your logo, some text and the invoice table, then drag them into place."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {elements.map((el, i) => (
                    <button
                      key={el.id}
                      onClick={() => setSelectedId(el.id)}
                      style={{ textAlign: "left", padding: "6px 9px", borderRadius: 7, fontSize: 11.5, fontFamily: ff, cursor: "pointer", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >
                      {i + 1}. {el.type === "text" ? `“${el.text.slice(0, 18)}”` : el.type === "invoiceTable" ? "Invoice Table" : el.type === "shape" ? el.shape : el.type}
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
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", flex: 1, textTransform: "capitalize" }}>{selected.type === "table" ? "Job Details Table" : selected.type === "invoiceTable" ? "Invoice Table" : selected.type}</p>
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
                      {RECEIPT_TOKENS.filter(t => !t.kind || t.kind === kind).map(t => (
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
                  <Field label="Font">
                    <select
                      value={selected.fontFamily ?? DEFAULT_FONT_FAMILY}
                      onChange={e => update(selected.id, { fontFamily: e.target.value })}
                      style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 9px", fontSize: 12, color: "var(--text-primary)", fontFamily: selected.fontFamily ?? DEFAULT_FONT_FAMILY, outline: "none", cursor: "pointer" }}
                    >
                      {FONT_OPTIONS.map(f => (
                        <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                      ))}
                    </select>
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
                  <Field label="Colour">
                    <input
                      type="color"
                      value={selected.color}
                      onChange={e => update(selected.id, { color: e.target.value })}
                      style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }}
                    />
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

              {selected.type === "line" && (
                <Field label="Colour">
                  <input
                    type="color"
                    value={selected.color}
                    onChange={e => update(selected.id, { color: e.target.value })}
                    style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }}
                  />
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 6 }}>
                    A thin box is a rule; a tall one is a filled band — this is how the header/footer colour bars are built.
                  </p>
                </Field>
              )}

              {selected.type === "shape" && (
                <>
                  <Field label="Shape">
                    <div style={{ display: "flex", gap: 6 }}>
                      {SHAPES.map(sh => {
                        const on = selected.shape === sh.id;
                        return (
                          <button
                            key={sh.id}
                            onClick={() => update(selected.id, { shape: sh.id })}
                            style={{
                              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                              padding: "7px 8px", borderRadius: 7, cursor: "pointer", fontSize: 11.5, fontFamily: ff,
                              border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                              background: on ? "var(--accent-dim)" : "var(--bg-card)",
                              color: on ? "var(--accent)" : "var(--text-secondary)",
                              fontWeight: on ? 700 : 500,
                            }}
                          >
                            <sh.icon size={13} /> {sh.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  {/* A colour input cannot say "none", so the paint is a
                      checkbox and the swatch is what it is set to. An outline
                      with no fill is the common case on an invoice — a box
                      around a total — so it has to be expressible. */}
                  <PaintField
                    key={`${selected.id}-fill`}
                    label="Fill"
                    colour={selected.fill}
                    onChange={fill => update(selected.id, { fill })}
                    fallback="#f3f4f6"
                  />

                  <PaintField
                    key={`${selected.id}-stroke`}
                    label="Outline"
                    colour={selected.stroke}
                    onChange={stroke => update(selected.id, { stroke })}
                    fallback="#111111"
                  />

                  {selected.stroke !== "" && (
                    <Field label="Outline thickness (mm)">
                      <input
                        type="number"
                        step={0.1}
                        min={0.1}
                        value={selected.strokeWidth}
                        onChange={e => update(selected.id, { strokeWidth: Math.max(0.1, Number(e.target.value) || 0.1) })}
                        style={inputStyle}
                      />
                    </Field>
                  )}

                  {selected.shape === "rectangle" && (
                    <Field label="Corner radius (mm)">
                      <input
                        type="number"
                        step={0.5}
                        min={0}
                        value={selected.radius}
                        onChange={e => update(selected.id, { radius: Math.max(0, Number(e.target.value) || 0) })}
                        style={inputStyle}
                      />
                    </Field>
                  )}

                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Shapes paint in layer order, so send a filled one down the list
                    to sit behind the text it is meant to frame.
                  </p>
                </>
              )}

              {selected.type === "qr" && (
                <>
                  <Field label="Encoded value">
                    <input
                      type="text"
                      value={selected.value}
                      onChange={e => update(selected.id, { value: e.target.value })}
                      style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 9px", fontSize: 12, color: "var(--text-primary)", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                    />
                  </Field>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Usually {"{{trackUrl}}"} — the customer's job-status tracking link. Kept square automatically.
                  </p>
                </>
              )}

              {selected.type === "table" && (
                <>
                  <Field label="Header background">
                    <input type="color" value={selected.headerBg} onChange={e => update(selected.id, { headerBg: e.target.value })} style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }} />
                  </Field>
                  <Field label="Header text colour">
                    <input type="color" value={selected.headerColor} onChange={e => update(selected.id, { headerColor: e.target.value })} style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }} />
                  </Field>
                  <Field label="Border colour">
                    <input type="color" value={selected.borderColor} onChange={e => update(selected.id, { borderColor: e.target.value })} style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }} />
                  </Field>
                  <Row label="Font (pt)">
                    <NumIn value={selected.fontSize} onChange={v => update(selected.id, { fontSize: Math.max(4, v) })} />
                  </Row>
                  <Field label="Remarks text">
                    <input
                      type="text"
                      value={selected.remarks}
                      onChange={e => update(selected.id, { remarks: e.target.value })}
                      placeholder="e.g. Handle with care"
                      style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 9px", fontSize: 12, color: "var(--text-primary)", fontFamily: ff, outline: "none", boxSizing: "border-box" }}
                    />
                  </Field>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Device, IMEI, fault, estimate and advance always come from the job — only the Remarks column and the styling are set here.
                  </p>
                </>
              )}

              {selected.type === "invoiceTable" && (
                <>
                  <Field label="Header background">
                    <input type="color" value={selected.headerBg} onChange={e => update(selected.id, { headerBg: e.target.value })} style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }} />
                  </Field>
                  <Field label="Header text colour">
                    <input type="color" value={selected.headerColor} onChange={e => update(selected.id, { headerColor: e.target.value })} style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }} />
                  </Field>
                  <Field label="Border colour">
                    <input type="color" value={selected.borderColor} onChange={e => update(selected.id, { borderColor: e.target.value })} style={{ width: "100%", height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }} />
                  </Field>
                  <Row label="Font (pt)">
                    <NumIn value={selected.fontSize} onChange={v => update(selected.id, { fontSize: Math.max(4, v) })} />
                  </Row>
                  <InvoiceColumnsField
                    columns={invoiceColumns(selected)}
                    onChange={columns => update(selected.id, { columns })}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Copy design from another template ── */

/**
 * Picking a design to copy is a visual decision, so each option is shown as
 * the page it produces rather than as a name in a list. Mirrors LabelCanvas's
 * CopyDesignDialog — see that one for the reasoning behind scaleToFit.
 */
function CopyReceiptDesignDialog({ sources, target, replacing, onClose, onCopy }: {
  sources: ReceiptDesignSource[];
  target: { w: number; h: number };
  replacing: boolean;
  onClose: () => void;
  onCopy: (src: ReceiptDesignSource, scaleToFit: boolean) => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(sources[0]?.id ?? null);
  const picked = sources.find(s => s.id === pickedId) ?? null;
  const sizeDiffers = !!picked && (picked.widthMm !== target.w || picked.heightMm !== target.h);
  // Only meaningful when the page size differs; defaulted on there, because
  // an unscaled copy onto a smaller page loses whatever falls off the edge.
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
              Reuse another receipt or invoice&apos;s arrangement on this one. Only the design is copied — this template keeps its own name, size and settings.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sources.map(src => {
              const active = src.id === pickedId;
              // Shown small: enough to recognise the arrangement, not to read.
              const previewScale = Math.min(220 / src.widthMm, 140 / src.heightMm) / (96 / 25.4);
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
                    <ReceiptRender
                      elements={src.elements}
                      data={SAMPLE}
                      widthMm={src.widthMm}
                      heightMm={src.heightMm}
                      scale={previewScale}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: active ? "var(--accent)" : "var(--text-primary)" }}>{src.name}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{src.kindLabel}</p>
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
                That design is laid out for <strong>{picked.widthMm} × {picked.heightMm} mm</strong> and this page is{" "}
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
              This replaces the design currently on this template.
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

/**
 * Choosing and sizing the invoice table's columns.
 *
 * Two jobs in one control because they are one decision in the shop's head:
 * which fields the invoice shows, and how much room each gets. The proportion
 * bar at the top is the sizing — dragging a divider moves width between the
 * two columns either side of it and leaves every other column alone, which is
 * how a table behaves everywhere else and means a drag can never quietly
 * reflow the whole row.
 */
function InvoiceColumnsField({ columns, onChange }: {
  columns: InvoiceColumn[]; onChange: (c: InvoiceColumn[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const total = columns.reduce((n, c) => n + Math.max(1, c.width), 0);
  const unused = INVOICE_COLUMNS.filter(k => !columns.some(c => c.id === k.id));

  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  /**
   * Drag a divider. Widths are shares of the table rather than millimetres, so
   * they keep their meaning whatever the element is resized to; both
   * neighbours keep a floor of 2% so a column can never be dragged away to
   * nothing and left impossible to grab again.
   */
  const startDrag = (i: number) => (down: React.PointerEvent) => {
    down.preventDefault();
    const bar = barRef.current;
    if (!bar) return;
    const barW = bar.getBoundingClientRect().width;
    if (barW <= 0) return;

    const startX = down.clientX;
    const a = Math.max(1, columns[i].width);
    const pair = a + Math.max(1, columns[i + 1].width);
    const MIN = total * 0.02;

    const onMove = (m: PointerEvent) => {
      const shift = ((m.clientX - startX) / barW) * total;
      const nextA = Math.min(pair - MIN, Math.max(MIN, a + shift));
      const next = [...columns];
      next[i] = { ...next[i], width: Math.round(nextA * 10) / 10 };
      next[i + 1] = { ...next[i + 1], width: Math.round((pair - nextA) * 10) / 10 };
      onChange(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: ff }}>
        Columns
      </label>

      {/* The table's proportions, to scale. Drag a divider to move width
          between the two columns it separates. */}
      <div
        ref={barRef}
        style={{ display: "flex", height: 30, borderRadius: 7, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-card)", userSelect: "none" }}
      >
        {columns.map((c, i) => (
          <div key={`${c.id}-${i}`} style={{ position: "relative", width: `${(Math.max(1, c.width) / total) * 100}%`, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", background: i % 2 ? "var(--accent-dim)" : "transparent" }}>
            <span style={{ fontSize: 9.5, color: "var(--text-muted)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 3px" }}>
              {Math.round((Math.max(1, c.width) / total) * 100)}%
            </span>
            {i < columns.length - 1 && (
              <div
                onPointerDown={startDrag(i)}
                title={`Resize ${c.label} / ${columns[i + 1].label}`}
                style={{ position: "absolute", top: 0, right: -4, width: 9, height: "100%", cursor: "col-resize", zIndex: 1 }}
              >
                <div style={{ width: 1, height: "100%", margin: "0 auto", background: "var(--border)" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* One row per column, in print order. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {columns.map((c, i) => {
          const spec = INVOICE_COLUMNS.find(k => k.id === c.id);
          return (
            <div key={`${c.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <GripVertical size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                type="text"
                value={c.label}
                onChange={e => {
                  const next = [...columns];
                  next[i] = { ...next[i], label: e.target.value };
                  onChange(next);
                }}
                placeholder={spec?.label}
                title={`Prints: ${spec?.label ?? c.id}`}
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
              <button onClick={() => move(i, -1)} disabled={i === 0} title="Move left"
                style={{ ...miniBtn, opacity: i === 0 ? 0.35 : 1 }}><ArrowUp size={11} /></button>
              <button onClick={() => move(i, 1)} disabled={i === columns.length - 1} title="Move right"
                style={{ ...miniBtn, opacity: i === columns.length - 1 ? 0.35 : 1 }}><ArrowDown size={11} /></button>
              <button
                onClick={() => onChange(columns.filter((_, n) => n !== i))}
                disabled={columns.length <= 1}
                title="Remove column"
                style={{ ...miniBtn, opacity: columns.length <= 1 ? 0.35 : 1, color: "#f87171" }}
              ><X size={11} /></button>
            </div>
          );
        })}
      </div>

      {adding ? (
        <select
          autoFocus
          defaultValue=""
          onChange={e => {
            const spec = INVOICE_COLUMNS.find(k => k.id === e.target.value);
            if (spec) {
              // Seeded at the average of what is already there, so a new column
              // lands looking like its neighbours rather than as a sliver
              // nobody can see or grab.
              const avg = Math.round((total / Math.max(1, columns.length)) * 10) / 10;
              onChange([...columns, { id: spec.id, label: spec.label, width: avg }]);
            }
            setAdding(false);
          }}
          onBlur={() => setAdding(false)}
          style={inputStyle}
        >
          <option value="" disabled>Choose a field…</option>
          {unused.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={unused.length === 0}
          style={{ ...addBtn, opacity: unused.length === 0 ? 0.4 : 1 }}
        >
          <Plus size={12} /> Add column
        </button>
      )}

      <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Every column reads from the job — the name here is only the printed heading.
        Drag a divider above to move width between two columns.
      </p>
    </div>
  );
}

const addBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: ff,
  cursor: "pointer", background: "var(--bg-surface)", border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

const miniBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  width: 26, height: 28, borderRadius: 7, cursor: "pointer",
  background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)",
};

const SHAPES = [
  { id: "rectangle" as const, label: "Rectangle", icon: Square },
  { id: "ellipse"   as const, label: "Ellipse",   icon: Circle },
];

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)",
  borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "var(--text-primary)",
  fontFamily: ff, outline: "none",
};

/**
 * A colour that is allowed to be absent.
 *
 * `<input type="color">` has no empty state — it always reports something — so
 * the on/off lives in a checkbox beside it and "" is the stored value for off.
 * Unticking keeps nothing; re-ticking restores the colour it was last set to,
 * or `fallback` if it has never had one, so the swatch is never a surprise.
 * Key this by element id — the remembered colour belongs to the shape you were
 * editing, not to the panel.
 */
function PaintField({ label, colour, onChange, fallback }: {
  label: string; colour: string; onChange: (c: string) => void; fallback: string;
}) {
  const [last, setLast] = useState(colour || fallback);

  return (
    <Field label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontFamily: ff, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={colour !== ""}
            onChange={e => onChange(e.target.checked ? last : "")}
            style={{ accentColor: "var(--accent)", cursor: "pointer" }}
          />
          {colour === "" ? "None" : "On"}
        </label>
        {colour !== "" && (
          <input
            type="color"
            value={colour}
            onChange={e => { setLast(e.target.value); onChange(e.target.value); }}
            style={{ flex: 1, minWidth: 0, height: 30, background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer" }}
          />
        )}
      </div>
    </Field>
  );
}

/* ── Small building blocks — identical to LabelCanvas's ── */

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
      step={1}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ flex: 1, minWidth: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "var(--text-primary)", fontFamily: ff, outline: "none" }}
    />
  );
}
