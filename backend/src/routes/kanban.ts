import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import {
  createBoardSchema,
  createColumnSchema,
  createCardSchema,
  updateBoardSchema,
  updateColumnSchema,
  updateCardSchema,
} from "../schemas/kanban.schema.js";

export const kanbanRouter = Router();

const BOARD_COLS = "id, owner_id, name, description, color, position, created_at, updated_at";
const COLUMN_COLS = "id, board_id, owner_id, name, color, position, created_at, updated_at";
const CARD_COLS =
  "id, column_id, board_id, owner_id, title, description, color, due_date, labels, position, created_at, updated_at";

// Nächste position = max(position)+1 innerhalb eines Scopes.
async function nextPosition(
  client: SupabaseClient,
  table: string,
  scopeCol: string,
  scopeVal: string,
): Promise<number> {
  const { data } = await client
    .from(table)
    .select("position")
    .eq(scopeCol, scopeVal)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

// ─── Boards ──────────────────────────────────────────────────────────
kanbanRouter.get("/boards", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("kanban_boards")
      .select(BOARD_COLS)
      .order("position", { ascending: true });
    if (error) throw errors.internal("Boards laden fehlgeschlagen");

    // Aggregat-Stats pro Board (zwei schlanke Selects + JS-Reduce).
    const [cols, cards] = await Promise.all([
      client.from("kanban_columns").select("board_id"),
      client.from("kanban_cards").select("board_id, due_date"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const colCount = new Map<string, number>();
    for (const c of (cols.data ?? []) as { board_id: string }[]) {
      colCount.set(c.board_id, (colCount.get(c.board_id) ?? 0) + 1);
    }
    const cardCount = new Map<string, number>();
    const overdue = new Map<string, number>();
    for (const c of (cards.data ?? []) as { board_id: string; due_date: string | null }[]) {
      cardCount.set(c.board_id, (cardCount.get(c.board_id) ?? 0) + 1);
      if (c.due_date && c.due_date < today) {
        overdue.set(c.board_id, (overdue.get(c.board_id) ?? 0) + 1);
      }
    }

    const items = (data ?? []).map((b: { id: string }) => ({
      ...b,
      column_count: colCount.get(b.id) ?? 0,
      card_count: cardCount.get(b.id) ?? 0,
      overdue_count: overdue.get(b.id) ?? 0,
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

kanbanRouter.post("/boards", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createBoardSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    const position = await nextPosition(client, "kanban_boards", "owner_id", req.user.id);
    const { data: board, error } = await client
      .from("kanban_boards")
      .insert({ ...body, owner_id: req.user.id, position })
      .select(BOARD_COLS)
      .single();
    if (error || !board) throw errors.internal(`Board anlegen fehlgeschlagen: ${error?.message}`);

    // Default-Spalten seeden
    const defaults = ["To Do", "In Arbeit", "Erledigt"];
    await client.from("kanban_columns").insert(
      defaults.map((name, i) => ({
        board_id: board.id,
        owner_id: req.user!.id,
        name,
        position: i + 1,
      })),
    );

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "kanban_board",
      resource_id: board.id,
      metadata: { name: board.name },
      ip: req.ip,
    });

    res.status(201).json({ board });
  } catch (err) {
    next(err);
  }
});

// Fällige/anstehende Aufgaben board-übergreifend (für Dashboard-Widget).
kanbanRouter.get("/tasks", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("kanban_cards")
      .select("id, title, due_date, color, board_id, kanban_boards(name)")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(12);
    if (error) throw errors.internal(`Aufgaben laden fehlgeschlagen: ${error.message}`);

    const items = (data ?? []).map((c) => {
      const rel = (c as { kanban_boards?: { name?: string } | { name?: string }[] }).kanban_boards;
      const board_name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
      return {
        id: c.id,
        title: c.title,
        due_date: c.due_date,
        color: c.color,
        board_id: c.board_id,
        board_name: board_name ?? "",
      };
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// Board-Detail: board + columns + cards in einem Round-Trip.
kanbanRouter.get("/boards/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: board, error: bErr } = await client
      .from("kanban_boards")
      .select(BOARD_COLS)
      .eq("id", req.params.id)
      .maybeSingle();
    if (bErr) throw errors.internal("Board laden fehlgeschlagen");
    if (!board) throw errors.notFound("Board nicht gefunden");

    const [cols, cards] = await Promise.all([
      client
        .from("kanban_columns")
        .select(COLUMN_COLS)
        .eq("board_id", board.id)
        .order("position", { ascending: true }),
      client
        .from("kanban_cards")
        .select(CARD_COLS)
        .eq("board_id", board.id)
        .order("position", { ascending: true }),
    ]);
    if (cols.error || cards.error) throw errors.internal("Board-Inhalte laden fehlgeschlagen");

    res.json({ board, columns: cols.data ?? [], cards: cards.data ?? [] });
  } catch (err) {
    next(err);
  }
});

kanbanRouter.patch("/boards/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateBoardSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("kanban_boards")
      .update(body)
      .eq("id", req.params.id)
      .select(BOARD_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Board nicht gefunden");
    res.json({ board: data });
  } catch (err) {
    next(err);
  }
});

kanbanRouter.delete("/boards/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data: existing } = await client
      .from("kanban_boards")
      .select("id, name")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Board nicht gefunden");
    const { error } = await client.from("kanban_boards").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Löschen fehlgeschlagen");
    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "kanban_board",
      resource_id: existing.id,
      metadata: { name: existing.name },
      ip: req.ip,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── Columns ─────────────────────────────────────────────────────────
kanbanRouter.post("/boards/:boardId/columns", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createColumnSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    // Board-Besitz implizit via RLS; sicherstellen dass es existiert.
    const { data: board } = await client
      .from("kanban_boards")
      .select("id")
      .eq("id", req.params.boardId)
      .maybeSingle();
    if (!board) throw errors.notFound("Board nicht gefunden");

    const position = await nextPosition(client, "kanban_columns", "board_id", board.id);
    const { data, error } = await client
      .from("kanban_columns")
      .insert({ ...body, board_id: board.id, owner_id: req.user.id, position })
      .select(COLUMN_COLS)
      .single();
    if (error || !data) throw errors.internal(`Spalte anlegen fehlgeschlagen: ${error?.message}`);
    res.status(201).json({ column: data });
  } catch (err) {
    next(err);
  }
});

kanbanRouter.patch("/columns/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateColumnSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("kanban_columns")
      .update(body)
      .eq("id", req.params.id)
      .select(COLUMN_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Spalte nicht gefunden");
    res.json({ column: data });
  } catch (err) {
    next(err);
  }
});

kanbanRouter.delete("/columns/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { error } = await client.from("kanban_columns").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Löschen fehlgeschlagen");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── Cards ───────────────────────────────────────────────────────────
kanbanRouter.post("/columns/:columnId/cards", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createCardSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    const { data: column } = await client
      .from("kanban_columns")
      .select("id, board_id")
      .eq("id", req.params.columnId)
      .maybeSingle();
    if (!column) throw errors.notFound("Spalte nicht gefunden");

    const position = await nextPosition(client, "kanban_cards", "column_id", column.id);
    const { data, error } = await client
      .from("kanban_cards")
      .insert({
        title: body.title,
        description: body.description ?? null,
        color: body.color ?? null,
        due_date: body.due_date ?? null,
        labels: body.labels ?? [],
        column_id: column.id,
        board_id: column.board_id,
        owner_id: req.user.id,
        position,
      })
      .select(CARD_COLS)
      .single();
    if (error || !data) throw errors.internal(`Karte anlegen fehlgeschlagen: ${error?.message}`);
    res.status(201).json({ card: data });
  } catch (err) {
    next(err);
  }
});

kanbanRouter.patch("/cards/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateCardSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("kanban_cards")
      .update(body)
      .eq("id", req.params.id)
      .select(CARD_COLS)
      .maybeSingle();
    if (error) throw errors.internal(`Update fehlgeschlagen: ${error.message}`);
    if (!data) throw errors.notFound("Karte nicht gefunden");
    res.json({ card: data });
  } catch (err) {
    next(err);
  }
});

kanbanRouter.delete("/cards/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { error } = await client.from("kanban_cards").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Löschen fehlgeschlagen");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
