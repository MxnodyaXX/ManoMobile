import type { Metadata } from "next";

// page.tsx here is a client component, so it can't export `metadata` itself
// (that only works from a Server Component) — this thin layout is just a
// vehicle for the browser-tab title.
export const metadata: Metadata = {
  title: "Mano Mobile - Technician",
};

export default function TechnicianLayout({ children }: { children: React.ReactNode }) {
  return children;
}
