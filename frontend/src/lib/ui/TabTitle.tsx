"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * The browser-tab title, with the signed-in person's name in it.
 *
 * Each app section already sets a static title from its layout ("Mano Mobile -
 * Technician"). That is fine until somebody has four tabs open and needs to
 * know which one is Manodya's bench, so once the profile has loaded this
 * rewrites it to "Mano Mobile - Manodya [Technician]".
 *
 * It has to be done from the client: the name comes from a session, and Next's
 * `metadata` export is resolved on the server before there is one. The static
 * layout title stays as the fallback for the moment before this runs, and for
 * anyone browsing without a session.
 */
export default function TabTitle({ role, name: override }: { role: string; name?: string | null }) {
  const { profile } = useAuth();
  // `override` is for a screen that belongs to somebody other than the viewer —
  // an Admin looking at a technician's bench should see whose bench it is, not
  // their own name.
  const name = (override ?? profile?.fullName ?? "").trim();

  useEffect(() => {
    document.title = name ? `Mano Mobile - ${name} [${role}]` : `Mano Mobile - ${role}`;
  }, [name, role]);

  return null;
}
