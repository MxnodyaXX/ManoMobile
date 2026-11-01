import type { Metadata } from "next";
import AccountView from "@/web/AccountView";

export const metadata: Metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <AccountView />
    </div>
  );
}
