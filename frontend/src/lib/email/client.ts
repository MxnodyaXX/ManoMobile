"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { JobEmailEvent } from "@/lib/email/templates";

/**
 * Browser-side access to customer email: asking the server to send, and
 * reading/writing the Admin settings and templates.
 *
 * The send itself goes through /api/email/send — the SMTP password never
 * reaches this file.
 */

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  jobId?: string;
  purpose?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data?.error ?? `Request failed (${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface EmailSettings {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  enabled: boolean;
}

export const BLANK_EMAIL_SETTINGS: EmailSettings = {
  fromName: "Mano Mobile", fromEmail: "", replyTo: "", enabled: false,
};

export async function fetchEmailSettings(): Promise<EmailSettings> {
  if (!isSupabaseConfigured()) return BLANK_EMAIL_SETTINGS;
  const { data, error } = await getSupabaseBrowserClient()
    .from("email_settings")
    .select("from_name, from_email, reply_to, enabled")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(`Could not load email settings: ${error.message}`);
  if (!data) return BLANK_EMAIL_SETTINGS;
  return {
    fromName: data.from_name ?? "",
    fromEmail: data.from_email ?? "",
    replyTo: data.reply_to ?? "",
    enabled: !!data.enabled,
  };
}

export async function saveEmailSettings(s: EmailSettings): Promise<void> {
  const { data: { user } } = await getSupabaseBrowserClient().auth.getUser();
  const { error } = await getSupabaseBrowserClient()
    .from("email_settings")
    .update({
      from_name: s.fromName.trim(),
      from_email: s.fromEmail.trim(),
      reply_to: s.replyTo.trim() || null,
      enabled: s.enabled,
      updated_by: user?.id ?? null,
    })
    .eq("id", true);

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Only an Admin can change the email settings."
        : `Could not save the email settings: ${error.message}`,
    );
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface EmailTemplate {
  event: JobEmailEvent;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("email_templates")
    .select("event, name, subject, body, is_active");

  if (error) throw new Error(`Could not load email templates: ${error.message}`);
  const rows = (data ?? []) as { event: string; name: string; subject: string; body: string; is_active: boolean }[];
  return rows.map(r => ({
    event: r.event as JobEmailEvent,
    name: r.name,
    subject: r.subject,
    body: r.body,
    isActive: !!r.is_active,
  }));
}

export async function saveEmailTemplate(t: EmailTemplate): Promise<void> {
  const { data: { user } } = await getSupabaseBrowserClient().auth.getUser();
  const { error } = await getSupabaseBrowserClient()
    .from("email_templates")
    .update({
      name: t.name, subject: t.subject, body: t.body,
      is_active: t.isActive, updated_by: user?.id ?? null,
    })
    .eq("event", t.event);

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Only an Admin can edit email templates."
        : `Could not save the template: ${error.message}`,
    );
  }
  cache = null;
}

// ─── Send-path lookup ────────────────────────────────────────────────────────
// Cached briefly: a busy counter completing jobs back to back should not fetch
// the same three rows every time.

let cache: { at: number; byEvent: Map<string, EmailTemplate> } | null = null;
const CACHE_MS = 60_000;

export async function emailTemplateFor(event: JobEmailEvent): Promise<EmailTemplate | null> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const rows = await fetchEmailTemplates();
    cache = { at: Date.now(), byEvent: new Map(rows.map(r => [r.event, r])) };
  }
  return cache.byEvent.get(event) ?? null;
}
