import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export function useBulkDeleteEntries(databaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiFetch<{ deleted: number }>("/entries/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      return res.deleted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", "list", databaseId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
