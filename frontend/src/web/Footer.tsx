import Link from "next/link";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { SHOP_DETAILS } from "@/lib/shop";

export const WHATSAPP = `https://wa.me/94${SHOP_DETAILS.phone.replace(/\D/g, "").replace(/^0/, "")}`;

export default function Footer() {
  return (
    <footer className="bg-neutral-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ManoMobileBlack.png" alt="" className="h-9 w-9 object-contain invert" />
            <span className="text-[16px] font-semibold">Mano Mobile</span>
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/55">
            Phone repairs, accessories and honest advice — {SHOP_DETAILS.tagline.toLowerCase()}.
          </p>
        </div>
        <div>
          <p className="mb-4 text-[11px] uppercase tracking-[0.25em] text-white/40">Shop</p>
          <ul className="flex flex-col gap-2.5 text-[13px] text-white/70">
            <li><Link href="/web/shop" className="hover:text-white">All accessories</Link></li>
            <li><Link href="/web/cart" className="hover:text-white">Basket</Link></li>
            <li><Link href="/web/account" className="hover:text-white">My orders</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-[11px] uppercase tracking-[0.25em] text-white/40">Repairs</p>
          <ul className="flex flex-col gap-2.5 text-[13px] text-white/70">
            <li><Link href="/web/repairs" className="hover:text-white">What we fix</Link></li>
            <li><Link href="/track" className="hover:text-white">Track a repair</Link></li>
            <li><Link href="/web/account" className="hover:text-white">Repair history</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-[11px] uppercase tracking-[0.25em] text-white/40">Visit</p>
          <ul className="flex flex-col gap-3 text-[13px] text-white/70">
            <li className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0" />{SHOP_DETAILS.address}</li>
            <li><a href={`tel:${SHOP_DETAILS.phone.replace(/\s/g, "")}`} className="flex gap-2 hover:text-white"><Phone size={15} className="shrink-0" />{SHOP_DETAILS.phone}</a></li>
            <li><a href={WHATSAPP} target="_blank" rel="noopener" className="flex gap-2 hover:text-white"><MessageCircle size={15} className="shrink-0" />WhatsApp us</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-5 py-6 text-[11px] text-white/40 md:px-8">
          <span>© {new Date().getFullYear()} {SHOP_DETAILS.name}</span>
          <span>{SHOP_DETAILS.website}</span>
        </div>
      </div>
    </footer>
  );
}
