"use client";

import { Building2, Loader2, Plus, Search, User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "../format";
import type { Party, PartyType } from "../types";

interface Props {
  type: PartyType;
  parties: Party[];
  loading: boolean;
  onSelect: (party: Party) => void;
  /** Opens the account and resolves to the party to bill; rejects with a message. */
  onAdd: (draft: { name: string; phone: string; address: string }) => Promise<void>;
  onClose: () => void;
}

const COPY: Record<PartyType, { title: string; noun: string; icon: typeof User; addressLabel: string }> = {
  customer: { title: "Select Customer", noun: "customer", icon: User, addressLabel: "Address (optional)" },
  dealer:   { title: "Select Dealer",   noun: "dealer",   icon: Building2, addressLabel: "Company / Address" },
};

export function PartyPicker({ type, parties, loading, onSelect, onAdd, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[type];
  const Icon = copy.icon;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parties;
    const digits = q.replace(/\D/g, "");
    return parties.filter(p =>
      p.name.toLowerCase().includes(q) || (digits.length > 0 && p.phone.replace(/\D/g, "").includes(digits)),
    );
  }, [parties, query]);

  async function handleAdd() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({ name: name.trim(), phone: phone.trim(), address: address.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-rise flex w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-violet-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{copy.title}</h2>
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

        {!showForm ? (
          <>
            <div className="px-6 pt-4">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`Search ${copy.noun}s by name or phone`}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-500/10"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto px-3 py-3">
              {loading && parties.length === 0 ? (
                <p className="flex items-center justify-center gap-2 px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-600">
                  <Loader2 size={14} className="spin-icon" /> Loading {copy.noun}s…
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-600">
                  {query ? <>No {copy.noun}s match &ldquo;{query}&rdquo;</> : <>No {copy.noun}s yet</>}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {filtered.map(p => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(p)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {p.name}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                            {p.phone || "no phone"}
                            {p.address ? ` · ${p.address}` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {p.outstandingBalance > 0 && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                              Owes {formatCurrency(p.outstandingBalance)}
                            </span>
                          )}
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Select
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setName(query && !filtered.length ? query : "");
                  setShowForm(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-500 hover:border-violet-300 hover:text-violet-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-violet-700 dark:hover:text-violet-400"
              >
                <Plus size={15} />
                Add new {copy.noun}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3 px-6 py-5">
            <Field label="Full name">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={type === "dealer" ? "e.g. City Cellular" : "e.g. Nimal Perera"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </Field>
            <Field label="Phone number (optional)">
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="07X XXX XXXX"
                inputMode="tel"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </Field>
            <Field label={copy.addressLabel}>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </Field>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="mt-2 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Back to list
              </button>
              <button
                type="button"
                disabled={!name.trim() || saving}
                onClick={handleAdd}
                className="flex flex-2 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                {saving && <Loader2 size={14} className="spin-icon" />}
                {saving ? "Saving…" : `Add & use ${copy.noun}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
