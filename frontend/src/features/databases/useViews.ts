import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { ViewConfig, ViewType } from "./view-types";

export interface SavedView {
  id: string;
  database_id: string;
  name: string;
  view_type: ViewType;
  config: Omit<ViewConfig, "view_type">;
  is_default: boolean;
  created_at: string;
}

export interface CreateViewInput {
  name: string;
  view_type: ViewType;
  config: Omit<ViewConfig, "view_type">;
  is_default?: boolean;
}

const KEY = "views";

export function useViews(databaseId: string | undefined) {
  return useQuery<SavedView[]>({
    queryKey: [KEY, "list", databaseId],
    queryFn: async () => {
      const data = await apiFetch<{ items: SavedView[] }>(
        `/databases/${databaseId}/views`,
      );
      return data.items;
    },
    enabled: !!databaseId,
    staleTime: 30_000,
  });
}

export function useCreateView(databaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateViewInput) => {
      const data = await apiFetch<{ view: SavedView }>(
        `/databases/${databaseId}/views`,
        { method: "POST", body: JSON.stringify(input) },
      );
      return data.view;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "list", databaseId] });
    },
  });
}

export function useUpdateView(viewId: string, databaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CreateViewInput>) => {
      const data = await apiFetch<{ view: SavedView }>(`/database-views/${viewId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      return data.view;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "list", databaseId] });
    },
  });
}

export function useDeleteView(viewId: string, databaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiFetch(`/database-views/${viewId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "list", databaseId] });
    },
  });
}
