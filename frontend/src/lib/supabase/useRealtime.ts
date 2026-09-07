"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Keep a screen in step with whatever another machine just did.
 *
 * Every context in this app loaded its rows once on mount and then never asked
 * again. That is fine with one person at one counter and wrong the moment there
 * are two: a job claimed on the bench stayed "available" on the cashier's
 * screen until somebody thought to refresh, and the second person to click it
 * was told it had been taken — by themselves.
 *
 * Postgres broadcasts every insert, update and delete over Supabase Realtime.
 * This subscribes to a table and calls back when one arrives.
 *
 * ── Refetch, not patch ──────────────────────────────────────────────────────
 * The callback is told nothing about what changed, on purpose. A payload
 * carries the raw row, which would then need mapping, merging, and deciding
 * whether it still passes the screen's filters — three chances to end up with
 * a list that disagrees with the database in a way nobody can reproduce.
 * Refetching is a request against lists of a few hundred rows, and it is
 * always right.
 *
 * ── Coalesced ───────────────────────────────────────────────────────────────
 * Issuing a job writes the job, a sale and a credit entry within a second, and
 * a handover writes several rows at once. Reloading per event would mean four
 * fetches for one action, so events inside a short window collapse into one.
 */
export function useRealtimeTable(
  table: string | string[],
  onChange: () => void,
  { enabled = true, debounceMs = 250 }: { enabled?: boolean; debounceMs?: number } = {},
) {
  // The callback is read through a ref so a caller can pass an inline arrow
  // without tearing the subscription down and rebuilding it every render.
  // Updated in an effect rather than during render: writing a ref while
  // rendering is exactly the thing React's rules forbid, and the subscription
  // effect below runs after this one, so it never reads a stale callback.
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; }, [onChange]);

  const tables = Array.isArray(table) ? table : [table];
  const key = tables.join(",");

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;

    const sb = getSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const ping = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), debounceMs);
    };

    // One channel per set of tables. A name shared by two mounted components
    // would have them fighting over the same subscription, so the table list
    // and a random suffix keep them apart.
    const channel = sb.channel(`rt:${key}:${Math.random().toString(36).slice(2, 9)}`);
    for (const t of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, ping);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void sb.removeChannel(channel);
    };
  }, [key, enabled, debounceMs]);
}
