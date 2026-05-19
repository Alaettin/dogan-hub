import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { FileRow } from "../files/useFiles";

export interface AttachedFile extends FileRow {
  attached_at: string;
}

const KEY = "entry-files";

export function useEntryFiles(entryId: string | undefined) {
  return useQuery<AttachedFile[]>({
    queryKey: [KEY, entryId],
    queryFn: async () => {
      const data = await apiFetch<{ items: AttachedFile[] }>(
        `/entries/${entryId}/files`,
      );
      return data.items;
    },
    enabled: !!entryId,
    staleTime: 15_000,
  });
}

export function useAttachFile(entryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await apiFetch(`/entries/${entryId}/files`, {
        method: "POST",
        body: JSON.stringify({ file_id: fileId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, entryId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDetachFile(entryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await apiFetch(`/entries/${entryId}/files/${fileId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, entryId] });
    },
  });
}
