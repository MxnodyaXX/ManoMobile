"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  message: string;
  tone?: "ok" | "error";
}

export function Toast({ message, tone = "ok" }: Props) {
  return (
    <div className="animate-rise fixed bottom-6 left-1/2 z-40 flex max-w-[90vw] -translate-x-1/2 items-center gap-2.5 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl dark:bg-white dark:text-slate-900">
      {tone === "error"
        ? <AlertCircle size={16} className="shrink-0 text-rose-400 dark:text-rose-600" />
        : <CheckCircle2 size={16} className="shrink-0 text-emerald-400 dark:text-emerald-600" />}
      {message}
    </div>
  );
}
