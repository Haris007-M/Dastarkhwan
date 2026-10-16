-- Run AFTER 03. Only dine-in orders share a bill (per table). Every takeaway or delivery order is its own order with its own number.
alter table orders add column if not exists order_no int;
update orders o set order_no = s.n from (select id, row_number() over (partition by restaurant_id order by created_at) n from orders) s where o.id = s.id and o.order_no is null;
update orders set bill_key = 'order:' || id::text where order_type <> 'Dine-in';

create or replace function place_order(p_slug text, p_session uuid, p_name text, p_type text, p_table text, p_address text, p_items jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r restaurants%rowtype; lines jsonb; sub int; rnd int; fee int := 0; v_key text; ono int;
begin
  select * into r from restaurants where slug = p_slug;
  if not found then raise exception 'Restaurant not found'; end if;
  if p_type not in ('Dine-in','Takeaway','Delivery') then raise exception 'Invalid order type'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Name required'; end if;
  if p_type = 'Dine-in' and coalesce(trim(p_table),'') = '' then raise exception 'Table number required'; end if;
  if p_type = 'Delivery' and coalesce(trim(p_address),'') = '' then raise exception 'Address required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then raise exception 'Invalid items'; end if;
  select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'price', i.price, 'qty', q.qty)), sum(i.price * q.qty)
    into lines, sub
    from (select (x->>'id')::uuid as id, least(greatest((x->>'qty')::int, 1), 50) as qty from jsonb_array_elements(p_items) x) q
    join items i on i.id = q.id and i.restaurant_id = r.id and i.available;
  if lines is null then raise exception 'No valid items in order'; end if;
  perform pg_advisory_xact_lock(hashtext(p_slug));
  select coalesce(max(o.order_no), 0) + 1 into ono from orders o where o.restaurant_id = r.id;
  if p_type = 'Dine-in' then
    v_key := 'table:' || lower(trim(p_table));
    select coalesce(max(o.round), 0) + 1 into rnd from orders o where o.restaurant_id = r.id and o.bill_key = v_key and o.paid = false;
  else
    v_key := 'order:' || gen_random_uuid()::text; rnd := 1;
    if p_type = 'Delivery' then fee := r.delivery_fee; end if;
  end if;
  insert into orders (restaurant_id, session_id, bill_key, order_no, table_no, customer_name, order_type, address, items, subtotal, fee, total, round)
  values (r.id, p_session, v_key, ono, left(trim(p_table),10), left(trim(p_name),60), p_type, left(p_address,200), lines, sub, fee, sub + fee, rnd);
  return json_build_object('round', rnd, 'order_no', ono, 'subtotal', sub, 'fee', fee);
end $$;

create or replace function table_bill(p_slug text, p_key text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('round', o.round, 'order_no', o.order_no, 'type', o.order_type, 'items', o.items, 'total', o.total, 'status', o.status, 'paid', o.paid) order by o.created_at), '[]'::json)
  from orders o join restaurants r on r.id = o.restaurant_id
  where r.slug = p_slug and o.paid = false and (
    (p_key like 'table:%' and o.bill_key = p_key) or
    (p_key like 'sess:%' and o.order_type <> 'Dine-in' and o.session_id::text = substr(p_key, 6))) $$;
grant execute on function place_order, table_bill to anon, authenticated;
