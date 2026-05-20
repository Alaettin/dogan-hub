import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import {
  createEventSchema,
  eventsQuerySchema,
  updateEventSchema,
} from "../schemas/calendar.schema.js";

export const calendarRouter = Router();

const EVENT_COLUMNS =
  "id, owner_id, title, description, location, start_at, end_at, all_day, color, category, recurrence_freq, recurrence_interval, recurrence_until, remind_minutes_before, created_at, updated_at";

// ─── GET /api/calendar/events?from=&to= ──────────────────────────────
// Liefert: Einmal-Events die [from,to] überlappen + ALLE wiederkehrenden
// Events (deren Occurrences im Fenster liegen könnten — Expansion macht das
// Frontend). Recurring-Set ist klein, daher unkritisch.
calendarRouter.get("/events", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { from, to } = eventsQuerySchema.parse(req.query);
    const client = getUserScopedClient(req.user.accessToken);

    // Einmal-Events: kein recurrence_freq, start_at < to UND (end_at, sonst start_at) >= from.
    const onceP = client
      .from("calendar_events")
      .select(EVENT_COLUMNS)
      .is("recurrence_freq", null)
      .lt("start_at", to)
      .or(`end_at.gte.${from},and(end_at.is.null,start_at.gte.${from})`);

    // Wiederkehrende: alle, deren Start vor dem Fensterende liegt und die nicht
    // vor Fensterbeginn ausgelaufen sind.
    const recurringP = client
      .from("calendar_events")
      .select(EVENT_COLUMNS)
      .not("recurrence_freq", "is", null)
      .lt("start_at", to)
      .or(`recurrence_until.is.null,recurrence_until.gte.${from}`);

    const [once, recurring] = await Promise.all([onceP, recurringP]);
    if (once.error) throw errors.internal(`Events laden fehlgeschlagen: ${once.error.message}`);
    if (recurring.error) {
      throw errors.internal(`Events laden fehlgeschlagen: ${recurring.error.message}`);
    }

    res.json({ items: [...(once.data ?? []), ...(recurring.data ?? [])] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/calendar/events ───────────────────────────────────────
calendarRouter.post("/events", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createEventSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    const { data, error } = await client
      .from("calendar_events")
      .insert({ ...body, owner_id: req.user.id })
      .select(EVENT_COLUMNS)
      .single();
    if (error || !data) {
      throw errors.internal(`Anlegen fehlgeschlagen: ${error?.message ?? "unknown"}`);
    }

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "calendar_event",
      resource_id: data.id,
      metadata: { title: data.title, recurrence_freq: data.recurrence_freq },
      ip: req.ip,
    });

    res.status(201).json({ event: data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/calendar/events/:id ──────────────────────────────────
calendarRouter.patch("/events/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateEventSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    const { data, error } = await client
      .from("calendar_events")
      .update(body)
      .eq("id", req.params.id)
      .select(EVENT_COLUMNS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Termin nicht gefunden");

    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "calendar_event",
      resource_id: data.id,
      metadata: { title: data.title },
      ip: req.ip,
    });

    res.json({ event: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/calendar/events/:id ─────────────────────────────────
calendarRouter.delete("/events/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: existing } = await client
      .from("calendar_events")
      .select("id, title")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Termin nicht gefunden");

    const { error } = await client.from("calendar_events").delete().eq("id", req.params.id);
    if (error) throw errors.internal(`Löschen fehlgeschlagen: ${error.message}`);

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "calendar_event",
      resource_id: existing.id,
      metadata: { title: existing.title },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
