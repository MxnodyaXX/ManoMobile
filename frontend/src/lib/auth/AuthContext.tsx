"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

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

    // Keeps every tab in step: signing out in one signs out the rest.
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

    // Read it straight back before the caller navigates. proxy.ts checks the
    // cookie on the very next request, and a navigation that overtakes the
    // cookie write lands back on the login screen looking like a failure.
    const { data: check } = await supabase.auth.getUser();
    if (!check.user) return { error: "Signed in, but the session did not stick. Check that cookies are enabled and try again.", role: null };

    return { error: null, role: payload.role ?? null };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) return;
    await getSupabaseBrowserClient().auth.signOut();
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
