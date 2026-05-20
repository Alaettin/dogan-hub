import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface KanbanLabel {
  name: string;
  color: string;
}

export interface Board {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  owner_id: string;
  name: string;
  color: string | null;
  position: number;
}

export interface Card {
  id: string;
  column_id: string;
  board_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  color: string | null;
  due_date: string | null;
  labels: KanbanLabel[];
  position: number;
}

export interface BoardListItem extends Board {
  column_count: number;
  card_count: number;
  overdue_count: number;
}

export interface BoardDetail {
  board: Board;
  columns: Column[];
  cards: Card[];
}

export interface UpcomingTask {
  id: string;
  title: string;
  due_date: string;
  color: string | null;
  board_id: string;
  board_name: string;
}

const KEY = "kanban";

export function useUpcomingTasks() {
  return useQuery<UpcomingTask[]>({
    queryKey: [KEY, "tasks"],
    queryFn: async () => (await apiFetch<{ items: UpcomingTask[] }>("/kanban/tasks")).items,
    staleTime: 30_000,
  });
}

// ─── Boards ──────────────────────────────────────────────────────────
export function useBoards() {
  return useQuery<BoardListItem[]>({
    queryKey: [KEY, "list"],
    queryFn: async () => (await apiFetch<{ items: BoardListItem[] }>("/kanban/boards")).items,
    staleTime: 30_000,
  });
}

export function useBoard(id: string | undefined) {
  return useQuery<BoardDetail>({
    queryKey: [KEY, "board", id],
    queryFn: async () => apiFetch<BoardDetail>(`/kanban/boards/${id}`),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string | null }) =>
      (await apiFetch<{ board: Board }>("/kanban/boards", {
        method: "POST",
        body: JSON.stringify(input),
      })).board,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "list"] }),
  });
}

export function useUpdateBoard(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Pick<Board, "name" | "description" | "color">>) =>
      (await apiFetch<{ board: Board }>(`/kanban/boards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })).board,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "board", id] });
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/kanban/boards/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ─── Columns ─────────────────────────────────────────────────────────
export function useCreateColumn(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string | null }) =>
      (await apiFetch<{ column: Column }>(`/kanban/boards/${boardId}/columns`, {
        method: "POST",
        body: JSON.stringify(input),
      })).column,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateColumn(_boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string } & Partial<Pick<Column, "name" | "color" | "position">>) =>
      (await apiFetch<{ column: Column }>(`/kanban/columns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })).column,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteColumn(_boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/kanban/columns/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ─── Cards ───────────────────────────────────────────────────────────
export interface CardInput {
  title?: string;
  description?: string | null;
  color?: string | null;
  due_date?: string | null;
  labels?: KanbanLabel[];
}

export function useCreateCard(_boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ columnId, ...input }: { columnId: string } & CardInput) =>
      (await apiFetch<{ card: Card }>(`/kanban/columns/${columnId}/cards`, {
        method: "POST",
        body: JSON.stringify(input),
      })).card,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCard(_boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string } & CardInput & { column_id?: string; position?: number }) =>
      (await apiFetch<{ card: Card }>(`/kanban/cards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })).card,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCard(_boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/kanban/cards/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// Move/Reorder ohne Refetch-Flackern: Cache direkt patchen, dann PATCH feuern.
// Bei Fehler invalidieren wir (Rollback auf Serverstand).
export function useReorder(boardId: string) {
  const qc = useQueryClient();

  function patchCache(updater: (prev: BoardDetail) => BoardDetail) {
    qc.setQueryData<BoardDetail>([KEY, "board", boardId], (prev) =>
      prev ? updater(prev) : prev,
    );
  }

  async function persistCard(id: string, body: { column_id?: string; position: number }) {
    try {
      await apiFetch(`/kanban/cards/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    } catch {
      qc.invalidateQueries({ queryKey: [KEY, "board", boardId] });
    }
  }

  async function persistColumn(id: string, position: number) {
    try {
      await apiFetch(`/kanban/columns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ position }),
      });
    } catch {
      qc.invalidateQueries({ queryKey: [KEY, "board", boardId] });
    }
  }

  return { patchCache, persistCard, persistColumn };
}
