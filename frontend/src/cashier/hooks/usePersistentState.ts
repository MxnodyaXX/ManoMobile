"use client";

import { useEffect, useState } from "react";

/**
 * localStorage-backed state. SSR-safe: it initialises with `initial` on the
 * server / first paint, then hydrates from localStorage after mount (so there
 * is no hydration mismatch). Writes are persisted on every change.
 *
 * This is what lets data created in one role (e.g. a technician issuing a
 * warranty) be visible in another role (the cashier's warranty register),
 * since both routes read/write the same key in the same browser.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  // Deliberately state, not a ref. A ref flips to true inside the hydrate
  // effect, which still leaves the *write* effect running in that same commit
  // with the pre-hydration `state` — it would persist `initial` over the stored
  // value. Under StrictMode the hydrate effect then re-reads that overwritten
  // value and adopts it, permanently wiping the data on every mount. Gating on
  // state means no write can happen until the loaded value is really in state.
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once, after mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt / unavailable storage */
    }
    setHydrated(true);
  }, [key]);

  // Persist on change (but never before the initial hydrate has landed).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage full / unavailable — fail silently */
    }
  }, [key, state, hydrated]);

  return [state, setState] as const;
}
