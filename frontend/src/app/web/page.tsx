import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BatteryCharging, Check, Cpu, Droplets, MapPin, MessageCircle, Phone, PlugZap, Smartphone, Unlock,
} from "lucide-react";
import { SHOP_DETAILS } from "@/lib/shop";
import { fetchCatalogue, fetchShopFacts } from "@/web/catalogue";
import ProductCard from "@/web/ProductCard";
import { CountUp } from "@/web/Motion";
import { delay } from "@/web/ui";
import { WHATSAPP } from "@/web/Footer";
import { BRAND_LOGOS, BrandMark } from "@/web/BrandLogos";

export const revalidate = 300;

const D = "font-[family-name:var(--font-display)]";
const SINCE = 2005;

const SERVICES = [
  { icon: Smartphone, title: "Screen & display", text: "Cracked glass, dead touch, lines or no display — replaced and tested before you collect." },
  { icon: BatteryCharging, title: "Battery", text: "Drains fast, swells or shuts down at 20%? A new cell, fitted properly." },
  { icon: PlugZap, title: "Charging port", text: "Loose cable, slow or no charging — cleaned, repaired or replaced." },
  { icon: Droplets, title: "Water damage", text: "Bring it in fast. We open it, clean it and tell you honestly what's saveable." },
  { icon: Cpu, title: "Board & software", text: "Boot loops, dead phones, updates and data recovery on the bench." },
  { icon: Unlock, title: "Unlock & setup", text: "Network unlocks, account help and moving your data to a new phone." },
];

const STEPS = [
  { n: "01", title: "Drop it off", text: "You get a job number and a slip with a QR code." },
  { n: "02", title: "We diagnose", text: "The technician checks it and prices the repair — sent to you by SMS." },
  { n: "03", title: "You approve", text: "Approve the estimate online. Nothing is fixed without your OK." },
  { n: "04", title: "Collect", text: "Pick it up tested, with a warranty on the repair." },
];

const BRANDS = [...BRAND_LOGOS, { name: "Realme" as const }];

