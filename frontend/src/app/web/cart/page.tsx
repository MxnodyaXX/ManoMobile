import type { Metadata } from "next";
import { Suspense } from "react";
import CartView from "@/web/CartView";

export const metadata: Metadata = { title: "Basket" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      {/* useSearchParams (?mode=) needs a Suspense boundary */}
      <Suspense fallback={null}>
        <CartView />
      </Suspense>
    </div>
  );
}
