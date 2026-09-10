"use client";

import { createClient } from "@supabase/supabase-js";
import type { createBrowserClient } from "@supabase/ssr";
import { tabSessionStorage, TAB_STORAGE_KEY } from "@/lib/supabase/tabSession";

/**
 * The browser Supabase client.
 *
 * This used to be createBrowserClient from @supabase/ssr, which keeps the
 * session in cookies so proxy.ts could see it. Cookies belong to the browser,
 * not to the tab, and that turned out to be the wrong shape for this shop: one
 * cookie jar meant one login, so a second tab opened as the technician dragged
 * the till tab along with it mid-invoice.
 *
 * The session now lives in sessionStorage — per tab, by definition — through
 * the adapter in tabSession.ts. Every tab is its own seat, and the same Chrome
 * can hold the counter, the bench and Admin Control open at once.
 *
 * What that costs, and where it went instead:
 *   · proxy.ts can no longer read the session, because there is no cookie to
 *     read. It never was the real gate — RLS is — so the redirect for signed-out
 *     staff moved to <RequireSignIn> on the client.
 *   · Route handlers that need to know who is calling can no longer read a
 *     cookie either. They take an Authorization: Bearer header now, sent by
 *     authedFetch, which is a truer answer anyway: it is the calling tab's
 *     session rather than whichever one wrote the cookie last.
 */
/**
 * The client type this file used to hand out, preserved exactly.
 *
 * createBrowserClient is an overloaded declaration, and ReturnType over
 * overloads with unresolved generics collapses to something very loose — which
 * is why the whole app can write `data as SomeRow[]` after a .select() built
 * from a runtime column string, and why nobody had to describe the shape of a
 * storage response.
 *
 * That looseness is not a virtue, but tightening it is a refactor of a hundred
 * call sites in files that have nothing to do with sessions. Moving the session
 * out of cookies should change where the session is kept and nothing else, so
 * the old type is imported (type-only — no cookie code is bundled) and kept.
 *
 * Generating real Database types is the proper fix, and its own job.
 */
type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        auth: {
          storage: tabSessionStorage,
          storageKey: TAB_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          // Nothing in this app signs in through a link with a token in the
          // URL, and leaving it on makes every page load parse the hash.
          detectSessionInUrl: false,
        },
      },
    );
  }
  return browserClient;
}

/**
 * The calling tab's access token, for our own API routes.
 *
 * Returns null when signed out, which the routes treat as "sign in first".
 */
export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * fetch, with this tab's session attached.
 *
 * Every call to one of our own route handlers goes through here. The session
 * used to travel on its own as a cookie; now it has to be carried explicitly,
 * and being explicit is the point — the token is the one belonging to the tab
 * that clicked the button, so an SMS sent from the till is recorded against the
 * cashier even while a technician is signed in one tab over.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

/**
 * Fail loudly at the point of use. NEXT_PUBLIC_* values are inlined at build
 * time, so a missing one shows up as `undefined` deep inside a fetch with an
 * unhelpful message; this names the variable instead.
 */
function requireEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  // Referenced statically (not via a computed key) so Next can inline them.
  const value = name === "NEXT_PUBLIC_SUPABASE_URL"
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error(
      `${name} is not set. Copy frontend/.env.local.example to .env.local and fill in your Supabase project settings, then restart the dev server.`,
    );
  }
  return value;
}

/** True when both env vars are present — lets the UI show a setup hint instead of crashing. */
export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
