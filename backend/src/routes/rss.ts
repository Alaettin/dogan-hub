import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import {
  createFolderSchema,
  updateFolderSchema,
  createFeedSchema,
  updateFeedSchema,
  updateItemSchema,
  markAllReadSchema,
  updateRssSettingsSchema,
} from "../schemas/rss.schema.js";
import {
  refreshFeed,
  fetchAndParse,
  buildOpml,
  parseOpml,
  type FeedRow,
} from "../services/rss.service.js";

export const rssRouter = Router();

const FOLDER_COLS = "id, owner_id, name, position, created_at, updated_at";
const FEED_COLS =
  "id, owner_id, folder_id, feed_url, site_url, title, description, favicon_url, status, last_fetched_at, last_error, error_count, created_at, updated_at";
const ITEM_COLS =
  "id, feed_id, owner_id, guid, title, link, author, summary, content, image_url, published_at, is_read, is_favorite, fetched_at, created_at";
const SETTINGS_COLS =
  "owner_id, refresh_interval_minutes, cleanup_mode, cleanup_after_days, cleanup_keep_favorites, default_view, mark_read_on_open, created_at, updated_at";

// Defaults wenn der Nutzer noch keine Settings-Zeile hat (matcht die
// DB-Defaults aus 0015_init_rss_settings.sql).
function defaultSettings(ownerId: string) {
  return {
    owner_id: ownerId,
    refresh_interval_minutes: 30,
    cleanup_mode: "off" as const,
    cleanup_after_days: 30,
    cleanup_keep_favorites: true,
    default_view: "all" as const,
    mark_read_on_open: true,
  };
}

// =====================================================================
// Einstellungen (1 Zeile pro Nutzer)
// =====================================================================
rssRouter.get("/settings", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("rss_settings")
      .select(SETTINGS_COLS)
      .eq("owner_id", req.user.id)
      .maybeSingle();
    if (error) throw errors.internal(`Einstellungen laden fehlgeschlagen: ${error.message}`);
    res.json({ settings: data ?? defaultSettings(req.user.id) });
  } catch (err) {
    next(err);
  }
});

rssRouter.patch("/settings", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateRssSettingsSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("rss_settings")
      .upsert({ owner_id: req.user.id, ...body }, { onConflict: "owner_id" })
      .select(SETTINGS_COLS)
      .single();
    if (error || !data) throw errors.internal(`Speichern fehlgeschlagen: ${error?.message}`);
    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "rss_settings",
      resource_id: req.user.id,
      metadata: body,
      ip: req.ip,
    });
    res.json({ settings: data });
  } catch (err) {
    next(err);
  }
});

// =====================================================================
// Ordner
// =====================================================================
rssRouter.get("/folders", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("rss_folders")
      .select(FOLDER_COLS)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw errors.internal(`Ordner laden fehlgeschlagen: ${error.message}`);
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

rssRouter.post("/folders", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createFolderSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("rss_folders")
      .insert({ name: body.name, position: body.position ?? 0, owner_id: req.user.id })
      .select(FOLDER_COLS)
      .single();
    if (error || !data) throw errors.internal(`Ordner anlegen fehlgeschlagen: ${error?.message}`);
    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "rss_folder",
      resource_id: data.id,
      metadata: { name: data.name },
      ip: req.ip,
    });
    res.status(201).json({ folder: data });
  } catch (err) {
    next(err);
  }
});

rssRouter.patch("/folders/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateFolderSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("rss_folders")
      .update(body)
      .eq("id", req.params.id)
      .select(FOLDER_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Ordner nicht gefunden");
    res.json({ folder: data });
  } catch (err) {
    next(err);
  }
});

