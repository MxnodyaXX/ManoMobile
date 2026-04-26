"use client";

import { ArrowRight } from "lucide-react";

export default function InfoCard({
  title, description, tag, accent = false, index = 0,
}: {
  title: string; description: string; tag?: string; accent?: boolean; index?: number;
}) {
  return (
    <div
      className={`fade-up fade-up-${index + 5}`}
      style={{
        background: accent ? "var(--accent)" : "var(--bg-card)",
        border: `1px solid ${accent ? "transparent" : "var(--border)"}`,
        borderRadius: 16, padding: "24px",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between", gap: 20,
        minHeight: 140, cursor: "pointer",
        position: "relative", overflow: "hidden",
        transition: "border-color 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = accent ? "transparent" : "var(--border-active)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = accent ? "transparent" : "var(--border)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {accent && (
        <div style={{
          position: "absolute", right: -20, bottom: -20,
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(0,0,0,0.08)",
        }} />
      )}
      <div>
        {tag && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: accent ? "rgba(0,0,0,0.5)" : "var(--text-muted)",
            fontFamily: "'Syne', sans-serif",
            display: "block", marginBottom: 10,
          }}>
            {tag}
          </span>
        )}
        <h3 className="heading" style={{ fontSize: 17, color: accent ? "#0a0a0f" : "var(--text-primary)", lineHeight: 1.3 }}>
          {title}
        </h3>
        <p style={{ fontSize: 13, color: accent ? "rgba(0,0,0,0.55)" : "var(--text-secondary)", marginTop: 8, lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: accent ? "rgba(0,0,0,0.12)" : "var(--accent-dim)",
          border: accent ? "none" : "1px solid var(--accent-glow)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent ? "#0a0a0f" : "var(--accent)",
        }}>
          <ArrowRight size={13} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}