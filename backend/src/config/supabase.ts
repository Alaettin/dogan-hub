import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Service-Role-Client: umgeht RLS. Nur für privilegierte Operationen
// (User-Verwaltung, Audit-Log-INSERT, Admin-Aggregationen).
export const supabaseService: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

// User-Scoped-Client: respektiert RLS via mitgesendetem User-JWT.
// Default für alle User-Daten-Zugriffe — Sicherheits-Layer ist die DB.
export function getUserScopedClient(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
