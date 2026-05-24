"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wrench, ShoppingCart, Shield, Landmark, ArrowRight, Smartphone, X, Zap } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";
const TECH_NAMES = ["Kamal", "Nimal", "Suresh"];

const ROLES = [
  {
    id: "cashier",
    label: "Cashier",
    sub: "Sales, repairs,\ninventory & reports",
    icon: ShoppingCart,
    color: "#6355ff",
    badge: "Full Access",
  },
  {
    id: "technician",
    label: "Technician",
    sub: "Repair jobs, status\nupdates & parts",
    icon: Wrench,
    color: "#34d399",
    badge: "Repair Focus",
  },
  {
    id: "admin",
    label: "Admin",
    sub: "System config &\naccess control",
    icon: Shield,
    color: "#a78bfa",
    badge: "Admin Only",
  },
  {
    id: "accounts",
    label: "Accounts",
    sub: "Ledger, AR/AP &\nfinancial reports",
    icon: Landmark,
    color: "#f59e0b",
    badge: "Finance",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);
  const [showTechPicker, setShowTechPicker] = useState(false);
  const [hoveredTech, setHoveredTech] = useState<string | null>(null);

  const handleRoleClick = (id: string) => {
    if (id === "technician") { setShowTechPicker(true); return; }
    if (id === "accounts")   { router.push("/accounts"); return; }
    if (id === "admin")      { router.push("/admin"); return; }
    router.push("/cashier");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: ff,
      padding: "40px 20px",
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 740, display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>

        {/* Brand mark */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 60, height: 60, borderRadius: 17,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.5)",
          }}>
            <Smartphone size={26} color="var(--text-secondary)" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 6, fontFamily: ff }}>
            Mano Mobile
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>
            Select your role to continue
          </p>
        </div>

        {/* Role cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, width: "100%" }}>
          {ROLES.map(role => {
            const Icon = role.icon;
            const hov = hoveredRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => handleRoleClick(role.id)}
                onMouseEnter={() => setHoveredRole(role.id)}
                onMouseLeave={() => setHoveredRole(null)}
                style={{
                  background: hov ? "var(--bg-card-hover)" : "var(--bg-card)",
                  border: `1px solid ${hov ? role.color + "55" : "var(--border)"}`,
                  borderRadius: 16, padding: "28px 22px",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.18s",
                  display: "flex", flexDirection: "column", gap: 18,
                  boxShadow: hov ? `0 0 0 1px ${role.color}22, 0 8px 36px rgba(0,0,0,0.35)` : "0 1px 3px rgba(0,0,0,0.3)",
                  fontFamily: ff,
                  transform: hov ? "translateY(-2px)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${role.color}14`, border: `1px solid ${role.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center", color: role.color,
                    transition: "background 0.18s",
                    ...(hov ? { background: `${role.color}22` } : {}),
                  }}>
                    <Icon size={20} />
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                    background: `${role.color}12`, color: role.color,
                    border: `1px solid ${role.color}25`, fontFamily: ff,
                    letterSpacing: "0.04em",
                  }}>
                    {role.badge}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, fontFamily: ff }}>{role.label}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.65, whiteSpace: "pre-line", fontFamily: ff }}>{role.sub}</p>
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 5, paddingTop: 4,
                  borderTop: `1px solid ${hov ? role.color + "22" : "var(--border)"}`,
                  color: hov ? role.color : "var(--text-muted)",
                  transition: "color 0.18s, border-color 0.18s",
                }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: ff }}>Sign in as {role.label}</span>
                  <ArrowRight size={12} style={{ marginLeft: "auto" }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={11} color="var(--text-muted)" />
          <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Mano Mobile POS &middot; v1.0.0</p>
        </div>
      </div>

      {/* Technician name picker overlay */}
      {showTechPicker && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, backdropFilter: "blur(8px)",
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowTechPicker(false); }}
        >
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 20, padding: "32px 28px", width: 380,
            display: "flex", flexDirection: "column", gap: 24,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Wrench size={13} color="#34d399" />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Select Technician</p>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>Choose your name to access your repair queue</p>
              </div>
              <button
                onClick={() => setShowTechPicker(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6 }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--border)" }} />

            {/* Tech cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TECH_NAMES.map(name => {
                const hov = hoveredTech === name;
                return (
                  <button
                    key={name}
                    onClick={() => router.push(`/technician?tech=${name}`)}
                    onMouseEnter={() => setHoveredTech(name)}
                    onMouseLeave={() => setHoveredTech(null)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: 12,
                      background: hov ? "rgba(52,211,153,0.07)" : "var(--bg-secondary)",
                      border: `1px solid ${hov ? "rgba(52,211,153,0.35)" : "var(--border)"}`,
                      cursor: "pointer", transition: "all 0.15s", fontFamily: ff,
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 11,
                      background: hov ? "rgba(52,211,153,0.18)" : "rgba(52,211,153,0.08)",
                      border: `1px solid ${hov ? "rgba(52,211,153,0.4)" : "rgba(52,211,153,0.2)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 800, color: "#34d399", fontFamily: ff,
                      transition: "all 0.15s", flexShrink: 0,
                    }}>
                      {name[0]}
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff }}>{name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Repair Technician</p>
                    </div>
                    <ArrowRight size={14} style={{ color: hov ? "#34d399" : "var(--text-muted)", transition: "color 0.15s", flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
