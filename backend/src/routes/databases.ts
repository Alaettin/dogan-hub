import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import {
  archiveSchema,
  createDatabaseSchema,
  duplicateSchema,
  updateDatabaseSchema,
} from "../schemas/database.schema.js";
import { DATABASE_TEMPLATES, findTemplate } from "../services/database-templates.js";

export const databasesRouter = Router();
export const databaseTemplatesRouter = Router();

// ─── GET /api/database-templates ─────────────────────────────────────
databaseTemplatesRouter.get("/", requireAuth, (_req, res) => {
  res.json({ templates: DATABASE_TEMPLATES });
});

// ─── GET /api/databases ──────────────────────────────────────────────
const listQuerySchema = z.object({
  archived: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

databasesRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { archived } = listQuerySchema.parse(req.query);

    const client = getUserScopedClient(req.user.accessToken);
    let query = client
      .from("databases")
      .select("id, name, icon, color, description, position, archived, created_at, updated_at")
      .order("position", { ascending: true });
    if (archived !== undefined) query = query.eq("archived", archived);

    const { data, error } = await query;
    if (error) throw errors.internal("Failed to load databases");

    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/databases/:id ──────────────────────────────────────────
databasesRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("databases")
      .select(
        "id, name, icon, color, description, schema, position, archived, created_at, updated_at",
      )
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw errors.internal("Failed to load database");
    if (!data) throw errors.notFound("Database not found");
    res.json({ database: data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/databases ─────────────────────────────────────────────
databasesRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createDatabaseSchema.parse(req.body);

    let name = body.name;
    let icon = body.icon ?? null;
    let color = body.color ?? null;
    let description = body.description ?? null;
    let schema = body.schema ?? [];

    if (body.template_key) {
      const tpl = findTemplate(body.template_key);
      if (!tpl) throw errors.badRequest(`Unknown template: ${body.template_key}`);
      name = body.name || tpl.name;
      icon = body.icon ?? tpl.icon;
      color = body.color ?? tpl.color;
      description = body.description ?? tpl.description;
      schema = body.schema ?? tpl.schema;
    }

    const client = getUserScopedClient(req.user.accessToken);

    // Position: nächste freie Stelle für diesen User
    const { data: maxRow } = await client
      .from("databases")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (maxRow?.position ?? -1) + 1;

    const { data, error } = await client
      .from("databases")
      .insert({
        owner_id: req.user.id,
        name,
        icon,
        color,
        description,
        schema,
        position: nextPosition,
      })
      .select()
      .single();
    if (error || !data) throw errors.internal(`Insert failed: ${error?.message ?? "unknown"}`);

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "database",
      resource_id: data.id,
      metadata: { name, template_key: body.template_key ?? null },
      ip: req.ip,
    });

    res.status(201).json({ database: data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/databases/:id ────────────────────────────────────────
databasesRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateDatabaseSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("databases")
      .update(body)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();
    if (error) throw errors.internal("Update failed");
    if (!data) throw errors.notFound("Database not found");

    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "database",
      resource_id: data.id,
      metadata: { fields: Object.keys(body) },
      ip: req.ip,
    });

    res.json({ database: data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/databases/:id/archive ─────────────────────────────────
databasesRouter.post("/:id/archive", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { archived } = archiveSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("databases")
      .update({ archived })
      .eq("id", req.params.id)
      .select()
      .maybeSingle();
    if (error) throw errors.internal("Archive failed");
    if (!data) throw errors.notFound("Database not found");

    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "database",
      resource_id: data.id,
      metadata: { archived },
      ip: req.ip,
    });

    res.json({ database: data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/databases/:id/duplicate ───────────────────────────────
databasesRouter.post("/:id/duplicate", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { name: overrideName } = duplicateSchema.parse(req.body ?? {});
    const client = getUserScopedClient(req.user.accessToken);

    const { data: source, error: getErr } = await client
      .from("databases")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (getErr) throw errors.internal("Load failed");
    if (!source) throw errors.notFound("Database not found");

    const { data: maxRow } = await client
      .from("databases")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (maxRow?.position ?? -1) + 1;

    const { data, error } = await client
      .from("databases")
      .insert({
        owner_id: req.user.id,
        name: overrideName ?? `${source.name} (Kopie)`,
        icon: source.icon,
        color: source.color,
        description: source.description,
        schema: source.schema,
        position: nextPosition,
      })
      .select()
      .single();
    if (error || !data) throw errors.internal("Duplicate failed");

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "database",
      resource_id: data.id,
      metadata: { duplicated_from: source.id },
      ip: req.ip,
    });

    res.status(201).json({ database: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/databases/:id ───────────────────────────────────────
databasesRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: existing } = await client
      .from("databases")
      .select("id, name")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Database not found");

    const { error } = await client.from("databases").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Delete failed");

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "database",
      resource_id: existing.id,
      metadata: { name: existing.name },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
