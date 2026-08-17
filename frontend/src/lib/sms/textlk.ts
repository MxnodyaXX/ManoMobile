/**
 * Text.lk SMS gateway — server side only.
 *
 * This module reads TEXTLK_API_TOKEN, which is deliberately NOT prefixed with
 * NEXT_PUBLIC_. Importing it from a client component would leak the token into
 * the browser bundle, where anyone could spend the shop's SMS balance. It is
 * imported by the route handler at app/api/sms/send only.
 *
 * API: POST https://app.text.lk/api/v3/sms/send  (docs: https://text.lk/docs/send-sms/)
 */

import "server-only";

const ENDPOINT = "https://app.text.lk/api/v3/sms/send";

export interface SendResult {
  ok: boolean;
  /** Gateway's message id, for chasing a delivery query with Text.lk. */
  uid?: string;
  providerStatus?: string;
  cost?: number;
  smsCount?: number;
  error?: string;
}

/**
 * Normalise a Sri Lankan number to the gateway's format: 94XXXXXXXXX.
 *
 * Numbers in this system were typed by hand at the counter, so they arrive as
 * "+94 77 123 4567", "0771234567" or "77 123 4567". Returns null when the input
 * cannot be read confidently — sending to a guessed number costs money and
 * tells the wrong person about someone else's repair.
 */
export function normaliseLkNumber(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;

  // 0771234567 → 94771234567
  if (digits.length === 10 && digits.startsWith("0")) return `94${digits.slice(1)}`;
  // 94771234567 (already correct)
  if (digits.length === 11 && digits.startsWith("94")) return digits;
  // 771234567 (no leading zero, no country code)
  if (digits.length === 9 && digits.startsWith("7")) return `94${digits}`;
  // 0094771234567
  if (digits.length === 13 && digits.startsWith("0094")) return digits.slice(2);

  return null;
}

/** A Text.lk sender ID is alphanumeric, 11 characters max. */
export function senderIdIssue(senderId: string): string | null {
  if (!senderId) return "No sender ID configured (TEXTLK_SENDER_ID).";
  if (senderId.length > 11) return `Sender ID "${senderId}" is ${senderId.length} characters; Text.lk allows 11.`;
  return null;
}

export function getSmsConfig() {
  return {
    token: process.env.TEXTLK_API_TOKEN ?? "",
    senderId: process.env.TEXTLK_SENDER_ID ?? "",
    configured: Boolean(process.env.TEXTLK_API_TOKEN && process.env.TEXTLK_SENDER_ID),
  };
}

interface TextLkResponse {
  status?: string;
  message?: string;
  data?: {
    uid?: string;
    status?: string;
    cost?: string | number;
    sms_count?: number;
  };
}

/**
 * Send one message. Never throws: the caller logs the outcome either way, and a
 * gateway outage must not take down the screen that triggered it.
 */
export async function sendSms(recipient: string, message: string): Promise<SendResult> {
  const { token, senderId, configured } = getSmsConfig();
  if (!configured) {
    return { ok: false, error: "SMS is not configured. Set TEXTLK_API_TOKEN and TEXTLK_SENDER_ID." };
  }
  const idIssue = senderIdIssue(senderId);
  if (idIssue) return { ok: false, error: idIssue };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient,
        sender_id: senderId,
        type: "plain",
        message,
      }),
      // The counter is waiting on this; do not hang a checkout on a slow gateway.
      signal: AbortSignal.timeout(15_000),
    });

    const raw = await res.text();
    let json: TextLkResponse = {};
    try {
      json = JSON.parse(raw) as TextLkResponse;
    } catch {
      return { ok: false, error: `Gateway returned a non-JSON response (HTTP ${res.status}): ${raw.slice(0, 200)}` };
    }

    if (!res.ok || json.status !== "success") {
      return { ok: false, error: json.message || `Gateway rejected the message (HTTP ${res.status}).` };
    }

    return {
      ok: true,
      uid: json.data?.uid,
      providerStatus: json.data?.status,
      cost: json.data?.cost == null ? undefined : Number(json.data.cost),
      smsCount: json.data?.sms_count,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.includes("timeout") || msg.includes("aborted") ? "The SMS gateway did not respond within 15 seconds." : msg };
  }
}