rssRouter.delete("/folders/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: existing } = await client
      .from("rss_folders")
      .select("id, name")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Ordner nicht gefunden");
    // Feeds bleiben erhalten (folder_id → null via FK on delete set null).
    const { error } = await client.from("rss_folders").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Löschen fehlgeschlagen");
    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "rss_folder",
      resource_id: existing.id,
      metadata: { name: existing.name },
      ip: req.ip,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// =====================================================================
// Feeds
// =====================================================================
rssRouter.get("/feeds", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    let query = client
      .from("rss_feeds")
      .select(FEED_COLS)
      .order("title", { ascending: true });
    const { folder_id } = req.query as Record<string, string | undefined>;
    if (folder_id) query = query.eq("folder_id", folder_id);
    const { data, error } = await query;
    if (error) throw errors.internal(`Feeds laden fehlgeschlagen: ${error.message}`);
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// Ungelesen-Zähler je Feed (für die Sidebar-Badges).
rssRouter.get("/unread-counts", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client.rpc("rss_unread_counts");
    if (error) throw errors.internal(`Zähler laden fehlgeschlagen: ${error.message}`);
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

rssRouter.post("/feeds", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createFeedSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    // Feed vor dem Speichern validieren (fetch + parse).
    let parsedTitle = body.title?.trim() ?? "";
    let siteUrl: string | null = null;
    let description: string | null = null;
    try {
      const parsed = await fetchAndParse(body.feed_url);
      if (!parsedTitle) parsedTitle = parsed.title || body.feed_url;
      siteUrl = parsed.siteUrl;
      description = parsed.description;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw errors.badRequest(`Feed konnte nicht geladen werden: ${msg}`);
    }

    const { data, error } = await client
      .from("rss_feeds")
      .insert({
        feed_url: body.feed_url,
        folder_id: body.folder_id ?? null,
        title: parsedTitle,
        site_url: siteUrl,
        description,
        owner_id: req.user.id,
      })
      .select(FEED_COLS)
      .single();
    if (error || !data) {
      if (error?.code === "23505") throw errors.conflict("Dieser Feed ist bereits abonniert");
      throw errors.internal(`Feed anlegen fehlgeschlagen: ${error?.message}`);
    }

    // Initialen Refresh ausführen (Items laden). Fehler hier nicht fatal —
    // der Cron holt es später nach.
    try {
      await refreshFeed(client, data as FeedRow);
    } catch {
      /* status=error wird in refreshFeed gesetzt */
    }

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "rss_feed",
      resource_id: data.id,
      metadata: { feed_url: data.feed_url, title: parsedTitle },
      ip: req.ip,
    });

    // Frisch laden (Status/last_fetched_at kann sich durch Refresh geändert haben).
    const { data: fresh } = await client
      .from("rss_feeds")
      .select(FEED_COLS)
      .eq("id", data.id)
      .single();
    res.status(201).json({ feed: fresh ?? data });
  } catch (err) {
    next(err);
  }
});

rssRouter.patch("/feeds/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateFeedSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("rss_feeds")
      .update(body)
      .eq("id", req.params.id)
      .select(FEED_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Feed nicht gefunden");
    res.json({ feed: data });
  } catch (err) {
    next(err);
  }
});

rssRouter.delete("/feeds/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: existing } = await client
      .from("rss_feeds")
      .select("id, title")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Feed nicht gefunden");
    const { error } = await client.from("rss_feeds").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Löschen fehlgeschlagen");
    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "rss_feed",
      resource_id: existing.id,
      metadata: { title: existing.title },
      ip: req.ip,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

rssRouter.post("/feeds/:id/refresh", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: feed, error } = await client
      .from("rss_feeds")
      .select("id, owner_id, feed_url, title")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw errors.internal("Feed laden fehlgeschlagen");
    if (!feed) throw errors.notFound("Feed nicht gefunden");

    let inserted = 0;
    try {
      const result = await refreshFeed(client, feed as FeedRow);
      inserted = result.inserted;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw errors.badRequest(`Refresh fehlgeschlagen: ${msg}`);
    }

    const { data: fresh } = await client
      .from("rss_feeds")
      .select(FEED_COLS)
      .eq("id", feed.id)
      .single();
    res.json({ feed: fresh, inserted });
  } catch (err) {
    next(err);
  }
});

// =====================================================================
// Artikel
// =====================================================================

