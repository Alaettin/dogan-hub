import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export type NoteType = "text" | "checklist" | "list";

export interface NoteItem {
  text: string;
  done?: boolean;
}

export interface Note {
  id: string;
  owner_id: string;
  type: NoteType;
  title: string;
  body: string;
  items: NoteItem[];
  pinned: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export type NoteListItem = Note;

export interface NotesFilter {
  search?: string;
  type?: NoteType | "";
  pinned?: boolean;
}

export interface CreateNoteInput {
  type: NoteType;
  title?: string;
  body?: string;
  items?: NoteItem[];
  pinned?: boolean;
}

export type UpdateNoteInput = Partial<
  Pick<Note, "type" | "title" | "body" | "items" | "pinned" | "position">
>;

const KEY = "notes";

function buildQuery(filter?: NotesFilter): string {
  if (!filter) return "";
  const params = new URLSearchParams();
  if (filter.search?.trim()) params.set("search", filter.search.trim());
  if (filter.type) params.set("type", filter.type);
  if (filter.pinned) params.set("pinned", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useNotes(filter?: NotesFilter) {
  return useQuery<NoteListItem[]>({
    queryKey: [KEY, "list", filter ?? {}],
    queryFn: async () =>
      (await apiFetch<{ items: NoteListItem[] }>(`/notes${buildQuery(filter)}`)).items,
    staleTime: 30_000,
  });
}

export function useNote(id: string | undefined) {
  return useQuery<Note>({
    queryKey: [KEY, "detail", id],
    queryFn: async () => (await apiFetch<{ note: Note }>(`/notes/${id}`)).note,
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoteInput) =>
      (
        await apiFetch<{ note: Note }>("/notes", {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).note,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "list"] }),
  });
}

export function useUpdateNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateNoteInput) =>
      (
        await apiFetch<{ note: Note }>(`/notes/${id}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).note,
    onSuccess: (note) => {
      qc.setQueryData([KEY, "detail", id], note);
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useSetPinned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) =>
      (
        await apiFetch<{ note: Note }>(`/notes/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ pinned }),
        })
      ).note,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/notes/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
