"use client";

/**
 * How many database requests are in flight, and how many of them a click
 * started — what <LoadingOverlay> draws from.
 *
 * Every Supabase call (and every authedFetch to our own API routes) goes
 * through trackedFetch, so this sees all of them without a single screen
 * having to say "I'm loading". Hundreds of buttons open pages, popups and
 * lists; wiring a spinner into each would miss the next one written.
 *
 * "Started by a click" is what decides between the full loading screen and
 * the quiet top bar. A click opens a short window; any request that starts in
 * it belongs to that click, and while the click's requests are running the
 * window stays open, so a second request chained after the first (save, then
 * read back) is still the same click. Background work — realtime refreshes,
 * token refresh, a search firing as somebody types — isn't, so it never
 * covers the screen.
 */

/** How long after a click a request still counts as caused by it. */
const CLICK_WINDOW_MS = 1500;
/** After a click's last request ends, how long a chained follow-up still counts. */
const CHAIN_GRACE_MS = 250;

let total = 0;
let fromClick = 0;
let clickOpenUntil = 0;
const listeners = new Set<() => void>();

export interface NetSnapshot { total: number; fromClick: number }
let snapshot: NetSnapshot = { total: 0, fromClick: 0 };

function emit() {
  snapshot = { total, fromClick };
  listeners.forEach(l => l());
}

export function subscribeNet(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getNetSnapshot = () => snapshot;
const SERVER_SNAPSHOT: NetSnapshot = { total: 0, fromClick: 0 };
export const getNetServerSnapshot = () => SERVER_SNAPSHOT;

/** Called by LoadingOverlay's document-level click listener. */
export function noteClick() {
  clickOpenUntil = Date.now() + CLICK_WINDOW_MS;
}

/** Requests that are housekeeping, not something the person is waiting on. */
function isBackground(url: string): boolean {
  return /\/auth\/v1\/(token|user)\b/.test(url);
}

export const trackedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (isBackground(url)) return fetch(input, init);

  const clicked = fromClick > 0 || Date.now() < clickOpenUntil;
  total++;
  if (clicked) fromClick++;
  emit();
  try {
    return await fetch(input, init);
  } finally {
    total--;
    if (clicked) {
      fromClick--;
      clickOpenUntil = Math.max(clickOpenUntil, Date.now() + CHAIN_GRACE_MS);
    }
    emit();
  }
};
