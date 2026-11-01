"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * One observer for the whole site (see motion.css):
 *   [data-reveal]  marked data-in the first time it scrolls into view;
 *   [data-live]    marked data-offscreen whenever it is out of view, which
 *                  pauses its never-ending animations (float, ticker, shine).
 * Server components only need the attribute. New elements (filters, tabs) are
 * picked up by a MutationObserver, batched to one scan per frame.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const reveal = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.setAttribute("data-in", "");
          reveal.unobserve(e.target);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    const live = new IntersectionObserver(entries => {
      for (const e of entries) e.target.toggleAttribute("data-offscreen", !e.isIntersecting);
    });

    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-in])").forEach(el => reveal.observe(el));
      document.querySelectorAll("[data-live]").forEach(el => {
        if (!seen.has(el)) { seen.add(el); live.observe(el); }
      });
    };
    scan();

    let queued = 0;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => { queued = 0; scan(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => { reveal.disconnect(); live.disconnect(); mo.disconnect(); cancelAnimationFrame(queued); };
  }, [pathname]);

  return null;
}

/**
 * A number that counts up from 0 the first time it's seen. Writes straight to
 * the text node each frame — no React re-render per frame.
 */
export function CountUp({ to, duration = 1600 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = (n: number) => { el.textContent = n.toLocaleString(); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { show(to); return; }

    show(0);
    let raf = 0;
    let wait = 0;
    // Behind the opening curtain the count would finish unseen — start it as
    // the curtain lifts instead (see Intro.tsx).
    const hold = document.querySelector(".mm-intro-on") ? 1500 : 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      wait = window.setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          show(Math.round(to * (1 - Math.pow(1 - p, 4)))); // ease-out
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, hold);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); clearTimeout(wait); };
  }, [to, duration]);

  // The real number in the server HTML (search engines, no-JS); the effect
  // resets it to 0 and counts up once it's on screen.
  return <span ref={ref}>{to.toLocaleString()}</span>;
}
