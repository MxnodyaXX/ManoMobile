"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Type, Image as ImageIcon, Minus, QrCode, Table2,
  Trash2, Copy, ArrowUp, ArrowDown, Upload,
} from "lucide-react";
import ReceiptRender from "@/cashier/components/shared/ReceiptRender";
import { SHOP_DETAILS } from "@/lib/shop";
import {
  blankReceiptElement, clampReceiptElement, RECEIPT_TOKENS,
  type ReceiptElement, type ReceiptElementType, type ReceiptData, type TemplateKind,
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

interface ReceiptCanvasProps {
  elements: ReceiptElement[];
  onChange: (els: ReceiptElement[]) => void;
  widthMm: number;
  heightMm: number;
  kind: TemplateKind;
}

export default function ReceiptCanvas({ elements, onChange, widthMm, heightMm, kind }: ReceiptCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
          Drag to move · corner to resize · arrows to nudge (Shift = 5mm) · Delete to remove
        </span>
      </div>

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
                      {i + 1}. {el.type === "text" ? `“${el.text.slice(0, 18)}”` : el.type === "invoiceTable" ? "Invoice Table" : el.type}
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
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Item, IMEI, warranty, advance, unit price, discount and line total always come from the job — only the styling is set here.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
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
