"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchDealerPortal, fetchDealerPortalInvoice,
  type DealerPortalData, type PortalInvoice, type PortalJob,
} from "@/lib/dealer/portal";
import { SHOP_DETAILS } from "@/lib/shop";

/**
 * The dealer portal — where the QR code on a dealer invoice lands.
 *
 * /dealer?t=<portal_token>&invoice=<INV-…>
 *
 * Shows the scanned invoice with every job on it, what the dealer owes in
 * total, every earlier invoice (each openable here), and their jobs still in
 * the shop. Everything comes from dealer_portal()/dealer_portal_invoice() in
 * migration 20260928000061, which answer nothing without a valid token and
 * never show one dealer another dealer's invoice.
 */

const ff = "'Plus Jakarta Sans', system-ui, sans-serif";

const CSS = `
.dp{--bg:#F5F5F3;--card:#fff;--ink:#141414;--ink2:#3A3A3A;--muted:#7A7A78;--line:#E7E5E0;--tint:#F2F2F0;
  --ok:#0FA96B;--okt:#E4F7EF;--bad:#C23B32;--badt:#FBEAE8;--amber:#B7791F;--ambt:#FDF3E1;
  background:var(--bg);color:var(--ink);font-family:${ff};font-size:14.5px;line-height:1.5;min-height:100vh;padding-bottom:60px}
.dp *{box-sizing:border-box}
.dp h1,.dp h2,.dp h3{margin:0;letter-spacing:-.015em;line-height:1.25}
.dp p{margin:0}
.dp button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.dp .top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.93);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:11px 18px;display:flex;align-items:center;gap:11px}
.dp .logo{width:34px;height:34px;border-radius:10px;background:#fff;border:1px solid var(--line);display:grid;place-items:center;padding:5px}
.dp .logo img{width:100%;height:100%;object-fit:contain}
.dp .bn{font-weight:800;font-size:15px}
.dp .bs{font-size:11.5px;color:var(--muted);margin-top:-2px}
.dp .tag{margin-left:auto;font-size:11.5px;font-weight:700;background:var(--tint);border:1px solid var(--line);padding:4px 10px;border-radius:999px}
.dp .wrap{max-width:1100px;margin:0 auto;padding:20px 16px;display:grid;gap:16px}
.dp .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
.dp .card>header{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.dp .card>header h2{font-size:16px;font-weight:750}
.dp .hint{font-size:12px;color:var(--muted)}
.dp .hero{color:#fff;border-radius:16px;background:linear-gradient(135deg,#232323,#000);padding:20px}
.dp .hero .lbl{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.06em}
.dp .hero .amt{font-size:32px;font-weight:850;letter-spacing:-.02em;margin-top:4px}
.dp .grid2{display:grid;gap:16px}
@media(min-width:860px){.dp .grid2{grid-template-columns:1.1fr 1fr}}
.dp .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:14px}
.dp .kv div{background:rgba(255,255,255,.08);border-radius:10px;padding:9px 11px}
.dp .kv span{display:block;font-size:11px;color:rgba(255,255,255,.65)}
.dp .kv b{font-size:14px}
.dp .pill{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
.dp .p-ok{background:var(--okt);color:var(--ok)} .dp .p-bad{background:var(--badt);color:var(--bad)}
.dp .p-amb{background:var(--ambt);color:var(--amber)} .dp .p-neu{background:var(--tint);color:var(--ink2)}
.dp .tabs{display:flex;gap:6px;background:var(--tint);padding:4px;border-radius:12px;width:fit-content}
.dp .tabs button{padding:7px 14px;border-radius:9px;font-size:13px;font-weight:650;color:var(--muted)}
.dp .tabs button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.dp .row{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--line)}
.dp .row:last-child{border-bottom:0}
.dp .row.click{cursor:pointer;border-radius:10px;padding:12px 10px}
.dp .row.click:hover{background:var(--tint)}
.dp .row.sel{background:var(--tint)}
.dp .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.dp .right{text-align:right;margin-left:auto}
.dp .job{border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;gap:10px}
.dp .jobs{display:grid;gap:12px}
@media(min-width:860px){.dp .jobs{grid-template-columns:1fr 1fr}}
.dp .jh{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.dp .jt{font-weight:750;font-size:14.5px}
.dp .js{font-size:12px;color:var(--muted);margin-top:2px}
.dp .facts{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12.5px}
.dp .facts span{color:var(--muted);display:block;font-size:11px}
.dp .tl{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.dp .tl div{border-top:3px solid var(--line);padding-top:6px;font-size:11px;color:var(--muted)}
.dp .tl div.done{border-color:var(--ink)}
.dp .tl b{display:block;color:var(--ink);font-size:11.5px;font-weight:650}
.dp .note{font-size:12.5px;background:var(--tint);border-radius:10px;padding:8px 10px;color:var(--ink2)}
.dp .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.dp .sum div{background:var(--tint);border-radius:12px;padding:10px 12px}
.dp .sum span{display:block;font-size:11px;color:var(--muted)}
.dp .sum b{font-size:16px}
.dp .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:13px;font-weight:650}
.dp .empty{padding:24px;text-align:center;color:var(--muted);font-size:13px}
.dp .center{min-height:60vh;display:grid;place-items:center;text-align:center;padding:24px}
@media print{.dp .top,.dp .noprint{display:none}.dp{background:#fff}.dp .card{border:0;padding:0}}
`;

