-- =====================================================================
-- 0017_init_shop.sql
-- Shopping/Verkäufe: sales_platforms (Parent) → shop_listings (Child).
-- Verkaufs-Tracker über mehrere Plattformen (z.B. Cardmarket). Alle
-- Beträge in EUR. owner-RLS überall, FK on delete cascade.
-- =====================================================================

-- ─── Plattformen ─────────────────────────────────────────────────────
create table public.sales_platforms (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  url         text,
  color       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index sales_platforms_owner_idx on public.sales_platforms (owner_id, name);

create trigger sales_platforms_set_updated_at
  before update on public.sales_platforms
  for each row execute function public.set_updated_at();

-- ─── Inserate / Verkäufe ─────────────────────────────────────────────
create table public.shop_listings (
  id              uuid primary key default gen_random_uuid(),
  platform_id     uuid not null references public.sales_platforms(id) on delete cascade,
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  price           numeric(12,2) not null,
  quantity        integer not null default 1 check (quantity > 0),
  purchase_price  numeric(12,2),
  fees            numeric(12,2),
  condition       text,
  category        text,
  item_url        text,
  image_url       text,
  notes           text,
  status          text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  listed_at       date not null default current_date,
  sold_at         date,
  sold_price      numeric(12,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.shop_listings.price is 'Angebotspreis (EUR).';
comment on column public.shop_listings.sold_price is 'Tatsächlicher Verkaufspreis (EUR), gesetzt bei status=sold.';

create index shop_listings_platform_idx on public.shop_listings (platform_id, listed_at desc);
create index shop_listings_owner_status_idx on public.shop_listings (owner_id, status);
create index shop_listings_owner_sold_idx on public.shop_listings (owner_id, sold_at);

create trigger shop_listings_set_updated_at
  before update on public.shop_listings
  for each row execute function public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.sales_platforms enable row level security;
alter table public.shop_listings enable row level security;

create policy "sales_platforms_owner_all"
  on public.sales_platforms for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "shop_listings_owner_all"
  on public.shop_listings for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
