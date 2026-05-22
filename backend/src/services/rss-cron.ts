import cron from "node-cron";
import { supabaseService } from "../config/supabase.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { refreshFeed, type FeedRow } from "./rss.service.js";

// =====================================================================
// RSS-Cron: zwei Läufe.
//   1) Refresh — aktualisiert Feeds, deren letzter Abruf älter als das
//      pro-Nutzer-Intervall (public.rss_settings) ist. Fallback-Intervall
//      = env.RSS_REFRESH_INTERVAL_MINUTES. Der Cron-Takt ist die Untergrenze.
//   2) Cleanup — löscht je nach Nutzer-Einstellung alte (ggf. nur gelesene)
//      Artikel; Favoriten werden optional geschützt.
// Beide nutzen den Service-Role-Client (umgeht RLS, owner_id explizit).
// =====================================================================

const DELAY_BETWEEN_FEEDS_MS = 500;

let refreshing = false;
let cleaning = false;

// owner_id → refresh_interval_minutes
async function loadRefreshIntervals(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await supabaseService
    .from("rss_settings")
    .select("owner_id, refresh_interval_minutes");
  if (error) {
    logger.warn({ err: error.message }, "rss-cron: Settings laden fehlgeschlagen — Fallback");
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.owner_id as string, row.refresh_interval_minutes as number);
  }
  return map;
}

export async function runRssRefreshCycle(): Promise<void> {
  if (refreshing) {
    logger.info("rss-cron: vorheriger Refresh noch aktiv — übersprungen");
    return;
  }
  refreshing = true;
  try {
    const intervals = await loadRefreshIntervals();

    // Alle nicht-pausierten Feeds laden; Fälligkeit pro Owner-Intervall in JS.
    const { data, error } = await supabaseService
      .from("rss_feeds")
      .select("id, owner_id, feed_url, title, last_fetched_at")
      .neq("status", "paused")
      .limit(500);
    if (error) {
      logger.warn({ err: error.message }, "rss-cron: Feeds laden fehlgeschlagen");
      return;
    }

    const now = Date.now();
    const due = (data ?? []).filter((f) => {
      const intervalMin = intervals.get(f.owner_id as string) ?? env.RSS_REFRESH_INTERVAL_MINUTES;
      const last = f.last_fetched_at ? new Date(f.last_fetched_at as string).getTime() : 0;
      return now - last >= intervalMin * 60_000;
    });

    if (due.length === 0) return;

    logger.info({ count: due.length }, "rss-cron: Refresh-Zyklus gestartet");
    let ok = 0;
    for (const feed of due) {
      try {
        await refreshFeed(supabaseService, feed as FeedRow);
        ok += 1;
      } catch {
        // refreshFeed loggt + setzt status=error selbst.
      }
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_FEEDS_MS));
    }
    logger.info({ ok, total: due.length }, "rss-cron: Refresh-Zyklus beendet");
  } finally {
    refreshing = false;
  }
}

export async function runRssCleanupCycle(): Promise<void> {
  if (cleaning) {
    logger.info("rss-cron: vorheriges Cleanup noch aktiv — übersprungen");
    return;
  }
  cleaning = true;
  try {
    const { data, error } = await supabaseService
      .from("rss_settings")
      .select("owner_id, cleanup_mode, cleanup_after_days, cleanup_keep_favorites")
      .neq("cleanup_mode", "off");
    if (error) {
      logger.warn({ err: error.message }, "rss-cron: Cleanup-Settings laden fehlgeschlagen");
      return;
    }
    const settings = data ?? [];
    if (settings.length === 0) return;

    let totalDeleted = 0;
    for (const s of settings) {
      const days = (s.cleanup_after_days as number) ?? 30;
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

      let query = supabaseService
        .from("rss_items")
        .delete()
        .eq("owner_id", s.owner_id as string)
        // Alter über published_at, Fallback created_at wenn published_at NULL.
        .or(`published_at.lt.${cutoff},and(published_at.is.null,created_at.lt.${cutoff})`);

      if (s.cleanup_mode === "read") query = query.eq("is_read", true);
      if (s.cleanup_keep_favorites) query = query.eq("is_favorite", false);

      const { data: deleted, error: delErr } = await query.select("id");
      if (delErr) {
        logger.warn({ err: delErr.message, owner: s.owner_id }, "rss-cron: Cleanup fehlgeschlagen");
        continue;
      }
      totalDeleted += deleted?.length ?? 0;
    }
    if (totalDeleted > 0) logger.info({ totalDeleted }, "rss-cron: Cleanup beendet");
  } finally {
    cleaning = false;
  }
}

export function startRssCron(): void {
  if (!env.RSS_CRON_ENABLED) {
    logger.info("rss-cron: deaktiviert (RSS_CRON_ENABLED=false)");
    return;
  }
  if (!cron.validate(env.RSS_CRON_SCHEDULE)) {
    logger.error({ schedule: env.RSS_CRON_SCHEDULE }, "rss-cron: ungültiger Refresh-Schedule");
    return;
  }
  cron.schedule(env.RSS_CRON_SCHEDULE, () => void runRssRefreshCycle());
  logger.info({ schedule: env.RSS_CRON_SCHEDULE }, "rss-cron: Refresh registriert");

  if (cron.validate(env.RSS_CLEANUP_SCHEDULE)) {
    cron.schedule(env.RSS_CLEANUP_SCHEDULE, () => void runRssCleanupCycle());
    logger.info({ schedule: env.RSS_CLEANUP_SCHEDULE }, "rss-cron: Cleanup registriert");
  } else {
    logger.error({ schedule: env.RSS_CLEANUP_SCHEDULE }, "rss-cron: ungültiger Cleanup-Schedule");
  }
}
