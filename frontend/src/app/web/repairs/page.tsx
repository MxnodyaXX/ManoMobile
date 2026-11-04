import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BatteryCharging, Camera, Cpu, Droplets, MessageCircle, Mic, PlugZap, Smartphone, Unlock, Volume2 } from "lucide-react";
import { WHATSAPP } from "@/web/Footer";
import { delay } from "@/web/ui";
import RepairFaq from "@/web/RepairFaq";

export const metadata: Metadata = { title: "Repairs" };

const D = "font-[family-name:var(--font-display)]";

const REPAIRS = [
  { icon: Smartphone, title: "Screen & display", points: ["Cracked or shattered glass", "Touch not responding", "Lines, flicker or black screen"] },
  { icon: BatteryCharging, title: "Battery", points: ["Drains fast or dies early", "Swollen battery", "Phone won't power on"] },
  { icon: PlugZap, title: "Charging", points: ["Loose or dirty port", "Slow or no charging", "Cable only works at an angle"] },
  { icon: Droplets, title: "Water damage", points: ["Dropped in water", "Corrosion clean-up", "Honest saveable-or-not answer"] },
  { icon: Camera, title: "Camera", points: ["Blurry or cracked lens", "Camera app crashing", "Front camera not working"] },
  { icon: Volume2, title: "Speaker & audio", points: ["No sound or crackling", "Earpiece too quiet", "Headphone jack"] },
  { icon: Mic, title: "Microphone", points: ["Callers can't hear you", "Voice notes silent"] },
  { icon: Cpu, title: "Board & software", points: ["Boot loops, stuck on logo", "Updates and reinstalls", "Data recovery"] },
  { icon: Unlock, title: "Unlock & setup", points: ["Network unlocking", "Account and FRP help", "Moving data to a new phone"] },
];

export default function RepairsPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 md:px-8 md:pt-16">
        <p className="mm-rise text-[11px] uppercase tracking-[0.35em] text-neutral-400">Repairs</p>
        <h1 style={delay(120)} className={`${D} mm-rise mt-4 max-w-4xl text-[clamp(2.6rem,6.5vw,5.6rem)] font-extralight uppercase leading-[0.92]`}>
          Fixed properly. Priced before we start.
        </h1>
        <p style={delay(260)} className="mm-rise mt-6 max-w-xl text-[15px] leading-relaxed text-neutral-600">
          Every phone gets a job number the moment it comes in. The technician checks it, you get the price by SMS,
          and nothing is repaired until you approve it — online, from the link we send.
        </p>
        <div style={delay(380)} className="mm-rise mt-9 flex flex-wrap gap-3">
          <a href={WHATSAPP} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3.5 text-[13px] font-medium text-white">
            <MessageCircle size={15} /> Ask about a repair
          </a>
          <Link href="/track" className="inline-flex items-center gap-2 rounded-full border border-neutral-900/20 px-6 py-3.5 text-[13px] font-medium hover:border-neutral-900">
            Track a repair <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-28 md:px-8">
        <div className="grid gap-px overflow-hidden rounded-[28px] border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {REPAIRS.map((r, i) => (
            <div key={r.title} data-reveal style={delay((i % 3) * 90)} className="group bg-white p-8 transition-colors duration-500 hover:bg-[#f6f6f4]">
              <r.icon size={28} strokeWidth={1} className="transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110" />
              <h2 className="mt-7 text-[17px] font-semibold">{r.title}</h2>
              <ul className="mt-4 flex flex-col gap-2 text-[13px] text-neutral-500">
                {r.points.map(p => <li key={p} className="flex gap-2"><span className="mt-2 h-px w-3 shrink-0 bg-neutral-400" />{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <RepairFaq title="Repair questions" />

      <section className="bg-neutral-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-3 md:px-8">
          {[
            ["You approve the price", "The estimate comes to your phone. Approve it online or call us — no surprises at the counter."],
            ["You can see where it is", "Received, diagnosed, repairing, ready. The status page updates as the bench works."],
            ["It comes with a warranty", "The repair's warranty is on record against your job number, so you never need the slip to claim it."],
          ].map(([t, d], i) => (
            <div key={t} data-reveal style={delay(i * 140)} className="border-t border-white/15 pt-6">
              <h3 className={`${D} text-[24px] font-light leading-tight`}>{t}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-white/55">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
