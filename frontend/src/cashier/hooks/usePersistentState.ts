"use client";

import { useEffect, useRef, useState } from "react";

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
  const loaded = useRef(false);

  // Hydrate once, after mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt / unavailable storage */
    }
    loaded.current = true;
  }, [key]);

  // Persist on change (but not before the initial hydrate has run).
  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage full / unavailable — fail silently */
    }
  }, [key, state]);

  return [state, setState] as const;
}
