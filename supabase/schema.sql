create table restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users default auth.uid(),
  slug text unique not null, name text not null, whatsapp text not null,
  tagline text, banner_url text, color text default '#e85d04', delivery_fee int default 0);
create table categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete cascade not null,
  name text not null, sort int default 0);
create table items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete cascade not null,
  category_id uuid references categories on delete cascade not null,
  name text not null, description text, price int not null, image_url text, available boolean default true);
alter table restaurants enable row level security;
alter table categories enable row level security;
alter table items enable row level security;
create policy "read" on restaurants for select using (true);
create policy "read" on categories for select using (true);
create policy "read" on items for select using (true);
create policy "own" on restaurants for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own" on categories for all using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "own" on items for all using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create index on categories (restaurant_id); create index on items (restaurant_id);

-- Demo restaurant at /demo
with r as (insert into restaurants (slug,name,whatsapp,tagline,banner_url,color,delivery_fee)
 values ('demo','Zinger House','923001234567','Crispy, hot, fast','https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200','#e85d04',100) returning id),
c as (insert into categories (restaurant_id,name,sort) select id,n,s from r, (values ('Burgers',1),('Sides',2),('Drinks',3)) v(n,s) returning id,name,restaurant_id)
insert into items (restaurant_id,category_id,name,description,price,image_url)
select restaurant_id,id,i.n,i.d,i.p,i.u from c join (values
('Burgers','Zinger Burger','Crispy chicken, mayo, lettuce',450,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'),
('Burgers','Beef Smash','Double patty, cheddar, pickles',650,'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=400'),
('Sides','Masala Fries','Spiced and salty',250,'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400'),
('Drinks','Mint Margarita','Fresh mint, lemon, soda',220,'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400')
) i(cat,n,d,p,u) on i.cat = c.name;
