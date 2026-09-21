"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { claimSeed } from "@/lib/supabase/tabSession";

export type StaffRole = "Admin" | "Cashier" | "POS Cashier" | "Technician" | "Accounts";

/**
 * Races a promise against a timeout instead of letting a stalled call (a
 * flaky connection, a stuck supabase-js internal refresh) hang the sign-in
 * button forever with no feedback and no way to retry.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

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

    withTimeout<Awaited<ReturnType<typeof supabase.auth.getUser>>>(supabase.auth.getUser(), 15000, "timed out")
      .then(async ({ data }) => {
        if (!active) return;
        setUser(data.user ?? null);
        await loadProfile(data.user ?? null);
      })
      .catch(() => {
        // A stalled initial session check must not leave the app stuck on a
        // splash screen forever — fall through as signed-out; RequireSignIn
        // sends them to sign in, and a real session (if any) still lands
        // moments later via onAuthStateChange below.
      })
      .finally(() => {
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
    let error: { message: string } | null;
    try {
      ({ error } = await withTimeout<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>>(
        supabase.auth.signInWithPassword({ email, password }),
        15000,
        "Signing in is taking too long. Check your connection and try again.",
      ));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not sign in." };
    }
    if (error) return { error: error.message };

    // A deliberate sign-in is what a new tab should inherit, so this tab takes
    // over the seed. Only on sign-in, never on a token refresh: otherwise the
    // seed would drift to whichever open tab renewed last, and opening a new
    // tab would land on an unpredictable one of the roles already on screen.
    claimSeed();

    // Stamp the sign-in so Admin Control's "Last Login" column means something.
    // Best-effort: a stall here must not leave the sign-in itself hanging.
    try {
      const { data } = await withTimeout<Awaited<ReturnType<typeof supabase.auth.getUser>>>(supabase.auth.getUser(), 8000, "timed out");
      if (data.user) {
        await withTimeout(
          supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", data.user.id),
          8000,
          "timed out",
        );
      }
    } catch {
      // Non-critical — the session is already established below.
    }
    return { error: null };
  };

  const signInAsProfile: AuthValue["signInAsProfile"] = async (profileId, password) => {
    let payload: { ok?: boolean; error?: string; role?: StaffRole; session?: { access_token: string; refresh_token: string } };
    try {
      const res = await withTimeout(
        fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, password }),
        }),
        15000,
        "The server is taking too long to respond. Check your connection and try again.",
      );
      payload = await res.json();
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not reach the server. Check your connection and try again.", role: null };
    }

    if (!payload.ok || !payload.session) {
      return { error: payload.error ?? "Could not sign in.", role: null };
    }

    const supabase = getSupabaseBrowserClient();
    let error: { message: string } | null;
    try {
      ({ error } = await withTimeout<Awaited<ReturnType<typeof supabase.auth.setSession>>>(
        supabase.auth.setSession(payload.session),
        15000,
        "Signed in, but confirming your session is taking too long. Try again.",
      ));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not confirm the session.", role: null };
    }
    if (error) return { error: error.message, role: null };
    claimSeed();

    // setSession() above already waits for the SIGNED_IN notification to reach
    // every onAuthStateChange listener — including this file's, which sets
    // `user`/`profile` — so state is current by the time it resolves. An extra
    // getUser() round trip here used to "confirm" that, but it is one more
    // supabase-js call that can stall for no benefit: setSession() succeeding
    // (no error, above) is already the confirmation.
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
