-- Run AFTER schema.sql
alter table restaurants add constraint one_restaurant_per_owner unique (owner_id);

-- Orders: no one can insert directly. Only place_order() can, and it recalculates prices on the server.
create table orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete cascade not null,
  session_id uuid not null, table_no text, customer_name text not null,
  order_type text not null, address text, items jsonb not null,
  subtotal int not null, fee int not null default 0, total int not null,
  round int not null default 1, status text not null default 'new', paid boolean not null default false,
  created_at timestamptz not null default now());
create index on orders (restaurant_id, paid); create index on orders (session_id);
alter table orders enable row level security;
create policy "owner read" on orders for select using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "owner update" on orders for update using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
alter publication supabase_realtime add table orders;

create or replace function place_order(p_slug text, p_session uuid, p_name text, p_type text, p_table text, p_address text, p_items jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r restaurants%rowtype; lines jsonb; sub int; rnd int; fee int := 0;
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
  select coalesce(max(round), 0) + 1 into rnd from orders where session_id = p_session and restaurant_id = r.id;
  if p_type = 'Delivery' and rnd = 1 then fee := r.delivery_fee; end if;
  insert into orders (restaurant_id, session_id, table_no, customer_name, order_type, address, items, subtotal, fee, total, round)
  values (r.id, p_session, left(p_table,10), left(trim(p_name),60), p_type, left(p_address,200), lines, sub, fee, sub + fee, rnd);
  return json_build_object('round', rnd, 'subtotal', sub, 'fee', fee);
end $$;

-- The customer's running bill. The session id is a random secret held only on their phone.
create or replace function session_bill(p_session uuid) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('round', round, 'items', items, 'total', total, 'status', status, 'paid', paid) order by round), '[]'::json)
  from orders where session_id = p_session $$;
grant execute on function place_order, session_bill to anon, authenticated;

-- Storage: anyone can view menu images, only a logged-in owner can write inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, array['image/webp','image/jpeg','image/png']) on conflict (id) do nothing;
create policy "img read" on storage.objects for select using (bucket_id = 'menu-images');
create policy "img insert" on storage.objects for insert to authenticated with check (bucket_id = 'menu-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "img delete" on storage.objects for delete to authenticated using (bucket_id = 'menu-images' and (storage.foldername(name))[1] = auth.uid()::text);
