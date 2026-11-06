"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { getNetServerSnapshot, getNetSnapshot, noteClick, subscribeNet } from "@/lib/ui/netActivity";

/**
 * The app-wide loading screen. See netActivity.ts for what is counted.
 *
 *   · A click whose data takes a moment covers the app — dimmed, with a
 *     spinner — until every request that click started has come back. It
 *     also swallows clicks while it's up, so a slow save can't be sent twice.
 *   · Anything else in flight shows only a thin bar along the top.
 *
 * Shown only after SHOW_AFTER_MS, so a fast answer never flashes a screen,
 * and kept for at least MIN_VISIBLE_MS once shown, so it doesn't blink.
 */

const SHOW_AFTER_MS = 220;
const MIN_VISIBLE_MS = 320;
/** A request that never answers must not lock the till: give the screen back. */
const GIVE_UP_MS = 20_000;

/** The customer website has its own loading states and motion. */
const NO_OVERLAY = ["/web"];

const CSS = `
@keyframes mm-load-spin{to{transform:rotate(360deg)}}
@keyframes mm-load-bar{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
@keyframes mm-load-in{from{opacity:0}to{opacity:1}}
.mm-load-bar{position:fixed;top:0;left:0;right:0;height:2.5px;z-index:2147483001;overflow:hidden;pointer-events:none}
.mm-load-bar i{position:absolute;top:0;bottom:0;width:40%;background:var(--accent,#111);border-radius:2px;animation:mm-load-bar 1.1s ease-in-out infinite}
.mm-load{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(0,0,0,.22);
  backdrop-filter:blur(1.5px);-webkit-backdrop-filter:blur(1.5px);cursor:progress;animation:mm-load-in .15s ease-out}
.mm-load-card{display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:14px;
  background:var(--bg-card,#fff);color:var(--text-primary,#111);border:1px solid var(--border,#e5e5e5);
  box-shadow:0 12px 40px rgba(0,0,0,.25);font-family:'Plus Jakarta Sans',sans-serif;font-size:13.5px;font-weight:600}
.mm-load-spin{width:20px;height:20px;border-radius:50%;border:2.5px solid var(--border,#ddd);border-top-color:var(--accent,#111);animation:mm-load-spin .7s linear infinite}
@media print{.mm-load,.mm-load-bar{display:none!important}}
@media (prefers-reduced-motion: reduce){.mm-load-bar i{animation-duration:2.4s}.mm-load-spin{animation-duration:1.4s}}
`;

/** A click into a text box is somebody about to type, not waiting on anything. */
function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof Element)) return false;
  const el = t.closest("input, textarea, select, [contenteditable='true']");
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    return !["button", "submit", "checkbox", "radio", "file", "reset"].includes(el.type);
  }
  return true;
}

export default function LoadingOverlay() {
  const net = useSyncExternalStore(subscribeNet, getNetSnapshot, getNetServerSnapshot);
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (!isTypingTarget(e.target)) noteClick(); };
    // Capture: runs before the button's own handler starts its request.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const busy = net.fromClick > 0;

  // Only on busy changing — a chained request flips it off and straight back
  // on, which just restarts the same timers rather than flashing the screen.
  useEffect(() => {
    if (busy) {
      const show = setTimeout(() => setShown(true), SHOW_AFTER_MS);
      const giveUp = setTimeout(() => setShown(false), GIVE_UP_MS);
      return () => { clearTimeout(show); clearTimeout(giveUp); };
    }
    const hide = setTimeout(() => setShown(false), MIN_VISIBLE_MS);
    return () => clearTimeout(hide);
  }, [busy]);

  const overlayAllowed = !NO_OVERLAY.some(p => pathname === p || pathname?.startsWith(`${p}/`));
  const overlay = shown && overlayAllowed;

  return (
    <>
      <style>{CSS}</style>
      {net.total > 0 && !overlay && <div className="mm-load-bar" aria-hidden><i /></div>}
      {overlay && (
        <div
          className="mm-load"
          role="status"
          aria-live="polite"
          onClickCapture={e => { e.stopPropagation(); e.preventDefault(); }}
        >
          <div className="mm-load-card"><span className="mm-load-spin" />Loading…</div>
        </div>
      )}
    </>
  );
}
