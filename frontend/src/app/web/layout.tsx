import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { CartProvider } from "@/web/cart";
import Nav from "@/web/Nav";
import Footer from "@/web/Footer";
import { RevealObserver } from "@/web/Motion";
import { Intro } from "@/web/Intro";
import { INTRO_SCRIPT } from "@/web/introScript";
import "@/web/motion.css";

/**
 * The customer website. A separate look from the staff app: white page, black
 * ink, thin wide capitals for headlines (Inter Tight), no theme switch. Lives
 * under /web until the shop's own domain points here.
 */

// Variable font: every weight from 100 to 900 in one file.
const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "Mano Mobile — Phone repairs & accessories", template: "%s · Mano Mobile" },
  description: "Phone repairs you can track, genuine accessories in stock, since 2005. Kurusa Junction, Horana Road.",
};

/**
 * The app loads Tailwind without its preflight reset (see globals.css), so
 * links come out blue and underlined and buttons grey. A reset for the website
 * only — inside the utilities layer, under :where() so it has the lowest
 * specificity there and every Tailwind class still wins over it.
 */
const RESET = `@layer utilities {
  :where(.mm-web) a { color: inherit; text-decoration: inherit; }
  :where(.mm-web) button { background: transparent; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; }
  :where(.mm-web) button:disabled { cursor: not-allowed; }
  :where(.mm-web) :is(h1, h2, h3, p, ul, ol, dl, dd, figure) { margin: 0; }
  :where(.mm-web) :is(ul, ol) { list-style: none; padding: 0; }
  :where(.mm-web) :is(input, select, textarea) { font: inherit; color: inherit; }
}`;

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-keep-case: the staff app capitalises every input; customers type normally.
    // suppressHydrationWarning: the intro script may add .mm-intro-on before React arrives.
    <div data-keep-case suppressHydrationWarning className={`mm-web ${display.variable} min-h-screen bg-white text-neutral-950 antialiased`} style={{ fontSize: 14 }}>
      <style>{RESET}</style>
      {/* Before anything else is painted: decide whether the opening curtain plays. */}
      <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      <Intro />
      <RevealObserver />
      <CartProvider>
        <Nav />
        <main>{children}</main>
        <Footer />
      </CartProvider>
    </div>
  );
}
