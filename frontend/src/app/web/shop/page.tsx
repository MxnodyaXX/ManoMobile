import type { Metadata } from "next";
import { fetchCatalogue } from "@/web/catalogue";
import ShopBrowser from "@/web/ShopBrowser";
import { delay } from "@/web/ui";

export const metadata: Metadata = { title: "Shop accessories" };
// Stock moves all day; a page a minute old is close enough for browsing.
export const revalidate = 60;

const D = "font-[family-name:var(--font-display)]";

export default async function ShopPage() {
  const { products, sample } = await fetchCatalogue();
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <p className="mm-rise text-[11px] uppercase tracking-[0.35em] text-neutral-400">Shop</p>
      <h1 style={delay(120)} className={`${D} mm-rise mt-4 text-[clamp(2.6rem,6vw,5rem)] font-extralight uppercase leading-[0.92]`}>Accessories</h1>
      <p style={delay(240)} className="mm-rise mt-4 max-w-lg text-[14px] text-neutral-500">
        Live stock from the shop floor. Reserve online and collect, or have it delivered.
      </p>
      {sample && (
        <p className="mt-4 inline-block rounded-full bg-neutral-100 px-4 py-1.5 text-[11px] text-neutral-500">Preview — showing sample items</p>
      )}
      <div className="mt-10">
        <ShopBrowser products={products} />
      </div>
    </div>
  );
}
