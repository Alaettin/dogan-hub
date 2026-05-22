import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export type ListingStatus = "active" | "sold" | "cancelled";

export interface Platform {
  id: string;
  owner_id: string;
  name: string;
  url: string | null;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformWithStats extends Platform {
  active: number;
  sold: number;
  revenue: number;
  active_value: number;
}

export interface Listing {
  id: string;
  platform_id: string;
  owner_id: string;
  title: string;
  price: number;
  quantity: number;
  purchase_price: number | null;
  fees: number | null;
  condition: string | null;
  category: string | null;
  item_url: string | null;
  image_url: string | null;
  notes: string | null;
  status: ListingStatus;
  listed_at: string;
  sold_at: string | null;
  sold_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface MonthPoint {
  month: string;
  revenue: number;
  profit: number;
  sold_count: number;
}

export interface Stats {
  listings: number;
  active: number;
  sold: number;
  cancelled: number;
  active_value: number;
  revenue: number;
  cost: number;
  profit: number;
  avg_sale_price: number;
  sell_through: number;
  revenue_by_month: MonthPoint[];
}

export interface GlobalStats extends Stats {
  platforms: number;
  by_platform: {
    platform_id: string;
    name: string;
    color: string | null;
    active: number;
    sold: number;
    active_value: number;
    revenue: number;
    profit: number;
  }[];
}

export interface CreateListingInput {
  title: string;
  price: number;
  quantity?: number;
  purchase_price?: number | null;
  fees?: number | null;
  condition?: string | null;
  category?: string | null;
  item_url?: string | null;
  image_url?: string | null;
  notes?: string | null;
  status?: ListingStatus;
  listed_at?: string;
  sold_at?: string | null;
  sold_price?: number | null;
}

const KEY = "shop";

// ─── Queries ─────────────────────────────────────────────────────────
export function usePlatforms() {
  return useQuery<PlatformWithStats[]>({
    queryKey: [KEY, "platforms"],
    queryFn: async () =>
      (await apiFetch<{ items: PlatformWithStats[] }>("/shop/platforms")).items,
    staleTime: 30_000,
  });
}

export function usePlatform(id: string | undefined) {
  return useQuery<Platform>({
    queryKey: [KEY, "platform", id],
    queryFn: async () => (await apiFetch<{ platform: Platform }>(`/shop/platforms/${id}`)).platform,
    enabled: !!id,
  });
}

export function useListings(platformId: string | undefined, status?: ListingStatus | "") {
  return useQuery<Listing[]>({
    queryKey: [KEY, "listings", platformId, status ?? ""],
    queryFn: async () => {
      const qs = status ? `?status=${status}` : "";
      return (
        await apiFetch<{ items: Listing[] }>(`/shop/platforms/${platformId}/listings${qs}`)
      ).items;
    },
    enabled: !!platformId,
    staleTime: 15_000,
  });
}

export function useGlobalStats() {
  return useQuery<GlobalStats>({
    queryKey: [KEY, "stats", "global"],
    queryFn: () => apiFetch<GlobalStats>("/shop/stats"),
    staleTime: 30_000,
  });
}

export function usePlatformStats(id: string | undefined) {
  return useQuery<Stats>({
    queryKey: [KEY, "stats", "platform", id],
    queryFn: () => apiFetch<Stats>(`/shop/platforms/${id}/stats`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ─── Plattform-Mutationen ────────────────────────────────────────────
interface PlatformInput {
  name: string;
  url?: string | null;
  color?: string | null;
  notes?: string | null;
}

export function useCreatePlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlatformInput) =>
      (await apiFetch<{ platform: Platform }>("/shop/platforms", {
        method: "POST",
        body: JSON.stringify(input),
      })).platform,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdatePlatform(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PlatformInput>) =>
      (await apiFetch<{ platform: Platform }>(`/shop/platforms/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })).platform,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeletePlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/shop/platforms/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ─── Inserat-Mutationen ──────────────────────────────────────────────
export function useCreateListing(platformId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateListingInput) =>
      (await apiFetch<{ listing: Listing }>(`/shop/platforms/${platformId}/listings`, {
        method: "POST",
        body: JSON.stringify(input),
      })).listing,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateListingInput>) =>
      (await apiFetch<{ listing: Listing }>(`/shop/listings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })).listing,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSellListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      sold_price,
      sold_at,
    }: {
      id: string;
      sold_price: number;
      sold_at?: string;
    }) =>
      (await apiFetch<{ listing: Listing }>(`/shop/listings/${id}/sell`, {
        method: "POST",
        body: JSON.stringify({ sold_price, sold_at }),
      })).listing,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/shop/listings/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
