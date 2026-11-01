"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, LogOut, Package, ShieldCheck, Smartphone, Wrench } from "lucide-react";
import { rs } from "./ui";

const D = "font-[family-name:var(--font-display)]";

/**
 * My Account — PREVIEW.
 *
 * The sign-in is the planned phone + SMS code flow, but nothing is sent and any
 * 6-digit code is accepted, and what's shown after is sample data. Showing a
 * real customer's repairs would need the code to actually be verified first —
 * that's the next step, not this one.
 */

const SAMPLE = {
  name: "Sample Customer",
  active: {
    id: "RM-1234", device: "Galaxy A23", fault: "Screen cracked, touch not working", eta: "Today, 5:00 PM",
    steps: [
      { label: "Received", at: "Mon 9:40 AM", done: true },
      { label: "Diagnosed — estimate sent", at: "Mon 11:15 AM", done: true },
      { label: "Approved by you", at: "Mon 11:32 AM", done: true },
      { label: "Repairing", at: "In progress", done: false },
      { label: "Ready to collect", at: "", done: false },
    ],
    estimate: 14500, paid: 2000,
  },
  history: [
    { id: "RM-1102", date: "12 Aug 2026", device: "iPhone 11", work: "Battery replacement", total: 9500, status: "Collected" },
    { id: "RM-0988", date: "03 Mar 2026", device: "Redmi Note 10", work: "Charging port", total: 3500, status: "Collected" },
    { id: "RM-0711", date: "21 Oct 2025", device: "Galaxy A23", work: "Software reinstall", total: 2500, status: "Collected" },
  ],
  warranties: [
    { title: "iPhone 11 — battery", until: "12 Nov 2026", left: "11 days left", active: true },
    { title: "Samsung 25W charger", until: "03 Jan 2027", left: "2 months left", active: true },
    { title: "Redmi Note 10 — charging port", until: "03 Jun 2026", left: "Expired", active: false },
  ],
  orders: [
    { ref: "WEB-482193", date: "30 Oct 2026", items: "Tempered Glass 9H ×1, Type-C Cable ×1", total: 2050, mode: "Collect", status: "Ready to collect" },
    { ref: "WEB-339021", date: "18 Sep 2026", items: "Power Bank 20000mAh ×1", total: 8900, mode: "Delivery", status: "Delivered" },
  ],
};

type Tab = "Overview" | "Repairs" | "Warranties" | "Orders";

