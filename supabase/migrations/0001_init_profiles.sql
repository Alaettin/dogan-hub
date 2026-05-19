-- =====================================================================
-- 0001_init_profiles.sql
-- profiles-Tabelle als Erweiterung von auth.users + Trigger + RLS
-- =====================================================================

-- ─── Tabelle ─────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  role          text not null default 'user' check (role in ('admin', 'user')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Erweitert auth.users um App-spezifische Felder. 1:1 via id.';

-- updated_at automatisch pflegen
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ─── Auto-Profile bei neuem auth.user ────────────────────────────────
-- SECURITY DEFINER, damit Trigger profiles INSERT darf trotz RLS.
-- Erster User wird automatisch admin.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
  resolved_display_name text;
begin
  select count(*) = 0 into is_first_user from public.profiles;

  resolved_display_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    resolved_display_name,
    case when is_first_user then 'admin' else 'user' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- SELECT: eigenes Profil
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- SELECT: Admins sehen alle Profile
create policy "profiles_select_admin"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- UPDATE: eigenes Profil (display_name, avatar_url)
-- role kann nicht via UPDATE-Policy beschränkt werden — wir verlassen uns auf
-- ein separates Admin-Endpoint, das mit Service-Role-Key role setzt.
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT/DELETE: nur via Trigger / Service-Role (keine Policy = Deny by default)
