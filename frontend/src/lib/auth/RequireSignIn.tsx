"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Keeps signed-out staff off the app shell.
 *
 * proxy.ts used to do this by reading the auth cookie. Sessions are per-tab now
 * and live in sessionStorage, which the server cannot see, so the check moved to
 * the only place that can still answer it: the tab itself.
 *
 * This is the same courtesy the proxy provided and nothing more — it stops
 * somebody landing on a shell that would only error at them. It is not the
 * access control, and never was: that is Postgres RLS, which does not care what
 * any screen decided to render.
 */

/**
 * Reachable without signing in.
 *
 * "/" is the login screen itself — role, then person, then password. /login is
 * the older email-and-password form, kept as a way in when someone's name is
 * not on the roster. /track is the public job lookup customers use.
 */
const PUBLIC_PATHS = ["/login", "/track", "/auth"];

const isPublic = (pathname: string) =>
  pathname === "/" || PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));

export default function RequireSignIn({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const blocked = isSupabaseConfigured() && !loading && !user && !isPublic(pathname);

  useEffect(() => {
    if (!blocked) return;
    // Plain "/". The proxy used to append ?next=<path> here, but the login
    // screen never read it — it routes by role once the password is accepted —
    // so it was a parameter that looked like a feature and was not one.
    router.replace("/");
  }, [blocked, router]);

  // Render nothing while the answer is unknown or the redirect is in flight.
  // A flash of the till belonging to nobody is worse than a blank moment, and
  // every screen underneath assumes it has a profile to draw.
  if (loading || blocked) return null;

  return <>{children}</>;
}
