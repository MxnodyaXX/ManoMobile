import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Route guard + session refresh.
 *
 * NOTE: this file is `proxy.ts`, not `middleware.ts` — the middleware file
 * convention is deprecated and renamed to `proxy` in this Next version.
 *
 * This is an *optimistic* check only, exactly as the Next auth guide advises:
 * it keeps signed-out staff from landing on an app shell that would just error.
 * The real access control is Postgres RLS — a forged cookie still cannot read a
 * single row.
 */

/** Reachable without signing in: the login screen and the public job tracker. */
const PUBLIC_PATHS = ["/login", "/track", "/auth"];

export async function proxy(request: NextRequest) {
  // With Supabase unconfigured the app still runs on seeded/local data; bouncing
  // everyone to a login that cannot work would be worse than letting them in.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() (not getSession()) — it revalidates the token with Supabase, so an
  // expired or tampered cookie is rejected rather than trusted at face value.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so login can return them there.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
