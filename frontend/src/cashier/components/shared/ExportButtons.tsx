"use client";

import { useState } from "react";
import { FileText, FileSpreadsheet, Image } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

interface ExportButtonsProps {
  onPdf:   () => Promise<void> | void;
  onExcel: () => Promise<void> | void;
  onPng:   () => Promise<void> | void;
}

const BTN_DEFS = [
  { key: "pdf"   as const, label: "PDF",   Icon: FileText,        color: "#f87171" },
  { key: "excel" as const, label: "Excel", Icon: FileSpreadsheet, color: "#4ade80" },
  { key: "png"   as const, label: "PNG",   Icon: Image,           color: "#60a5fa" },
];

export default function ExportButtons({ onPdf, onExcel, onPng }: ExportButtonsProps) {
  const [loading, setLoading] = useState<"pdf" | "excel" | "png" | null>(null);
  const isMobile = useIsMobile();

  const fns = { pdf: onPdf, excel: onExcel, png: onPng };

  const handle = async (key: "pdf" | "excel" | "png") => {
    if (loading) return;
    setLoading(key);
    try { await fns[key](); } finally { setLoading(null); }
  };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {BTN_DEFS.map(({ key, label, Icon, color }) => (
        <button
          key={key}
          onClick={() => handle(key)}
          disabled={loading !== null}
          title={`Export as ${label}`}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 11px", borderRadius: 8,
            border: `1px solid ${color}35`,
            background: loading === key ? `${color}22` : `${color}12`,
            color,
            fontSize: 11.5, fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            cursor: loading ? (loading === key ? "wait" : "not-allowed") : "pointer",
            opacity: loading !== null && loading !== key ? 0.45 : 1,
            transition: "background 0.15s, opacity 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          <Icon size={12} />
          {!isMobile && (loading === key ? "…" : label)}
        </button>
      ))}
    </div>
  );
}
