import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface Folder {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderInput {
  name: string;
  parent_id?: string | null;
}

export interface UpdateFolderInput {
  name?: string;
  parent_id?: string | null;
}

const KEY = "folders";

export function useFolders() {
  return useQuery<Folder[]>({
    queryKey: [KEY, "list"],
    queryFn: async () => {
      const data = await apiFetch<{ items: Folder[] }>("/folders");
      return data.items;
    },
    staleTime: 30_000,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFolderInput) => {
      const data = await apiFetch<{ folder: Folder }>("/folders", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.folder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateFolder(folderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateFolderInput) => {
      const data = await apiFetch<{ folder: Folder }>(`/folders/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      return data.folder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDeleteFolder(folderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiFetch(`/folders/${folderId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