const rs = (n: number | null | undefined) => `Rs. ${Math.round(n ?? 0).toLocaleString("en-LK")}`;
const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" }) : null;
const dayTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-LK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

const STATUS_LABEL: Record<PortalJob["status"], { text: string; cls: string }> = {
  "Non-Issued": { text: "Received", cls: "p-neu" },
  Issued:       { text: "In repair", cls: "p-amb" },
  Pending:      { text: "On hold", cls: "p-amb" },
  Completed:    { text: "Ready to collect", cls: "p-ok" },
  Delivered:    { text: "Collected", cls: "p-neu" },
  Cancelled:    { text: "Cancelled", cls: "p-bad" },
};

function JobCard({ j, index }: { j: PortalJob; index?: number }) {
  const st = STATUS_LABEL[j.status] ?? { text: j.status, cls: "p-neu" };
  const amount = j.lineTotal ?? j.estimate;
  const steps: [string, string | null][] = [
    ["Received", j.receivedAt],
    ["Started", j.startedAt],
    ["Completed", j.completedAt],
    [j.status === "Cancelled" ? "Cancelled" : "Issued", j.status === "Cancelled" ? j.cancelledAt : j.issuedAt],
  ];
  return (
    <div className="job">
      <div className="jh">
        <div>
          <div className="jt">{index != null && `${index}. `}{[j.brand, j.model].filter(Boolean).join(" ") || "Device"}</div>
          <div className="js">
            {j.id}{j.dealerJobNo ? ` · Your job #${j.dealerJobNo}` : ""}{j.customerName ? ` · ${j.customerName}` : ""}
          </div>
        </div>
        <span className={`pill ${st.cls}`}>{st.text}</span>
      </div>

      <div className="facts">
        <div><span>Fault</span>{j.issue || "—"}</div>
        <div><span>Technician</span>{j.technician || "Not assigned yet"}</div>
        <div><span>IMEI</span><span className="mono" style={{ color: "var(--ink)", fontSize: 12 }}>{j.imei || "—"}</span></div>
        <div>
          <span>{j.lineTotal != null ? "Billed" : "Estimate"}</span>
          <b>{j.completionType === "Cash Return" ? "Cash return" : rs(amount)}</b>
          {j.discount ? <span style={{ display: "inline", marginLeft: 6 }}>({rs(j.discount)} off)</span> : null}
        </div>
      </div>

      <div className="tl">
        {steps.map(([label, at]) => (
          <div key={label} className={at ? "done" : ""}>
            {label}
            <b>{dayTime(at) ?? "—"}</b>
          </div>
        ))}
      </div>

      {j.status !== "Delivered" && j.status !== "Cancelled" && j.estimatedCompletion && (
        <div className="hint">Expected by {day(j.estimatedCompletion)}</div>
      )}
      {j.techRemarks && <div className="note"><b>Technician remarks:</b> {j.techRemarks}</div>}
      {j.partsUsed.length > 0 && <div className="hint">Parts used: {j.partsUsed.join(", ")}</div>}
    </div>
  );
}

