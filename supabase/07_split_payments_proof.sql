-- Run AFTER 06. Split payments (pay in parts), change payment method, and payment screenshots.
alter table orders add column if not exists pay_batch uuid, add column if not exists pay_proof text;
update orders set pay_batch = gen_random_uuid() where pay_requested_at is not null and pay_batch is null and paid = false;

-- Private bucket. Anyone may upload a screenshot into a real restaurant's folder. Only that restaurant's owner can view them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 3145728, array['image/webp','image/jpeg','image/png']) on conflict (id) do nothing;
create policy "proof upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs' and exists (select 1 from public.restaurants r where r.id::text = (storage.foldername(name))[1]));
create policy "proof owner read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and exists (select 1 from public.restaurants r where r.id::text = (storage.foldername(name))[1] and r.owner_id = auth.uid()));

drop function if exists request_payment(text, text, uuid, text, text, text);
create or replace function request_payment(p_slug text, p_table text, p_session uuid, p_code text, p_method text, p_ref text, p_proof text)
returns void language plpgsql security definer set search_path = public as $$
declare r restaurants%rowtype; v_batch uuid := gen_random_uuid(); n int;
begin
  select * into r from restaurants where slug = p_slug;
  if not found then raise exception 'Restaurant not found'; end if;
  if p_method not in ('Cash','Easypaisa','JazzCash','Bank transfer','Card') then raise exception 'Invalid payment method'; end if;
  if p_method not in ('Cash','Card') and (coalesce(p_proof,'') = '' or p_proof not like r.id::text || '/%') then raise exception 'Payment screenshot required'; end if;
  -- Only orders that are not already in a payment request. New orders after a request get their own payment.
  update orders o set pay_batch = v_batch, pay_method = p_method, pay_ref = nullif(left(trim(coalesce(p_ref,'')), 40), ''), pay_proof = nullif(p_proof,''), pay_requested_at = now()
  where o.restaurant_id = r.id and o.paid = false and o.pay_batch is null and (
    (coalesce(trim(p_table),'') <> '' and o.bill_key = 'table:' || lower(trim(p_table))) or
    (coalesce(trim(p_table),'') = '' and o.bill_key like 'order:%' and o.session_id = p_session and o.code = p_code));
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Nothing to pay'; end if;
end $$;

create or replace function cancel_payment(p_slug text, p_batch uuid) returns void
language sql security definer set search_path = public as $$
  update orders o set pay_batch = null, pay_method = null, pay_ref = null, pay_proof = null, pay_requested_at = null
  from restaurants r where r.id = o.restaurant_id and r.slug = p_slug and o.pay_batch = p_batch and o.paid = false $$;

create or replace function table_bill(p_slug text, p_key text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', o.id, 'round', o.round, 'code', o.code, 'type', o.order_type, 'items', o.items, 'total', o.total, 'status', o.status, 'paid', o.paid,
    'pay_batch', o.pay_batch, 'pay_method', o.pay_method, 'pay_requested_at', o.pay_requested_at) order by o.created_at), '[]'::json)
  from orders o join restaurants r on r.id = o.restaurant_id
  where r.slug = p_slug and o.paid = false and (
    (p_key like 'table:%' and o.bill_key = p_key) or
    (p_key like 'sess:%' and o.bill_key like 'order:%' and o.session_id::text = substr(p_key, 6))) $$;
grant execute on function request_payment, cancel_payment, table_bill to anon, authenticated;
