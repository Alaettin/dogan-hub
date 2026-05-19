-- =====================================================================
-- 0006_init_tags.sql
-- Tags-Subsystem: user-weiter Tag-Pool, anwendbar auf entries UND files.
-- =====================================================================

create table public.tags (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references public.profiles(id) on delete cascade,
  name      text not null check (length(trim(name)) > 0),
  color     text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

comment on table public.tags is 'Cross-cutting Tags, user-weit. Anwendbar auf entries + files.';

create index tags_owner_idx on public.tags (owner_id);

-- ─── Bridge-Tabellen ─────────────────────────────────────────────────
create table public.entry_tags (
  entry_id    uuid not null references public.entries(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (entry_id, tag_id)
);

create index entry_tags_tag_idx on public.entry_tags (tag_id);

create table public.file_tags (
  file_id     uuid not null references public.files(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (file_id, tag_id)
);

create index file_tags_tag_idx on public.file_tags (tag_id);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.tags enable row level security;
alter table public.entry_tags enable row level security;
alter table public.file_tags enable row level security;

create policy "tags_owner_all"
  on public.tags
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "entry_tags_owner_all"
  on public.entry_tags
  for all
  using (
    exists (select 1 from public.entries e where e.id = entry_id and e.owner_id = auth.uid())
    and
    exists (select 1 from public.tags t where t.id = tag_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.entries e where e.id = entry_id and e.owner_id = auth.uid())
    and
    exists (select 1 from public.tags t where t.id = tag_id and t.owner_id = auth.uid())
  );

create policy "file_tags_owner_all"
  on public.file_tags
  for all
  using (
    exists (select 1 from public.files f where f.id = file_id and f.owner_id = auth.uid())
    and
    exists (select 1 from public.tags t where t.id = tag_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.files f where f.id = file_id and f.owner_id = auth.uid())
    and
    exists (select 1 from public.tags t where t.id = tag_id and t.owner_id = auth.uid())
  );
