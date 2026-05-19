import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface FileRow {
  id: string;
  owner_id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface FileListResult {
  items: FileRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface SignUploadInput {
  filename: string;
  mime_type: string;
  size_bytes: number;
  folder_id?: string | null;
  checksum_sha256?: string;
}

export interface SignUploadResult {
  file_id: string;
  signed_url: string;
  token: string;
  path: string;
}

const KEY = "files";

export function useFiles(folderId: string | null | undefined) {
  return useQuery<FileListResult>({
    queryKey: [KEY, "list", folderId ?? null],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (folderId) sp.set("folder_id", folderId);
      sp.set("limit", "100");
      sp.set("offset", "0");
      return apiFetch<FileListResult>(`/files?${sp.toString()}`);
    },
    staleTime: 15_000,
  });
}

export function useSignUpload() {
  return useMutation({
    mutationFn: async (input: SignUploadInput) => {
      const data = await apiFetch<SignUploadResult>("/files/sign-upload", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data;
    },
  });
}

export function useCommitFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await apiFetch(`/files/${fileId}/commit`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const data = await apiFetch<{ url: string }>(`/files/${fileId}/download`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      return data.url;
    },
  });
}

export function useUpdateFile(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string; folder_id?: string | null }) => {
      const data = await apiFetch<{ file: FileRow }>(`/files/${fileId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      return data.file;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await apiFetch(`/files/${fileId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
