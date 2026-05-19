import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";

export const dashboardRouter = Router();

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

    const [{ data: profile, error: pErr }, { data: lastLogin }, { count: auditCount }] =
      await Promise.all([profilePromise, lastLoginPromise, auditCountPromise]);

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
        used_bytes: 0,
        limit_bytes: STORAGE_LIMIT_BYTES,
        items: 0,
      },
      counts: {
        audit_entries: auditCount ?? 0,
        databases: 0,
        entries: 0,
        files: 0,
      },
    });
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
