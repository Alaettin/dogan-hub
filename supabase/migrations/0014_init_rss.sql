-- =====================================================================
-- 0014_init_rss.sql
-- RSS-Feeds-Modul: drei Tabellen.
--   rss_folders — optionale Gruppierung von Feeds (privat pro Nutzer)
--   rss_feeds   — abonnierte Feeds (URL, Status, Fehler-Tracking)
--   rss_items   — gecachte Artikel (gelesen/Favorit, Volltext-Suche)
-- owner-RLS überall (auth.uid() = owner_id). Items werden per Cron
-- (Service-Role) sowie beim manuellen Refresh per Upsert befüllt.
-- =====================================================================

-- ─── Ordner ──────────────────────────────────────────────────────────
create table public.rss_folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null default '',
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index rss_folders_owner_idx on public.rss_folders (owner_id, position);

create trigger rss_folders_set_updated_at
  before update on public.rss_folders
  for each row execute function public.set_updated_at();

-- ─── Feeds ───────────────────────────────────────────────────────────
create table public.rss_feeds (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  folder_id       uuid references public.rss_folders(id) on delete set null,
  feed_url        text not null,
  site_url        text,
  title           text not null default '',
  description     text,
  favicon_url     text,
  status          text not null default 'active' check (status in ('active', 'paused', 'error')),
  last_fetched_at timestamptz,
  last_error      text,
  error_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, feed_url)
);

comment on column public.rss_feeds.status is 'active = wird vom Cron aktualisiert · paused = pausiert · error = letzter Abruf fehlgeschlagen.';

create index rss_feeds_owner_folder_idx on public.rss_feeds (owner_id, folder_id);
create index rss_feeds_status_fetched_idx on public.rss_feeds (status, last_fetched_at);

create trigger rss_feeds_set_updated_at
  before update on public.rss_feeds
  for each row execute function public.set_updated_at();

-- ─── Artikel ─────────────────────────────────────────────────────────
create table public.rss_items (
  id            uuid primary key default gen_random_uuid(),
  feed_id       uuid not null references public.rss_feeds(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  guid          text not null,
  title         text not null default '',
  link          text,
  author        text,
  summary       text,
  content       text,
  image_url     text,
  published_at  timestamptz,
  is_read       boolean not null default false,
  is_favorite   boolean not null default false,
  fetched_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  search_tsv    tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, ''))
  ) stored,
  unique (feed_id, guid)
);

comment on column public.rss_items.guid is 'Feed-<guid>/<id>, Fallback auf link — Dedup-Schlüssel je Feed.';
comment on column public.rss_items.owner_id is 'Denormalisiert vom Feed — für RLS + Cross-Feed-Queries (Dashboard).';

create index rss_items_owner_published_idx on public.rss_items (owner_id, published_at desc);
create index rss_items_feed_published_idx on public.rss_items (feed_id, published_at desc);
create index rss_items_owner_read_idx on public.rss_items (owner_id, is_read);
create index rss_items_owner_fav_idx on public.rss_items (owner_id, is_favorite);
create index rss_items_search_idx on public.rss_items using gin (search_tsv);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.rss_folders enable row level security;
alter table public.rss_feeds enable row level security;
alter table public.rss_items enable row level security;

create policy "rss_folders_owner_all"
  on public.rss_folders for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "rss_feeds_owner_all"
  on public.rss_feeds for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "rss_items_owner_all"
  on public.rss_items for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─── Ungelesen-Zähler je Feed ────────────────────────────────────────
-- security invoker → RLS greift, liefert nur die Feeds des aufrufenden
-- Nutzers. Frontend nutzt das für die Badges in der Feed-Sidebar.
create or replace function public.rss_unread_counts()
returns table (feed_id uuid, unread bigint)
language sql
security invoker
stable
set search_path = ''
as $$
  select feed_id, count(*)::bigint as unread
  from public.rss_items
  where is_read = false
  group by feed_id;
$$;
