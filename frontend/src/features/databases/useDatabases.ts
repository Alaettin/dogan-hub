import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface DatabaseListItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldDefinition {
  id: string;
  key: string;
  label: string;
  type: string;
  required?: boolean;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  visible_in_table?: boolean;
  position?: number;
}

export interface Database extends DatabaseListItem {
  schema: FieldDefinition[];
  owner_id: string;
}

export interface CreateDatabaseInput {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  schema?: FieldDefinition[];
  template_key?: string;
}

export interface UpdateDatabaseInput {
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  schema?: FieldDefinition[];
}

const KEY = "databases";

export function useDatabases(archived = false) {
  return useQuery<DatabaseListItem[]>({
    queryKey: [KEY, "list", { archived }],
    queryFn: async () => {
      const data = await apiFetch<{ items: DatabaseListItem[] }>(
        `/databases?archived=${archived}`,
      );
      return data.items;
    },
    staleTime: 30_000,
  });
}

export function useDatabase(id: string | undefined) {
  return useQuery<Database>({
    queryKey: [KEY, "detail", id],
    queryFn: async () => {
      if (!id) throw new Error("missing id");
      const data = await apiFetch<{ database: Database }>(`/databases/${id}`);
      return data.database;
    },
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreateDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDatabaseInput) => {
      const data = await apiFetch<{ database: Database }>("/databases", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.database;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateDatabase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDatabaseInput) => {
      const data = await apiFetch<{ database: Database }>(`/databases/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      return data.database;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useArchiveDatabase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (archived: boolean) => {
      const data = await apiFetch<{ database: Database }>(`/databases/${id}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived }),
      });
      return data.database;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDuplicateDatabase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name?: string) => {
      const data = await apiFetch<{ database: Database }>(`/databases/${id}/duplicate`, {
        method: "POST",
        body: JSON.stringify(name ? { name } : {}),
      });
      return data.database;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDeleteDatabase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiFetch(`/databases/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
