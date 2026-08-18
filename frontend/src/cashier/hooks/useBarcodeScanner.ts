"use client";

import { useEffect, useRef } from "react";

// Hardware barcode scanners act as a keyboard — they "type" the code's
// characters far faster than any human, then send Enter. 50ms between
// keystrokes is well beyond even a fast typist, so it's a safe cutoff for
// telling a scan apart from someone typing.
const MAX_KEY_INTERVAL_MS = 50;
const MIN_CODE_LENGTH = 3;

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Detects a hardware barcode scan anywhere in the app and reports the
 * decoded value. Deliberately ignores keystrokes while focus is in an
 * editable field (input/textarea/select/contenteditable) — it only reacts
 * while the user is just browsing, so it can never intercept normal typing
 * or hijack a form the user is filling in.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function handleKeydown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= MIN_CODE_LENGTH) onScanRef.current(code);
        return;
      }

      if (e.key.length === 1) {
        // Gap too long to be a scanner burst — this is a fresh sequence.
        if (elapsed > MAX_KEY_INTERVAL_MS) bufferRef.current = "";
        bufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [enabled]);
}
