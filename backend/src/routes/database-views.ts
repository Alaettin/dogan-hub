import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient, supabaseService } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import {
  createViewSchema,
  updateViewSchema,
} from "../schemas/database-view.schema.js";

export const databaseViewsRouter = Router();

// ─── GET /api/databases/:databaseId/views ────────────────────────────
databaseViewsRouter.get(
  "/databases/:databaseId/views",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.user) throw errors.unauthorized();
      const client = getUserScopedClient(req.user.accessToken);
      const { data, error } = await client
        .from("database_views")
        .select("id, database_id, name, view_type, config, is_default, created_at")
        .eq("database_id", req.params.databaseId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw errors.internal("Failed to load views");
      res.json({ items: data ?? [] });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/databases/:databaseId/views ───────────────────────────
databaseViewsRouter.post(
  "/databases/:databaseId/views",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.user) throw errors.unauthorized();
      const body = createViewSchema.parse(req.body);
      const client = getUserScopedClient(req.user.accessToken);

      // Existenz der Datenbank explizit prüfen
      const { data: db } = await client
        .from("databases")
        .select("id")
        .eq("id", req.params.databaseId)
        .maybeSingle();
      if (!db) throw errors.notFound("Database not found");

      // Wenn is_default=true: andere defaults dieser DB zurücksetzen
      if (body.is_default) {
        await supabaseService
          .from("database_views")
          .update({ is_default: false })
          .eq("database_id", req.params.databaseId)
          .eq("is_default", true);
      }

      const { data, error } = await client
        .from("database_views")
        .insert({
          database_id: req.params.databaseId,
          owner_id: req.user.id,
          name: body.name,
          view_type: body.view_type,
          config: body.config,
          is_default: body.is_default,
        })
        .select()
        .single();
      if (error || !data) throw errors.internal(`Insert failed: ${error?.message ?? "unknown"}`);

      await recordEvent({
        user_id: req.user.id,
        action: "create",
        resource_type: "database_view",
        resource_id: data.id,
        metadata: { database_id: req.params.databaseId, view_type: body.view_type },
        ip: req.ip,
      });

      res.status(201).json({ view: data });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /api/database-views/:id ───────────────────────────────────
databaseViewsRouter.patch("/database-views/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateViewSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    // Existenz prüfen + database_id für is_default-Logik holen
    const { data: existing } = await client
      .from("database_views")
      .select("id, database_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("View not found");

    if (body.is_default === true) {
      await supabaseService
        .from("database_views")
        .update({ is_default: false })
        .eq("database_id", existing.database_id)
        .eq("is_default", true)
        .neq("id", existing.id);
    }

    const { data, error } = await client
      .from("database_views")
      .update(body)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error || !data) throw errors.internal(`Update failed: ${error?.message ?? "unknown"}`);

    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "database_view",
      resource_id: data.id,
      metadata: { database_id: existing.database_id },
      ip: req.ip,
    });

    res.json({ view: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/database-views/:id ──────────────────────────────────
databaseViewsRouter.delete("/database-views/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: existing } = await client
      .from("database_views")
      .select("id, database_id, name")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("View not found");

    const { error } = await client.from("database_views").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Delete failed");

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "database_view",
      resource_id: existing.id,
      metadata: { database_id: existing.database_id, name: existing.name },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
