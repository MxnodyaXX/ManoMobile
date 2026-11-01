"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, Minus, Plus, ShoppingBag, Store, Trash2, Truck } from "lucide-react";
import { SHOP_DETAILS } from "@/lib/shop";
import { useCart } from "./cart";
import { ProductArt, rs } from "./ui";

const D = "font-[family-name:var(--font-display)]";
type Mode = "pickup" | "delivery";

/**
 * Basket and checkout. PREVIEW: placing a reservation/order shows the
 * confirmation the customer would see, but nothing is sent to the shop yet —
 * that waits on customer sign-in (SMS code) and the shop-side order queue.
 */
export default function CartView() {
  const params = useSearchParams();
  const { lines, total, setQty, remove, clear } = useCart();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "delivery" ? "delivery" : "pickup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");
  const [placed, setPlaced] = useState<null | { ref: string; mode: Mode; total: number; count: number }>(null);
  const [error, setError] = useState<string | null>(null);

  const field = "h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-[14px] outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950";

  function place() {
    if (!name.trim()) return setError("Add your name.");
    if (phone.replace(/\D/g, "").length < 9) return setError("Add a phone number we can reach you on.");
    if (mode === "delivery" && (!address.trim() || !city.trim())) return setError("Add the delivery address and town.");
    setError(null);
    setPlaced({ ref: `WEB-${Date.now().toString().slice(-6)}`, mode, total, count: lines.reduce((s, l) => s + l.qty, 0) });
    clear();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (placed) {
    return (
      <div className="mm-fade mx-auto max-w-2xl py-16 text-center">
        <span className="mm-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-950 text-white" style={{ ["--d" as string]: "150ms" }}><Check size={26} /></span>
        <p className="mt-8 text-[11px] uppercase tracking-[0.35em] text-neutral-400">{placed.mode === "pickup" ? "Reservation" : "Order"} {placed.ref}</p>
        <h1 className={`${D} mt-4 text-[clamp(2.2rem,5vw,3.8rem)] font-extralight uppercase leading-[0.95]`}>
          {placed.mode === "pickup" ? "It's set aside for you" : "Order received"}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-neutral-600">
          {placed.mode === "pickup"
            ? `We'll hold your ${placed.count} item${placed.count === 1 ? "" : "s"} for 48 hours. Pay ${rs(placed.total)} when you collect at ${SHOP_DETAILS.address}.`
            : `We'll call ${phone} to confirm delivery and the delivery charge before it goes out.`}
        </p>
        <p className="mx-auto mt-8 inline-block rounded-full bg-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
          Preview — this wasn&apos;t sent to the shop. Online ordering goes live once customer sign-in is connected.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/web/shop" className="rounded-full bg-neutral-950 px-6 py-3.5 text-[13px] font-medium text-white">Keep shopping</Link>
          <Link href="/web/account" className="rounded-full border border-neutral-900/20 px-6 py-3.5 text-[13px] font-medium">My orders</Link>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-24 text-center">
        <ShoppingBag size={40} strokeWidth={1} className="mx-auto text-neutral-300" />
        <h1 className={`${D} mt-6 text-[clamp(2rem,4vw,3rem)] font-extralight uppercase`}>Your basket is empty</h1>
        <Link href="/web/shop" className="mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3.5 text-[13px] font-medium text-white">
          Browse accessories <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mm-fade grid gap-12 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <h1 className={`${D} text-[clamp(2.4rem,5vw,4rem)] font-extralight uppercase leading-[0.95]`}>Basket</h1>
        <ul className="mt-10 divide-y divide-neutral-200 border-y border-neutral-200">
          {lines.map(l => (
            <li key={l.id} className="flex gap-5 py-6">
              <Link href={`/web/shop/${l.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
                <ProductArt category={l.category} brand="" size="sm" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">{l.category}</p>
                    <Link href={`/web/shop/${l.id}`} className="mt-1 block text-[14px] font-medium leading-snug">{l.name}</Link>
                  </div>
                  <span className="shrink-0 text-[14px] font-semibold">{rs(l.price * l.qty)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex h-9 items-center rounded-full border border-neutral-200">
                    <button onClick={() => setQty(l.id, l.qty - 1)} aria-label="Less" className="flex h-9 w-9 items-center justify-center text-neutral-500"><Minus size={13} /></button>
                    <span className="w-6 text-center text-[13px] font-semibold">{l.qty}</span>
                    <button onClick={() => setQty(l.id, l.qty + 1)} aria-label="More" className="flex h-9 w-9 items-center justify-center text-neutral-500"><Plus size={13} /></button>
                  </div>
                  <button onClick={() => remove(l.id)} className="flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-neutral-950"><Trash2 size={13} /> Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-[28px] bg-[#efefed] p-6 md:p-8 lg:sticky lg:top-24">
        <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">How do you want it?</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([["pickup", Store, "Collect", "Free · held 48h"], ["delivery", Truck, "Delivery", "We'll confirm the fee"]] as const).map(([m, Icon, title, sub]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-2xl border p-4 text-left transition-colors ${mode === m ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300 bg-white"}`}>
              <Icon size={18} strokeWidth={1.5} />
              <p className="mt-3 text-[13px] font-semibold">{title}</p>
              <p className={`text-[11px] ${mode === m ? "text-white/60" : "text-neutral-500"}`}>{sub}</p>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={field} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" className={field} />
          {mode === "delivery" && <>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" className={field} />
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="Town" className={field} />
          </>}
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" rows={2}
            className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none placeholder:text-neutral-400 focus:border-neutral-950" />
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-neutral-300 pt-5 text-[13px]">
          <div className="flex justify-between text-neutral-600"><span>Items</span><span>{rs(total)}</span></div>
          <div className="flex justify-between text-neutral-600"><span>{mode === "pickup" ? "Collection" : "Delivery"}</span><span>{mode === "pickup" ? "Free" : "Confirmed by phone"}</span></div>
          <div className="flex justify-between pt-2 text-[18px] font-semibold"><span>Total</span><span>{rs(total)}</span></div>
          <p className="text-[11px] text-neutral-500">{mode === "pickup" ? "Pay at the shop when you collect." : "Pay on delivery."}</p>
        </div>

        {error && <p className="mt-4 text-[12px] text-red-600">{error}</p>}
        <button onClick={place} className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-[13px] font-medium text-white transition-transform hover:scale-[1.01]">
          {mode === "pickup" ? "Reserve items" : "Place order"} <ArrowRight size={15} />
        </button>
      </aside>
    </div>
  );
}
