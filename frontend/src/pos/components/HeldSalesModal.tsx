"use client";

import { Inbox, Trash2, X } from "lucide-react";
import { formatCurrency, formatTime } from "../format";
import type { HeldSale } from "../types";

interface Props {
  sales: HeldSale[];
  onClose: () => void;
  onResume: (sale: HeldSale) => void;
  onDelete: (id: string) => void;
}

export function HeldSalesModal({ sales, onClose, onResume, onDelete }: Props) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-rise flex w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Held Sales</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Kept in this tab until it is closed</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto px-3 py-3">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-slate-300 dark:text-slate-700">
              <Inbox size={28} strokeWidth={1.5} />
              <p className="text-sm font-medium text-slate-400 dark:text-slate-600">No held sales</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sales.map(sale => {
                const subtotal = sale.lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
                const total = Math.max(0, subtotal - sale.discountAmount - sale.writeOffAmount);
                const itemCount = sale.lines.reduce((n, l) => n + l.qty, 0);
                return (
                  <li
                    key={sale.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {formatTime(new Date(sale.heldAt))}
                        {sale.party ? ` · ${sale.party.name}` : ""}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {itemCount} {itemCount === 1 ? "item" : "items"} &middot;{" "}
                        <span className="font-mono">{formatCurrency(total)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onResume(sale)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-violet-600 dark:hover:bg-violet-500"
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(sale.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 dark:text-slate-600 dark:hover:bg-rose-500/10"
                        aria-label="Delete held sale"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
