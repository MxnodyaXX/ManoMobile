"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyInvoice, type VerifiedInvoice, type VerifiedItem } from "@/lib/sales/verify";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { SHOP_DETAILS } from "@/lib/shop";
import { docDate } from "@/lib/docDate";

/**
 * The public "Product & Warranty Check" page — what a customer sees when they
 * scan the QR on an accessory invoice, or type an invoice number in at
 * /verify. The product counterpart of /track: proof the invoice is genuine,
 * what was on it, and whether each item is still covered.
 *
 * Everything shown comes from verify_invoice() (migration 20261104000091),
 * which only answers for an exact invoice number and never returns the
 * customer's phone or full name.
 */

const ff = "'Plus Jakarta Sans', sans-serif";

const CSS = `
.vp{--bg:#F5F5F3;--card:#fff;--ink:#141414;--ink-2:#3A3A3A;--muted:#7A7A78;--line:#E7E5E0;
  --ok:#0FA96B;--ok-tint:#E4F7EF;--bad:#C23B32;--bad-tint:#FBEAE8;--neutral:#F1F2F0;
  background:var(--bg);color:var(--ink);font-family:${ff};font-size:15px;line-height:1.55;min-height:100vh;padding-bottom:60px}
.vp *{box-sizing:border-box}
.vp h1,.vp h2,.vp p{margin:0}
.vp button{font:inherit;cursor:pointer}
.vp .topbar{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);padding:12px 18px;display:flex;align-items:center;gap:12px}
.vp .logo{width:34px;height:34px;border-radius:10px;background:#fff;border:1px solid var(--line);display:grid;place-items:center;padding:5px}
.vp .logo img{width:100%;height:100%;object-fit:contain}
.vp .brand{font-weight:800;font-size:15px;letter-spacing:-.02em}
.vp .brand small{display:block;font-size:11.5px;color:var(--muted);font-weight:500;letter-spacing:0}
.vp .secure{margin-left:auto;font-size:11.5px;font-weight:600;color:var(--ok);background:var(--ok-tint);padding:5px 10px;border-radius:999px;white-space:nowrap}
.vp .shell{max-width:720px;margin:0 auto;padding:22px 16px;display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.vp .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}
.vp .card h2{font-size:16px;font-weight:700;margin-bottom:12px}
.vp .hero{color:#fff;border-radius:18px;background:linear-gradient(135deg,#232323,#141414 55%,#000);padding:22px 20px;box-shadow:0 14px 34px rgba(0,0,0,.28)}
.vp .hero .lbl{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.7)}
.vp .hero strong{display:block;font-size:27px;font-weight:800;letter-spacing:-.03em;margin:3px 0 2px;font-variant-numeric:tabular-nums}
.vp .hero .sub{font-size:13.5px;color:rgba(255,255,255,.84)}
.vp .hero .badge{display:inline-flex;align-items:center;gap:7px;margin-top:14px;font-weight:700;font-size:12.5px;padding:7px 13px;border-radius:999px}
.vp .hero .foot{margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.18);display:flex;gap:22px;flex-wrap:wrap}
.vp .hero .foot span{display:block;font-size:11px;color:rgba(255,255,255,.66)}
.vp .hero .foot b{font-size:14px}
.vp .item{border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;gap:10px}
.vp .item + .item{margin-top:10px}
.vp .item-top{display:flex;gap:12px;align-items:flex-start}
.vp .item-name{font-weight:700;font-size:14.5px;min-width:0}
.vp .item-name small{display:block;font-weight:500;font-size:12px;color:var(--muted);margin-top:1px}
.vp .pill{margin-left:auto;flex:none;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap}
.vp .pill.ok{background:var(--ok-tint);color:var(--ok)}
.vp .pill.bad{background:var(--bad-tint);color:var(--bad)}
.vp .pill.neutral{background:var(--neutral);color:var(--muted)}
.vp .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px 14px}
.vp .kv span{display:block;font-size:11.5px;color:var(--muted);font-weight:600}
.vp .kv b{font-size:13.5px;font-weight:600}
.vp .bar{height:6px;border-radius:99px;background:var(--neutral);overflow:hidden}
.vp .bar i{display:block;height:100%;background:var(--ok);border-radius:99px}
.vp .terms{font-size:12.5px;color:var(--ink-2);background:#FAFAF8;border:1px solid var(--line);border-radius:10px;padding:9px 11px}
.vp .search{display:flex;gap:8px}
.vp .search input{flex:1;min-width:0;padding:12px 14px;border-radius:12px;border:1px solid var(--line);font:inherit;font-size:15px;background:#fff;text-transform:uppercase}
.vp .search input::placeholder{text-transform:none}
.vp .search button{padding:12px 18px;border-radius:12px;border:0;background:#141414;color:#fff;font-weight:700}
.vp .muted{color:var(--muted);font-size:13.5px}
.vp .contact a{display:inline-block;padding:12px 0;color:var(--ink);font-weight:700;text-decoration:none}
`;

