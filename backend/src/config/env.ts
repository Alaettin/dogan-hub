import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) =>
      s
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),

  // Wenn gesetzt, schreibt der Logger zusätzlich in diese Datei mit
  // täglicher Rotation (siehe pino-roll in lib/logger.ts).
  LOG_FILE_PATH: z.string().optional(),

  // RSS-Cron: periodischer Feed-Refresh + Aufräumen. Abschaltbar (Tests/Dev).
  // Der Refresh-Takt ist die Untergrenze des pro-Nutzer-Intervalls; das
  // tatsächliche Intervall steht pro Nutzer in public.rss_settings.
  // RSS_REFRESH_INTERVAL_MINUTES = Fallback für Nutzer ohne Settings-Zeile.
  RSS_CRON_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  RSS_CRON_SCHEDULE: z.string().default("*/5 * * * *"),
  RSS_REFRESH_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
  RSS_CLEANUP_SCHEDULE: z.string().default("30 3 * * *"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[env] Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
