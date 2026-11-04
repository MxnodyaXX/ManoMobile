-- ============================================================================
-- Mano Mobile — public product & warranty check (the QR-code "/verify" page)
--
-- The repair receipt's QR opens /track for the job. This is the same thing for
-- a product sale: the QR on the accessory invoice opens /verify?inv=INV-…,
-- where the customer can see that the invoice is genuine, what was on it, and
-- whether each item is still under warranty — no staff login, by design.
--
-- Same shape as track_job() (20260819000015): sales and sale_items stay
-- staff-only under their own RLS, and this SECURITY DEFINER function is the
-- only door in — exact invoice number only (never a listing), and a narrow,
-- customer-safe result: the customer's name shortened to first name + initial,
-- no phone, no cost price, an IMEI cut to its last four digits.
--
-- Warranty per line is worked out the way Warranty Center does it
-- (lib/warranty/lookup.ts): what the counter chose on the line
-- (sale_items.warranty_days) beats the shop policy for the product's category,
-- which beats the policy for the whole kind; counted from the sale date. A
-- voided or returned invoice covers nothing.
-- ============================================================================

-- Idempotent copies of 20261021000084's columns, so this migration doesn't
-- depend on that one having been run first.
alter table public.sale_items
  add column if not exists warranty_days integer check (warranty_days is null or warranty_days >= 0),
  add column if not exists warranty_label text;

create or replace function public.verify_invoice(p_invoice_no text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'invoice_no', s.invoice_no,
    'sold_on',    s.sold_on,
    'category',   s.category,
    'status',     s.status,
    'total',      s.total,
    -- "Sumod Themiya" -> "Sumod T." ; a walk-in stays "Walk-in".
    'customer',   case
                    when coalesce(nullif(trim(s.customer), ''), 'Walk-in') = 'Walk-in' then 'Walk-in'
                    when position(' ' in trim(s.customer)) = 0 then trim(s.customer)
                    else split_part(trim(s.customer), ' ', 1) || ' ' || left(split_part(trim(s.customer), ' ', 2), 1) || '.'
                  end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description',  i.description,
        'kind',         i.kind,
        'code',         i.code,
        'category',     i.category,
        'qty',          i.qty,
        'line_total',   i.line_total,
        'warranty_days', i.days,
        'warranty_label', i.label,
        'terms',        i.terms,
        'starts_on',    s.sold_on,
        'expires_on',   case when i.days > 0 then s.sold_on + i.days end
      ) order by i.sort_order)
      from (
        select
          l.sort_order, l.description, l.kind::text as kind, l.qty, l.line_total,
          case
            when l.kind::text = 'accessory' then p.code
            when l.kind::text = 'device' and l.reference_id is not null then '•••• ' || right(l.reference_id, 4)
          end as code,
          p.category,
          coalesce(l.warranty_days, pc.duration_days, pk.duration_days, 0) as days,
          coalesce(nullif(l.warranty_label, ''), nullif(pc.label, ''), nullif(pk.label, '')) as label,
          coalesce(nullif(pc.terms, ''), nullif(pk.terms, ''), '') as terms
        from public.sale_items l
        left join public.accessory_products p
          on l.kind::text = 'accessory' and p.id::text = l.reference_id
        left join public.warranty_policies pc
          on pc.kind = case l.kind::text when 'accessory' then 'accessory' when 'device' then 'device'
                                         when 'repair_part' then 'part' else 'other' end
         and pc.category is not null and lower(pc.category) = lower(p.category)
        left join public.warranty_policies pk
          on pk.kind = case l.kind::text when 'accessory' then 'accessory' when 'device' then 'device'
                                         when 'repair_part' then 'part' else 'other' end
         and pk.category is null
        where l.invoice_no = s.invoice_no
          -- A repair's own cover lives on /track; this page is for products.
          and l.kind::text <> 'repair_service'
      ) i
    ), '[]'::jsonb)
  )
  from public.sales s
  where s.invoice_no = upper(trim(p_invoice_no));
$$;

comment on function public.verify_invoice(text) is
  'Public product/warranty check for the /verify page. Exact invoice number only — never lists sales. Customer-safe fields only.';

revoke all on function public.verify_invoice(text) from public;
grant execute on function public.verify_invoice(text) to anon, authenticated;
