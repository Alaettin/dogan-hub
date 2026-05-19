import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { FieldDefinition } from "./useDatabases";

export interface DatabaseTemplate {
  key: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  schema: FieldDefinition[];
}

export function useTemplates() {
  return useQuery<DatabaseTemplate[]>({
    queryKey: ["database-templates"],
    queryFn: async () => {
      const data = await apiFetch<{ templates: DatabaseTemplate[] }>("/database-templates");
      return data.templates;
    },
    staleTime: 5 * 60_000, // Templates ändern sich nie zur Laufzeit
  });
}
