-- =====================================================================
-- 0016_init_dashboard_settings.sql
-- Pro-Nutzer-Konfiguration des Dashboards: welche Widgets sichtbar sind
-- und wie viele Elemente sie zeigen. 1:1 pro Nutzer (PK = owner_id).
-- =====================================================================

create table public.dashboard_settings (
  owner_id        uuid primary key references public.profiles(id) on delete cascade,
  show_calendar   boolean not null default true,
  show_kanban     boolean not null default true,
  show_notes      boolean not null default true,
  show_rss        boolean not null default true,
  calendar_count  integer not null default 6 check (calendar_count between 1 and 20),
  kanban_count    integer not null default 6 check (kanban_count between 1 and 20),
  notes_count     integer not null default 6 check (notes_count between 1 and 20),
  rss_count       integer not null default 5 check (rss_count between 1 and 20),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger dashboard_settings_set_updated_at
  before update on public.dashboard_settings
  for each row execute function public.set_updated_at();

alter table public.dashboard_settings enable row level security;

create policy "dashboard_settings_owner_all"
  on public.dashboard_settings for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