function InvoiceView({ inv, onClose }: { inv: PortalInvoice; onClose: () => void }) {
  return (
    <section className="card" id="invoice">
      <header>
        <div>
          <h2>Invoice {inv.invoiceNo}</h2>
          <div className="hint">{day(inv.createdAt ?? inv.date)} · {inv.jobs.length} job{inv.jobs.length === 1 ? "" : "s"}{inv.paymentMethod ? ` · ${inv.paymentMethod}` : ""}</div>
        </div>
        <span className={`pill ${inv.outstanding > 0.005 ? "p-bad" : "p-ok"}`} style={{ marginLeft: "auto" }}>
          {inv.outstanding > 0.005 ? `${rs(inv.outstanding)} due` : "Settled"}
        </span>
        <div className="noprint" style={{ display: "flex", gap: 6 }}>
          <button className="btn" onClick={() => window.print()}>Print</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </header>

      <div className="sum" style={{ marginBottom: 14 }}>
        {inv.discount > 0 && <div><span>Before discount</span><b>{rs(inv.subtotal ?? inv.total + inv.discount)}</b></div>}
        {inv.discount > 0 && <div><span>Discount</span><b>{rs(inv.discount)}</b></div>}
        <div><span>Invoice total</span><b>{rs(inv.total)}</b></div>
        <div><span>Paid</span><b>{rs(inv.paid)}</b></div>
        <div><span>Outstanding on this invoice</span><b style={{ color: inv.outstanding > 0.005 ? "var(--bad)" : undefined }}>{rs(inv.outstanding)}</b></div>
      </div>

      <div className="jobs">
        {inv.jobs.map((j, i) => <JobCard key={j.id} j={j} index={i + 1} />)}
      </div>
      {inv.jobs.length === 0 && <div className="empty">No repair jobs on this invoice.</div>}

      {inv.otherLines.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 14, marginBottom: 6 }}>Other items</h3>
          {inv.otherLines.map((l, i) => (
            <div key={i} className="row">
              <div>{l.description}{l.qty > 1 ? ` × ${l.qty}` : ""}</div>
              <div className="right"><b>{rs(l.lineTotal)}</b></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Portal() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t") ?? "";
  const invoiceNo = params.get("invoice");

  const [data, setData] = useState<DealerPortalData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [inv, setInv] = useState<PortalInvoice | null | undefined>(undefined);
  const [tab, setTab] = useState<"invoices" | "jobs">("invoices");

  useEffect(() => {
    let live = true;
    const load = token ? fetchDealerPortal(token) : Promise.resolve(null);
    load.then(d => { if (live) setData(d); })
      .catch(e => { if (live) { setError(e instanceof Error ? e.message : String(e)); setData(null); } });
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    let live = true;
    const load = token && invoiceNo ? fetchDealerPortalInvoice(token, invoiceNo) : Promise.resolve(null);
    load.then(i => { if (live) setInv(i); }).catch(() => { if (live) setInv(null); });
    return () => { live = false; };
  }, [token, invoiceNo]);

  const openInvoice = useCallback((no: string | null) => {
    const q = new URLSearchParams({ t: token });
    if (no) q.set("invoice", no);
    router.replace(`/dealer?${q.toString()}`, { scroll: false });
    if (no) requestAnimationFrame(() => document.getElementById("invoice")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [router, token]);

  const top = (
    <div className="top">
      <div className="logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SHOP_DETAILS.logo} alt="" />
      </div>
      <div>
        <div className="bn">{SHOP_DETAILS.name}</div>
        <div className="bs">{SHOP_DETAILS.phone}</div>
      </div>
      <span className="tag">Dealer Portal</span>
    </div>
  );

  if (data === undefined) {
    return <div className="dp"><style>{CSS}</style>{top}<div className="center"><p className="hint">Loading your account…</p></div></div>;
  }
  if (!data) {
    return (
      <div className="dp"><style>{CSS}</style>{top}
        <div className="center">
          <div>
            <h1 style={{ fontSize: 20 }}>This link is not valid</h1>
            <p className="hint" style={{ marginTop: 6, maxWidth: 380 }}>
              {error ?? "Scan the QR code on your latest invoice again, or call us on " + SHOP_DETAILS.phone + " for a new link."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const acc = data.account;
  const balance = acc?.balance ?? 0;
  const billed = data.invoices.reduce((s, i) => s + i.total, 0);
  const accStatus = !acc || balance <= 0.005 ? { t: "Settled", c: "p-ok" }
    : acc.status === "Overdue" ? { t: "Overdue", c: "p-bad" } : { t: "Active", c: "p-amb" };

  return (
    <div className="dp">
      <style>{CSS}</style>
      {top}
      <div className="wrap">
        <div>
          <h1 style={{ fontSize: 22 }}>{data.dealer.name}</h1>
          <p className="hint">{[data.dealer.contact, data.dealer.address].filter(Boolean).join(" · ")}</p>
        </div>

        <div className="grid2">
          <section className="hero">
            <div className="lbl">Total outstanding</div>
            <div className="amt">{rs(balance)}</div>
            <span className={`pill ${accStatus.c}`} style={{ marginTop: 8 }}>{accStatus.t}</span>
            <div className="kv">
              <div><span>Total billed on credit</span><b>{rs(acc?.totalCharged)}</b></div>
              <div><span>Total paid</span><b>{rs(acc?.totalPaid)}</b></div>
              {acc && acc.creditLimit > 0 && <div><span>Credit limit</span><b>{rs(acc.creditLimit)}</b></div>}
              {acc?.lastPaymentOn && <div><span>Last payment</span><b>{day(acc.lastPaymentOn)}</b></div>}
              {acc && <div><span>Payment terms</span><b>{acc.termsDays} days</b></div>}
            </div>
          </section>

          <section className="card">
            <header><h2>At a glance</h2></header>
            <div className="sum">
              <div><span>Invoices</span><b>{data.invoices.length}</b></div>
              <div><span>Total invoiced</span><b>{rs(billed)}</b></div>
              <div><span>Jobs in the shop</span><b>{data.openJobs.length}</b></div>
              <div><span>Ready to collect</span><b>{data.openJobs.filter(j => j.status === "Completed").length}</b></div>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Questions about a job or a payment? Call {SHOP_DETAILS.phone}.
            </p>
          </section>
        </div>

        {invoiceNo && inv === null && (
          <section className="card"><p className="hint">Invoice {invoiceNo} could not be found on your account.</p></section>
        )}
        {inv && <InvoiceView inv={inv} onClose={() => openInvoice(null)} />}

        <section className="card noprint">
          <header>
            <div className="tabs">
              <button className={tab === "invoices" ? "on" : ""} onClick={() => setTab("invoices")}>Invoices ({data.invoices.length})</button>
              <button className={tab === "jobs" ? "on" : ""} onClick={() => setTab("jobs")}>Jobs in shop ({data.openJobs.length})</button>
            </div>
          </header>

          {tab === "invoices" ? (
            data.invoices.length === 0 ? <div className="empty">No invoices yet.</div> : (
              <div>
                {data.invoices.map(i => (
                  <div key={i.invoiceNo} className={`row click ${i.invoiceNo === invoiceNo ? "sel" : ""}`} onClick={() => openInvoice(i.invoiceNo)}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{i.invoiceNo}</div>
                      <div className="hint">{day(i.createdAt ?? i.date)} · {i.jobCount} job{i.jobCount === 1 ? "" : "s"}</div>
                    </div>
                    <div className="right">
                      <div style={{ fontWeight: 700 }}>{rs(i.total)}</div>
                      {i.outstanding > 0.005
                        ? <span className="pill p-bad">{rs(i.outstanding)} due</span>
                        : <span className="pill p-ok">Settled</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            data.openJobs.length === 0 ? <div className="empty">None of your devices are in the shop right now.</div> : (
              <div className="jobs">
                {data.openJobs.map(j => <JobCard key={j.id} j={j} />)}
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}

export default function DealerPortalPage() {
  return (
    <Suspense fallback={null}>
      <Portal />
    </Suspense>
  );
}
