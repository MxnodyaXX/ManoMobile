"use client";

import { LayoutDashboard, ClipboardList, PackageCheck, Layers, History, LogOut, Wrench, TrendingUp, Timer } from "lucide-react";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

export type TechPage = "Dashboard" | "My Jobs" | "Pending Collection" | "Parts & Stock" | "Job History" | "My Performance" | "My Shift";

const NAV_ITEMS: { id: TechPage; icon: any; label: string }[] = [
  { id: "Dashboard",          icon: LayoutDashboard, label: "Dashboard"          },
  { id: "My Jobs",            icon: ClipboardList,   label: "My Jobs"            },
  { id: "Pending Collection", icon: PackageCheck,    label: "Pending Collection" },
  { id: "Parts & Stock",      icon: Layers,          label: "Parts & Stock"      },
  { id: "Job History",        icon: History,         label: "Job History"        },
  { id: "My Performance",     icon: TrendingUp,      label: "My Performance"     },
  { id: "My Shift",           icon: Timer,           label: "My Shift"           },
];

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

interface Props {
  activePage: TechPage;
  onNavigate: (p: TechPage) => void;
  techName: string;
  onLogout: () => void;
  jobCounts?: Partial<Record<TechPage, number>>;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function TechSidebar({ activePage, onNavigate, techName, onLogout, jobCounts = {}, isOpen = false, onClose }: Props) {
  const isMobile = useIsMobile();

  const handleNavigate = (p: TechPage) => {
    onNavigate(p);
    if (isMobile && onClose) onClose();
  };

  return (
    <>
      {isMobile && isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}
      <aside style={{
        width: isMobile ? 280 : 220,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        height: "100vh", flexShrink: 0, fontFamily: ff,
        ...(isMobile ? {
          position: "fixed", top: 0, left: 0, zIndex: 50,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        } : {}),
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${TA}14`, border: `1px solid ${TA}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Wrench size={15} color={TA} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Mano Mobile</p>
            <p style={{ fontSize: 10, color: TA, fontWeight: 600, fontFamily: ff, letterSpacing: "0.04em" }}>TECHNICIAN</p>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "10px 10px 0", overflowY: "auto" }}>
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
            const active = activePage === id;
            const count = jobCounts[id];
            return (
              <button
                key={id}
                onClick={() => handleNavigate(id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: isMobile ? "13px 12px" : "9px 12px",
                  borderRadius: 9,
                  border: active ? `1px solid ${TA}30` : "1px solid transparent",
                  background: active ? `${TA}0e` : "transparent",
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  marginBottom: 3, fontFamily: ff,
                  minHeight: isMobile ? 52 : "auto",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <Icon size={isMobile ? 18 : 15} strokeWidth={active ? 2.4 : 1.8} color={active ? TA : "var(--text-muted)"} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: active ? 600 : 400, color: active ? "var(--text-primary)" : "var(--text-secondary)", flex: 1, fontFamily: ff }}>
                  {label}
                </span>
                {count !== undefined && count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: active ? TA : "rgba(52,211,153,0.15)", color: active ? "#000" : TA, borderRadius: 20, padding: "2px 7px", minWidth: 20, textAlign: "center", fontFamily: ff }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Tech identity + logout */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${TA}14`, border: `1px solid ${TA}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: TA, fontFamily: ff, flexShrink: 0 }}>
              {techName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{techName}</p>
              <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: ff }}>On shift</p>
            </div>
            <button onClick={onLogout} title="Log out" style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 6, color: "var(--text-muted)", transition: "color 0.15s, background 0.15s", flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
