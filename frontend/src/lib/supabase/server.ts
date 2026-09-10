import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components and Route Handlers.
 *
 * `cookies()` is async in this Next version, so this helper is async too.
 * Server Components cannot set cookies; the `setAll` catch below swallows the
 * resulting error.
 *
 * NOTE: since sessions moved into per-tab sessionStorage there is normally no
 * auth cookie to find, so this no longer identifies a signed-in caller. It is
 * kept for anonymous, RLS-governed reads from the server. To find out *who* is
 * calling a route handler, use getCallerClient below.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, which may not set cookies.
          }
        },
      },
    },
  );
}

/**
 * A client acting as whoever sent the request.
 *
 * The browser attaches its tab's access token as `Authorization: Bearer …`
 * (see authedFetch). That is a better answer than the cookie this replaced:
 * with several roles signed in across several tabs, the cookie could only ever
 * name one of them, and it would have been whichever tab signed in last rather
 * than the tab that actually clicked the button.
 *
 * The token is not trusted on sight — `getUser()` on the returned client
 * revalidates it with Supabase, so a forged or expired one resolves to no user.
 * RLS applies to every query made through it, as the caller.
 */
export function getCallerClient(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // A route handler is one request; it must never pick up or write a
      // session of its own.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    },
  );
}

/**
 * The signed-in caller, or null.
 *
 * Every route that used to open with `getSupabaseServerClient()` and
 * `getUser()` now opens with this instead. Returns the client too, so the
 * caller's own RLS-governed queries — "is this person an Admin?" — run as them
 * rather than as nobody.
 */
export async function getCaller(request: Request) {
  const supabase = getCallerClient(request);
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}
