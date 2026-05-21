-- =====================================================================
-- 0012_init_notes.sql
-- Notizen-Modul: eine Tabelle, drei Typen (text | checklist | list).
-- owner-RLS (privat pro Nutzer). body = Markdown für type='text',
-- items = JSONB für checklist ([{text,done}]) und list ([{text}]).
-- =====================================================================

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  type        text not null default 'text' check (type in ('text', 'checklist', 'list')),
  title       text not null default '',
  body        text not null default '',
  items       jsonb not null default '[]'::jsonb,
  color       text,
  tags        jsonb not null default '[]'::jsonb,
  pinned      boolean not null default false,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.notes.body is 'Markdown-Text für type=text.';
comment on column public.notes.items is 'checklist: [{text,done}] · list: [{text}].';
comment on column public.notes.tags is 'Array von Strings — frei pro Notiz.';

create index notes_owner_pinned_idx on public.notes (owner_id, pinned, updated_at desc);
create index notes_tags_gin_idx on public.notes using gin (tags);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.notes enable row level security;

create policy "notes_owner_all"
  on public.notes for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
