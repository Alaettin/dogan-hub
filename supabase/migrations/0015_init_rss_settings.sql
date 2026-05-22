-- =====================================================================
-- 0015_init_rss_settings.sql
-- Pro-Nutzer-Einstellungen für die RSS-App (1:1, PK = owner_id).
-- Steuert Aktualisierungsintervall, Auto-Aufräumen, Standard-Ansicht
-- und Mark-on-open. Wird vom Cron (Service-Role) gelesen.
-- =====================================================================

create table public.rss_settings (
  owner_id                 uuid primary key references public.profiles(id) on delete cascade,
  refresh_interval_minutes integer not null default 30 check (refresh_interval_minutes >= 5),
  cleanup_mode             text not null default 'off' check (cleanup_mode in ('off', 'read', 'all')),
  cleanup_after_days       integer not null default 30 check (cleanup_after_days >= 1),
  cleanup_keep_favorites   boolean not null default true,
  default_view             text not null default 'all' check (default_view in ('all', 'unread')),
  mark_read_on_open        boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on column public.rss_settings.cleanup_mode is 'off = kein Aufräumen · read = nur gelesene löschen · all = alle löschen (nach cleanup_after_days).';
comment on column public.rss_settings.cleanup_keep_favorites is 'true = Favoriten werden nie automatisch gelöscht.';

create trigger rss_settings_set_updated_at
  before update on public.rss_settings
  for each row execute function public.set_updated_at();

alter table public.rss_settings enable row level security;

create policy "rss_settings_owner_all"
  on public.rss_settings for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
