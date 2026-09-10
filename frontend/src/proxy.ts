import { NextResponse } from "next/server";

/**
 * NOTE: this file is `proxy.ts`, not `middleware.ts` — the middleware file
 * convention is deprecated and renamed to `proxy` in this Next version.
 *
 * ── Why this no longer checks the session ───────────────────────────────────
 * It used to read the Supabase auth cookie and bounce signed-out staff to the
 * login screen. There is no such cookie any more: a cookie belongs to the whole
 * browser, which meant the shop could only ever be signed in as one person at a
 * time, and a second tab opened as the technician silently took the till tab
 * with it. Sessions now live in sessionStorage, one per tab, and the server
 * cannot see those — by design, since that is exactly what stops two tabs from
 * sharing one login.
 *
 * Nothing is lost that was ever load-bearing. Next's own guidance is that a
 * proxy is for optimistic checks and "should not be used as a full session
 * management or authorization solution", and this one already said in its own
 * comments that the real access control is Postgres RLS — a forged cookie could
 * never read a row. What it actually provided was the courtesy of not landing a
 * signed-out person on an app shell that would just error, and <RequireSignIn>
 * in the app shell does that now, in the only place that can still tell.
 *
 * The file stays because the route matcher and the public-path list are worth
 * keeping in one place for whatever comes next; it currently passes everything
 * through untouched.
 */

export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
