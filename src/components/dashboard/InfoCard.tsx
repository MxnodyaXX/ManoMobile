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
        borderRadius: 14, padding: "22px 24px",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between", gap: 18,
        minHeight: 140, cursor: "pointer",
        position: "relative", overflow: "hidden",
        transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
        boxShadow: accent ? "0 4px 20px rgba(79,70,229,0.35)" : "var(--shadow-card)",
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
        <>
          <div style={{
            position: "absolute", right: -30, top: -30,
            width: 100, height: 100, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }} />
          <div style={{
            position: "absolute", right: 20, bottom: -20,
            width: 60, height: 60, borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
          }} />
        </>
      )}
      <div>
        {tag && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: accent ? "rgba(255,255,255,0.65)" : "var(--text-muted)",
            display: "block", marginBottom: 10,
          }}>
            {tag}
          </span>
        )}
        <h3 className="heading" style={{ fontSize: 16, color: accent ? "#ffffff" : "var(--text-primary)", lineHeight: 1.3 }}>
          {title}
        </h3>
        <p style={{ fontSize: 13.5, color: accent ? "rgba(255,255,255,0.72)" : "var(--text-secondary)", marginTop: 8, lineHeight: 1.65, fontWeight: 400 }}>
          {description}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: accent ? "rgba(255,255,255,0.18)" : "var(--accent-dim)",
          border: accent ? "none" : "1px solid var(--accent-glow)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent ? "#ffffff" : "var(--accent)",
        }}>
          <ArrowRight size={13} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}