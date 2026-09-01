import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/track/photos?job=RM-058 — signed URLs for one job's intake photos,
 * for the public /track page.
 *
 * The repair-intake storage bucket is private and its own policies are
 * staff-only (see 20260812000001_repair_core.sql) — an anonymous customer's
 * browser can't sign a URL for it directly, the way a signed-in cashier's
 * can. This route does that signing server-side with the service-role key
 * instead, but only ever for the exact job id it's asked for — same trust
 * boundary as track_job() itself: you already have to hold this job's id.
 */
export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("job")?.trim();
  if (!jobId) {
    return Response.json({ ok: false, error: "Missing job id." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ ok: true, urls: [] });
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: job } = await admin
    .from("repair_jobs")
    .select("intake_photos")
    .eq("id", jobId)
    .maybeSingle();
  const paths = ((job?.intake_photos as string[] | null) ?? []).filter(p => p && !p.startsWith("data:") && !p.startsWith("http"));
  if (paths.length === 0) {
    return Response.json({ ok: true, urls: [] });
  }

  const { data: signed, error } = await admin.storage.from("repair-intake").createSignedUrls(paths, 3600);
  if (error) {
    return Response.json({ ok: true, urls: [] });
  }
  return Response.json({ ok: true, urls: (signed ?? []).map(s => s.signedUrl).filter(Boolean) });
}