export default async function HomePage() {
  const [{ products }, facts] = await Promise.all([fetchCatalogue(), fetchShopFacts()]);
  const featured = products.filter(p => p.stock > 0).slice(0, 4);
  const years = new Date().getFullYear() - SINCE;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section data-live className="px-3 pt-3 md:px-5 md:pt-5">
        <div className="relative overflow-hidden rounded-[28px] bg-[#efefed] md:rounded-[36px]">
          <div className="mx-auto grid max-w-7xl items-center gap-6 px-6 pb-40 pt-14 md:grid-cols-[1.15fr_1fr] md:px-12 md:pb-48 md:pt-20">
            <div className="relative z-10">
              <p className="mm-rise flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
                <span className="h-px w-8 bg-neutral-400" /> Since {SINCE} · Horana Road
              </p>
              <h1 className={`${D} mt-6 text-[clamp(2.7rem,7.2vw,6.2rem)] font-extralight uppercase leading-[0.92] tracking-[-0.02em]`}>
                <span className="mm-rise block" style={delay(120)}>Your phone,</span>
                <span className="mm-rise relative block" style={delay(260)}>
                  fixed right.
                  {/* the hand-drawn loop from the reference — draws itself once the words are in */}
                  <svg className="pointer-events-none absolute -top-[0.55em] left-[44%] hidden w-[40%] md:block" viewBox="0 0 300 80" fill="none" aria-hidden>
                    <path className="mm-draw" style={delay(900)} pathLength={1} d="M4 60 C 70 10, 170 0, 240 22 C 290 38, 260 66, 210 52" stroke="#111" strokeWidth="1" />
                  </svg>
                </span>
              </h1>
              <p className="mm-rise mt-7 max-w-md text-[15px] leading-relaxed text-neutral-600" style={delay(420)}>
                Screens, batteries, charging ports and water damage — diagnosed honestly, repaired properly,
                and tracked from drop-off to pickup. Plus the accessories to go with it.
              </p>
              <div className="mm-rise mt-9 flex flex-wrap gap-3" style={delay(540)}>
                <Link href="/track" className="group inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3.5 text-[13px] font-medium text-white transition-transform duration-300 hover:scale-[1.03]">
                  Track my repair <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link href="/web/shop" className="inline-flex items-center gap-2 rounded-full border border-neutral-900/20 px-6 py-3.5 text-[13px] font-medium text-neutral-900 transition-colors duration-300 hover:border-neutral-900 hover:bg-neutral-950 hover:text-white">
                  Shop accessories
                </Link>
              </div>

              <div className="mm-rise mt-12 flex flex-wrap gap-x-10 gap-y-4" style={delay(680)}>
                <Fact value={years} unit="yrs" label="Fixing phones" />
                {facts.repairsDone ? <Fact value={facts.repairsDone} unit="+" label="Repairs logged" /> : null}
                {facts.productsInStock ? <Fact value={facts.productsInStock} label="Items in stock" /> : null}
              </div>
            </div>

            {/* Phone mockup with a live-looking status card */}
            <div className="mm-rise relative mx-auto h-[440px] w-full max-w-[420px] md:h-[540px]" style={delay(300)}>
              <div className="mm-float absolute left-1/2 top-4 h-[400px] w-[200px] -translate-x-1/2 rotate-[7deg] rounded-[40px] bg-neutral-950 p-[9px] shadow-[0_50px_90px_-25px_rgba(0,0,0,0.5)] md:h-[480px] md:w-[240px] md:rounded-[46px]" style={delay(0, { "--t": "7s" })}>
                <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[32px] bg-white px-5 pt-12 md:rounded-[38px]">
                  <span className="absolute left-1/2 top-3 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-950" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/ManoMobileBlack.png" alt="" className="h-9 w-9 object-contain" />
                  <p className="mt-5 text-[9px] uppercase tracking-[0.3em] text-neutral-400">Repair status</p>
                  <p className={`${D} text-[26px] font-light leading-none`}>Your phone</p>
                  <p className="mt-1 text-[11px] text-neutral-500">Galaxy A23 · Screen</p>
                  <div className="mt-6 flex flex-col gap-3">
                    {/* ticked off one by one, as if the job is moving along */}
                    {["Received", "Diagnosed", "Approved", "Ready for pickup"].map((s, i) => (
                      <div key={s} className="mm-rise flex items-center gap-2.5" style={delay(1100 + i * 220)}>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full ${i < 4 ? "bg-neutral-950 text-white" : "border border-neutral-300"}`}>
                          <Check size={9} strokeWidth={3} />
                        </span>
                        <span className={`text-[11px] ${i === 3 ? "font-semibold text-neutral-950" : "text-neutral-500"}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mm-rise mm-shine mt-auto mb-6 rounded-2xl bg-neutral-950 px-4 py-3 text-white" style={delay(2000)}>
                    <p className="text-[9px] uppercase tracking-[0.25em] text-white/50">Warranty</p>
                    <p className="text-[12px] font-medium">3 months · active</p>
                  </div>
                </div>
              </div>

              {/* Outer box arrives (rise), inner box floats — two transforms, two elements. */}
              <div className="mm-rise absolute -left-20 bottom-24 hidden w-44 lg:block" style={delay(1600)}>
                <div className="mm-float rounded-2xl bg-white p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)]" style={delay(-2000, { "--t": "6s" })}>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-400">SMS update</p>
                  <p className="mt-1.5 text-[12px] leading-snug text-neutral-800">Your phone is repaired and ready to collect.</p>
                </div>
              </div>
              <div className="mm-rise absolute -right-1 bottom-20 md:-right-6" style={delay(1300)}>
                <div className="mm-float rounded-2xl bg-white px-5 py-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)]" style={delay(-4000, { "--t": "8s" })}>
                  <p className={`${D} flex items-center gap-2 text-[30px] font-light leading-none`}>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-950 opacity-40" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-neutral-950" />
                    </span>
                    Live
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">Status, any time</p>
                </div>
              </div>
            </div>
          </div>

          {/* the dark angled band along the bottom, with the brands running by */}
          <div className="absolute inset-x-0 bottom-0 h-36 bg-neutral-950 md:h-32"
            style={{ clipPath: "polygon(0 38%, 34% 38%, 38% 0, 100% 0, 100% 100%, 0 100%)" }}>
            <div className="mx-auto flex h-full max-w-7xl items-end px-6 pb-6 md:px-12 md:pb-8">
              <div className="flex w-full items-center gap-8">
                <span className="shrink-0 text-[10px] uppercase tracking-[0.3em] text-white/40">We repair</span>
                <div className="mm-marquee-mask min-w-0 flex-1">
                  <div className="mm-marquee" style={{ "--t": "28s" } as React.CSSProperties}>
                    {[...BRANDS, ...BRANDS].map((b, i) => (
                      <span key={i} aria-hidden={i >= BRANDS.length} title={b.name}
                        className="flex h-8 shrink-0 items-center pr-12 text-white/70 transition-colors duration-300 hover:text-white md:pr-16">
                        <BrandMark brand={b} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <SectionHead kicker="Repairs" title="What we fix" link={{ href: "/web/repairs", label: "All repairs" }} />
        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <div key={s.title} data-reveal style={delay((i % 3) * 90)} className="group bg-white p-8 transition-colors duration-500 hover:bg-neutral-950 hover:text-white">
              <s.icon size={30} strokeWidth={1} className="transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110" />
              <h3 className="mt-8 text-[17px] font-semibold">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-500 group-hover:text-white/60">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="bg-neutral-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-28">
          <p data-reveal className="text-[11px] uppercase tracking-[0.35em] text-white/40">How a repair works</p>
          <h2 data-reveal style={delay(100)} className={`${D} mt-4 max-w-2xl text-[clamp(2rem,4.5vw,3.6rem)] font-extralight uppercase leading-[1]`}>
            You always know where your phone is.
          </h2>
          <div className="mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            {STEPS.map((s, i) => (
              <div key={s.n} data-reveal style={delay(i * 140)} className="border-t border-white/15 pt-6">
                <span className={`${D} text-[13px] font-light text-white/40`}>{s.n}</span>
                <h3 className="mt-3 text-[18px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Shop preview ─────────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
          <SectionHead kicker="In store now" title="Accessories" link={{ href: "/web/shop", label: "Shop all" }} />
          <div className="mt-14 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
            {featured.map((p, i) => <div key={p.id} data-reveal style={delay(i * 90)}><ProductCard p={p} /></div>)}
          </div>
        </section>
      )}

      {/* ── Track band ───────────────────────────────────────────────────── */}
      <section className="px-3 md:px-5">
        <div data-reveal className="mx-auto grid max-w-7xl items-center gap-10 rounded-[28px] bg-[#efefed] px-6 py-14 md:grid-cols-2 md:rounded-[36px] md:px-14 md:py-20">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">Already dropped it off?</p>
            <h2 className={`${D} mt-4 text-[clamp(2rem,4vw,3.4rem)] font-extralight uppercase leading-[1]`}>Track your repair</h2>
            <p className="mt-4 max-w-sm text-[14px] text-neutral-600">Enter the job number from your slip — it starts with RM.</p>
          </div>
          <form action="/track" className="flex w-full flex-col gap-3 sm:flex-row">
            <input name="job" required placeholder="e.g. RM-1008"
              className="h-14 flex-1 rounded-full border border-neutral-300 bg-white px-6 text-[15px] outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-950" />
            <button className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-neutral-950 px-8 text-[13px] font-medium text-white">
              Track <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </section>

      {/* ── Visit ────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-24 md:grid-cols-[1fr_1.3fr] md:px-8 md:py-32">
        <div data-reveal>
          <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-400">Visit us</p>
          <h2 className={`${D} mt-4 text-[clamp(2rem,4vw,3.4rem)] font-extralight uppercase leading-[1]`}>Kurusa Junction</h2>
          <div className="mt-10 flex flex-col gap-5 text-[14px]">
            <p className="flex gap-3"><MapPin size={18} strokeWidth={1.5} className="shrink-0" />{SHOP_DETAILS.address}</p>
            <a href={`tel:${SHOP_DETAILS.phone.replace(/\s/g, "")}`} className="flex gap-3 hover:underline"><Phone size={18} strokeWidth={1.5} className="shrink-0" />{SHOP_DETAILS.phone}</a>
            <a href={WHATSAPP} target="_blank" rel="noopener" className="flex gap-3 hover:underline"><MessageCircle size={18} strokeWidth={1.5} className="shrink-0" />Message us on WhatsApp</a>
          </div>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${SHOP_DETAILS.name} ${SHOP_DETAILS.address}`)}`} target="_blank" rel="noopener"
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-neutral-900/20 px-6 py-3 text-[13px] font-medium hover:border-neutral-900">
            Get directions <ArrowUpRight size={15} />
          </a>
        </div>
        <div data-reveal style={delay(150)} className="aspect-[4/3] overflow-hidden rounded-[28px] bg-neutral-100 grayscale">
          <iframe
            title="Map"
            className="h-full w-full border-0"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(`${SHOP_DETAILS.address}, Sri Lanka`)}&z=15&output=embed`}
          />
        </div>
      </section>
    </>
  );
}

function Fact({ value, unit, label }: { value: number; unit?: string; label: string }) {
  return (
    <div>
      <p className={`${D} text-[34px] font-light leading-none`}><CountUp to={value} /><span className="text-[18px] text-neutral-400">{unit}</span></p>
      <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">{label}</p>
    </div>
  );
}

function SectionHead({ kicker, title, link }: { kicker: string; title: string; link?: { href: string; label: string } }) {
  return (
    <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-400">{kicker}</p>
        <h2 className={`${D} mt-4 text-[clamp(2.2rem,5vw,4rem)] font-extralight uppercase leading-[0.95]`}>{title}</h2>
      </div>
      {link && (
        <Link href={link.href} className="group inline-flex items-center gap-2 border-b border-neutral-900 pb-1 text-[13px] font-medium">
          {link.label} <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
