"use client";

import { useSyncExternalStore } from "react";

/**
 * Has this component rendered on the client yet?
 *
 * The obvious check, `typeof document === "undefined"`, cannot answer it. That
 * is false during hydration too, so a component using it renders one thing on
 * the server and something else on the client's very first pass — which is
 * exactly the mismatch React responds to by throwing the whole tree away and
 * re-rendering it.
 *
 * useSyncExternalStore is built for this: React uses the server snapshot while
 * hydrating and the client snapshot afterwards, so the first client render
 * agrees with the HTML and the real content arrives on the next one. No effect,
 * so no cascading render and nothing for the lint rules to object to.
 *
 * Use it for anything whose output depends on the browser — a portal, a stored
 * preference, a viewport measurement — and that renders unconditionally rather
 * than behind a click.
 */
const noSubscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
