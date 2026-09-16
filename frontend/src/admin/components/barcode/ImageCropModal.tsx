"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crop, Scissors, X, RotateCcw } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

/** The cropped image is stored inline in the template row — see LabelCanvas. */
const MAX_OUTPUT_BYTES = 200_000;
/** A label is 50mm wide; nothing on it needs more pixels than this. */
const MAX_SIDE = 1000;
/** The stage the picture is shown on, in CSS px. */
const STAGE_W = 560;
const STAGE_H = 380;
const HANDLE = 10;

interface Rect { x: number; y: number; w: number; h: number }
type Grip = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * Crop a label image.
 *
 * A logo file is rarely the logo: it is the logo with a margin of white or
 * transparent canvas around it, and on a 50mm label that margin is most of
 * the box. This lets the designer draw the part that matters — or press
 * "Trim edges" and have the margin found for them — and writes the result
 * back as a new image, at the picture's own pixel size, never upscaled.
 *
 * Coordinates: the crop rectangle is kept in image pixels and drawn at the
 * stage's scale, so the result does not depend on how big the modal is.
 */
export default function ImageCropModal({ src, onApply, onClose }: {
  src: string;
  onApply: (dataUrl: string, size: { w: number; h: number }) => void;
  onClose: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = new Image();
    el.onload = () => { setImg(el); setRect({ x: 0, y: 0, w: el.naturalWidth, h: el.naturalHeight }); };
    el.onerror = () => setError("Could not load that image.");
    el.src = src;
  }, [src]);

  const natW = img?.naturalWidth ?? 1;
  const natH = img?.naturalHeight ?? 1;
  const k = Math.min(STAGE_W / natW, STAGE_H / natH, 1.5);
  const shownW = natW * k;
  const shownH = natH * k;

  const clampRect = (r: Rect): Rect => {
    const w = Math.max(8, Math.min(r.w, natW));
    const h = Math.max(8, Math.min(r.h, natH));
    return { w, h, x: Math.max(0, Math.min(r.x, natW - w)), y: Math.max(0, Math.min(r.y, natH - h)) };
  };

  // The drag lives in this closure: where it started and what the box was.
  // Nothing about it needs to survive a render, so nothing is stored.
  const beginDrag = (grip: Grip, e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, o = rect;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / k;
      const dy = (ev.clientY - startY) / k;
      let next: Rect = { ...o };
      switch (grip) {
        case "move": next = { ...o, x: o.x + dx, y: o.y + dy }; break;
        case "e":  next = { ...o, w: o.w + dx }; break;
        case "w":  next = { ...o, x: o.x + dx, w: o.w - dx }; break;
        case "s":  next = { ...o, h: o.h + dy }; break;
        case "n":  next = { ...o, y: o.y + dy, h: o.h - dy }; break;
        case "se": next = { ...o, w: o.w + dx, h: o.h + dy }; break;
        case "sw": next = { ...o, x: o.x + dx, w: o.w - dx, h: o.h + dy }; break;
        case "ne": next = { ...o, y: o.y + dy, w: o.w + dx, h: o.h - dy }; break;
        case "nw": next = { ...o, x: o.x + dx, y: o.y + dy, w: o.w - dx, h: o.h - dy }; break;
      }
      // A handle dragged past its opposite edge flips the box rather than
      // collapsing it to nothing.
      if (next.w < 8) { next.x = Math.min(next.x, o.x + o.w - 8); next.w = 8; }
      if (next.h < 8) { next.y = Math.min(next.y, o.y + o.h - 8); next.h = 8; }
      setRect(clampRect(next));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /**
   * Find the picture inside its margins.
   *
   * Anything transparent, or near enough white, counts as margin. That is what
   * a logo exported from a design tool is wrapped in; a photo would trim to
   * nothing useful, but photos do not go on labels.
   */
  const trimEdges = () => {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = natW; c.height = natH;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, 0, natW, natH).data;
    } catch {
      setError("This image cannot be read for trimming — crop it by hand.");
      return;
    }
    const isInk = (i: number) => data[i + 3] > 12 && !(data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238);
    let top = natH, left = natW, right = -1, bottom = -1;
    for (let y = 0; y < natH; y++) {
      for (let x = 0; x < natW; x++) {
        if (isInk((y * natW + x) * 4)) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    if (right < 0) { setError("Nothing but margin was found in this image."); return; }
    const pad = Math.round(Math.max(natW, natH) * 0.01) + 1;
    setError(null);
    setRect(clampRect({ x: left - pad, y: top - pad, w: right - left + 1 + pad * 2, h: bottom - top + 1 + pad * 2 }));
  };

  const apply = () => {
    if (!img || !rect) return;
    const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
    // Never larger than the source, and never past what a label can use.
    let scale = Math.min(1, MAX_SIDE / Math.max(r.w, r.h));
    for (let attempt = 0; attempt < 8; attempt++) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(r.w * scale));
      c.height = Math.max(1, Math.round(r.h * scale));
      const ctx = c.getContext("2d");
      if (!ctx) { setError("Could not draw the cropped image."); return; }
      ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      let out: string;
      try {
        out = c.toDataURL("image/png");
      } catch {
        setError("This image cannot be cropped here — it is served from another site.");
        return;
      }
      // A data URI is ~4/3 the size of the bytes it carries.
      if (out.length * 0.75 <= MAX_OUTPUT_BYTES) {
        onApply(out, { w: c.width, h: c.height });
        return;
      }
      scale *= 0.8;
    }
    setError("The cropped image is still too large to store. Crop tighter, or start from a smaller file.");
  };

  if (typeof document === "undefined") return null;

  const handleStyle = (pos: React.CSSProperties, cursor: string): React.CSSProperties => ({
    position: "absolute", width: HANDLE, height: HANDLE, borderRadius: 3,
    background: "#fff", border: "1.5px solid #6355ff", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
    cursor, ...pos,
  });
  const edgeStyle = (pos: React.CSSProperties, cursor: string): React.CSSProperties => ({
    position: "absolute", cursor, ...pos,
  });

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 640, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", fontFamily: ff, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              <Crop size={15} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Crop image</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {img ? `${natW} × ${natH} px` : "Loading…"}
                {rect && img ? ` · keeping ${Math.round(rect.w)} × ${Math.round(rect.h)}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={16} /></button>
        </div>

        {/* The stage: a checkerboard so a transparent logo's edges can be seen. */}
        <div style={{ padding: 20, display: "flex", justifyContent: "center", background: "var(--bg-secondary)" }}>
          <div style={{ width: STAGE_W, height: STAGE_H, maxWidth: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {img && rect ? (
              <div
                style={{
                  position: "relative", width: shownW, height: shownH, userSelect: "none", touchAction: "none",
                  backgroundColor: "#ddd",
                  backgroundImage: "linear-gradient(45deg, #bbb 25%, transparent 25%), linear-gradient(-45deg, #bbb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #bbb 75%), linear-gradient(-45deg, transparent 75%, #bbb 75%)",
                  backgroundSize: "16px 16px", backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI drawn at a measured size; next/image cannot do either */}
                <img src={src} alt="" draggable={false} style={{ display: "block", width: shownW, height: shownH, pointerEvents: "none" }} />

                {/* Dimmed margins, drawn as four panes around the crop so the
                    kept part shows at full strength. */}
                {[
                  { left: 0, top: 0, width: shownW, height: rect.y * k },
                  { left: 0, top: (rect.y + rect.h) * k, width: shownW, height: shownH - (rect.y + rect.h) * k },
                  { left: 0, top: rect.y * k, width: rect.x * k, height: rect.h * k },
                  { left: (rect.x + rect.w) * k, top: rect.y * k, width: shownW - (rect.x + rect.w) * k, height: rect.h * k },
                ].map((p, i) => <div key={i} style={{ position: "absolute", background: "rgba(0,0,0,0.55)", pointerEvents: "none", ...p }} />)}

                <div
                  onPointerDown={e => beginDrag("move", e)}
                  style={{ position: "absolute", left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k, border: "1.5px solid #6355ff", boxShadow: "0 0 0 1px rgba(255,255,255,0.6) inset", cursor: "move", boxSizing: "border-box" }}
                >
                  <div onPointerDown={e => beginDrag("n", e)} style={edgeStyle({ left: HANDLE, right: HANDLE, top: -4, height: 8 }, "ns-resize")} />
                  <div onPointerDown={e => beginDrag("s", e)} style={edgeStyle({ left: HANDLE, right: HANDLE, bottom: -4, height: 8 }, "ns-resize")} />
                  <div onPointerDown={e => beginDrag("w", e)} style={edgeStyle({ top: HANDLE, bottom: HANDLE, left: -4, width: 8 }, "ew-resize")} />
                  <div onPointerDown={e => beginDrag("e", e)} style={edgeStyle({ top: HANDLE, bottom: HANDLE, right: -4, width: 8 }, "ew-resize")} />
                  <div onPointerDown={e => beginDrag("nw", e)} style={handleStyle({ left: -HANDLE / 2, top: -HANDLE / 2 }, "nwse-resize")} />
                  <div onPointerDown={e => beginDrag("ne", e)} style={handleStyle({ right: -HANDLE / 2, top: -HANDLE / 2 }, "nesw-resize")} />
                  <div onPointerDown={e => beginDrag("sw", e)} style={handleStyle({ left: -HANDLE / 2, bottom: -HANDLE / 2 }, "nesw-resize")} />
                  <div onPointerDown={e => beginDrag("se", e)} style={handleStyle({ right: -HANDLE / 2, bottom: -HANDLE / 2 }, "nwse-resize")} />
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: error ? "#f87171" : "var(--text-muted)" }}>{error ?? "Loading image…"}</p>
            )}
          </div>
        </div>

        {error && img && (
          <p style={{ fontSize: 12, color: "#f87171", padding: "10px 20px 0", lineHeight: 1.5 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={trimEdges} disabled={!img} style={{ ...ghost, display: "flex", alignItems: "center", gap: 6 }} title="Find the picture inside its white or transparent margin">
            <Scissors size={13} /> Trim edges
          </button>
          <button onClick={() => img && setRect({ x: 0, y: 0, w: natW, h: natH })} disabled={!img} style={{ ...ghost, display: "flex", alignItems: "center", gap: 6 }}>
            <RotateCcw size={13} /> Whole image
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={ghost}>Cancel</button>
          <button onClick={apply} disabled={!img || !rect} style={{ ...ghost, background: "var(--accent)", color: "var(--accent-fg)", border: "none", fontWeight: 700 }}>
            Apply crop
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ghost: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 9, border: "1px solid var(--border)",
  background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
  fontSize: 12.5, fontFamily: ff, fontWeight: 600,
};
