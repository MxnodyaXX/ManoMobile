"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * A fixed-size printed page shown on screen: zoomed down when its box is
 * narrower than the page, untouched when the page fits.
 *
 * An invoice is laid out in millimetres, wider than a phone. Centred in a
 * narrower box its left edge is cut off with nothing to scroll to, and even
 * scrolled it can't be read as a page. The zoom sits on this wrapper rather
 * than on the page, so the markup copied for printing and history never
 * carries it.
 */
export default function ShrinkToFit({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current, inner = innerRef.current;
    if (!outer || !inner) return;
    const fit = () => {
      inner.style.zoom = "1";
      const need = inner.offsetWidth, have = outer.clientWidth;
      inner.style.zoom = need > have && have > 0 ? String(have / need) : "1";
    };
    fit();
    // The outer box for rotation and resize; the inner for a designed template
    // that loads in after the plain layout and comes out a different size.
    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} style={{ width: "100%", minWidth: 0, display: "flex", justifyContent: "center", overflow: "hidden" }}>
      <div ref={innerRef} style={{ width: "max-content", flexShrink: 0 }}>{children}</div>
    </div>
  );
}
