-- Run AFTER 05. Payment requests: the customer says how they pay, only the restaurant can confirm.
alter table restaurants add column if not exists payment_info text;
alter table orders add column if not exists pay_method text, add column if not exists pay_ref text,
  add column if not exists pay_requested_at timestamptz, add column if not exists paid_at timestamptz;

create or replace function request_payment(p_slug text, p_table text, p_session uuid, p_code text, p_method text, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_method not in ('Cash','Easypaisa','JazzCash','Bank transfer','Card') then raise exception 'Invalid payment method'; end if;
  update orders o set pay_method = p_method, pay_ref = left(trim(coalesce(p_ref,'')), 40), pay_requested_at = now()
  from restaurants r
  where r.id = o.restaurant_id and r.slug = p_slug and o.paid = false and (
    (coalesce(trim(p_table),'') <> '' and o.bill_key = 'table:' || lower(trim(p_table))) or
    (coalesce(trim(p_table),'') = '' and o.bill_key like 'order:%' and o.session_id = p_session and o.code = p_code));
end $$;

create or replace function table_bill(p_slug text, p_key text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('round', o.round, 'code', o.code, 'type', o.order_type, 'items', o.items, 'total', o.total, 'status', o.status, 'paid', o.paid,
    'pay_method', o.pay_method, 'pay_requested_at', o.pay_requested_at) order by o.created_at), '[]'::json)
  from orders o join restaurants r on r.id = o.restaurant_id
  where r.slug = p_slug and o.paid = false and (
    (p_key like 'table:%' and o.bill_key = p_key) or
    (p_key like 'sess:%' and o.bill_key like 'order:%' and o.session_id::text = substr(p_key, 6))) $$;
grant execute on function request_payment, table_bill to anon, authenticated;
