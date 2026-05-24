"use client";

import { useEffect, useState } from "react";
import { Clock, Wifi, Bell, Menu } from "lucide-react";
import { useRepair } from "@/cashier/contexts/RepairContext";
import { useTech } from "@/technician/contexts/TechContext";
import { useIsMobile } from "@/cashier/hooks/useIsMobile";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";

interface Props {
  activePage: string;
  onMenuClick?: () => void;
}

export default function TechNavbar({ activePage, onMenuClick }: Props) {
  const { jobs } = useRepair();
  const { technicianName, partRequests } = useTech();
  const isMobile = useIsMobile();
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const myActiveJob = jobs.find(j => j.technician === technicianName && j.status === "Issued");
  const pendingRequests = partRequests.filter(r => r.status === "Pending").length;
  const approvedRequests = partRequests.filter(r => r.status === "Approved").length;

  const fmtTime = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <header style={{
      height: isMobile ? 56 : 54,
      background: "var(--bg-secondary)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: isMobile ? "0 14px" : "0 20px",
      gap: 10, flexShrink: 0, fontFamily: ff,
    }}>
      {/* Hamburger */}
      <button className="hamburger-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={18} />
      </button>

      {/* Page title */}
      <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {activePage}
      </p>

      {/* Active job badge — hide on small mobile */}
      {myActiveJob && !isMobile && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "5px 12px", borderRadius: 20,
          background: `${TA}10`, border: `1px solid ${TA}30`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: TA, animation: "pulse-tech 2s infinite", display: "inline-block" }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: TA, fontFamily: ff }}>
            Active: {myActiveJob.id}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>
            {myActiveJob.brand} {myActiveJob.model}
          </span>
        </div>
      )}

      {/* Notifications */}
      {(pendingRequests > 0 || approvedRequests > 0) && (
        <div style={{ position: "relative" }}>
          <Bell size={16} color="var(--text-muted)" />
          <span style={{
            position: "absolute", top: -5, right: -5,
            width: 14, height: 14, borderRadius: "50%",
            background: approvedRequests > 0 ? TA : "#fbbf24",
            fontSize: 9, fontWeight: 700, color: "#000",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: ff,
          }}>
            {approvedRequests > 0 ? approvedRequests : pendingRequests}
          </span>
        </div>
      )}

      {/* Connection + Clock — desktop only */}
      {!isMobile && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Wifi size={13} color={TA} />
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Online</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <Clock size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: ff, fontVariantNumeric: "tabular-nums" }}>
              {fmtTime(time)}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>{fmtDate(time)}</span>
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse-tech {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </header>
  );
}
