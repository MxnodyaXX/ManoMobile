"use client";

import { History, Minus, Plus, Printer, Receipt, ShoppingBag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "../format";
import type { CartApi } from "../useCart";
import type { PartyType } from "../types";
import { PartySection } from "./PartySection";

interface Props {
  cart: CartApi;
  /** The invoice number the next sale will get — a preview, never reserved. */
  billNo: string | null;
  heldCount: number;
  onOpenHeld: () => void;
  onPickParty: (type: PartyType) => void;
  onHold: () => void;
  onNewSale: () => void;
  onVoid: () => void;
  onCharge: () => void;
  onPrint: () => void;
}

export function CartPanel({ cart, billNo, heldCount, onOpenHeld, onPickParty, onHold, onNewSale, onVoid, onCharge, onPrint }: Props) {
  const [voidArmed, setVoidArmed] = useState(false);
  const isEmpty = cart.lines.length === 0;
  const previousBalance = cart.party?.outstandingBalance ?? 0;
  const grandDue = cart.due + previousBalance;

  function handleVoidClick() {
    if (!voidArmed) {
      setVoidArmed(true);
      setTimeout(() => setVoidArmed(false), 3000);
      return;
    }
    setVoidArmed(false);
    onVoid();
  }

  return (
    <aside className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Header — fixed. Everything above the line stays put; only the lines
          of the sale scroll. */}
      <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Current Sale</h2>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrint}
            disabled={isEmpty}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Print bill"
            title="Print a copy of the bill as it stands"
          >
            <Printer size={15} />
          </button>
          <button
            type="button"
            onClick={onOpenHeld}
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Held sales"
          >
            <History size={15} />
            {heldCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {heldCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="shrink-0 px-5 pb-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1 font-mono text-xs font-extrabold tracking-wide text-white dark:bg-violet-500"
          title="The number this sale will take when it is completed"
        >
          <Receipt size={12} strokeWidth={2.5} />
          {billNo ?? "INV-…"}
        </span>
      </div>

      {/* Who is being billed — fixed, because the balance they already owe is
          part of the figure at the bottom and should not scroll away from it. */}
      <div className="shrink-0 px-5 pb-4">
        <PartySection party={cart.party} onPick={onPickParty} onRemove={() => cart.setParty(null)} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 px-5 dark:border-slate-800">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center text-slate-300 dark:text-slate-700">
            <ShoppingBag size={30} strokeWidth={1.5} />
            <p className="text-sm font-medium text-slate-400 dark:text-slate-600">Cart is empty</p>
            <p className="text-xs text-slate-300 dark:text-slate-700">Tap a product to add it to the sale</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            {/* The column heads stay with the list as it scrolls. */}
            <thead className="sticky top-0 z-10 bg-white dark:bg-slate-950">
              <tr className="text-left text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="pb-2 pt-3 font-semibold">Item</th>
                <th className="w-24 pb-2 pt-3 text-center font-semibold">Qty</th>
                <th className="pb-2 pt-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {cart.lines.map(line => (
                <tr key={line.id} className="align-top">
                  <td className="border-t border-slate-100 py-2.5 pr-2 dark:border-slate-800">
                    <p className="font-semibold leading-snug text-slate-800 dark:text-slate-100">
                      {line.product.name}
                    </p>
                    <p className="font-mono text-[10.5px] text-slate-400 dark:text-slate-500">
                      {line.product.sku} &middot; {formatCurrency(line.product.price)}
                    </p>
                  </td>
                  <td className="border-t border-slate-100 py-2.5 text-center dark:border-slate-800">
                    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-1 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => cart.decQty(line.id)}
                        className="flex h-6 w-6 items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-4 text-center font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => cart.incQty(line.id)}
                        disabled={line.qty >= line.product.stock}
                        className="flex h-6 w-6 items-center justify-center text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white"
                        aria-label="Increase quantity"
                        title={line.qty >= line.product.stock ? `Only ${line.product.stock} in stock` : undefined}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </td>
                  <td className="border-t border-slate-100 py-2.5 text-right dark:border-slate-800">
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(line.product.price * line.qty)}
                    </p>
                    <button
                      type="button"
                      onClick={() => cart.removeLine(line.id)}
                      className="mt-0.5 text-slate-300 hover:text-rose-500 dark:text-slate-700"
                      aria-label={`Remove ${line.product.name}`}
                    >
                      <X size={12} className="ml-auto" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Totals — pinned above the buttons, so the figure being charged is on
          screen whatever the list is doing. */}
      <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-5 pb-4 pt-4 dark:border-slate-800">
        <TotalRow label="Subtotal" value={formatCurrency(cart.subtotal)} />
        <EditableRow label="Discount" value={cart.discountAmount} onChange={cart.setDiscountAmount} />
        <EditableRow label="Write-off" value={cart.writeOffAmount} onChange={cart.setWriteOffAmount} />

        <div className="my-1 border-t border-dashed border-slate-200 dark:border-slate-700" />

        <TotalRow label="Total" value={formatCurrency(cart.total)} strong />

        <div className="flex items-center justify-between gap-2">
          <label htmlFor="paid-amount" className="text-sm text-slate-500 dark:text-slate-400">
            Paid
          </label>
          <div className="flex items-center gap-1.5">
            {!cart.paidIsAuto && (
              <button
                type="button"
                onClick={cart.resetPaidToFull}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Full
              </button>
            )}
            <input
              id="paid-amount"
              type="number"
              min={0}
              value={cart.paidAmount === 0 ? "" : cart.paidAmount}
              placeholder="0.00"
              onChange={e => cart.setPaidAmount(Number(e.target.value))}
              className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right font-mono text-sm text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {previousBalance > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-600 dark:text-amber-400">Previous balance</span>
            <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrency(previousBalance)}
            </span>
          </div>
        )}

        <div className="my-1 border-t border-dashed border-slate-200 dark:border-slate-700" />

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {grandDue < 0 ? "Change" : "Due"}
          </span>
          <span
            className={`font-mono text-xl font-extrabold ${
              grandDue > 0
                ? "text-rose-600 dark:text-rose-400"
                : grandDue < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-900 dark:text-white"
            }`}
          >
            {formatCurrency(Math.abs(grandDue))}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 border-t border-slate-200 px-5 pb-5 pt-4 dark:border-slate-800">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onHold}
            disabled={isEmpty}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 py-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
          >
            <History size={15} />
            <span className="text-[10.5px] font-semibold">Hold</span>
          </button>
          <button
            type="button"
            onClick={onNewSale}
            disabled={isEmpty}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 py-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
          >
            <Receipt size={15} />
            <span className="text-[10.5px] font-semibold">New sale</span>
          </button>
          <button
            type="button"
            onClick={handleVoidClick}
            disabled={isEmpty}
            className={`flex flex-col items-center gap-1 rounded-xl border py-2 transition disabled:opacity-40 ${
              voidArmed
                ? "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-400"
                : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
            }`}
          >
            <Trash2 size={15} />
            <span className="text-[10.5px] font-semibold">{voidArmed ? "Confirm?" : "Void"}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCharge}
          disabled={isEmpty}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          Complete Sale
        </button>
      </div>
    </aside>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between ${
        strong ? "text-base font-extrabold text-slate-900 dark:text-white" : "text-sm text-slate-500 dark:text-slate-400"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function EditableRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value === 0 ? "" : value}
        placeholder="0.00"
        onChange={e => onChange(Number(e.target.value))}
        className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right font-mono text-sm text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}
