import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export interface DashboardSettings {
  owner_id: string;
  show_calendar: boolean;
  show_kanban: boolean;
  show_notes: boolean;
  show_rss: boolean;
  calendar_count: number;
  kanban_count: number;
  notes_count: number;
  rss_count: number;
}

export type UpdateDashboardSettingsInput = Partial<
  Omit<DashboardSettings, "owner_id">
>;

export function useDashboardSettings() {
  return useQuery<DashboardSettings>({
    queryKey: ["dashboard", "settings"],
    queryFn: async () =>
      (await apiFetch<{ settings: DashboardSettings }>("/dashboard/settings")).settings,
    staleTime: 60_000,
  });
}

export function useUpdateDashboardSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDashboardSettingsInput) =>
      (
        await apiFetch<{ settings: DashboardSettings }>("/dashboard/settings", {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).settings,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["dashboard", "settings"] });
      const prev = qc.getQueryData<DashboardSettings>(["dashboard", "settings"]);
      if (prev) qc.setQueryData<DashboardSettings>(["dashboard", "settings"], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard", "settings"], ctx.prev);
    },
    onSuccess: (settings) => qc.setQueryData(["dashboard", "settings"], settings),
  });
}
