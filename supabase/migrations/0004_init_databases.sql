-- =====================================================================
-- 0004_init_databases.sql
-- Datenbanken-Subsystem: databases + entries + database_views.
-- =====================================================================

-- ─── databases ───────────────────────────────────────────────────────
create table public.databases (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  icon        text,
  color       text,
  description text,
  schema      jsonb not null default '[]'::jsonb,
  position    integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.databases is 'Container für strukturierte Datensätze (Autos, Verträge, …).';
comment on column public.databases.schema is 'Array von Feld-Definitionen: [{id, key, label, type, required, options?, …}]';

create index databases_owner_idx on public.databases (owner_id, position);
create index databases_owner_active_idx on public.databases (owner_id) where archived = false;

create trigger databases_set_updated_at
  before update on public.databases
  for each row
  execute function public.set_updated_at();

-- ─── entries ─────────────────────────────────────────────────────────
create table public.entries (
  id          uuid primary key default gen_random_uuid(),
  database_id uuid not null references public.databases(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  -- Volltextsuche, deutsche Sprachkonfig. Indexiert den gesamten data-jsonb als Text
  -- (inkl. Keys — akzeptabel für MVP, präzisere Extraction in Phase 2).
  search_vector tsvector generated always as (
    to_tsvector('german', coalesce(data::text, ''))
  ) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.entries is 'Einzelner Datensatz in einer Datenbank. data folgt dem schema des parents.';

create index entries_database_created_idx on public.entries (database_id, created_at desc);
create index entries_owner_idx on public.entries (owner_id);
create index entries_search_idx on public.entries using gin (search_vector);

create trigger entries_set_updated_at
  before update on public.entries
  for each row
  execute function public.set_updated_at();

-- ─── database_views ──────────────────────────────────────────────────
create table public.database_views (
  id          uuid primary key default gen_random_uuid(),
  database_id uuid not null references public.databases(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  view_type   text not null check (view_type in ('table', 'cards', 'list', 'calendar', 'kanban')),
  config      jsonb not null default '{}'::jsonb,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.database_views is 'Gespeicherte View-Configs (Spalten, Filter, Sort, Gruppierung) pro Datenbank.';

create index database_views_database_idx on public.database_views (database_id);
-- Nur eine Default-View pro Datenbank
create unique index database_views_one_default_idx
  on public.database_views (database_id)
  where is_default = true;

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.databases enable row level security;
alter table public.entries enable row level security;
alter table public.database_views enable row level security;

create policy "databases_owner_all"
  on public.databases
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "entries_owner_all"
  on public.entries
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "database_views_owner_all"
  on public.database_views
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
