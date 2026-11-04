import { existsSync } from "node:fs";
import path from "node:path";
import { delay } from "./ui";

/**
 * Our Team (About page).
 *
 * Photos: drop a file named after the person's `photo` slug into
 * frontend/public/team/ — e.g. public/team/wijaya-kumar.jpg (.jpg, .jpeg, .png
 * or .webp). It is picked up on the next deploy/build; until then the card
 * shows the person's initials. Portrait (3:4) photos look best.
 */

const D = "font-[family-name:var(--font-display)]";

const TEAM = [
  { name: "B Wijaya Kumar", role: "Main Technician", photo: "wijaya-kumar" },
  { name: "B Manodya Kalhara", role: "Trainee Technician · Software Solutions", photo: "manodya-kalhara" },
  { name: "B Bimsara Gimhana", role: "Trainee Technician", photo: "bimsara-gimhana" },
  { name: "A N S P Fernando", role: "Customer Care", photo: "nsp-fernando" },
];

const EXTS = ["jpg", "jpeg", "png", "webp"];

/** The photo's public URL if one has been added, else null. */
function photoFor(slug: string): string | null {
  for (const ext of EXTS) {
    if (existsSync(path.join(process.cwd(), "public", "team", `${slug}.${ext}`))) return `/team/${slug}.${ext}`;
  }
  return null;
}

/** "B Wijaya Kumar" → "WK" (the two full names); "A N S P Fernando" → "AF"
 *  (only one full name, so the first initial with it). */
function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const words = parts.filter(w => w.length > 1);
  const two = words.length >= 2 ? words.slice(-2) : [parts[0], parts[parts.length - 1]];
  return two.map(w => w[0]).join("").toUpperCase();
}

export default function Team() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-28 md:px-8">
      <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-400">Our team</p>
          <h2 className={`${D} mt-4 text-[clamp(2.2rem,5vw,4rem)] font-extralight uppercase leading-[0.95]`}>The people at the counter</h2>
        </div>
        <p className="max-w-sm text-[14px] leading-relaxed text-neutral-500">
          The same faces who take your phone in are the ones who fix it and hand it back.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {TEAM.map((m, i) => {
          const src = photoFor(m.photo);
          return (
            <figure key={m.name} data-reveal style={delay(i * 100)} className="group">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[28px] bg-[#efefed]">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={m.name} loading="lazy"
                    className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.04] group-hover:grayscale-0" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center transition-transform duration-700 group-hover:scale-[1.04]">
                    <svg className="absolute inset-0 h-full w-full text-neutral-900 opacity-[0.12]" viewBox="0 0 200 260" preserveAspectRatio="none" aria-hidden>
                      <path d="M0 190 L80 190 L105 160 L200 160" fill="none" stroke="currentColor" strokeWidth="0.6" />
                    </svg>
                    <span className={`${D} text-[64px] font-extralight tracking-[0.06em] text-neutral-900`}>{initials(m.name)}</span>
                  </div>
                )}
                <span className="absolute bottom-4 left-5 text-[10px] font-light uppercase tracking-[0.3em] text-neutral-500 mix-blend-difference">
                  Mano Mobile
                </span>
              </div>
              <figcaption className="mt-5">
                <p className="text-[17px] font-semibold text-neutral-950">{m.name}</p>
                <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-neutral-500">{m.role}</p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
