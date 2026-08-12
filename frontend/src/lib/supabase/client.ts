"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * The browser Supabase client.
 *
 * Uses @supabase/ssr rather than plain supabase-js so the session lives in
 * cookies instead of localStorage — that is what lets `proxy.ts` (this Next
 * version's rename of middleware) see whether a request is signed in and bounce
 * it to /login before the page renders.
 *
 * One instance per tab: createBrowserClient memoises internally, but keeping a
 * module-level singleton avoids re-subscribing auth listeners on every render.
 */
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    );
  }
  return browserClient;
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
