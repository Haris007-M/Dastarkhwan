-- Run AFTER 02. One open bill per table: every order for "Table 2" joins Table 2's bill, whatever phone it comes from.
alter table orders add column if not exists bill_key text;
update orders set bill_key = case when order_type = 'Dine-in' then 'table:' || lower(trim(coalesce(table_no, ''))) else 'sess:' || session_id::text end where bill_key is null;
alter table orders alter column bill_key set not null;
create index if not exists orders_bill_idx on orders (restaurant_id, bill_key, paid);
drop function if exists session_bill(uuid);

create or replace function place_order(p_slug text, p_session uuid, p_name text, p_type text, p_table text, p_address text, p_items jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r restaurants%rowtype; lines jsonb; sub int; rnd int; fee int := 0; v_key text;
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
  v_key := case when p_type = 'Dine-in' then 'table:' || lower(trim(p_table)) else 'sess:' || p_session::text end;
  select coalesce(max(o.round), 0) + 1 into rnd from orders o where o.restaurant_id = r.id and o.bill_key = v_key and o.paid = false;
  if p_type = 'Delivery' and rnd = 1 then fee := r.delivery_fee; end if;
  insert into orders (restaurant_id, session_id, bill_key, table_no, customer_name, order_type, address, items, subtotal, fee, total, round)
  values (r.id, p_session, v_key, left(trim(p_table),10), left(trim(p_name),60), p_type, left(p_address,200), lines, sub, fee, sub + fee, rnd);
  return json_build_object('round', rnd, 'subtotal', sub, 'fee', fee);
end $$;

create or replace function table_bill(p_slug text, p_key text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('round', o.round, 'items', o.items, 'total', o.total, 'status', o.status, 'paid', o.paid) order by o.round, o.created_at), '[]'::json)
  from orders o join restaurants r on r.id = o.restaurant_id where r.slug = p_slug and o.bill_key = p_key and o.paid = false $$;
grant execute on function place_order, table_bill to anon, authenticated;
