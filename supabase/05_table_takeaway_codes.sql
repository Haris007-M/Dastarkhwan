-- Run AFTER 04.
-- 1) Any order that has a table number (eat here OR takeaway/delivery from that table) joins that table's bill.
-- 2) Standalone takeaway/delivery orders get a short pickup code and a phone number instead of a running number.
alter table orders add column if not exists phone text;
alter table orders add column if not exists code text;
update orders set code = 'A' || lpad((coalesce(order_no, 0) % 100)::text, 2, '0') where code is null and order_type <> 'Dine-in';
drop function if exists place_order(text, uuid, text, text, text, text, jsonb);

create or replace function place_order(p_slug text, p_session uuid, p_name text, p_type text, p_table text, p_address text, p_phone text, p_items jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r restaurants%rowtype; lines jsonb; sub int; rnd int := 1; fee int := 0; v_key text; v_code text; v_phone text; has_table boolean;
begin
  select * into r from restaurants where slug = p_slug;
  if not found then raise exception 'Restaurant not found'; end if;
  has_table := coalesce(trim(p_table), '') <> '';
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if p_type not in ('Dine-in','Takeaway','Delivery') then raise exception 'Invalid order type'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Name required'; end if;
  if p_type = 'Dine-in' and not has_table then raise exception 'Table number required'; end if;
  if p_type = 'Delivery' and coalesce(trim(p_address),'') = '' then raise exception 'Address required'; end if;
  if (p_type = 'Delivery' or (p_type = 'Takeaway' and not has_table)) and length(v_phone) < 10 then raise exception 'Mobile number required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then raise exception 'Invalid items'; end if;
  select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'price', i.price, 'qty', q.qty)), sum(i.price * q.qty)
    into lines, sub
    from (select (x->>'id')::uuid as id, least(greatest((x->>'qty')::int, 1), 50) as qty from jsonb_array_elements(p_items) x) q
    join items i on i.id = q.id and i.restaurant_id = r.id and i.available;
  if lines is null then raise exception 'No valid items in order'; end if;
  perform pg_advisory_xact_lock(hashtext(p_slug));
  if has_table then
    v_key := 'table:' || lower(trim(p_table));
    select coalesce(max(o.round), 0) + 1 into rnd from orders o where o.restaurant_id = r.id and o.bill_key = v_key and o.paid = false;
  else
    v_key := 'order:' || gen_random_uuid()::text;
    loop
      v_code := chr(65 + floor(random() * 26)::int) || lpad(floor(random() * 100)::int::text, 2, '0');
      exit when not exists (select 1 from orders o where o.restaurant_id = r.id and o.paid = false and o.code = v_code);
    end loop;
  end if;
  if p_type = 'Delivery' then fee := r.delivery_fee; end if;
  insert into orders (restaurant_id, session_id, bill_key, table_no, customer_name, phone, order_type, address, items, subtotal, fee, total, round, code)
  values (r.id, p_session, v_key, nullif(left(trim(coalesce(p_table,'')),10),''), left(trim(p_name),60), nullif(v_phone,''), p_type, left(p_address,200), lines, sub, fee, sub + fee, rnd, v_code);
  return json_build_object('round', rnd, 'subtotal', sub, 'fee', fee, 'code', v_code);
end $$;

create or replace function table_bill(p_slug text, p_key text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('round', o.round, 'code', o.code, 'type', o.order_type, 'items', o.items, 'total', o.total, 'status', o.status, 'paid', o.paid) order by o.created_at), '[]'::json)
  from orders o join restaurants r on r.id = o.restaurant_id
  where r.slug = p_slug and o.paid = false and (
    (p_key like 'table:%' and o.bill_key = p_key) or
    (p_key like 'sess:%' and o.bill_key like 'order:%' and o.session_id::text = substr(p_key, 6))) $$;
grant execute on function place_order, table_bill to anon, authenticated;
