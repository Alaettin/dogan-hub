-- =====================================================================
-- 0011_init_kanban.sql
-- Kanban-Modul: boards → columns → cards. owner-RLS, position-Sortierung
-- (double precision für Midpoint-Reorder ohne Bulk-Reindex).
-- =====================================================================

create table public.kanban_boards (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  color       text,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.kanban_columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.kanban_boards(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  color       text,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.kanban_cards (
  id          uuid primary key default gen_random_uuid(),
  column_id   uuid not null references public.kanban_columns(id) on delete cascade,
  board_id    uuid not null references public.kanban_boards(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  color       text,
  due_date    date,
  labels      jsonb not null default '[]'::jsonb,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.kanban_cards.labels is 'Array von { name, color } — frei pro Karte.';

create index kanban_boards_owner_pos_idx  on public.kanban_boards (owner_id, position);
create index kanban_columns_board_pos_idx on public.kanban_columns (board_id, position);
create index kanban_cards_col_pos_idx     on public.kanban_cards (column_id, position);

create trigger kanban_boards_set_updated_at
  before update on public.kanban_boards
  for each row execute function public.set_updated_at();
create trigger kanban_columns_set_updated_at
  before update on public.kanban_columns
  for each row execute function public.set_updated_at();
create trigger kanban_cards_set_updated_at
  before update on public.kanban_cards
  for each row execute function public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.kanban_boards  enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.kanban_cards   enable row level security;

create policy "kanban_boards_owner_all"
  on public.kanban_boards for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "kanban_columns_owner_all"
  on public.kanban_columns for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "kanban_cards_owner_all"
  on public.kanban_cards for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