type State = "Active" | "Expired" | "None" | "Void";
const DAY = 86_400_000;

function coverage(item: VerifiedItem, status: VerifiedInvoice["status"]): { state: State; days: number | null; share: number } {
  if (status !== "Paid") return { state: "Void", days: null, share: 0 };
  if (!item.expiresOn || item.warrantyDays <= 0) return { state: "None", days: null, share: 0 };
  const today = new Date(new Date().toDateString()).getTime();
  const ends = new Date(`${item.expiresOn}T00:00:00`).getTime();
  const left = Math.round((ends - today) / DAY);
  if (left < 0) return { state: "Expired", days: -left, share: 0 };
  return { state: "Active", days: left, share: Math.min(1, left / item.warrantyDays) };
}

const Rs = (n: number) => `Rs. ${n.toLocaleString("en-LK")}`;

function ItemCard({ item, status }: { item: VerifiedItem; status: VerifiedInvoice["status"] }) {
  const c = coverage(item, status);
  const pill =
    c.state === "Active" ? <span className="pill ok">Under warranty</span>
    : c.state === "Expired" ? <span className="pill bad">Warranty expired</span>
    : c.state === "Void" ? <span className="pill bad">Not covered</span>
    : <span className="pill neutral">No warranty</span>;
  const sub = [item.code, item.category, item.qty > 1 ? `Qty ${item.qty}` : null].filter(Boolean).join(" · ");
  return (
    <div className="item">
      <div className="item-top">
        <div className="item-name">{item.description}{sub && <small>{sub}</small>}</div>
        {pill}
      </div>
      {c.state !== "None" && c.state !== "Void" && (
        <>
          <div className="kv">
            <div><span>Warranty</span><b>{item.warrantyLabel || `${item.warrantyDays} days`}</b></div>
            <div><span>From</span><b>{docDate(item.startsOn)}</b></div>
            <div><span>Until</span><b>{docDate(item.expiresOn)}</b></div>
            <div>
              <span>{c.state === "Active" ? "Days left" : "Ended"}</span>
              <b>{c.state === "Active" ? `${c.days} day${c.days === 1 ? "" : "s"}` : `${c.days} day${c.days === 1 ? "" : "s"} ago`}</b>
            </div>
          </div>
          {c.state === "Active" && <div className="bar"><i style={{ width: `${Math.max(3, c.share * 100)}%` }} /></div>}
        </>
      )}
      {item.terms && c.state !== "Void" && <div className="terms">{item.terms}</div>}
    </div>
  );
}

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const inv = (params.get("inv") ?? "").trim().toUpperCase();
  const [typed, setTyped] = useState(inv);
  const [result, setResult] = useState<{ forNo: string; invoice: VerifiedInvoice | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!inv) return;
    let live = true;
    verifyInvoice(inv)
      .then(invoice => { if (live) setResult({ forNo: inv, invoice, error: null }); })
      .catch(e => { if (live) setResult({ forNo: inv, invoice: null, error: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, [inv]);

  const ready = !!inv && result?.forNo === inv;
  const invoice = ready ? result.invoice : null;
  const active = invoice ? invoice.items.filter(i => coverage(i, invoice.status).state === "Active").length : 0;

  const search = (
    <form
      className="search"
      onSubmit={e => { e.preventDefault(); const v = typed.trim(); if (v) router.replace(`/verify?inv=${encodeURIComponent(v.toUpperCase())}`); }}
    >
      <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Invoice number, e.g. INV-000723" aria-label="Invoice number" />
      <button type="submit">Check</button>
    </form>
  );

  return (
    <div className="vp">
      <style>{CSS}</style>
      <div className="topbar">
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SHOP_DETAILS.logo} alt="" />
        </div>
        <div className="brand">{SHOP_DETAILS.name}<small>Product &amp; Warranty Check</small></div>
        <span className="secure">✓ Official record</span>
      </div>

      <div className="shell">
        {!inv && (
          <div className="card">
            <h2>Check your purchase</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Scan the QR code on your invoice, or type the invoice number printed on it.
            </p>
            {search}
          </div>
        )}

        {inv && !ready && <div className="card"><p className="muted">Checking {inv}…</p></div>}

        {ready && result.error && (
          <div className="card"><h2>Couldn&apos;t check this invoice</h2><p className="muted">{result.error}</p></div>
        )}

        {ready && !result.error && !invoice && (
          <div className="card">
            <h2>Invoice not found</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              {isSupabaseConfigured()
                ? <>We couldn&apos;t find <b>{inv}</b> in our records. Check the number on your invoice and try again — or contact the shop below.</>
                : "Invoice checking isn't available right now."}
            </p>
            {search}
          </div>
        )}

        {invoice && (
          <>
            <div className="hero">
              <span className="lbl">Invoice</span>
              <strong>{invoice.invoiceNo}</strong>
              <div className="sub">Sold on {docDate(invoice.soldOn)} · {invoice.customer}</div>
              {invoice.status === "Paid" ? (
                <span className="badge" style={{ background: "#E4F7EF", color: "#0FA96B" }}>✓ Genuine {SHOP_DETAILS.name} invoice</span>
              ) : (
                <span className="badge" style={{ background: "#FBEAE8", color: "#C23B32" }}>
                  ✕ This invoice was {invoice.status === "Voided" ? "voided" : "returned"} — its items are not covered
                </span>
              )}
              <div className="foot">
                <div><span>Items</span><b>{invoice.items.reduce((n, i) => n + i.qty, 0)}</b></div>
                <div><span>Under warranty</span><b>{active} of {invoice.items.length}</b></div>
                <div><span>Total paid</span><b>{Rs(invoice.total)}</b></div>
              </div>
            </div>

            <div className="card">
              <h2>Products</h2>
              {invoice.items.length === 0
                ? <p className="muted">No product lines are recorded on this invoice.</p>
                : invoice.items.map((it, i) => <ItemCard key={i} item={it} status={invoice.status} />)}
            </div>

            <div className="card">
              <h2>Making a warranty claim</h2>
              <p className="muted">
                Bring the item and this invoice (or its number) to the shop. Warranty covers manufacturing faults;
                physical, liquid and burn damage are not covered.
              </p>
            </div>
          </>
        )}

        <div className="card contact">
          <h2>{SHOP_DETAILS.name}</h2>
          <p className="muted">{SHOP_DETAILS.address}</p>
          <p className="muted" style={{ marginTop: 4 }}>
            Call <a href={`tel:${SHOP_DETAILS.phone.replace(/\s/g, "")}`}>{SHOP_DETAILS.phone}</a>
            {SHOP_DETAILS.website && <> · <a href={`https://${SHOP_DETAILS.website.replace(/^https?:\/\//, "")}`}>{SHOP_DETAILS.website}</a></>}
          </p>
        </div>

        {invoice && <div className="card"><h2>Check another invoice</h2>{search}</div>}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
