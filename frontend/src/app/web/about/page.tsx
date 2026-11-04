import type { Metadata } from "next";
import { MapPin, MessageCircle, Phone, Mail } from "lucide-react";
import { SHOP_DETAILS } from "@/lib/shop";
import { WHATSAPP } from "@/web/Footer";
import { delay } from "@/web/ui";
import Team from "@/web/Team";

export const metadata: Metadata = { title: "About us" };

const D = "font-[family-name:var(--font-display)]";
const SINCE = 2005;

export default function AboutPage() {
  const years = new Date().getFullYear() - SINCE;
  return (
    <>
      <section className="px-3 pt-3 md:px-5 md:pt-5">
        <div className="mx-auto max-w-7xl rounded-[28px] bg-[#efefed] px-6 py-20 md:rounded-[36px] md:px-14 md:py-28">
          <p className="mm-rise flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            <span className="h-px w-8 bg-neutral-400" /> About Mano Mobile
          </p>
          <h1 style={delay(120)} className={`${D} mm-rise mt-6 max-w-5xl text-[clamp(2.6rem,6.5vw,5.6rem)] font-extralight uppercase leading-[0.92]`}>
            {years} years of fixing what matters to you.
          </h1>
          <p style={delay(260)} className="mm-rise mt-8 max-w-2xl text-[15px] leading-relaxed text-neutral-600">
            Mano Mobile has been repairing phones at Kurusa Junction since {SINCE}. Your phone holds your photos, your
            work and your people — so we treat it that way: a clear price before we start, a record of everything we do,
            and a warranty on the work.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-px px-5 py-24 md:grid-cols-3 md:px-8">
        {[
          ["Honest", "We tell you what's wrong and what it costs before we touch it — and when a repair isn't worth it."],
          ["Recorded", "Every job has a number, a history and photos from when it came in. Nothing gets lost on a scrap of paper."],
          ["Stocked", "The accessories on this site are the ones on our shelves, with live stock — not a supplier's catalogue."],
        ].map(([t, d], i) => (
          <div key={t} data-reveal style={delay(i * 140)} className="border-t border-neutral-900 pt-6 md:pr-10">
            <h2 className={`${D} text-[34px] font-extralight uppercase`}>{t}</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">{d}</p>
          </div>
        ))}
      </section>

      <Team />

      <section className="mx-auto max-w-7xl px-5 pb-28 md:px-8">
        <div data-reveal data-live className="mm-shine grid gap-6 rounded-[28px] bg-neutral-950 p-8 text-white md:grid-cols-4 md:p-12">
          <Contact icon={MapPin} label="Visit" value={SHOP_DETAILS.address} />
          <Contact icon={Phone} label="Call" value={SHOP_DETAILS.phone} href={`tel:${SHOP_DETAILS.phone.replace(/\s/g, "")}`} />
          <Contact icon={MessageCircle} label="WhatsApp" value="Message us" href={WHATSAPP} />
          <Contact icon={Mail} label="Email" value={SHOP_DETAILS.email} href={`mailto:${SHOP_DETAILS.email}`} />
        </div>
      </section>
    </>
  );
}

function Contact({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string; href?: string }) {
  const body = (
    <>
      <Icon size={20} strokeWidth={1.3} />
      <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-white/40">{label}</p>
      <p className="mt-1.5 text-[14px]">{value}</p>
    </>
  );
  return href
    ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="block rounded-2xl p-2 transition-colors hover:bg-white/5">{body}</a>
    : <div className="p-2">{body}</div>;
}
