"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Wrench, ArrowRight, History, CheckCircle, XCircle, User } from "lucide-react";
import { RepairProvider, useRepair } from "@/cashier/contexts/RepairContext";
import { useTechnicians } from "@/lib/repair/technicians";
import { WarrantyProvider } from "@/cashier/contexts/WarrantyContext";
import { PartsProvider } from "@/cashier/contexts/PartsContext";
import { TechProvider }   from "@/technician/contexts/TechContext";
import TechSidebar, { type TechPage } from "@/technician/components/layout/TechSidebar";
import TechNavbar    from "@/technician/components/layout/TechNavbar";
import MyBench       from "@/technician/components/bench/MyBench";
import TechDashboard from "@/technician/components/dashboard/TechDashboard";
import MyJobs        from "@/technician/components/jobs/MyJobs";
import PendingCollection from "@/technician/components/collection/PendingCollection";
import PartsAvailability from "@/technician/components/parts/PartsAvailability";
import MyPerformance from "@/technician/components/performance/MyPerformance";
import ShiftTracker  from "@/technician/components/shift/ShiftTracker";
import JobScanFab    from "@/cashier/components/shared/JobScanFab";
import TabTitle       from "@/lib/ui/TabTitle";
import { useAuth }    from "@/lib/auth/AuthContext";

const TA = "#34d399";
const ff = "'Plus Jakarta Sans', sans-serif";


// ─── Job History (delivered + cancelled) ─────────────────────────────────────

