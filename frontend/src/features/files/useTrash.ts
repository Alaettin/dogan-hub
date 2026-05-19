import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { FileRow } from "./useFiles";

export interface TrashedFile extends FileRow {
  deleted_at: string;
}

const KEY = "trash";

export function useTrashedFiles() {
  return useQuery<TrashedFile[]>({
    queryKey: [KEY, "list"],
    queryFn: async () => {
      const data = await apiFetch<{ items: TrashedFile[] }>("/files/trash");
      return data.items;
    },
    staleTime: 15_000,
  });
}

export function useRestoreFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      const data = await apiFetch<{ file: FileRow }>(`/files/${fileId}/restore`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      return data.file;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function usePurgeFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await apiFetch(`/files/${fileId}/purge`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useEmptyTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await apiFetch<{ purged: number }>("/files/trash/empty", {
        method: "POST",
        body: JSON.stringify({}),
      });
      return data.purged;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
