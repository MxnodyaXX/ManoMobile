"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  DEFAULT_SMS_BODIES, JOB_SMS_EVENTS, JOB_SMS_LABEL,
  type JobSmsEvent,
} from "@/lib/sms/templates";

/**
 * Reading and writing the editable SMS templates.
 *
 * Two consumers with different needs:
 *  • the admin editor wants a live list it can save back to;
 *  • the sender wants one template, fast, at the moment a job changes state —
 *    so it reads through a short-lived cache rather than hitting the database
 *    on every status change.
 */

export interface SmsTemplate {
  event: JobSmsEvent;
  name: string;
  body: string;
  isActive: boolean;
  updatedAt?: string;
}

interface TemplateRow {
  event: string;
  name: string;
  body: string;
  is_active: boolean;
  updated_at?: string;
}

const rowToTemplate = (r: TemplateRow): SmsTemplate => ({
  event: r.event as JobSmsEvent,
  name: r.name,
  body: r.body,
  isActive: r.is_active,
  updatedAt: r.updated_at,
});

/** The built-in wording, used until the table is created or a row is added. */
export const defaultTemplates = (): SmsTemplate[] =>
  JOB_SMS_EVENTS.map(event => ({
    event,
    name: JOB_SMS_LABEL[event],
    body: DEFAULT_SMS_BODIES[event],
    isActive: true,
  }));

export async function fetchSmsTemplates(): Promise<SmsTemplate[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("sms_templates")
    .select("event, name, body, is_active, updated_at");

  if (error) throw new Error(`Could not load SMS templates: ${error.message}`);

  const rows = (data as TemplateRow[]).map(rowToTemplate);
  // Any event without a row falls back to the built-in wording, so a partially
  // seeded table still sends something sensible.
  return JOB_SMS_EVENTS.map(
    event => rows.find(r => r.event === event) ?? defaultTemplates().find(d => d.event === event)!,
  );
}

export async function saveSmsTemplate(t: SmsTemplate): Promise<void> {
  const { data: { user } } = await getSupabaseBrowserClient().auth.getUser();
  const { error } = await getSupabaseBrowserClient()
    .from("sms_templates")
    .upsert({
      event: t.event,
      name: t.name,
      body: t.body,
      is_active: t.isActive,
      updated_by: user?.id ?? null,
    });

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Only an Admin can change the customer message templates."
        : `Could not save the template: ${error.message}`,
    );
  }
  invalidateTemplateCache();
}

// ─── Sender-side cache ───────────────────────────────────────────────────────

let cache: { at: number; templates: SmsTemplate[] } | null = null;
const CACHE_MS = 60_000;

export function invalidateTemplateCache() {
  cache = null;
}

/**
 * The template for one event, for sending.
 *
 * Never throws and never blocks a job from moving: if the table is missing or
 * unreachable, the built-in wording is used rather than the customer hearing
 * nothing.
 */
export async function templateFor(event: JobSmsEvent): Promise<SmsTemplate> {
  const fallback = defaultTemplates().find(t => t.event === event)!;
  if (!isSupabaseConfigured()) return fallback;

  if (!cache || Date.now() - cache.at > CACHE_MS) {
    try {
      cache = { at: Date.now(), templates: await fetchSmsTemplates() };
    } catch {
      return fallback;
    }
  }
  return cache.templates.find(t => t.event === event) ?? fallback;
}

// ─── Admin editor hook ───────────────────────────────────────────────────────

export function useSmsTemplates() {
  const configured = isSupabaseConfigured();
  const [templates, setTemplates] = useState<SmsTemplate[]>(defaultTemplates());
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    try {
      setTemplates(await fetchSmsTemplates());
      setError(null);
    } catch (e) {
      // Keep showing the built-in wording; say why it is not editable.
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [configured]);

  useEffect(() => {
    // `loading` already starts false when unconfigured, so there is nothing to
    // set here — and setting state synchronously in an effect just cascades.
    if (!configured) return;
    let active = true;
    (async () => {
      await reload();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [configured, reload]);

  const save = useCallback(async (t: SmsTemplate) => {
    await saveSmsTemplate(t);
    setTemplates(prev => prev.map(p => (p.event === t.event ? t : p)));
  }, []);

  return { templates, loading, error, reload, save, configured };
}
