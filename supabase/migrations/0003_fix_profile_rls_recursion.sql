-- =====================================================================
-- 0003_fix_profile_rls_recursion.sql
--
-- Entfernt die rekursiven Admin-SELECT-Policies aus 0001 + 0002.
-- Problem: profiles_select_admin macht ein "EXISTS (... FROM profiles)",
-- was Postgres als infinite recursion erkennt — ganze Query schlägt
-- silently fehl, PostgREST returnt leeres data, Backend wirft 404.
--
-- Proper Admin-Policies kommen in Etappe 4 via JWT-claim oder
-- SECURITY DEFINER helper-function (Supabase-Empfehlung).
-- =====================================================================

drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "audit_log_select_admin" on public.audit_log;
