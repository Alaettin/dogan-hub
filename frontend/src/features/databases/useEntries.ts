import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface Entry {
  id: string;
  database_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EntryListResult {
  items: Entry[];
  total: number;
  limit: number;
  offset: number;
}

const KEY = "entries";

export function useEntries(databaseId: string | undefined, limit = 50, offset = 0) {
  return useQuery<EntryListResult>({
    queryKey: [KEY, "list", databaseId, { limit, offset }],
    queryFn: () =>
      apiFetch<EntryListResult>(
        `/databases/${databaseId}/entries?limit=${limit}&offset=${offset}`,
      ),
    enabled: !!databaseId,
    staleTime: 15_000,
  });
}

export function useEntry(id: string | undefined) {
  return useQuery<Entry>({
    queryKey: [KEY, "detail", id],
    queryFn: async () => {
      const data = await apiFetch<{ entry: Entry }>(`/entries/${id}`);
      return data.entry;
    },
    enabled: !!id,
  });
}

export function useCreateEntry(databaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiFetch<{ entry: Entry }>(`/databases/${databaseId}/entries`, {
        method: "POST",
        body: JSON.stringify({ data }),
      });
      return res.entry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "list", databaseId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateEntry(entryId: string, databaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiFetch<{ entry: Entry }>(`/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ data }),
      });
      return res.entry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "list", databaseId] });
      qc.invalidateQueries({ queryKey: [KEY, "detail", entryId] });
    },
  });
}

export function useDeleteEntry(entryId: string, databaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiFetch(`/entries/${entryId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "list", databaseId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
