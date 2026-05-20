-- =====================================================================
-- 0010_init_calendar_events.sql
-- Kalender-Modul: eigene Tabelle mit echten Timestamp-Spalten + Index.
-- Recurrence-Regel wird einmal gespeichert, Expansion macht das Frontend.
-- =====================================================================

create table public.calendar_events (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles(id) on delete cascade,
  title                 text not null,
  description           text,
  location              text,
  start_at              timestamptz not null,
  end_at                timestamptz,
  all_day               boolean not null default false,
  color                 text,
  category              text,
  recurrence_freq       text check (recurrence_freq in ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_interval   int not null default 1,
  recurrence_until      timestamptz,
  remind_minutes_before int,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.calendar_events is 'Kalender-Termine. recurrence_freq=null → Einmal-Termin. Occurrences werden clientseitig expandiert.';

create index calendar_events_owner_start_idx on public.calendar_events (owner_id, start_at);
create index calendar_events_recurring_idx on public.calendar_events (owner_id)
  where recurrence_freq is not null;

create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row
  execute function public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.calendar_events enable row level security;

create policy "calendar_events_owner_all"
  on public.calendar_events
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
