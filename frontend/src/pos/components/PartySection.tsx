"use client";

import { Building2, User, X } from "lucide-react";
import { formatCurrency } from "../format";
import type { Party, PartyType } from "../types";

interface Props {
  party: Party | null;
  onPick: (type: PartyType) => void;
  onRemove: () => void;
}

export function PartySection({ party, onPick, onRemove }: Props) {
  if (!party) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Bill to
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPick("customer")}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-violet-600 dark:hover:text-violet-400"
          >
            <User size={13} /> Customer
          </button>
          <button
            type="button"
            onClick={() => onPick("dealer")}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-violet-600 dark:hover:text-violet-400"
          >
            <Building2 size={13} /> Dealer
          </button>
        </div>
      </div>
    );
  }

  const Icon = party.type === "dealer" ? Building2 : User;

  return (
    <div className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
          <Icon size={13} />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {party.type === "dealer" ? "Dealer" : "Customer"}
          </p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{party.name}</p>
          <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            {party.phone || "no phone"}
            {party.address ? ` · ${party.address}` : ""}
          </p>
          {party.outstandingBalance > 0 && (
            <p className="mt-0.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              Owes {formatCurrency(party.outstandingBalance)}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove billing party"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-rose-500 dark:text-slate-500 dark:hover:bg-slate-800"
      >
        <X size={13} />
      </button>
    </div>
  );
}
