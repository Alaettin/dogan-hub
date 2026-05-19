import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface DatabaseHit {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
}

export interface FolderHit {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
}

export interface EntryHit {
  id: string;
  database_id: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface FileHit {
  id: string;
  name: string;
  mime_type: string;
  folder_id: string | null;
  size_bytes: number;
  created_at: string;
}

export interface SearchResult {
  databases: DatabaseHit[];
  folders: FolderHit[];
  entries: EntryHit[];
  files: FileHit[];
}

export function useGlobalSearch(query: string, limit = 5) {
  const q = query.trim();
  return useQuery<SearchResult>({
    queryKey: ["search", q, limit],
    queryFn: () =>
      apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    enabled: q.length > 0,
    staleTime: 10_000,
  });
}
