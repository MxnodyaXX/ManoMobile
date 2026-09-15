"use client";

import { AlertCircle, Banknote, CreditCard, FileCheck2, Landmark, Loader2, X } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "../format";
import type { PaymentMethod } from "../types";

interface Props {
  total: number;
  paid: number;
  due: number;
  /** Set when a balance is being left with nobody to owe it. */
  warning: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onComplete: (method: PaymentMethod, withBill: boolean) => void;
}

const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "cash",   label: "Cash",      icon: Banknote },
  { id: "card",   label: "Card",      icon: CreditCard },
  { id: "credit", label: "On Credit", icon: Landmark },
  { id: "check",  label: "Cheque",    icon: FileCheck2 },
];

export function PaymentSheet({ total, paid, due, warning, busy, error, onClose, onComplete }: Props) {
  const [method, setMethod] = useState<PaymentMethod>(due > 0 ? "credit" : "cash");
  const [withBill, setWithBill] = useState(true);
  const blocked = busy || !!warning;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-rise flex w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Take Payment</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 font-mono dark:bg-slate-800/60">
            <SummaryFigure label="Total" value={total} />
            <SummaryFigure label="Paid" value={paid} />
            <SummaryFigure label={due < 0 ? "Change" : "Due"} value={Math.abs(due)} tone={due > 0 ? "rose" : due < 0 ? "emerald" : undefined} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {METHODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={`flex flex-col items-center gap-2 rounded-xl border py-4 transition ${
                  method === id
                    ? "border-violet-400 bg-violet-50 text-violet-700 ring-2 ring-violet-100 dark:border-violet-600 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/10"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span className="text-xs font-semibold">{label}</span>
              </button>
            ))}
          </div>

          {(warning || error) && (
            <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle size={15} className="mt-px shrink-0" />
              <span className="leading-relaxed">{error ?? warning}</span>
            </div>
          )}

          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Print receipt</span>
            <button
              type="button"
              role="switch"
              aria-checked={withBill}
              onClick={() => setWithBill(w => !w)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                withBill ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  withBill ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          </label>
        </div>

        <div className="flex gap-2.5 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={blocked}
            onClick={() => onComplete(method, withBill)}
            className="flex flex-2 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {busy && <Loader2 size={15} className="spin-icon" />}
            {busy ? "Recording…" : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryFigure({ label, value, tone }: { label: string; value: number; tone?: "rose" | "emerald" }) {
  const toneClass = tone === "rose" ? "text-rose-600 dark:text-rose-400" : tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white";
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className={`text-sm font-bold ${toneClass}`}>{formatCurrency(value)}</span>
    </div>
  );
}