// Dashboard-Widget: neueste N Artikel über alle Feeds.
rssRouter.get("/items/latest", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
    const { data, error } = await client
      .from("rss_items")
      .select("id, feed_id, title, link, image_url, published_at, is_read")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw errors.internal(`Artikel laden fehlgeschlagen: ${error.message}`);
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

rssRouter.get("/items", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const q = req.query as Record<string, string | undefined>;

    let query = client.from("rss_items").select(ITEM_COLS);

    if (q.feed_id) {
      query = query.eq("feed_id", q.feed_id);
    } else if (q.folder_id) {
      // Feeds des Ordners ermitteln, dann Items darüber filtern.
      const { data: feeds } = await client
        .from("rss_feeds")
        .select("id")
        .eq("folder_id", q.folder_id);
      const ids = (feeds ?? []).map((f) => f.id);
      if (ids.length === 0) {
        res.json({ items: [] });
        return;
      }
      query = query.in("feed_id", ids);
    }

    if (q.unread === "true") query = query.eq("is_read", false);
    if (q.favorite === "true") query = query.eq("is_favorite", true);
    if (q.search?.trim()) {
      query = query.textSearch("search_tsv", q.search.trim(), {
        type: "websearch",
        config: "simple",
      });
    }

    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    query = query
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw errors.internal(`Artikel laden fehlgeschlagen: ${error.message}`);
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

rssRouter.patch("/items/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateItemSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("rss_items")
      .update(body)
      .eq("id", req.params.id)
      .select(ITEM_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Artikel nicht gefunden");
    res.json({ item: data });
  } catch (err) {
    next(err);
  }
});

rssRouter.post("/items/mark-all-read", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = markAllReadSchema.parse(req.body ?? {});
    const client = getUserScopedClient(req.user.accessToken);

    let query = client.from("rss_items").update({ is_read: true }).eq("is_read", false);
    if (body.feed_id) {
      query = query.eq("feed_id", body.feed_id);
    } else if (body.folder_id) {
      const { data: feeds } = await client
        .from("rss_feeds")
        .select("id")
        .eq("folder_id", body.folder_id);
      const ids = (feeds ?? []).map((f) => f.id);
      if (ids.length === 0) {
        res.json({ updated: 0 });
        return;
      }
      query = query.in("feed_id", ids);
    }
    const { data, error } = await query.select("id");
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    res.json({ updated: data?.length ?? 0 });
  } catch (err) {
    next(err);
  }
});

// =====================================================================
// OPML Import / Export
// =====================================================================
rssRouter.get("/opml/export", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const [{ data: feeds }, { data: folders }] = await Promise.all([
      client.from("rss_feeds").select("title, feed_url, site_url, folder_id"),
      client.from("rss_folders").select("id, name"),
    ]);
    const xml = buildOpml(feeds ?? [], folders ?? []);
    res.setHeader("Content-Type", "text/x-opml; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="myhub-feeds.opml"');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

rssRouter.post("/opml/import", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const xml = typeof req.body === "string" ? req.body : req.body?.opml;
    if (typeof xml !== "string" || !xml.trim()) {
      throw errors.badRequest("OPML-Inhalt fehlt (Body als Text oder { opml })");
    }
    const client = getUserScopedClient(req.user.accessToken);

    let parsed;
    try {
      parsed = parseOpml(xml);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw errors.badRequest(`OPML ungültig: ${msg}`);
    }

    let foldersCreated = 0;
    let feedsCreated = 0;
    let feedsSkipped = 0;

    const insertFeed = async (
      url: string,
      title: string,
      siteUrl: string | null,
      folderId: string | null,
    ) => {
      const { error } = await client.from("rss_feeds").insert({
        feed_url: url,
        title,
        site_url: siteUrl,
        folder_id: folderId,
        owner_id: req.user!.id,
      });
      if (error) {
        if (error.code === "23505") feedsSkipped += 1; // schon abonniert
        return;
      }
      feedsCreated += 1;
    };

    // Ordner + verschachtelte Feeds
    for (const folder of parsed.folders) {
      const { data: f } = await client
        .from("rss_folders")
        .insert({ name: folder.name, owner_id: req.user.id })
        .select("id")
        .single();
      const folderId = f?.id ?? null;
      if (f) foldersCreated += 1;
      for (const feed of folder.feeds) {
        await insertFeed(feed.feedUrl, feed.title, feed.siteUrl, folderId);
      }
    }
    // Top-level Feeds
    for (const feed of parsed.rootFeeds) {
      await insertFeed(feed.feedUrl, feed.title, feed.siteUrl, null);
    }

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "rss_opml_import",
      metadata: { foldersCreated, feedsCreated, feedsSkipped },
      ip: req.ip,
    });

    res.status(201).json({ foldersCreated, feedsCreated, feedsSkipped });
  } catch (err) {
    next(err);
  }
});
