"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Eraser, PenLine } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * A small canvas signature capture. Emits a PNG data-URL via onChange when the
 * stroke ends, and an empty string when cleared. Works with mouse and touch.
 */
export default function SignaturePad({
  value,
  onChange,
  height = 150,
  label = "Signature",
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);

  // Size the canvas to its container (DPR-aware) and repaint an existing value.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };

  const end = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas && hasInk) onChange(canvas.toDataURL("image/png"));
  }, [hasInk, onChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasInk(false);
    onChange("");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: ff }}>
          <PenLine size={12} /> {label}
        </span>
        <button
          type="button"
          onClick={clear}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontFamily: ff }}
        >
          <Eraser size={11} /> Clear
        </button>
      </div>
      <div style={{ position: "relative", borderRadius: 10, border: `1px solid ${hasInk ? "var(--accent)" : "var(--border)"}`, background: "#fff", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          style={{ width: "100%", height, display: "block", touchAction: "none", cursor: "crosshair" }}
        />
        {!hasInk && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: "#bbb", fontSize: 13, fontFamily: ff }}>
            Sign here
          </span>
        )}
      </div>
    </div>
  );
}
