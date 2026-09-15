"use client";

import { LogOut, Moon, ShoppingBasket, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { formatCurrency, formatDate, formatTime } from "../format";

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  todayTotal: number;
  todayCount: number;
  cashierName: string;
  onLogout: () => void;
}

export function TopBar({ dark, onToggleDark, todayTotal, todayCount, cashierName, onLogout }: Props) {
  const now = useClock();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-violet-600">
          <ShoppingBasket size={16} strokeWidth={2.2} />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900 dark:text-white">Mano Mobile</p>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            Point of Sale &middot; {cashierName}
          </p>
        </div>
      </div>

      <div className="hidden items-center gap-6 sm:flex">
        <div className="text-right leading-tight">
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Today&rsquo;s sales</p>
          <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
            {formatCurrency(todayTotal)}
            <span className="ml-1.5 font-sans text-[11px] font-medium text-slate-400 dark:text-slate-500">
              &middot; {todayCount} {todayCount === 1 ? "sale" : "sales"}
            </span>
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />

        <div className="text-right leading-tight">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{now ? formatTime(now) : " "}</p>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{now ? formatDate(now) : " "}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleDark}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

/* The wall clock, to the half-minute. An external store rather than state set
   from an effect: the server renders no time (it would never match the
   browser's), and the browser subscribes to a tick. */
const TICK = 30_000;
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, TICK);
  return () => clearInterval(id);
};
const getTick = () => Math.floor(Date.now() / TICK);
const getServerTick = () => 0;

function useClock(): Date | null {
  const tick = useSyncExternalStore(subscribe, getTick, getServerTick);
  return tick === 0 ? null : new Date(tick * TICK);
}
