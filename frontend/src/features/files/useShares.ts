import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface FolderShare {
  id: string;
  folder_id: string;
  owner_id: string;
  token: string;
  permission: "read" | "edit";
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface CreateShareInput {
  permission: "read" | "edit";
  ttl_sec: number;
}

const KEY = "shares";

export function useFolderShares(folderId: string | undefined) {
  return useQuery<FolderShare[]>({
    queryKey: [KEY, "folder", folderId],
    queryFn: async () => {
      if (!folderId) return [];
      const data = await apiFetch<{ items: FolderShare[] }>(
        `/folders/${folderId}/shares`,
      );
      return data.items;
    },
    enabled: !!folderId,
    staleTime: 15_000,
  });
}

export function useCreateShare(folderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateShareInput) => {
      return apiFetch<FolderShare>(`/folders/${folderId}/shares`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useRevokeShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shareId: string) => {
      await apiFetch(`/folders/shares/${shareId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

// TTL-Presets für den Dialog. Server-Cap: 7 Tage.
export const TTL_PRESETS = [
  { label: "1 Stunde", sec: 3_600 },
  { label: "24 Stunden", sec: 24 * 3_600 },
  { label: "3 Tage", sec: 3 * 24 * 3_600 },
  { label: "7 Tage", sec: 7 * 24 * 3_600 },
] as const;
