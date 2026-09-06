"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHydrated } from "@/lib/ui/useHydrated";

/**
 * Light/dark mode.
 *
 * Replaces next-themes, and drops the pre-paint script both it and an earlier
 * version of this file rendered.
 *
 * That script existed to set `light`/`dark` on <html> before the first paint,
 * to stop the page flashing the wrong palette. In this app it never could:
 * globals.css is the only stylesheet and it has no `.dark` or `[data-theme]`
 * rule anywhere. The colours are CSS custom properties written onto
 * documentElement by applyPalette() from AppearanceProvider's effect, which
 * runs after mount whatever the class says. The script was setting a class
 * nothing styles, and paying for it with React's "script tag while rendering"
 * warning on every load — React re-creates any executable inline script it
 * renders on the client, so no placement avoids that.
 *
 * The class and color-scheme are still applied, from the effect below, because
 * `color-scheme` drives the native controls — scrollbars, date pickers, the
 * form widgets the palette cannot reach.
 *
 * The API is deliberately the three fields the app already used — `theme`,
 * `setTheme`, `resolvedTheme` — so no call site had to change shape.
 */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Where the choice is kept. */
export const THEME_STORAGE_KEY = "theme";

const DEFAULT_THEME: Theme = "light";

const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

const systemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" && window.matchMedia(SYSTEM_QUERY).matches ? "dark" : "light";

const storedTheme = (): Theme | null => {
  // Private windows and blocked site data both throw here rather than
  // returning null, so the read is guarded and not merely null-checked.
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : null;
  } catch {
    return null;
  }
};

/**
 * Put the resolved mode on <html>.
 *
 * The class is for anything reading it in JS; `color-scheme` is the part that
 * does visible work, telling the browser to draw its own controls dark.
 */
function applyTheme(resolved: ResolvedTheme) {
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  el.classList.add(resolved);
  el.style.colorScheme = resolved;
}

interface ThemeValue {
  /** The choice, which may be "system". */
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** What "system" actually resolves to right now. Never "system". */
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined" ? DEFAULT_THEME : storedTheme() ?? DEFAULT_THEME,
  );
  const [system, setSystem] = useState<ResolvedTheme>(() => systemTheme());

  /**
   * The stored choice is deliberately withheld from the first client render.
   *
   * It is read from localStorage in the initialiser above, which also runs
   * while hydrating — so a consumer drawing anything theme-dependent (a chart's
   * colours, a Sun/Moon icon) would render "dark" against server HTML that said
   * "light", and React would discard the tree. Holding the default for one
   * render costs nothing visible: the palette is applied by AppearanceProvider's
   * effect either way, which lands no earlier than this does.
   */
  const hydrated = useHydrated();
  const effective: Theme = hydrated ? theme : DEFAULT_THEME;
  const resolvedTheme: ResolvedTheme = effective === "system" ? system : effective;

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The mode still applies for this session; it just will not be
      // remembered. Not worth failing over.
    }
  }, []);

  useEffect(() => { applyTheme(resolvedTheme); }, [resolvedTheme]);

  // Following the OS only matters while the choice is "system", but the
  // listener is unconditional: switching to "system" later should not depend on
  // a listener that was never attached.
  useEffect(() => {
    const mq = window.matchMedia(SYSTEM_QUERY);
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // A second tab changing the mode should reach this one. Same behaviour
  // next-themes had, and the reason a shop with two browser windows open on
  // the same counter does not end up with them disagreeing.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      setThemeState(storedTheme() ?? DEFAULT_THEME);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({ theme: effective, setTheme, resolvedTheme }),
    [effective, setTheme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * The current mode.
 *
 * Falls back to the light default outside a provider rather than throwing:
 * a chart or a toggle rendered in isolation should draw in some sane palette,
 * not take the screen down.
 */
export function useTheme(): ThemeValue {
  return useContext(ThemeContext) ?? {
    theme: DEFAULT_THEME,
    setTheme: () => {},
    resolvedTheme: "light",
  };
}
