import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { supabase } from "../../lib/supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

// ─── Typen ───────────────────────────────────────────────────────────
export type FeedStatus = "active" | "paused" | "error";

export interface RssFolder {
  id: string;
  owner_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface RssFeed {
  id: string;
  owner_id: string;
  folder_id: string | null;
  feed_url: string;
  site_url: string | null;
  title: string;
  description: string | null;
  favicon_url: string | null;
  status: FeedStatus;
  last_fetched_at: string | null;
  last_error: string | null;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface RssItem {
  id: string;
  feed_id: string;
  owner_id: string;
  guid: string;
  title: string;
  link: string | null;
  author: string | null;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  published_at: string | null;
  is_read: boolean;
  is_favorite: boolean;
  fetched_at: string;
  created_at: string;
}

export interface UnreadCount {
  feed_id: string;
  unread: number;
}

export interface LatestItem {
  id: string;
  feed_id: string;
  title: string;
  link: string | null;
  image_url: string | null;
  published_at: string | null;
  is_read: boolean;
}

export interface ItemsFilter {
  feedId?: string;
  folderId?: string;
  unread?: boolean;
  favorite?: boolean;
  search?: string;
}

export type CleanupMode = "off" | "read" | "all";
export type DefaultView = "all" | "unread";

export interface RssSettings {
  owner_id: string;
  refresh_interval_minutes: number;
  cleanup_mode: CleanupMode;
  cleanup_after_days: number;
  cleanup_keep_favorites: boolean;
  default_view: DefaultView;
  mark_read_on_open: boolean;
  created_at?: string;
  updated_at?: string;
}

export type UpdateRssSettingsInput = Partial<
  Pick<
    RssSettings,
    | "refresh_interval_minutes"
    | "cleanup_mode"
    | "cleanup_after_days"
    | "cleanup_keep_favorites"
    | "default_view"
    | "mark_read_on_open"
  >
>;

const KEY = "rss";

// ─── Queries ─────────────────────────────────────────────────────────
export function useFolders() {
  return useQuery<RssFolder[]>({
    queryKey: [KEY, "folders"],
    queryFn: async () => (await apiFetch<{ items: RssFolder[] }>("/rss/folders")).items,
    staleTime: 60_000,
  });
}

export function useFeeds(folderId?: string) {
  return useQuery<RssFeed[]>({
    queryKey: [KEY, "feeds", folderId ?? "all"],
    queryFn: async () =>
      (
        await apiFetch<{ items: RssFeed[] }>(
          `/rss/feeds${folderId ? `?folder_id=${folderId}` : ""}`,
        )
      ).items,
    staleTime: 60_000,
  });
}

export function useUnreadCounts() {
  return useQuery<Record<string, number>>({
    queryKey: [KEY, "unread-counts"],
    queryFn: async () => {
      const { items } = await apiFetch<{ items: UnreadCount[] }>("/rss/unread-counts");
      const map: Record<string, number> = {};
      for (const c of items) map[c.feed_id] = Number(c.unread);
      return map;
    },
    staleTime: 30_000,
  });
}

function buildItemsQuery(filter: ItemsFilter): string {
  const params = new URLSearchParams();
  if (filter.feedId) params.set("feed_id", filter.feedId);
  if (filter.folderId) params.set("folder_id", filter.folderId);
  if (filter.unread) params.set("unread", "true");
  if (filter.favorite) params.set("favorite", "true");
  if (filter.search?.trim()) params.set("search", filter.search.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useItems(filter: ItemsFilter) {
  return useQuery<RssItem[]>({
    queryKey: [KEY, "items", filter],
    queryFn: async () =>
      (await apiFetch<{ items: RssItem[] }>(`/rss/items${buildItemsQuery(filter)}`)).items,
    staleTime: 15_000,
  });
}

export function useLatestItems(limit = 5) {
  return useQuery<LatestItem[]>({
    queryKey: [KEY, "latest", limit],
    queryFn: async () =>
      (await apiFetch<{ items: LatestItem[] }>(`/rss/items/latest?limit=${limit}`)).items,
    staleTime: 30_000,
  });
}

// ─── Feed-Mutationen ─────────────────────────────────────────────────
export function useAddFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { feed_url: string; folder_id?: string | null; title?: string }) =>
      (
        await apiFetch<{ feed: RssFeed }>("/rss/feeds", {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).feed,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      folder_id?: string | null;
      status?: "active" | "paused";
    }) =>
      (
        await apiFetch<{ feed: RssFeed }>(`/rss/feeds/${id}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).feed,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "feeds"] }),
  });
}

export function useDeleteFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/rss/feeds/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRefreshFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      await apiFetch<{ feed: RssFeed; inserted: number }>(`/rss/feeds/${id}/refresh`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ─── Ordner-Mutationen ───────────────────────────────────────────────
export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (
        await apiFetch<{ folder: RssFolder }>("/rss/folders", {
          method: "POST",
          body: JSON.stringify({ name }),
        })
      ).folder,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "folders"] }),
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      (
        await apiFetch<{ folder: RssFolder }>(`/rss/folders/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        })
      ).folder,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "folders"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/rss/folders/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ─── Artikel-Mutationen ──────────────────────────────────────────────
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      is_read?: boolean;
      is_favorite?: boolean;
    }) =>
      (
        await apiFetch<{ item: RssItem }>(`/rss/items/${id}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).item,
    // Optimistisches Update auf alle geladenen Item-Listen.
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: [KEY, "items"] });
      const snapshots = qc.getQueriesData<RssItem[]>({ queryKey: [KEY, "items"] });
      for (const [qk, list] of snapshots) {
        if (!list) continue;
        qc.setQueryData<RssItem[]>(
          qk,
          list.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        );
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshots.forEach(([qk, list]) => qc.setQueryData(qk, list));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [KEY, "items"] });
      qc.invalidateQueries({ queryKey: [KEY, "unread-counts"] });
      qc.invalidateQueries({ queryKey: [KEY, "latest"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scope: { feed_id?: string; folder_id?: string }) =>
      await apiFetch<{ updated: number }>("/rss/items/mark-all-read", {
        method: "POST",
        body: JSON.stringify(scope),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useImportOpml() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opml: string) =>
      await apiFetch<{ foldersCreated: number; feedsCreated: number; feedsSkipped: number }>(
        "/rss/opml/import",
        { method: "POST", body: JSON.stringify({ opml }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ─── Einstellungen ───────────────────────────────────────────────────
export function useRssSettings() {
  return useQuery<RssSettings>({
    queryKey: [KEY, "settings"],
    queryFn: async () => (await apiFetch<{ settings: RssSettings }>("/rss/settings")).settings,
    staleTime: 60_000,
  });
}

export function useUpdateRssSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRssSettingsInput) =>
      (
        await apiFetch<{ settings: RssSettings }>("/rss/settings", {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).settings,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: [KEY, "settings"] });
      const prev = qc.getQueryData<RssSettings>([KEY, "settings"]);
      if (prev) qc.setQueryData<RssSettings>([KEY, "settings"], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData([KEY, "settings"], ctx.prev);
    },
    onSuccess: (settings) => qc.setQueryData([KEY, "settings"], settings),
  });
}

// OPML-Export: authentifizierter Download als Datei.
export async function downloadOpml(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API_BASE}/rss/opml/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export fehlgeschlagen");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "myhub-feeds.opml";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
