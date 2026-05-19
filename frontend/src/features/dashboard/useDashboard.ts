import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface DashboardStats {
  user: { id: string; email: string; display_name: string; role: "admin" | "user" };
  last_login: string | null;
  modules: Record<string, { status: "active" | "coming_soon"; eta?: string }>;
  storage: { used_bytes: number; limit_bytes: number; items: number };
  counts: { audit_entries: number; databases: number; entries: number; files: number };
}

export interface ActivityItem {
  id: number;
  action: "create" | "update" | "delete" | "login" | "logout";
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: () => apiFetch<DashboardStats>("/dashboard/stats"),
    staleTime: 30_000,
  });
}

export function useDashboardActivity(limit = 20) {
  return useQuery<{ items: ActivityItem[] }>({
    queryKey: ["dashboard", "activity", limit],
    queryFn: () => apiFetch<{ items: ActivityItem[] }>(`/dashboard/activity?limit=${limit}`),
    staleTime: 15_000,
  });
}
