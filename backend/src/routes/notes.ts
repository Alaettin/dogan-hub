import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import { createNoteSchema, updateNoteSchema } from "../schemas/notes.schema.js";
import { escapeLikeValue } from "../lib/postgrest.js";

export const notesRouter = Router();

const NOTE_COLS =
  "id, owner_id, type, title, body, items, color, tags, pinned, position, created_at, updated_at";

const NOTE_TYPES = ["text", "checklist", "list"] as const;

// ─── Liste ───────────────────────────────────────────────────────────
notesRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    let query = client
      .from("notes")
      .select(NOTE_COLS)
      .order("updated_at", { ascending: false });

    const { search, type, pinned } = req.query as Record<string, string | undefined>;
    if (type && (NOTE_TYPES as readonly string[]).includes(type)) {
      query = query.eq("type", type);
    }
    if (pinned === "true") {
      query = query.eq("pinned", true);
    }
    if (search) {
      const term = search.trim();
      if (term) {
        // Wert in Anführungszeichen + Escapen, damit PostgREST-Sonderzeichen
        // (z.B. "." "," "(" ")") im Suchtext den .or()-Filter nicht zerbrechen.
        const esc = escapeLikeValue(term);
        query = query.or(`title.ilike."%${esc}%",body.ilike."%${esc}%"`);
      }
    }

    const { data, error } = await query;
    if (error) throw errors.internal(`Notizen laden fehlgeschlagen: ${error.message}`);
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// ─── Detail ──────────────────────────────────────────────────────────
notesRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("notes")
      .select(NOTE_COLS)
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw errors.internal("Notiz laden fehlgeschlagen");
    if (!data) throw errors.notFound("Notiz nicht gefunden");
    res.json({ note: data });
  } catch (err) {
    next(err);
  }
});

// ─── Anlegen ─────────────────────────────────────────────────────────
notesRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createNoteSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    const { data, error } = await client
      .from("notes")
      .insert({
        type: body.type,
        title: body.title,
        body: body.body,
        items: body.items ?? [],
        color: body.color ?? null,
        tags: body.tags ?? [],
        pinned: body.pinned ?? false,
        owner_id: req.user.id,
      })
      .select(NOTE_COLS)
      .single();
    if (error || !data) throw errors.internal(`Notiz anlegen fehlgeschlagen: ${error?.message}`);

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "note",
      resource_id: data.id,
      metadata: { type: data.type, title: data.title },
      ip: req.ip,
    });

    res.status(201).json({ note: data });
  } catch (err) {
    next(err);
  }
});

// ─── Aktualisieren ───────────────────────────────────────────────────
notesRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateNoteSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("notes")
      .update(body)
      .eq("id", req.params.id)
      .select(NOTE_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Notiz nicht gefunden");
    res.json({ note: data });
  } catch (err) {
    next(err);
  }
});

// ─── Löschen ─────────────────────────────────────────────────────────
notesRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: existing } = await client
      .from("notes")
      .select("id, title")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Notiz nicht gefunden");
    const { error } = await client.from("notes").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Löschen fehlgeschlagen");
    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "note",
      resource_id: existing.id,
      metadata: { title: existing.title },
      ip: req.ip,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
