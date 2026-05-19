import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import {
  bulkDeleteSchema,
  createEntrySchema,
  listEntriesQuerySchema,
  updateEntrySchema,
} from "../schemas/entry.schema.js";
import { applyFilter } from "../lib/filter-ops.js";

export const entriesRouter = Router();

// ─── GET /api/databases/:databaseId/entries ──────────────────────────
entriesRouter.get(
  "/databases/:databaseId/entries",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.user) throw errors.unauthorized();
      const { limit, offset, sort, order, filter, search } = listEntriesQuerySchema.parse(
        req.query,
      );
      const client = getUserScopedClient(req.user.accessToken);

      let query = client
        .from("entries")
        .select("id, database_id, data, created_at, updated_at", { count: "exact" })
        .eq("database_id", req.params.databaseId);

      // Filter-Bedingungen anwenden (chained AND)
      if (filter) {
        for (const cond of filter) {
          query = applyFilter(query, cond);
        }
      }

      // Volltextsuche über search_vector (GIN-indiziert)
      if (search && search.trim().length > 0) {
        query = query.textSearch("search_vector", search.trim(), {
          config: "german",
          type: "websearch",
        });
      }

      // Sort: created_at|updated_at direkt, sonst über data->>field (text-sort)
      const sortColumn =
        sort === "created_at" || sort === "updated_at"
          ? sort
          : sort
            ? `data->>${sort}`
            : "created_at";
      const ascending = order === "asc";
      query = query.order(sortColumn, { ascending });

      // Tie-Breaker, damit identische Sort-Werte deterministisch zurückkommen
      if (sortColumn !== "created_at") {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);
      if (error) throw errors.internal(`Failed to load entries: ${error.message}`);

      res.json({ items: data ?? [], total: count ?? 0, limit, offset });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/entries/:id ────────────────────────────────────────────
entriesRouter.get("/entries/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("entries")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw errors.internal("Failed to load entry");
    if (!data) throw errors.notFound("Entry not found");
    res.json({ entry: data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/databases/:databaseId/entries ─────────────────────────
entriesRouter.post(
  "/databases/:databaseId/entries",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.user) throw errors.unauthorized();
      const body = createEntrySchema.parse(req.body);
      const client = getUserScopedClient(req.user.accessToken);

      // Sicherstellen dass Database dem User gehört (RLS macht das auch,
      // aber explizit liefert klare 404 statt Insert-Error).
      const { data: db } = await client
        .from("databases")
        .select("id")
        .eq("id", req.params.databaseId)
        .maybeSingle();
      if (!db) throw errors.notFound("Database not found");

      const { data, error } = await client
        .from("entries")
        .insert({
          database_id: req.params.databaseId,
          owner_id: req.user.id,
          data: body.data,
        })
        .select()
        .single();
      if (error || !data) throw errors.internal(`Insert failed: ${error?.message ?? "unknown"}`);

      await recordEvent({
        user_id: req.user.id,
        action: "create",
        resource_type: "entry",
        resource_id: data.id,
        metadata: { database_id: req.params.databaseId },
        ip: req.ip,
      });

      res.status(201).json({ entry: data });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /api/entries/:id ──────────────────────────────────────────
entriesRouter.patch("/entries/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateEntrySchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("entries")
      .update({ data: body.data })
      .eq("id", req.params.id)
      .select()
      .maybeSingle();
    if (error) throw errors.internal("Update failed");
    if (!data) throw errors.notFound("Entry not found");

    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "entry",
      resource_id: data.id,
      metadata: { database_id: data.database_id },
      ip: req.ip,
    });

    res.json({ entry: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/entries/:id ─────────────────────────────────────────
entriesRouter.delete("/entries/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: existing } = await client
      .from("entries")
      .select("id, database_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Entry not found");

    const { error } = await client.from("entries").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Delete failed");

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "entry",
      resource_id: existing.id,
      metadata: { database_id: existing.database_id },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/entries/bulk-delete ──────────────────────────────────
entriesRouter.post("/entries/bulk-delete", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { ids } = bulkDeleteSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    // Hole existing für audit-metadata
    const { data: existing, error: selErr } = await client
      .from("entries")
      .select("id, database_id")
      .in("id", ids);
    if (selErr) throw errors.internal("Bulk lookup failed");

    const accessibleIds = (existing ?? []).map((e) => e.id);
    if (accessibleIds.length === 0) {
      res.status(200).json({ deleted: 0 });
      return;
    }

    const { error: delErr } = await client.from("entries").delete().in("id", accessibleIds);
    if (delErr) throw errors.internal("Bulk delete failed");

    // Pro Eintrag Audit-Event (fire-and-forget, sequenziell weil services nicht parallel-safe)
    for (const row of existing ?? []) {
      await recordEvent({
        user_id: req.user.id,
        action: "delete",
        resource_type: "entry",
        resource_id: row.id,
        metadata: { database_id: row.database_id, bulk: true },
        ip: req.ip,
      });
    }

    res.status(200).json({ deleted: accessibleIds.length });
  } catch (err) {
    next(err);
  }
});
