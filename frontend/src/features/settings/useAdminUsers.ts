import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export interface AdminUser {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

const KEY = "admin-users";

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: [KEY, "list"],
    queryFn: async () => {
      const data = await apiFetch<{ items: AdminUser[] }>("/admin/users");
      return data.items;
    },
    staleTime: 15_000,
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      return apiFetch<{ id: string | null; email: string }>("/admin/users/invite", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export interface UpdateUserInput {
  id: string;
  display_name?: string;
  role?: "admin" | "user";
  email?: string;
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateUserInput) => {
      return apiFetch<AdminUser>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
