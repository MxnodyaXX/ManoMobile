"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The opening curtain (styles in motion.css → "The intro"). Whether it plays
 * is decided by INTRO_SCRIPT (introScript.ts) before the first paint.
 */

const WORD = "MANO MOBILE";

export function Intro() {
  const pathname = usePathname();
  const first = useRef(pathname);

  // Once the visitor moves to another page, the hero hold-back (--intro) must
  // not delay that page's animations too — and the curtain is long gone.
  useEffect(() => {
    if (pathname !== first.current) document.querySelector(".mm-intro-on")?.classList.remove("mm-intro-on");
  }, [pathname]);

  return (
    <div className="mm-intro" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ManoMobileBlack.png" alt="" className="mm-intro-logo h-14 w-14 object-contain invert" />
      <div className="mm-intro-word mt-7 font-[family-name:var(--font-display)] text-[clamp(1.8rem,5vw,3.4rem)] font-extralight tracking-[0.18em]">
        {WORD.split("").map((ch, i) => (
          <span key={i} style={{ ["--i" as string]: i }}>{ch === " " ? " " : ch}</span>
        ))}
      </div>
      <p className="mm-intro-sub mt-4 text-[10px] uppercase tracking-[0.5em] text-white/45">Since 2005</p>
      <div className="mm-intro-bar mt-8" />
    </div>
  );
}
