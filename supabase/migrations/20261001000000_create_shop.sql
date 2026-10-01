create extension if not exists pgcrypto;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  category text not null,
  price_minor integer not null check (price_minor > 0),
  emoji text not null,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  customer_email text not null,
  customer_name text not null,
  phone text not null,
  delivery_address text not null,
  city text not null,
  delivery_notes text not null default '',
  total_minor integer not null check (total_minor > 0),
  payment_status text not null default 'unpaid' check (payment_status = 'unpaid'),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price_minor integer not null check (unit_price_minor > 0),
  quantity integer not null check (quantity between 1 and 20),
  line_total_minor integer not null check (line_total_minor > 0)
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Anyone can view available products"
  on public.products for select
  using (is_available);

create policy "Customers can view their own orders"
  on public.orders for select to authenticated
  using (auth.uid() = user_id);

create policy "Customers can view items from their own orders"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
revoke all on public.order_items from anon, authenticated;
grant select on public.order_items to authenticated;
grant select on public.products to anon, authenticated;

create or replace function public.create_order(
  p_items jsonb,
  p_customer_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_delivery_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_total bigint := 0;
  v_order_id uuid;
begin
  if v_user_id is null or v_email is null then
    raise exception 'Authentication is required to create an order.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'The order must contain between 1 and 30 products.';
  end if;
  if length(trim(p_customer_name)) not between 1 and 120
     or length(trim(p_phone)) not between 1 and 40
     or length(trim(p_address)) not between 1 and 500
     or length(trim(p_city)) not between 1 and 120
     or length(coalesce(p_delivery_notes, '')) > 500 then
    raise exception 'One or more delivery details are invalid.';
  end if;
  if (
    select count(distinct value ->> 'product_id')
    from jsonb_array_elements(p_items)
  ) <> jsonb_array_length(p_items) then
    raise exception 'The order contains duplicate products.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity not between 1 and 20 then
      raise exception 'Product quantities must be between 1 and 20.';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and is_available
    for share;

    if not found then
      raise exception 'A product in the order is unavailable.';
    end if;

    v_total := v_total + (v_product.price_minor::bigint * v_quantity);
  end loop;

  if v_total > 2147483647 then
    raise exception 'The order total is too large.';
  end if;

  insert into public.orders (
    user_id, customer_email, customer_name, phone, delivery_address,
    city, delivery_notes, total_minor
  )
  values (
    v_user_id, v_email, trim(p_customer_name), trim(p_phone),
    trim(p_address), trim(p_city), coalesce(trim(p_delivery_notes), ''),
    v_total::integer
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and is_available
    for share;

    insert into public.order_items (
      order_id, product_id, product_name, unit_price_minor,
      quantity, line_total_minor
    )
    values (
      v_order_id, v_product.id, v_product.name, v_product.price_minor,
      v_quantity, v_product.price_minor * v_quantity
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_order(jsonb, text, text, text, text, text) from public;
grant execute on function public.create_order(jsonb, text, text, text, text, text) to authenticated;

insert into public.products (slug, name, description, category, price_minor, emoji, sort_order)
values
  ('sunshine-bowl', 'Sunshine bowl', 'Roasted sweet potato, crisp greens, avocado and our lemon tahini.', 'Bowls', 680000, '🥗', 1),
  ('golden-crunch-wrap', 'Golden crunch wrap', 'Spiced chickpeas, crunchy slaw and herby yoghurt in a warm wrap.', 'Lunch', 450000, '🌯', 2),
  ('garden-pasta', 'Garden pasta', 'Pasta tossed with seasonal vegetables, basil and parmesan.', 'Mains', 720000, '🍝', 3),
  ('berry-bliss', 'Berry bliss cup', 'Creamy yoghurt, seasonal berries, granola and a drizzle of honey.', 'Treats', 320000, '🍓', 4),
  ('ginger-glow-juice', 'Ginger glow juice', 'Fresh pineapple, orange and a little zing of ginger.', 'Drinks', 250000, '🍹', 5),
  ('chocolate-cloud', 'Chocolate cloud', 'A soft, rich chocolate brownie made in small batches.', 'Treats', 280000, '🍫', 6);
