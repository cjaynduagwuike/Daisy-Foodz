create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_user_product_unique unique (user_id, product_id)
);

create or replace function public.set_cart_item_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_cart_item_updated_at();

alter table public.cart_items enable row level security;
alter table public.cart_items replica identity full;

create policy "Users can view their own cart items"
  on public.cart_items for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can add items to their own cart"
  on public.cart_items for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own cart items"
  on public.cart_items for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can remove items from their own cart"
  on public.cart_items for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.cart_items from anon, authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

alter publication supabase_realtime add table public.cart_items;
