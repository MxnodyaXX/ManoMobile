"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Light/dark mode.
 *
 * Replaces next-themes, which is otherwise fine but renders its pre-paint
 * script as a React element inside a client component. React 19 warns on every
 * load that a script created client-side never executes — true, and harmless
 * there, since the copy in the server HTML had already run. Still a warning
 * nobody can act on, printed on every page.
 *
 * Here the script is emitted by `next/script` at `beforeInteractive` from the
 * root layout, which puts it in the initial HTML's <head> rather than in the
 * React tree at all. Same no-flash behaviour, nothing for React to re-create.
 *
 * The API is deliberately the three fields the app already used — `theme`,
 * `setTheme`, `resolvedTheme` — so no call site had to change shape.
 */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Where the choice is kept. Must match THEME_SCRIPT below. */
export const THEME_STORAGE_KEY = "theme";

const DEFAULT_THEME: Theme = "light";

/**
 * The pre-paint bootstrap, as source.
 *
 * Runs before the first paint, straight from the HTML — this is the whole
 * reason a theme needs a script at all. Without it the page paints in the
 * default palette and then snaps to the stored one, which is the flash every
 * theme switcher exists to avoid.
 *
 * Deliberately hand-written and self-contained rather than serialised from a
 * function: it has to run with no bundler, no modules and no React, and it
 * must never throw — a browser with site data blocked has to get a themed page,
 * not a blank one.
 */
export const THEME_SCRIPT = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||${JSON.stringify(DEFAULT_THEME)};
var t=s==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):s;
var d=document.documentElement;
d.classList.remove("light","dark");
d.classList.add(t);
d.style.colorScheme=t;
}catch(e){}})();`;

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

/** Put the resolved mode on <html>, the same way THEME_SCRIPT does. */
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
  // Read on the client during the first render, so a component reading the
  // theme immediately after hydration sees the same value the script already
  // applied to <html> rather than the default it is about to be corrected to.
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined" ? DEFAULT_THEME : storedTheme() ?? DEFAULT_THEME,
  );
  const [system, setSystem] = useState<ResolvedTheme>(() => systemTheme());

  const resolvedTheme: ResolvedTheme = theme === "system" ? system : theme;

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
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme],
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
