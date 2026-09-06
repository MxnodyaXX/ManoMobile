"use client";

import { useEffect } from "react";

/**
 * Two browser defaults that quietly corrupt money, fixed once for the whole app.
 *
 * Mounted at the root rather than wired into each field: there are well over a
 * hundred `<input type="number">` in this system — estimates, advances, cash
 * return amounts, discounts, payments, stock counts — and a rule applied field
 * by field is a rule that is missing from whichever one gets added next.
 *
 * ── 1. The wheel ────────────────────────────────────────────────────────────
 * Chrome and Edge change a focused number input's value when the mouse wheel
 * scrolls over it. Nobody asked for that, and it is an easy way to silently
 * mis-enter a price while just scrolling past a form. Blurring the input the
 * moment a wheel event reaches it stops the value changing and lets the wheel
 * scroll the page instead.
 *
 * ── 2. The leading zero ─────────────────────────────────────────────────────
 * A field showing its default `0` keeps that zero when you type into it, so
 * clicking a Rs. 0 box and typing 5000 records `05000`. Browsers parse that
 * back to 5000, which is precisely what makes it dangerous: the number is
 * right, the box looks wrong, and anybody watching assumes the value is wrong
 * too — or corrects it into something that really is.
 *
 * Selecting the zero on focus means the first keystroke replaces it, which is
 * what everyone already expects. Only an exact zero is selected: a field
 * holding 1500 must keep its value when tabbed through, or a stray keystroke
 * would wipe a real figure.
 */
export default function NumberInputGuards() {
  useEffect(() => {
    const isNumberField = (el: EventTarget | null): el is HTMLInputElement =>
      el instanceof HTMLInputElement && el.type === "number";

    const onWheel = () => {
      if (isNumberField(document.activeElement)) document.activeElement.blur();
    };

    /** "0", "0.00", "-0" — a placeholder value, not something typed. */
    const isDefaultZero = (v: string) => /^-?0(\.0+)?$/.test(v.trim());

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (!isNumberField(el) || el.readOnly || el.disabled) return;
      if (!isDefaultZero(el.value)) return;

      el.select();
      // A click focuses first and then places the caret on mouseup, which would
      // undo the selection immediately. Suppressing that one mouseup — and only
      // that one — keeps it. A second click still positions the caret normally.
      el.addEventListener("mouseup", ev => ev.preventDefault(), { once: true });
    };

    // Capture phase so both run before the browser's own default action.
    document.addEventListener("wheel", onWheel, { passive: true, capture: true });
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("wheel", onWheel, { capture: true });
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, []);

  return null;
}
