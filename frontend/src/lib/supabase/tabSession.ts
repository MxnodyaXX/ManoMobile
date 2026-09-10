"use client";

/**
 * One signed-in person per browser tab.
 *
 * The session used to live in cookies. A cookie jar belongs to the whole
 * browser, so the shop had exactly one login at a time: open a second tab, sign
 * in as the technician to check a bench job, and the first tab — the till, mid
 * invoice — silently became the technician too. The only way to hold two roles
 * open was two browsers, or Chrome plus an incognito window.
 *
 * sessionStorage is the one web storage that is scoped to a single tab. Two
 * tabs of the same site have two separate sessionStorage areas, and neither can
 * see the other's. So that is where the session goes, and the tabs stop
 * fighting over one seat.
 *
 * ── The seed ────────────────────────────────────────────────────────────────
 * Strict per-tab storage has one cost: a brand new tab knows nothing, so
 * opening one would mean signing in again even when nobody wanted a second
 * role. That is a worse day than the bug.
 *
 * So the last sign-in is also copied to localStorage as a seed. A tab that
 * opens with nothing of its own adopts the seed once, and from that moment owns
 * a private copy — signing in as somebody else in that tab changes that tab
 * and nothing else.
 *
 * Exactly one tab owns the seed at a time, tracked by a tab id in localStorage,
 * so the seed always means "the role signed into most recently" rather than
 * "whichever tab happened to refresh its token last".
 */

/** This tab's session. sessionStorage is per-tab, which is the whole point. */
const TAB_KEY = "mano.auth.session";
/** The most recent sign-in, so a new tab does not start from nothing. */
const SEED_KEY = "mano.auth.seed";
/** Which tab is currently entitled to update the seed. */
const SEED_OWNER_KEY = "mano.auth.seed-owner";

/**
 * Identifies this tab for as long as it is open.
 *
 * Deliberately not persisted: a duplicated tab must not inherit the right to
 * write the seed, or duplicating the till tab would quietly reassign it.
 */
const tabId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t${Date.now()}${Math.random().toString(36).slice(2)}`;

/** Storage can throw outright — private mode, or a browser set to block it. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const hasWindow = () => typeof window !== "undefined";

function ownsSeed(): boolean {
  return safe(() => window.localStorage.getItem(SEED_OWNER_KEY) === tabId, false);
}

/**
 * Make this tab the one whose session new tabs will inherit.
 *
 * Called on a deliberate sign-in, never on a token refresh — otherwise the seed
 * would drift to whichever open tab happened to renew last, and a new tab would
 * open as an unpredictable one of the roles already on screen.
 */
export function claimSeed() {
  if (!hasWindow()) return;
  safe(() => {
    window.localStorage.setItem(SEED_OWNER_KEY, tabId);
    const current = window.sessionStorage.getItem(TAB_KEY);
    if (current) window.localStorage.setItem(SEED_KEY, current);
  }, undefined);
}

/**
 * The storage Supabase reads and writes the session through.
 *
 * Synchronous on purpose: supabase-js accepts either, and a synchronous
 * adapter means the very first getItem on page load already has the answer,
 * with no window where the app renders as signed out and redirects.
 */
export const tabSessionStorage = {
  getItem(key: string): string | null {
    if (!hasWindow()) return null;
    return safe(() => {
      const mine = window.sessionStorage.getItem(key);
      if (mine !== null) return mine;

      // Nothing of this tab's own: a fresh tab, or one whose person signed out.
      // Adopt the seed once, then this tab has a private copy and diverges from
      // every other tab for good.
      if (key !== TAB_KEY) return null;
      const seed = window.localStorage.getItem(SEED_KEY);
      if (seed === null) return null;
      window.sessionStorage.setItem(key, seed);
      return seed;
    }, null);
  },

  setItem(key: string, value: string): void {
    if (!hasWindow()) return;
    safe(() => {
      window.sessionStorage.setItem(key, value);
      // Refreshed tokens keep the seed usable, but only from the tab that owns
      // it. Without this the seed's refresh token would go stale and a new tab
      // would adopt a session that cannot be renewed.
      if (key === TAB_KEY && ownsSeed()) window.localStorage.setItem(SEED_KEY, value);
    }, undefined);
  },

  removeItem(key: string): void {
    if (!hasWindow()) return;
    safe(() => {
      window.sessionStorage.removeItem(key);
      if (key === TAB_KEY && ownsSeed()) {
        window.localStorage.removeItem(SEED_KEY);
        window.localStorage.removeItem(SEED_OWNER_KEY);
      }
    }, undefined);
  },
};

export const TAB_STORAGE_KEY = TAB_KEY;
