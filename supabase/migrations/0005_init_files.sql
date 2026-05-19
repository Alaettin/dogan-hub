-- =====================================================================
-- 0005_init_files.sql
-- Dateien-Subsystem: folders + files + entry_files Bridge-Tabelle.
-- =====================================================================

-- ─── folders ─────────────────────────────────────────────────────────
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  parent_id   uuid references public.folders(id) on delete cascade,
  name        text not null,
  path        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Keine doppelten Namen im selben Parent (NULL-Parent = root)
  unique (owner_id, parent_id, name)
);

comment on table public.folders is 'Hierarchische Ordner-Struktur. path ist denormalisiert für schnelle Breadcrumbs.';

create index folders_owner_parent_idx on public.folders (owner_id, parent_id);
create index folders_owner_path_idx on public.folders (owner_id, path);

create trigger folders_set_updated_at
  before update on public.folders
  for each row
  execute function public.set_updated_at();

-- ─── files ───────────────────────────────────────────────────────────
create table public.files (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  folder_id       uuid references public.folders(id) on delete set null,
  name            text not null,
  storage_path    text not null unique,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes >= 0),
  checksum_sha256 text,
  deleted_at      timestamptz,
  search_vector   tsvector generated always as (to_tsvector('german', name)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.files is 'Eine Datei = eine Row. Storage-Pfad: {owner_id}/{file_id}/{filename}.';
comment on column public.files.deleted_at is 'Soft-Delete für Trash (30 Tage). Cronjob purged danach.';

create index files_owner_folder_idx on public.files (owner_id, folder_id) where deleted_at is null;
create index files_owner_deleted_idx on public.files (owner_id, deleted_at) where deleted_at is not null;
create index files_search_idx on public.files using gin (search_vector);

create trigger files_set_updated_at
  before update on public.files
  for each row
  execute function public.set_updated_at();

-- ─── entry_files (Bridge) ────────────────────────────────────────────
create table public.entry_files (
  entry_id    uuid not null references public.entries(id) on delete cascade,
  file_id     uuid not null references public.files(id) on delete cascade,
  attached_at timestamptz not null default now(),
  primary key (entry_id, file_id)
);

comment on table public.entry_files is 'Verknüpfung Eintrag↔Datei. Datei kann an mehrere Einträge gehängt sein, keine Storage-Duplikate.';

create index entry_files_file_idx on public.entry_files (file_id);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.folders enable row level security;
alter table public.files enable row level security;
alter table public.entry_files enable row level security;

create policy "folders_owner_all"
  on public.folders
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "files_owner_all"
  on public.files
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- entry_files: User darf eine Verknüpfung nur dann anlegen/lesen/löschen,
-- wenn er sowohl den Entry als auch die File besitzt.
create policy "entry_files_owner_all"
  on public.entry_files
  for all
  using (
    exists (select 1 from public.entries e where e.id = entry_id and e.owner_id = auth.uid())
    and
    exists (select 1 from public.files f where f.id = file_id and f.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.entries e where e.id = entry_id and e.owner_id = auth.uid())
    and
    exists (select 1 from public.files f where f.id = file_id and f.owner_id = auth.uid())
  );
