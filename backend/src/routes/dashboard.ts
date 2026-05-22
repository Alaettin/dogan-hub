import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { updateDashboardSettingsSchema } from "../schemas/dashboard.schema.js";

export const dashboardRouter = Router();

const DASHBOARD_SETTINGS_COLS =
  "owner_id, show_calendar, show_kanban, show_notes, show_rss, calendar_count, kanban_count, notes_count, rss_count";

function defaultDashboardSettings(ownerId: string) {
  return {
    owner_id: ownerId,
    show_calendar: true,
    show_kanban: true,
    show_notes: true,
    show_rss: true,
    calendar_count: 6,
    kanban_count: 6,
    notes_count: 6,
    rss_count: 5,
  };
}

const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB MVP Hard-Limit (PLAN §4g)

// GET /api/dashboard/stats — User, Letzte Anmeldung, Module-Status, Storage.
// Counts für Etappe-3-Module sind 0 bis die Tabellen existieren.
dashboardRouter.get("/stats", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const profilePromise = client
      .from("profiles")
      .select("display_name, role")
      .eq("id", req.user.id)
      .single();

    const lastLoginPromise = client
      .from("audit_log")
      .select("created_at")
      .eq("action", "login")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const auditCountPromise = client
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id);

    // Storage: SUM size_bytes + COUNT der nicht-gelöschten Files.
    // Bei 1000+ Files mehrere ms — MVP-akzeptabel.
    const filesAggregatePromise = client
      .from("files")
      .select("size_bytes")
      .is("deleted_at", null);

    const databasesCountPromise = client
      .from("databases")
      .select("id", { count: "exact", head: true })
      .eq("archived", false);

    const entriesCountPromise = client
      .from("entries")
      .select("id", { count: "exact", head: true });

    const [
      { data: profile, error: pErr },
      { data: lastLogin },
      { count: auditCount },
      { data: fileSizes },
      { count: dbCount },
      { count: entryCount },
    ] = await Promise.all([
      profilePromise,
      lastLoginPromise,
      auditCountPromise,
      filesAggregatePromise,
      databasesCountPromise,
      entriesCountPromise,
    ]);

    const storageUsed = (fileSizes ?? []).reduce(
      (sum, row) => sum + (Number(row.size_bytes) || 0),
      0,
    );
    const filesCount = fileSizes?.length ?? 0;

    if (pErr || !profile) throw errors.notFound("Profile not found");

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        display_name: profile.display_name,
        role: profile.role,
      },
      last_login: lastLogin?.created_at ?? null,
      modules: {
        auth:     { status: "active" },
        data:     { status: "coming_soon", eta: "Etappe 3" },
        admin:    { status: "coming_soon", eta: "Etappe 4" },
        shopping: { status: "coming_soon", eta: "Etappe 6" },
      },
      storage: {
        used_bytes: storageUsed,
        limit_bytes: STORAGE_LIMIT_BYTES,
        items: filesCount,
      },
      counts: {
        audit_entries: auditCount ?? 0,
        databases: dbCount ?? 0,
        entries: entryCount ?? 0,
        files: filesCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/dashboard/settings ─────────────────────────────────────
dashboardRouter.get("/settings", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("dashboard_settings")
      .select(DASHBOARD_SETTINGS_COLS)
      .eq("owner_id", req.user.id)
      .maybeSingle();
    if (error) throw errors.internal(`Einstellungen laden fehlgeschlagen: ${error.message}`);
    res.json({ settings: data ?? defaultDashboardSettings(req.user.id) });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/dashboard/settings ───────────────────────────────────
dashboardRouter.patch("/settings", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateDashboardSettingsSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("dashboard_settings")
      .upsert({ owner_id: req.user.id, ...body }, { onConflict: "owner_id" })
      .select(DASHBOARD_SETTINGS_COLS)
      .single();
    if (error || !data) throw errors.internal(`Speichern fehlgeschlagen: ${error?.message}`);
    res.json({ settings: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/activity?limit=20 — letzte N audit_log-Einträge des Users.
const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

dashboardRouter.get("/activity", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { limit } = activityQuerySchema.parse(req.query);

    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("audit_log")
      .select("id, action, resource_type, resource_id, metadata, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw errors.internal("Failed to load activity");

    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});
