"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * What each role may do with each module.
 *
 * The Permissions grid used to be local state with a Save button that wrote
 * nothing. This is the stored version, and Postgres enforces the same rows —
 * see migration 20260831000008. Hiding a sidebar item is the courtesy; the
 * policy is the control.
 *
 * Everything here falls open. A module with no row, a role nobody seeded, or a
 * failed fetch all mean "allowed", matching the database. Access control that
 * fails closed on its own bookkeeping locks a counter out mid-repair.
 */

export type Access = "full" | "view" | "none";
export type RoleName = "Admin" | "Cashier" | "Technician" | "Accounts" | "Procurement";

export type AccessMatrix = Record<string, Partial<Record<RoleName, Access>>>;

interface Row { role: RoleName; module: string; access: Access }

export async function fetchModuleAccess(): Promise<AccessMatrix> {
  if (!isSupabaseConfigured()) return {};
  const { data, error } = await getSupabaseBrowserClient()
    .from("role_module_access")
    .select("role, module, access");

  if (error) throw new Error(`Could not load module access: ${error.message}`);

  const out: AccessMatrix = {};
  for (const r of (data ?? []) as Row[]) {
    (out[r.module] ??= {})[r.role] = r.access;
  }
  return out;
}

/** Upserts the whole grid. One statement rather than a write per cell, so a
 *  half-saved grid cannot exist. */
export async function saveModuleAccess(matrix: AccessMatrix): Promise<void> {
  const { data: { user } } = await getSupabaseBrowserClient().auth.getUser();

  const rows = Object.entries(matrix).flatMap(([module, byRole]) =>
    Object.entries(byRole).map(([role, access]) => ({
      role, module, access, updated_by: user?.id ?? null,
    })),
  );
  if (rows.length === 0) return;

  const { error } = await getSupabaseBrowserClient()
    .from("role_module_access")
    .upsert(rows, { onConflict: "role,module" });

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Only an Admin can change module access."
        : `Could not save module access: ${error.message}`,
    );
  }
}

/** The whole grid, for the Permissions screen. */
export function useModuleAccessMatrix() {
  const [matrix, setMatrix] = useState<AccessMatrix>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await fetchModuleAccess();
      setMatrix(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const next = await fetchModuleAccess();
        if (active) { setMatrix(next); setError(null); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { matrix, setMatrix, loading, error, reload };
}

/**
 * What the signed-in person may do — the question every sidebar asks.
 *
 * Returns "full" until it knows otherwise, so a slow network shows the app
 * rather than an empty shell. The database is what actually refuses.
 */
export function useMyModuleAccess(): {
  access: (module: string) => Access;
  canOpen: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  loading: boolean;
} {
  const [matrix, setMatrix] = useState<AccessMatrix>({});
  const [role, setRole] = useState<RoleName | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!isSupabaseConfigured()) return;
        const sb = getSupabaseBrowserClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        const [{ data: profile }, m] = await Promise.all([
          sb.from("profiles").select("role").eq("id", user.id).maybeSingle(),
          fetchModuleAccess(),
        ]);
        if (!active) return;
        setRole(((profile as { role?: RoleName } | null)?.role) ?? null);
        setMatrix(m);
      } catch {
        /* stays permissive */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const access = useCallback(
    (module: string): Access => {
      if (role === "Admin") return "full";
      if (!role) return "full";
      return matrix[module]?.[role] ?? "full";
    },
    [matrix, role],
  );

  return {
    access,
    canOpen: (m: string) => access(m) !== "none",
    canEdit: (m: string) => access(m) === "full",
    loading,
  };
}
