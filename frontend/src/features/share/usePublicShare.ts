import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface PublicShareMeta {
  folder: { id: string; name: string; path: string };
  permission: "read" | "edit";
  expires_at: string;
}

export interface PublicFolder {
  id: string;
  parent_id: string | null;
  name: string;
  path: string;
}

export interface PublicFile {
  id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

const KEY = "public-share";

export function usePublicShare(token: string | undefined) {
  return useQuery<PublicShareMeta>({
    queryKey: [KEY, token],
    queryFn: async () => apiFetch<PublicShareMeta>(`/public/shares/${token}`),
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  });
}

export function usePublicFolders(token: string | undefined, parentId: string | null | undefined) {
  return useQuery<PublicFolder[]>({
    queryKey: [KEY, "folders", token, parentId ?? "root"],
    queryFn: async () => {
      const qs = parentId ? `?parent_id=${parentId}` : "";
      const data = await apiFetch<{ items: PublicFolder[] }>(
        `/public/shares/${token}/folders${qs}`,
      );
      return data.items;
    },
    enabled: !!token,
    staleTime: 15_000,
  });
}

export function usePublicFiles(token: string | undefined, folderId: string | null | undefined) {
  return useQuery<PublicFile[]>({
    queryKey: [KEY, "files", token, folderId ?? "root"],
    queryFn: async () => {
      const qs = folderId ? `?folder_id=${folderId}` : "";
      const data = await apiFetch<{ items: PublicFile[] }>(
        `/public/shares/${token}/files${qs}`,
      );
      return data.items;
    },
    enabled: !!token,
    staleTime: 15_000,
  });
}

export function usePublicDownload(token: string) {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const data = await apiFetch<{ url: string }>(
        `/public/shares/${token}/files/${fileId}/download`,
        { method: "POST" },
      );
      return data.url;
    },
  });
}

interface UploadInput {
  filename: string;
  mime_type: string;
  size_bytes: number;
  folder_id?: string;
}

export function usePublicUpload(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId: string | null }) => {
      const body: UploadInput = {
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        ...(folderId ? { folder_id: folderId } : {}),
      };
      const signed = await apiFetch<{ file_id: string; signed_url: string; token: string; path: string }>(
        `/public/shares/${token}/sign-upload`,
        { method: "POST", body: JSON.stringify(body) },
      );
      // Direct upload to Supabase Storage via signed URL.
      const putRes = await fetch(signed.signed_url, {
        method: "PUT",
        headers: { "Content-Type": body.mime_type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      await apiFetch(`/public/shares/${token}/files/${signed.file_id}/commit`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      return signed.file_id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "files", token] });
    },
  });
}

export function usePublicCreateFolder(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId: string | null }) => {
      return apiFetch<{ folder: PublicFolder }>(`/public/shares/${token}/folders`, {
        method: "POST",
        body: JSON.stringify({ name, ...(parentId ? { parent_id: parentId } : {}) }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "folders", token] });
    },
  });
}

export function usePublicDeleteFile(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await apiFetch(`/public/shares/${token}/files/${fileId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "files", token] });
    },
  });
}

export function usePublicDeleteFolder(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderId: string) => {
      await apiFetch(`/public/shares/${token}/folders/${folderId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