function JobHistory({ techName }: { techName: string }) {
  const { jobs } = useRepair();
  const historyJobs = jobs
    .filter((j: any) => j.technician === techName && ["Delivered", "Cancelled"].includes(j.status))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: ff }}>
      <div className="fade-up">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4, fontFamily: ff }}>Job History</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Completed deliveries and cancelled jobs</p>
      </div>
      <div className="fade-up" style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Job ID", "Device", "Issue", "Customer", "Est. Cost", "Outcome", "Date"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, fontFamily: ff }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historyJobs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: ff }}>No history yet</td></tr>
            ) : historyJobs.map((job: any, i: number) => (
              <tr key={job.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{job.id}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-primary)", fontFamily: ff }}>{job.brand} {job.model}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{job.issue}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontFamily: ff }}>{job.customerName}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>Rs. {job.estimatedCost.toLocaleString()}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {job.status === "Delivered"
                      ? <CheckCircle size={13} color={TA} />
                      : <XCircle size={13} color="#f87171" />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: job.status === "Delivered" ? TA : "#f87171", fontFamily: ff }}>{job.status}</span>
                  </div>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontFamily: ff }}>{job.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Technician selector screen ───────────────────────────────────────────────

function TechSelect({ onSelect }: { onSelect: (name: string) => void }) {
  const [hov, setHov] = useState<string | null>(null);
  // The roster is the staff directory (profiles with role = Technician), so this
  // list and the cashier's assignment list can never drift apart.
  const { technicians, loading, error } = useTechnicians();

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)", fontFamily: ff, padding: "40px 20px",
    }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `${TA}12`, border: `1px solid ${TA}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
          }}>
            <Wrench size={24} color={TA} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 6, fontFamily: ff }}>
            Technician Login
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>
            Select your name to access your repair queue
          </p>
        </div>

        {/* Name cards */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {loading && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff, textAlign: "center", padding: "20px 0" }}>
              Loading technicians…
            </p>
          )}

          {/* No roster means nobody can sign in — name the cause rather than
              showing an empty screen. */}
          {!loading && technicians.length === 0 && (
            <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.4)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", fontFamily: ff, marginBottom: 5 }}>
                No technicians found
              </p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: ff, lineHeight: 1.55 }}>
                {error
                  ? error
                  : "The staff directory has nobody with the Technician role yet. Add them in Supabase (profiles.role = 'Technician') and they will appear here."}
              </p>
            </div>
          )}

          {technicians.map(tech => {
            const name = tech.name;
            const isHov = hov === name;
            return (
              <button
                key={name}
                onClick={() => onSelect(name)}
                onMouseEnter={() => setHov(name)}
                onMouseLeave={() => setHov(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14,
                  background: isHov ? "var(--bg-card-hover)" : "var(--bg-card)",
                  border: `1px solid ${isHov ? `${TA}50` : "var(--border)"}`,
                  cursor: "pointer", transition: "all 0.18s", fontFamily: ff,
                  boxShadow: isHov ? `0 0 0 1px ${TA}20, 0 4px 20px rgba(0,0,0,0.3)` : "none",
                  transform: isHov ? "translateY(-1px)" : "none",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: isHov ? `${TA}20` : `${TA}10`,
                  border: `1px solid ${TA}${isHov ? "40" : "25"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, fontWeight: 800, color: TA, fontFamily: ff,
                  transition: "all 0.15s", flexShrink: 0,
                }}>
                  {name[0]}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 2 }}>{name}</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>{tech.speciality} · Mano Mobile</p>
                </div>
                <ArrowRight size={15} style={{ color: isHov ? TA : "var(--text-muted)", transition: "color 0.15s", flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Inner page (reads searchParams) ─────────────────────────────────────────

function TechPageInner() {
  const searchParams = useSearchParams();
  const urlTech = searchParams.get("tech");

  const [picked, setPicked] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<TechPage>("My Bench");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * Whose bench this is.
   *
   * A signed-in technician is simply themselves — they typed a password at the
   * login screen and there is nothing left to ask. The picker below survives
   * for the one case that still needs it: an Admin looking at somebody else's
   * bench, who has a session but not a technician's name.
   */
  const { profile, signOut } = useAuth();
  const sessionTech = profile?.role === "Technician" ? (profile.fullName || "").trim() : "";

  // If a name was passed in the URL, accept it once the roster has loaded.
  const { technicians } = useTechnicians();
  useEffect(() => {
    if (urlTech && technicians.some(t => t.name === urlTech)) {
      setPicked(urlTech);
    }
  }, [urlTech, technicians]);

  const techName = sessionTech || picked;

  if (!techName) {
    return <TechSelect onSelect={setPicked} />;
  }
  const MANAGED_PAGES: TechPage[] = ["My Jobs", "Pending Collection", "Parts & Stock", "Job History", "My Performance", "My Shift"];
  const isManaged = MANAGED_PAGES.includes(activePage);

  return (
    <RepairProvider>
    <WarrantyProvider>
    <PartsProvider>
    <TechProvider technicianName={techName}>
      <TabTitle role="Technician" name={techName} />
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-primary)" }}>

        <TechSidebar
          activePage={activePage}
          onNavigate={setActivePage}
          techName={techName}
          onLogout={() => { void signOut().then(() => window.location.assign("/")); }}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <TechNavbar activePage={activePage} onMenuClick={() => setSidebarOpen(true)} />

          <main
            className={isManaged ? "resp-main-tight" : "resp-main"}
            style={{
              flex: 1,
              overflowY: isManaged ? "hidden" : "auto",
              display: "flex", flexDirection: "column", gap: 0,
            }}
          >
            {activePage === "My Bench"           && <MyBench />}
            {/* Dashboard and My Jobs are what My Bench replaces. Kept
                reachable rather than deleted, so nothing is lost if the bench
                turns out to be missing something in daily use — nav no longer
                offers them. */}
            {activePage === "Dashboard"          && <TechDashboard />}
            {activePage === "My Jobs"            && <MyJobs />}
            {activePage === "Pending Collection" && <PendingCollection />}
            {activePage === "Parts & Stock"      && <PartsAvailability />}
            {activePage === "Job History"        && <JobHistory techName={techName} />}
            {activePage === "My Performance"     && <MyPerformance />}
            {activePage === "My Shift"           && <ShiftTracker />}
          </main>
        </div>
      </div>
      <JobScanFab />
    </TechProvider>
    </PartsProvider>
    </WarrantyProvider>
    </RepairProvider>
  );
}

// ─── Page export (must wrap in Suspense for useSearchParams) ──────────────────

export default function TechnicianPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", fontFamily: ff }}>
        <div style={{ textAlign: "center" }}>
          <Wrench size={28} color={TA} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>Loading…</p>
        </div>
      </div>
    }>
      <TechPageInner />
    </Suspense>
  );
}
