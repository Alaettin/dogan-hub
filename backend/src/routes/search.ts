import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";

export const searchRouter = Router();

const querySchema = z.object({
  q: z.string().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

function escapeIlike(v: string): string {
  return v.replace(/[%_]/g, "\\$&");
}

// GET /api/search?q=…&limit=5
// Returns grouped results across databases, folders, entries, files.
searchRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { q, limit } = querySchema.parse(req.query);
    const trimmed = q.trim();
    if (!trimmed) {
      res.json({ databases: [], folders: [], entries: [], files: [] });
      return;
    }

    const client = getUserScopedClient(req.user.accessToken);
    const ilikePattern = `%${escapeIlike(trimmed)}%`;

    const databasesPromise = client
      .from("databases")
      .select("id, name, icon, color, description")
      .eq("archived", false)
      .ilike("name", ilikePattern)
      .limit(limit);

    const foldersPromise = client
      .from("folders")
      .select("id, name, path, parent_id")
      .ilike("name", ilikePattern)
      .limit(limit);

    const entriesPromise = client
      .from("entries")
      .select("id, database_id, data, created_at")
      .textSearch("search_vector", trimmed, { config: "german", type: "websearch" })
      .order("created_at", { ascending: false })
      .limit(limit);

    // Dateinamen via ilike — tsvector tokenisiert "Toyota_Werkstatt.pdf"
    // als einen Token, deshalb finden Volltext-Queries keine Teil-Namen.
    const filesPromise = client
      .from("files")
      .select("id, name, mime_type, folder_id, size_bytes, created_at")
      .is("deleted_at", null)
      .ilike("name", ilikePattern)
      .order("created_at", { ascending: false })
      .limit(limit);

    const [
      { data: databases, error: dbErr },
      { data: folders, error: foErr },
      { data: entries, error: enErr },
      { data: files, error: fiErr },
    ] = await Promise.all([
      databasesPromise,
      foldersPromise,
      entriesPromise,
      filesPromise,
    ]);

    if (dbErr || foErr || enErr || fiErr) {
      const msg =
        dbErr?.message ?? foErr?.message ?? enErr?.message ?? fiErr?.message ?? "search failed";
      throw errors.internal(`Search failed: ${msg}`);
    }

    res.json({
      databases: databases ?? [],
      folders: folders ?? [],
      entries: entries ?? [],
      files: files ?? [],
    });
  } catch (err) {
    next(err);
  }
});
