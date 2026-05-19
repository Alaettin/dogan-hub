-- =====================================================================
-- 0002_init_audit.sql
-- audit_log: persistente Spur jedes Write-Zugriffs auf User-Daten
-- =====================================================================

create table public.audit_log (
  id            bigserial primary key,
  user_id       uuid references public.profiles(id) on delete set null,
  action        text not null check (action in ('create', 'update', 'delete', 'login', 'logout')),
  resource_type text not null,
  resource_id   text,
  metadata      jsonb,
  ip_hash       text,
  created_at    timestamptz not null default now()
);

comment on table public.audit_log is 'Append-only Log aller Write-Ops. Retention 1 Jahr (PLAN §4 Logging).';

-- Index für "letzte N Aktivitäten von User X" (Dashboard) und Admin-View
create index audit_log_user_created_idx on public.audit_log (user_id, created_at desc);
create index audit_log_resource_idx on public.audit_log (resource_type, resource_id);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.audit_log enable row level security;

-- SELECT: eigene Einträge
create policy "audit_log_select_own"
  on public.audit_log
  for select
  using (auth.uid() = user_id);

-- SELECT: Admins sehen alle
create policy "audit_log_select_admin"
  on public.audit_log
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- INSERT: nur Service-Role (Backend schreibt mit SERVICE_ROLE_KEY → umgeht RLS).
-- Keine Policy für INSERT = Default Deny für normale User.
-- UPDATE/DELETE: niemals (Append-Only).
