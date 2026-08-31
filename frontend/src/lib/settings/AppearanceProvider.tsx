"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { applyPalette, fetchAppearance, DEFAULT_APPEARANCE, type Appearance } from "@/lib/settings/appearance";

/**
 * Applies the shop's chosen palette to every screen.
 *
 * Mounted once at the root, above the routes, so the cashier, technician and
 * admin sides all get the same surfaces — appearance is a property of the shop,
 * and two people at the same counter should not be looking at different colours.
 *
 * Re-applies when the light/dark mode changes, because each palette carries a
 * separate set of values for each mode rather than one being derived from the
 * other by lightening.
 *
 * A failed fetch leaves the stylesheet defaults in place. The look of the app
 * is not worth blocking a repair over.
 */
export default function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [look, setLook] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    let active = true;
    fetchAppearance()
      .then(a => { if (active) setLook(a); })
      .catch(() => { /* stylesheet defaults apply */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    applyPalette(look.palette, resolvedTheme === "dark", look.comfort);
  }, [look, resolvedTheme]);

  // Another tab — or the Appearance page itself — changing the palette should
  // reach this one without a reload.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const next = (e as CustomEvent<Appearance>).detail;
      if (next && typeof next.palette === "string") setLook(next);
    };
    window.addEventListener("mano:palette", onChanged);
    return () => window.removeEventListener("mano:palette", onChanged);
  }, []);

  return <>{children}</>;
}
