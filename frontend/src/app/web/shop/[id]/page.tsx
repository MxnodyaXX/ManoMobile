import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { fetchProduct } from "@/web/catalogue";
import BuyBox from "@/web/BuyBox";
import ProductCard from "@/web/ProductCard";
import { ProductArt, StockBadge, delay, rs } from "@/web/ui";

export const revalidate = 60;

// None at build time; each product page is rendered on its first visit, then
// served from cache (refreshed every minute) instead of rebuilt per request.
export function generateStaticParams() {
  return [];
}

const D = "font-[family-name:var(--font-display)]";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { product } = await fetchProduct(Number(id));
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { product: p, related, warranty } = await fetchProduct(Number(id));
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-8 md:px-8">
      <Link href="/web/shop" className="inline-flex items-center gap-2 text-[12px] text-neutral-500 hover:text-neutral-950">
        <ArrowLeft size={14} /> Back to shop
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-16">
        <div className="mm-rise aspect-square overflow-hidden rounded-[32px]">
          <ProductArt category={p.category} brand={p.brand} size="lg" />
        </div>

        <div className="mm-rise flex flex-col md:py-6" style={delay(150)}>
          <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-400">{[p.category, p.subcategory].filter(Boolean).join(" · ")}</p>
          <h1 className={`${D} mt-4 text-[clamp(2rem,4vw,3.2rem)] font-light leading-[1.02]`}>{p.name}</h1>
          <div className="mt-6 flex items-center gap-5">
            <span className="text-[26px] font-semibold">{rs(p.price)}</span>
            <StockBadge stock={p.stock} />
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-y-4 border-y border-neutral-200 py-6 text-[13px]">
            {p.brand && <><dt className="text-neutral-400">Brand</dt><dd>{p.brand}</dd></>}
            {p.model && <><dt className="text-neutral-400">Fits</dt><dd>{p.model}</dd></>}
            <dt className="text-neutral-400">Item code</dt><dd className="font-mono text-[12px]">{p.code}</dd>
            <dt className="text-neutral-400">Warranty</dt>
            <dd className="flex items-center gap-1.5"><ShieldCheck size={14} strokeWidth={1.5} />{warranty ?? "Ask in store"}</dd>
          </dl>
          {p.description && <p className="mt-6 text-[14px] leading-relaxed text-neutral-600">{p.description}</p>}

          <div className="mt-8">
            <BuyBox p={p} />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-28">
          <h2 className={`${D} text-[clamp(1.8rem,3.5vw,2.8rem)] font-extralight uppercase`}>More {p.category}</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
            {related.map((r, i) => <div key={r.id} data-reveal style={delay(i * 80)}><ProductCard p={r} /></div>)}
          </div>
        </section>
      )}
    </div>
  );
}
