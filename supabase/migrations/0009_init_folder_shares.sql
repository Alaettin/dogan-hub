-- =====================================================================
-- 0009_init_folder_shares.sql
-- Folder-Sharing per Link: Owner kann einen Folder mit Externen teilen,
-- TTL ≤ 7 Tage, Berechtigung read | edit.
-- =====================================================================

create table public.folder_shares (
  id          uuid primary key default gen_random_uuid(),
  folder_id   uuid not null references public.folders(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  token       text not null unique,
  permission  text not null check (permission in ('read', 'edit')),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.folder_shares is 'Public Folder-Freigaben mit Token + TTL. Edit-Permission erlaubt Sub-Tree-Manipulation, nicht aber den Wurzel-Folder selbst.';

create index folder_shares_token_idx on public.folder_shares (token);
create index folder_shares_owner_idx on public.folder_shares (owner_id, created_at desc);
create index folder_shares_folder_idx on public.folder_shares (folder_id);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.folder_shares enable row level security;

-- Owner sieht/verwaltet nur eigene Shares.
-- Public-Endpoints umgehen RLS bewusst via Service-Role
-- (Token wird in TypeScript validiert, RLS würde nur stören).
create policy "folder_shares_owner_all"
  on public.folder_shares
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
