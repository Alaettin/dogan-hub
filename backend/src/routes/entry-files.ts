import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import { attachFileSchema } from "../schemas/entry-file.schema.js";

export const entryFilesRouter = Router();

// ─── GET /api/entries/:id/files ──────────────────────────────────────
// Liste der File-Rows, die mit diesem Entry verknüpft sind.
// Soft-deleted Files filtern wir raus — kein "Ghost-Chip" für File im Trash.
entryFilesRouter.get("/entries/:id/files", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data, error } = await client
      .from("entry_files")
      .select(
        "attached_at, file:files!inner(id, owner_id, folder_id, name, storage_path, mime_type, size_bytes, deleted_at, created_at, updated_at)",
      )
      .eq("entry_id", req.params.id)
      .is("file.deleted_at", null)
      .order("attached_at", { ascending: false });
    if (error) throw errors.internal(`Failed to load entry files: ${error.message}`);

    // Supabase typt die joined-Spalte als Array; wir wissen dass es 1:1 ist.
    type FileRow = {
      id: string;
      owner_id: string;
      folder_id: string | null;
      name: string;
      storage_path: string;
      mime_type: string;
      size_bytes: number;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    type Row = { attached_at: string; file: FileRow | FileRow[] };
    const files = (data ?? []).map((r) => {
      const row = r as unknown as Row;
      const file = Array.isArray(row.file) ? row.file[0] : row.file;
      return { ...file, attached_at: row.attached_at };
    });
    res.json({ items: files });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/entries/:id/files ─────────────────────────────────────
entryFilesRouter.post("/entries/:id/files", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = attachFileSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    // Existenz von beiden prüfen (RLS würde sonst silent fail)
    const [{ data: entry }, { data: file }] = await Promise.all([
      client.from("entries").select("id").eq("id", req.params.id).maybeSingle(),
      client.from("files").select("id").eq("id", body.file_id).is("deleted_at", null).maybeSingle(),
    ]);
    if (!entry) throw errors.notFound("Entry not found");
    if (!file) throw errors.notFound("File not found or in trash");

    const { error } = await client
      .from("entry_files")
      .insert({ entry_id: req.params.id, file_id: body.file_id });
    if (error) {
      // 23505 = unique-violation → schon verknüpft, idempotent OK
      if (error.code === "23505") {
        res.status(200).json({ ok: true, already: true });
        return;
      }
      throw errors.internal(`Attach failed: ${error.message}`);
    }

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "entry_file",
      metadata: { entry_id: req.params.id, file_id: body.file_id },
      ip: req.ip,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/entries/:id/files/:fileId ───────────────────────────
entryFilesRouter.delete(
  "/entries/:id/files/:fileId",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.user) throw errors.unauthorized();
      const client = getUserScopedClient(req.user.accessToken);

      const { error } = await client
        .from("entry_files")
        .delete()
        .eq("entry_id", req.params.id)
        .eq("file_id", req.params.fileId);
      if (error) throw errors.internal("Detach failed");

      await recordEvent({
        user_id: req.user.id,
        action: "delete",
        resource_type: "entry_file",
        metadata: { entry_id: req.params.id, file_id: req.params.fileId },
        ip: req.ip,
      });

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
