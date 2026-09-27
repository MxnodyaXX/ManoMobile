"use client";

import { useEffect } from "react";

/**
 * Everything typed into a text field is stored in UPPERCASE, for the whole app.
 *
 * Mounted once at the root, like NumberInputGuards, rather than wired into each
 * of the hundreds of fields: a rule applied field by field is missing from
 * whichever one gets added next. It changes the value itself, not just how it
 * looks (CSS text-transform would show "SAMSUNG" and still save "samsung"), so
 * names, models and notes are consistent in the database, reports and search.
 *
 * ── How it reaches React ────────────────────────────────────────────────────
 * The listener runs on `window` in the capture phase, which is before React's
 * own listener on the root. It rewrites the field through the prototype's
 * value setter — not `el.value = …`, which React intercepts and would then see
 * as "no change", dropping the keystroke — so React's onChange receives the
 * uppercased text as if it had been typed that way. The caret is put back
 * where it was, so editing mid-word does not jump to the end.
 *
 * ── What is left alone ──────────────────────────────────────────────────────
 * Fields where case matters or uppercase would be wrong: passwords, emails,
 * URLs, usernames, numbers and dates. Detected from type, autocomplete, name,
 * id and placeholder. Anything else can opt out by carrying `data-keep-case`
 * (on the field or any ancestor). Template tokens inside a field ({customer},
 * {{job}}) keep their case, so SMS/receipt/label templates still fill in.
 */

const TEXT_TYPES = new Set(["text", "search", "tel", ""]);
const KEEP_CASE_HINT = /e-?mail|password|passcode|username|url|website|http|www\.|@/i;

const inputSetter = typeof window !== "undefined"
  ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  : undefined;
const textareaSetter = typeof window !== "undefined"
  ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set
  : undefined;

function shouldUppercase(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el.readOnly || el.disabled) return false;
  if (el instanceof HTMLInputElement && !TEXT_TYPES.has(el.type)) return false;
  if (el.closest("[data-keep-case]")) return false;
  const hints = [
    el.getAttribute("autocomplete"), el.getAttribute("name"),
    el.id, el.getAttribute("placeholder"), el.getAttribute("inputmode"),
  ].filter(Boolean).join(" ");
  return !KEEP_CASE_HINT.test(hints) && !/\b(email|url)\b/i.test(el.getAttribute("inputmode") ?? "");
}

export default function UppercaseInputs() {
  useEffect(() => {
    const onInput = (e: Event) => {
      const el = e.target;
      const isInput = el instanceof HTMLInputElement;
      if (!isInput && !(el instanceof HTMLTextAreaElement)) return;
      // Mid-composition (Sinhala/Tamil IMEs) the text is not final yet.
      if ((e as InputEvent).isComposing) return;
      if (!shouldUppercase(el)) return;

      // Template tokens ({customerName}, {{customer}}) are matched by exact
      // case when SMS, receipts and labels are filled in — keep them as typed.
      const upper = el.value
        .split(/(\{\{?\w*\}?\}?)/)
        .map((part, i) => (i % 2 === 1 ? part : part.toUpperCase()))
        .join("");
      if (upper === el.value) return;

      const { selectionStart, selectionEnd } = el;
      const set = isInput ? inputSetter : textareaSetter;
      if (!set) return;
      set.call(el, upper);
      // toUpperCase can change length for a few characters (ß → SS); clamp.
      if (selectionStart != null && selectionEnd != null) {
        const max = upper.length;
        el.setSelectionRange(Math.min(selectionStart, max), Math.min(selectionEnd, max));
      }
    };

    // An IME finishing a word fires compositionend after the last input event.
    const onCompositionEnd = (e: CompositionEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    window.addEventListener("input", onInput, true);
    window.addEventListener("compositionend", onCompositionEnd, true);
    return () => {
      window.removeEventListener("input", onInput, true);
      window.removeEventListener("compositionend", onCompositionEnd, true);
    };
  }, []);

  return null;
}
