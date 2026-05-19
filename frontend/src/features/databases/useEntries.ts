import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { FilterCondition } from "./view-types";

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

export interface EntryListParams {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  filters?: FilterCondition[];
}

const KEY = "entries";

function buildEntryQuery(params: EntryListParams): string {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit ?? 50));
  sp.set("offset", String(params.offset ?? 0));
  if (params.sort) sp.set("sort", params.sort);
  if (params.order) sp.set("order", params.order);
  if (params.search && params.search.trim()) sp.set("search", params.search.trim());
  if (params.filters && params.filters.length > 0) {
    sp.set("filter", JSON.stringify(params.filters));
  }
  return sp.toString();
}

export function useEntries(databaseId: string | undefined, params: EntryListParams = {}) {
  return useQuery<EntryListResult>({
    queryKey: [KEY, "list", databaseId, params],
    queryFn: () =>
      apiFetch<EntryListResult>(
        `/databases/${databaseId}/entries?${buildEntryQuery(params)}`,
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
