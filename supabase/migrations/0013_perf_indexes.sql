-- =====================================================================
-- 0013_perf_indexes.sql
-- Zusätzliche Indizes für häufige Queries (Audit Phase 1).
-- Alle idempotent (IF NOT EXISTS).
-- =====================================================================

-- Notizen-Liste: Sortierung nach updated_at je Owner (ohne pinned-Prefix).
create index if not exists notes_owner_updated_idx
  on public.notes (owner_id, updated_at desc);

-- Kanban: Board-Detail (cards je Board) + /tasks (fällige Karten).
create index if not exists kanban_cards_board_idx
  on public.kanban_cards (board_id);
create index if not exists kanban_cards_board_due_idx
  on public.kanban_cards (board_id, due_date)
  where due_date is not null;

-- Kalender: Range-Queries über start_at/end_at je Owner.
create index if not exists calendar_events_owner_range_idx
  on public.calendar_events (owner_id, start_at, end_at);

-- Entry-Files: Lookup nach entry_id (bisher nur file_id indiziert).
create index if not exists entry_files_entry_idx
  on public.entry_files (entry_id);
