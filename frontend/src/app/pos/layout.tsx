import type { Metadata } from "next";

// page.tsx here is a client component, so it can't export `metadata` itself —
// this thin layout is just a vehicle for the browser-tab title.
export const metadata: Metadata = {
  title: "Mano Mobile - POS",
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
