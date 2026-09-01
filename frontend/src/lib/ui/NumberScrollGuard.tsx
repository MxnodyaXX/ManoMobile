"use client";

import { useEffect } from "react";

/**
 * Chrome/Edge (and, differently, Firefox) change a focused
 * <input type="number">'s value when the mouse wheel scrolls over it — a
 * browser default nobody asked for here, and an easy way to silently
 * mis-enter a price (Estimated Cost, Advance Paid, a discount…) while just
 * scrolling past the form. Blurring the input the instant a wheel event
 * reaches it, while it still has focus, stops the value from changing and
 * lets the wheel scroll the page normally instead — mounted once at the
 * app root so every number field everywhere gets this without each one
 * needing its own onWheel handler.
 */
export default function NumberScrollGuard() {
  useEffect(() => {
    const onWheel = () => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === "number") {
        el.blur();
      }
    };
    // Capture phase so this runs before the browser's own default action for
    // the event; passive since it never needs to (and must not) block the
    // page's own scrolling.
    document.addEventListener("wheel", onWheel, { passive: true, capture: true });
    return () => document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  return null;
}
