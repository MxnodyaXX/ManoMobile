import Link from "next/link";
import FaqItem from "./FaqItem";
import { delay } from "./ui";

/**
 * Repair FAQ. Every answer describes what the shop's system actually does —
 * job numbers, the online status page, estimate approval, warranties recorded
 * against the job and starting at collection, weekly pickup reminders. Nothing
 * here promises a time, a fee or a guarantee the system doesn't record.
 *
 * Each row is a FaqItem (smooth open/close). The FAQPage data lets search engines
 * show the questions directly in results.
 */

const D = "font-[family-name:var(--font-display)]";

type Faq = { q: string; a: React.ReactNode; plain: string };

const FAQS: Faq[] = [
  {
    q: "How long does a screen replacement take?",
    a: <>It depends on the phone model, whether the part is in stock, and how busy the bench is. After the technician checks your phone, you get an <strong>estimated completion date</strong> — it&apos;s on your repair slip and on your repair&apos;s status page.</>,
    plain: "It depends on the phone model, whether the part is in stock, and how busy the bench is. After the technician checks your phone, you get an estimated completion date — it's on your repair slip and on your repair's status page.",
  },
  {
    q: "How much will my repair cost?",
    a: <>We check the phone first, then send you the price by SMS. <strong>Nothing is repaired until you approve it</strong> — you can approve the estimate online from the link in the message.</>,
    plain: "We check the phone first, then send you the price by SMS. Nothing is repaired until you approve it — you can approve the estimate online from the link in the message.",
  },
  {
    q: "Can I check my repair status online?",
    a: <>Yes. Enter the job number from your slip (it starts with <strong>RM</strong>) on our <Link href="/track" className="underline underline-offset-4">Track a repair</Link> page to see its status, history and estimate. We also text you the link.</>,
    plain: "Yes. Enter the job number from your slip (it starts with RM) on our Track a repair page to see its status, history and estimate. We also text you the link.",
  },
  {
    q: "Will my data be safe?",
    a: <>We only work on what the repair needs. Still, please <strong>back up your photos and contacts before you bring the phone in</strong> whenever you can — some faults, like water or board damage, can affect stored data. If we need your passcode to test the phone after the repair, it&apos;s recorded only on your job.</>,
    plain: "We only work on what the repair needs. Still, please back up your photos and contacts before you bring the phone in whenever you can — some faults, like water or board damage, can affect stored data. If we need your passcode to test the phone after the repair, it's recorded only on your job.",
  },
  {
    q: "Do repairs come with a warranty?",
    a: <>Yes — the warranty depends on the repair and the parts used, and it&apos;s written on your invoice. It&apos;s also <strong>recorded against your job number</strong> and starts the day you collect the phone, so you can see how long it has left on your repair&apos;s status page.</>,
    plain: "Yes — the warranty depends on the repair and the parts used, and it's written on your invoice. It's also recorded against your job number and starts the day you collect the phone, so you can see how long it has left on your repair's status page.",
  },
  {
    q: "What if I can't collect my phone straight away?",
    a: <>No problem — we keep it safe. Once it&apos;s ready we&apos;ll text you, and send a reminder every week until it&apos;s collected.</>,
    plain: "No problem — we keep it safe. Once it's ready we'll text you, and send a reminder every week until it's collected.",
  },
];

export default function RepairFaq({ title = "Questions, answered" }: { title?: string }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.plain } })),
  };

  return (
    <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-[1fr_1.6fr] md:px-8 md:py-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div data-reveal>
        <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-400">FAQ</p>
        <h2 className={`${D} mt-4 text-[clamp(2.2rem,5vw,4rem)] font-extralight uppercase leading-[0.95]`}>{title}</h2>
        <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-neutral-500">
          Something else? Call or WhatsApp us — we&apos;re happy to help.
        </p>
      </div>

      <div className="border-t border-neutral-200">
        {FAQS.map((f, i) => (
          <FaqItem key={f.q} q={f.q} style={delay(i * 70)}>{f.a}</FaqItem>
        ))}
      </div>
    </section>
  );
}
