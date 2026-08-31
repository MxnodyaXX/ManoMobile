"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench, ShoppingCart, Shield, Landmark, ArrowRight, ArrowLeft,
  Smartphone, Zap, Loader2, AlertCircle, LogIn, Eye, EyeOff,
} from "lucide-react";
import { useAuth, type StaffRole } from "@/lib/auth/AuthContext";

const ff = "'Plus Jakarta Sans', sans-serif";

/**
 * The way into Mano Mobile: role, then person, then password.
 *
 * This used to be a door-picker with no lock on it — four cards, click one,
 * you were in. The apps behind it then asked "which of you is this?" with
 * another passwordless list. So the screen could say "Admin" while the API and
 * every RLS policy saw whichever account the browser happened to hold a cookie
 * for, and adding staff failed with "Only an Admin can add staff" while the
 * sidebar showed you as the administrator.
 *
 * Three steps now, and the third one is a password. What comes out is a real
 * Supabase session, so the name in the sidebar, the role the database enforces,
 * and the person actually sitting there are finally the same fact.
 *
 * The roster comes from /api/auth/roster because at this point there is no
 * session and `profiles` is behind RLS. Names only — never email addresses.
 */

interface RosterEntry {
  id: string;
  fullName: string;
  role: StaffRole;
  speciality: string | null;
  staffId: string | null;
}

const ROLES: {
  id: string; role: StaffRole; label: string; sub: string;
  icon: typeof Wrench; color: string; badge: string; path: string;
}[] = [
  { id: "cashier",    role: "Cashier",    label: "Cashier",    sub: "Sales, repairs,\ninventory & reports", icon: ShoppingCart, color: "#6355ff", badge: "Front Counter", path: "/cashier" },
  { id: "technician", role: "Technician", label: "Technician", sub: "Repair jobs, status\nupdates & parts",   icon: Wrench,       color: "#34d399", badge: "Repair Focus",  path: "/technician" },
  { id: "admin",      role: "Admin",      label: "Admin",      sub: "System config &\naccess control",        icon: Shield,       color: "#a78bfa", badge: "Admin Only",    path: "/admin" },
  { id: "accounts",   role: "Accounts",   label: "Accounts",   sub: "Ledger, AR/AP &\nfinancial reports",     icon: Landmark,     color: "#f59e0b", badge: "Finance",       path: "/accounts" },
];

const pathForRole = (role: StaffRole) => ROLES.find(r => r.role === role)?.path ?? "/cashier";

/* ── The pieces every step is built from ─────────────────────────────────
 *
 * Module scope, not inside the component. Declared inside, React treats each
 * render as producing a brand-new component type and remounts the subtree — so
 * the password field would lose its value and its focus on every keystroke.
 */

const Shell = ({ children, maxWidth = 740 }: { children: React.ReactNode; maxWidth?: number }) => (
  <div style={{
    minHeight: "100vh", background: "var(--bg-primary)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: ff, padding: "40px 20px",
  }}>
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none",
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)," +
        "linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      backgroundSize: "40px 40px",
    }} />
    <div style={{ position: "relative", width: "100%", maxWidth, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
      {children}
    </div>
  </div>
);

const Brand = ({ caption }: { caption: string }) => (
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
    <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: ff }}>{caption}</p>
  </div>
);

const Footer = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <Zap size={11} color="var(--text-muted)" />
    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff }}>Mano Mobile POS &middot; v1.0.0</p>
  </div>
);

const Warning = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    display: "flex", gap: 9, padding: "11px 15px", borderRadius: 11, width: "100%",
    background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)",
  }}>
    <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, fontFamily: ff }}>{children}</p>
  </div>
);

const BackLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 7, minHeight: 36, padding: "0 14px",
      borderRadius: 999, background: "transparent", border: "1px solid var(--border)",
      color: "var(--text-secondary)", fontSize: 12.5, cursor: "pointer", fontFamily: ff,
    }}
  >
    <ArrowLeft size={13} /> {label}
  </button>
);