export default function AccountView() {
  const [step, setStep] = useState<"phone" | "code" | "in">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");

  if (step !== "in") {
    return (
      <div className="mm-rise mx-auto grid max-w-5xl overflow-hidden rounded-[32px] bg-[#efefed] md:grid-cols-2">
        <div className="relative hidden bg-neutral-950 p-12 text-white md:flex md:flex-col md:justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ManoMobileBlack.png" alt="" className="h-10 w-10 object-contain invert" />
          <div>
            <h2 className={`${D} text-[44px] font-extralight uppercase leading-[0.95]`}>Your repairs, in one place</h2>
            <ul className="mt-8 flex flex-col gap-3 text-[13px] text-white/65">
              {["Live status of the phone you left with us", "Every past repair and invoice", "Warranties and when they end", "Your reservations and orders"].map(t => (
                <li key={t} className="flex gap-3"><Check size={15} className="mt-0.5 shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
          <svg className="absolute inset-x-0 top-28 h-10 w-full opacity-20" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
            <path d="M0 30 L150 30 L180 8 L400 8" fill="none" stroke="#fff" strokeWidth="1" />
          </svg>
        </div>

        <div key={step} className="mm-fade p-8 md:p-12">
          <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">My account</p>
          <h1 className={`${D} mt-4 text-[34px] font-extralight uppercase leading-none`}>{step === "phone" ? "Sign in" : "Enter the code"}</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">
            {step === "phone"
              ? "Use the phone number you gave us at the counter. We'll text you a 6-digit code — no password needed."
              : `We sent a code to ${phone}.`}
          </p>

          {step === "phone" ? (
            <form className="mt-8 flex flex-col gap-3" onSubmit={e => {
              e.preventDefault();
              if (phone.replace(/\D/g, "").length < 9) { setError("Enter your mobile number, e.g. 077 123 4567."); return; }
              setError(null); setStep("code");
            }}>
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoFocus placeholder="07X XXX XXXX"
                className="h-14 w-full rounded-full border border-neutral-300 bg-white px-6 text-[16px] tracking-wide outline-none focus:border-neutral-950" />
              <button className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-[13px] font-medium text-white">
                Send code <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <form className="mt-8 flex flex-col gap-3" onSubmit={e => {
              e.preventDefault();
              if (!/^\d{6}$/.test(code)) { setError("The code is 6 digits."); return; }
              setError(null); setStep("in");
            }}>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus placeholder="••••••"
                className="h-14 w-full rounded-full border border-neutral-300 bg-white px-6 text-center text-[22px] tracking-[0.6em] outline-none focus:border-neutral-950" />
              <button className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-[13px] font-medium text-white">
                Verify <ArrowRight size={15} />
              </button>
              <button type="button" onClick={() => { setStep("phone"); setCode(""); }} className="w-full py-2 text-[12px] text-neutral-500">Use a different number</button>
            </form>
          )}
          {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}
          <p className="mt-8 rounded-2xl bg-white/70 px-4 py-3 text-[11px] leading-relaxed text-neutral-500">
            Preview: no SMS is sent yet — any 6-digit code opens a sample account.
          </p>
        </div>
      </div>
    );
  }

  const a = SAMPLE.active;
  const done = a.steps.filter(s => s.done).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-400">My account · {phone}</p>
          <h1 className={`${D} mt-4 text-[clamp(2.4rem,5vw,4rem)] font-extralight uppercase leading-[0.95]`}>Hello, {SAMPLE.name.split(" ")[0]}</h1>
        </div>
        <button onClick={() => { setStep("phone"); setCode(""); }} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-5 py-2.5 text-[12px] text-neutral-600 hover:border-neutral-900">
          <LogOut size={14} /> Sign out
        </button>
      </div>
      <p className="mt-4 inline-block rounded-full bg-neutral-100 px-4 py-1.5 text-[11px] text-neutral-500">Preview — sample data</p>

      <div className="mt-10 flex gap-6 overflow-x-auto border-b border-neutral-200">
        {(["Overview", "Repairs", "Warranties", "Orders"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 pb-3 text-[13px] transition-colors ${tab === t ? "border-neutral-950 font-semibold text-neutral-950" : "border-transparent text-neutral-500"}`}>
            {t}
          </button>
        ))}
      </div>

      <div key={tab} className="mm-fade">
      {tab === "Overview" && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* The phone in the shop right now */}
          <div data-live className="mm-shine rounded-[28px] bg-neutral-950 p-7 text-white md:p-9">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">In the shop now</p>
                <p className={`${D} mt-3 text-[34px] font-extralight leading-none`}>{a.id}</p>
                <p className="mt-2 text-[13px] text-white/60">{a.device} · {a.fault}</p>
              </div>
              <span className="rounded-full bg-white px-4 py-1.5 text-[11px] font-semibold text-neutral-950">Repairing</span>
            </div>
            <div className="mt-8 h-1 overflow-hidden rounded-full bg-white/15">
              <div className="mm-grow h-full rounded-full bg-white" style={{ width: `${(done / a.steps.length) * 100}%`, ["--d" as string]: "300ms" }} />
            </div>
            <ol className="mt-8 flex flex-col gap-4">
              {a.steps.map((s, i) => (
                <li key={s.label} className="mm-rise flex items-center gap-4" style={{ ["--d" as string]: `${200 + i * 120}ms` }}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-white text-neutral-950" : "border border-white/30"}`}>
                    {s.done && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={`flex-1 text-[13px] ${s.done ? "text-white" : "text-white/45"}`}>{s.label}</span>
                  <span className="text-[11px] text-white/40">{s.at}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-6 text-[12px]">
              <div><p className="text-white/40">Estimate</p><p className="mt-1 font-semibold">{rs(a.estimate)}</p></div>
              <div><p className="text-white/40">Paid</p><p className="mt-1 font-semibold">{rs(a.paid)}</p></div>
              <div><p className="text-white/40">Ready by</p><p className="mt-1 font-semibold">{a.eta}</p></div>
            </div>
            <Link href="/track" className="mt-8 inline-flex items-center gap-2 border-b border-white pb-1 text-[12px]">Full repair page <ArrowRight size={13} /></Link>
          </div>

          <div className="grid gap-4">
            <Tile icon={Wrench} label="Repairs with us" value={`${SAMPLE.history.length + 1}`} onClick={() => setTab("Repairs")} />
            <Tile icon={ShieldCheck} label="Active warranties" value={`${SAMPLE.warranties.filter(w => w.active).length}`} onClick={() => setTab("Warranties")} />
            <Tile icon={Package} label="Ready to collect" value={`${SAMPLE.orders.filter(o => o.status === "Ready to collect").length}`} onClick={() => setTab("Orders")} />
          </div>
        </div>
      )}

      {tab === "Repairs" && (
        <ul className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
          {SAMPLE.history.map(r => (
            <li key={r.id}>
              <div className="flex items-center gap-5 py-6 md:px-2">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#efefed]"><Smartphone size={20} strokeWidth={1.3} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{r.device} — {r.work}</p>
                  <p className="mt-0.5 text-[12px] text-neutral-500">{r.id} · {r.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-semibold">{rs(r.total)}</p>
                  <p className="text-[11px] text-neutral-500">{r.status}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "Warranties" && (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SAMPLE.warranties.map(w => (
            <div key={w.title} className={`rounded-[24px] p-6 ${w.active ? "bg-neutral-950 text-white" : "border border-neutral-200 text-neutral-500"}`}>
              <ShieldCheck size={22} strokeWidth={1.2} />
              <p className="mt-8 text-[14px] font-medium">{w.title}</p>
              <p className={`mt-1 text-[12px] ${w.active ? "text-white/55" : ""}`}>Until {w.until}</p>
              <p className={`mt-6 text-[11px] uppercase tracking-[0.2em] ${w.active ? "text-white" : ""}`}>{w.left}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "Orders" && (
        <ul className="mt-8 flex flex-col gap-4">
          {SAMPLE.orders.map(o => (
            <li key={o.ref} className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-neutral-200 p-6">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-400">{o.ref} · {o.date} · {o.mode}</p>
                <p className="mt-2 text-[14px] font-medium">{o.items}</p>
              </div>
              <div className="flex items-center gap-5">
                <span className="text-[15px] font-semibold">{rs(o.total)}</span>
                <span className={`rounded-full px-4 py-1.5 text-[11px] font-semibold ${o.status === "Ready to collect" ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"}`}>{o.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, onClick }: { icon: typeof Wrench; label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between rounded-[24px] bg-[#efefed] p-6 text-left transition-colors hover:bg-neutral-200">
      <div>
        <Icon size={20} strokeWidth={1.3} />
        <p className="mt-5 text-[12px] text-neutral-500">{label}</p>
      </div>
      <span className={`${D} text-[44px] font-extralight leading-none`}>{value}</span>
    </button>
  );
}
