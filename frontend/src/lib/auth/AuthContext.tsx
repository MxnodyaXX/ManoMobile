"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { claimSeed } from "@/lib/supabase/tabSession";

export type StaffRole = "Admin" | "Cashier" | "Technician" | "Accounts";

export interface StaffProfile {
  id: string;
  staffId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  status: "Active" | "Inactive" | "Suspended";
}

interface AuthValue {
  user: User | null;
  profile: StaffProfile | null;
  /** True until the first session check resolves — render a splash, not a redirect. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /**
   * Sign in as a chosen staff profile rather than a typed email.
   *
   * The login screen at / lists people, not mailboxes, so it holds a profile id
   * and a password. /api/auth/login resolves the address and verifies the
   * password; setSession() below then writes the cookies through the ordinary
   * browser client, so proxy.ts and every screen see the session the same way
   * they would after a normal sign-in.
   */
  signInAsProfile: (profileId: string, password: string) => Promise<{ error: string | null; role: StaffRole | null }>;
  signOut: () => Promise<void>;
  /** Convenience for UI gating. RLS is still the real enforcement. */
  can: (...roles: StaffRole[]) => boolean;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: "Auth not configured" }),
  signInAsProfile: async () => ({ error: "Auth not configured", role: null }),
  signOut: async () => {},
  can: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  // Only "loading" when there is actually a session to check. Both env vars are
  // inlined at build time, so this evaluates identically on server and client.
  const [loading, setLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    let active = true;

    const loadProfile = async (u: User | null) => {
      if (!u) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, staff_id, full_name, email, phone, role, status")
        .eq("id", u.id)
        .maybeSingle();
      if (!active) return;
      setProfile(
        data
          ? {
              id: data.id,
              staffId: data.staff_id,
              fullName: data.full_name,
              email: data.email,
              phone: data.phone,
              role: data.role,
              status: data.status,
            }
          : null,
      );
    };

    supabase.auth.getUser().then(async ({ data }: { data: { user: User | null } }) => {
      if (!active) return;
      setUser(data.user ?? null);
      await loadProfile(data.user ?? null);
      if (active) setLoading(false);
    });

    // Within this tab only. Sessions are per-tab now, so signing in as the
    // technician next door no longer reaches in here and changes who the till
    // thinks it is — which is the entire point of the change.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event: string, session: Session | null) => {
      if (!active) return;
      setUser(session?.user ?? null);
      await loadProfile(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthValue["signIn"] = async (email, password) => {
    if (!isSupabaseConfigured()) return { error: "Supabase is not configured — see docs/BACKEND-SETUP.md" };
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // A deliberate sign-in is what a new tab should inherit, so this tab takes
    // over the seed. Only on sign-in, never on a token refresh: otherwise the
    // seed would drift to whichever open tab renewed last, and opening a new
    // tab would land on an unpredictable one of the roles already on screen.
    claimSeed();

    // Stamp the sign-in so Admin Control's "Last Login" column means something.
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", data.user.id);
    }
    return { error: null };
  };

  const signInAsProfile: AuthValue["signInAsProfile"] = async (profileId, password) => {
    let payload: { ok?: boolean; error?: string; role?: StaffRole; session?: { access_token: string; refresh_token: string } };
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, password }),
      });
      payload = await res.json();
    } catch {
      return { error: "Could not reach the server. Check your connection and try again.", role: null };
    }

    if (!payload.ok || !payload.session) {
      return { error: payload.error ?? "Could not sign in.", role: null };
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.setSession(payload.session);
    if (error) return { error: error.message, role: null };
    claimSeed();

    // Read it straight back before the caller navigates: a screen that renders
    // before the session has landed sees nobody signed in and bounces to the
    // login screen, which looks exactly like a wrong password.
    const { data: check } = await supabase.auth.getUser();
    if (!check.user) return { error: "Signed in, but the session did not stick. Check that this browser allows site data, and try again.", role: null };

    return { error: null, role: payload.role ?? null };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) return;
    // scope: "local" — this tab, not every device this person is signed in on.
    // A cashier closing their till should not sign the same account out of the
    // workshop tablet, and the default would.
    // Clearing the stored session runs through the tab storage adapter, which
    // drops the seed too — but only if this tab is the one that owns it. A
    // second tab signing out must not stop new tabs inheriting the till that
    // is still signed in next door.
    await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
    setUser(null);
    setProfile(null);
  };

  const can = (...roles: StaffRole[]) => (profile ? roles.includes(profile.role) : false);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInAsProfile, signOut, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