export default function LoginPage() {
  const router = useRouter();
  const { profile, loading: authLoading, signInAsProfile, signOut } = useAuth();

  const [staff, setStaff] = useState<RosterEntry[]>([]);
  const [configured, setConfigured] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [pickedRole, setPickedRole] = useState<StaffRole | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set the moment a destination is chosen and left set until this page
  // unmounts, so the overlay also covers dev's on-demand compile of the target.
  const [going, setGoing] = useState<StaffRole | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/roster");
        const payload = await res.json();
        if (!active) return;
        if (!payload.ok) { setRosterError(payload.error ?? "Could not load the staff list."); return; }
        setConfigured(payload.configured !== false);
        setStaff(payload.staff ?? []);
      } catch {
        if (active) setRosterError("Could not reach the server. Check your connection and reload.");
      } finally {
        if (active) setRosterLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const forRole = useMemo(
    () => (role: StaffRole) => staff.filter(s => s.role === role),
    [staff],
  );
  const picked = pickedId ? staff.find(s => s.id === pickedId) ?? null : null;
  const pickedMeta = ROLES.find(r => r.role === pickedRole) ?? ROLES[0];

  const go = useCallback((role: StaffRole) => {
    setGoing(role);
    router.push(pathForRole(role));
  }, [router]);

  const chooseRole = (role: StaffRole) => {
    setError(null);
    // Without Supabase the app runs on local data and there are no accounts to
    // sign into. A password box that could never accept anything would lock
    // somebody out of their own demo.
    if (!configured) { go(role); return; }
    setPickedRole(role);
    setPickedId(null);
    setPassword("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    const { error: err, role } = await signInAsProfile(picked.id, password);
    if (err) {
      setError(err);
      setPassword("");
      setBusy(false);
      return;
    }
    // Trust the role the server read off the profile over the one that was
    // clicked — they differ only if the roster is stale, and the profile wins.
    go(role ?? picked.role);
  };

  /* ── the navigating overlay ──────────────────────────────────────────── */

  if (going) {
    const meta = ROLES.find(r => r.role === going);
    return (
      <div role="status" aria-live="polite" style={{
        position: "fixed", inset: 0, zIndex: 200, background: "var(--bg-primary)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <Loader2 size={30} className="spin-icon" color={meta?.color ?? "var(--text-secondary)"} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: ff }}>
          Loading {meta?.label ?? "dashboard"}&hellip;
        </p>
      </div>
    );
  }

  /* ── already signed in ───────────────────────────────────────────────── */

  if (!authLoading && profile) {
    const meta = ROLES.find(r => r.role === profile.role) ?? ROLES[0];
    const Icon = meta.icon;
    return (
      <Shell maxWidth={520}>
        <Brand caption="You are already signed in" />

        <div style={{
          width: "100%", padding: "24px 22px", borderRadius: 16,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 18,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 13, flexShrink: 0,
              background: meta.color + "14", border: "1px solid " + meta.color + "30", color: meta.color,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={21} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>
                {profile.fullName || profile.email}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: ff }}>{profile.role}</p>
            </div>
          </div>

          <button
            onClick={() => go(profile.role)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", minHeight: 46, borderRadius: 12, border: "none",
              background: meta.color, color: "#0b0b0f", fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: ff,
            }}
          >
            Continue as {meta.label} <ArrowRight size={15} />
          </button>

          <button
            onClick={() => { void signOut(); setPickedRole(null); setPickedId(null); setPassword(""); }}
            style={{
              width: "100%", minHeight: 40, borderRadius: 11,
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600,
              cursor: "pointer", fontFamily: ff,
            }}
          >
            Sign out and use a different account
          </button>
        </div>

        {/* An Admin runs the shop and legitimately needs to look at the other
            shells; everyone else has exactly one. */}
        {profile.role === "Admin" && (
          <div style={{ width: "100%" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: ff, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10, textAlign: "center" }}>
              Or open another section
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {ROLES.filter(r => r.role !== "Admin").map(r => (
                <button
                  key={r.id}
                  onClick={() => go(r.role)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, minHeight: 38, padding: "0 15px",
                    borderRadius: 999, background: "var(--bg-card)", border: "1px solid var(--border)",
                    color: "var(--text-secondary)", fontSize: 12.5, cursor: "pointer", fontFamily: ff,
                  }}
                >
                  <r.icon size={13} color={r.color} /> {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Footer />
      </Shell>
    );
  }

  /* ── step 3: password ────────────────────────────────────────────────── */

  if (picked) {
    const Icon = pickedMeta.icon;
    return (
      <Shell maxWidth={430}>
        <Brand caption={"Signing in as " + pickedMeta.label.toLowerCase()} />

        <form onSubmit={submit} style={{
          width: "100%", padding: "24px 22px", borderRadius: 16,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 18,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: pickedMeta.color + "14", border: "1px solid " + pickedMeta.color + "30",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: pickedMeta.color, fontFamily: ff,
            }}>
              {picked.fullName[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{picked.fullName}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon size={11} color={pickedMeta.color} />
                {picked.speciality ?? pickedMeta.label}
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 7, display: "block", fontFamily: ff }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", minHeight: 44, padding: "0 42px 0 13px", borderRadius: 11,
                  border: "1px solid " + (error ? "rgba(248,113,113,0.5)" : "var(--border)"),
                  background: "var(--bg-secondary)", color: "var(--text-primary)",
                  fontSize: 14, fontFamily: ff, outline: "none", boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", padding: 8, borderRadius: 8, lineHeight: 0,
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: "flex", gap: 8, padding: "10px 12px", borderRadius: 10,
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)",
            }}>
              <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600, fontFamily: ff, lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", minHeight: 46, borderRadius: 12, border: "none",
              background: pickedMeta.color, color: "#0b0b0f",
              fontSize: 14, fontWeight: 700, fontFamily: ff,
              cursor: busy ? "wait" : !password ? "not-allowed" : "pointer",
              opacity: busy || !password ? 0.55 : 1,
            }}
          >
            {busy
              ? <><Loader2 size={15} className="spin-icon" /> Signing in&hellip;</>
              : <><LogIn size={15} /> Sign In</>}
          </button>
        </form>

        <BackLink label="Someone else" onClick={() => { setPickedId(null); setPassword(""); setError(null); }} />
        <Footer />
      </Shell>
    );
  }

  /* ── step 2: who ─────────────────────────────────────────────────────── */

  if (pickedRole) {
    const people = forRole(pickedRole);
    const Icon = pickedMeta.icon;
    return (
      <Shell maxWidth={480}>
        <Brand caption="Select your profile" />

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 2 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: pickedMeta.color + "14", border: "1px solid " + pickedMeta.color + "30", color: pickedMeta.color,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={14} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff }}>{pickedMeta.label}</p>
          </div>

          {rosterLoading && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: ff, textAlign: "center", padding: "20px 0" }}>Loading staff&hellip;</p>
          )}

          {!rosterLoading && people.length === 0 && (
            <Warning>
              No active {pickedMeta.label.toLowerCase()} accounts yet. An Admin can add one under{" "}
              <strong>Staff</strong>, and it will appear here straight away.
            </Warning>
          )}

          {people.map(person => (
            <button
              key={person.id}
              onClick={() => { setPickedId(person.id); setError(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 13, width: "100%",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                cursor: "pointer", fontFamily: ff, textAlign: "left", minHeight: 66,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = pickedMeta.color + "55";
                el.style.background = "var(--bg-card-hover)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "var(--border)";
                el.style.background = "var(--bg-card)";
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: pickedMeta.color + "12", border: "1px solid " + pickedMeta.color + "28",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 800, color: pickedMeta.color, fontFamily: ff,
              }}>
                {person.fullName[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: ff, marginBottom: 2 }}>{person.fullName}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: ff }}>
                  {person.speciality ?? pickedMeta.label}{person.staffId ? " · " + person.staffId : ""}
                </p>
              </div>
              <ArrowRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            </button>
          ))}
        </div>

        <BackLink label="All roles" onClick={() => { setPickedRole(null); setError(null); }} />
        <Footer />
      </Shell>
    );
  }

  /* ── step 1: which role ──────────────────────────────────────────────── */

  return (
    <Shell>
      <Brand caption="Select your role to continue" />

      {rosterError && <Warning>{rosterError}</Warning>}

      {!rosterLoading && !configured && (
        <Warning>
          Supabase isn&apos;t configured, so there are no accounts to sign into — the app is
          running on local data and every section is open. Add{" "}
          <strong>NEXT_PUBLIC_SUPABASE_URL</strong>, <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong>{" "}
          and <strong>SUPABASE_SERVICE_ROLE_KEY</strong> to <code>.env.local</code> to turn sign-in on.
        </Warning>
      )}

      <div className="resp-grid-4" style={{ width: "100%" }}>
        {ROLES.map(r => {
          const Icon = r.icon;
          const count = forRole(r.role).length;
          return (
            <button
              key={r.id}
              onClick={() => chooseRole(r.role)}
              style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 16, padding: "28px 22px", cursor: "pointer", textAlign: "left",
                transition: "all 0.18s", display: "flex", flexDirection: "column", gap: 18,
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)", fontFamily: ff,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = r.color + "55";
                el.style.background = "var(--bg-card-hover)";
                el.style.transform = "translateY(-2px)";
                el.style.boxShadow = "0 0 0 1px " + r.color + "22, 0 8px 36px rgba(0,0,0,0.35)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "var(--border)";
                el.style.background = "var(--bg-card)";
                el.style.transform = "none";
                el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.3)";
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: r.color + "14", border: "1px solid " + r.color + "30", color: r.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} />
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                  background: r.color + "12", color: r.color, border: "1px solid " + r.color + "25",
                  fontFamily: ff, letterSpacing: "0.04em",
                }}>
                  {r.badge}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, fontFamily: ff }}>{r.label}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.65, whiteSpace: "pre-line", fontFamily: ff }}>{r.sub}</p>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 5, paddingTop: 4,
                borderTop: "1px solid var(--border)", color: "var(--text-muted)",
              }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: ff }}>
                  {!configured ? "Open" : rosterLoading ? "Sign in" : count === 1 ? "1 account" : count + " accounts"}
                </span>
                <ArrowRight size={12} style={{ marginLeft: "auto" }} />
              </div>
            </button>
          );
        })}
      </div>

      <Footer />
    </Shell>
  );
}
