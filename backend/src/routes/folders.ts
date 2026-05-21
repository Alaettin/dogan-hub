import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import { createFolderSchema, updateFolderSchema } from "../schemas/folder.schema.js";
import { softDeleteFolderTreeFiles } from "../services/folder.service.js";

export const foldersRouter = Router();

interface FolderRow {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  path: string;
}

async function buildPath(
  client: SupabaseClient,
  parentId: string | null,
  name: string,
): Promise<string> {
  if (!parentId) return `/${name}`;
  const { data: parent, error } = await client
    .from("folders")
    .select("path")
    .eq("id", parentId)
    .maybeSingle();
  if (error || !parent) throw errors.badRequest("Parent folder not found");
  return `${parent.path}/${name}`;
}

// Recompute path-Spalte rekursiv für alle Descendants nach einem Move/Rename.
// Iteriert in BFS-Reihenfolge — nicht performance-kritisch für MVP.
async function recomputeDescendantPaths(
  client: SupabaseClient,
  startFolderId: string,
  newPath: string,
): Promise<void> {
  await client.from("folders").update({ path: newPath }).eq("id", startFolderId);

  const { data: children } = await client
    .from("folders")
    .select("id, name")
    .eq("parent_id", startFolderId);

  for (const child of (children ?? []) as Array<{ id: string; name: string }>) {
    await recomputeDescendantPaths(client, child.id, `${newPath}/${child.name}`);
  }
}

// ─── GET /api/folders ────────────────────────────────────────────────
foldersRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);
    const { data, error } = await client
      .from("folders")
      .select("id, owner_id, parent_id, name, path, created_at, updated_at")
      .order("name", { ascending: true });
    if (error) throw errors.internal("Failed to load folders");
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/folders ───────────────────────────────────────────────
foldersRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createFolderSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);
    const path = await buildPath(client, body.parent_id ?? null, body.name);

    const { data, error } = await client
      .from("folders")
      .insert({
        owner_id: req.user.id,
        parent_id: body.parent_id ?? null,
        name: body.name,
        path,
      })
      .select()
      .single();
    if (error || !data) {
      throw error?.code === "23505"
        ? errors.conflict(`Ordner "${body.name}" existiert hier bereits`)
        : errors.internal(`Insert failed: ${error?.message ?? "unknown"}`);
    }

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "folder",
      resource_id: data.id,
      metadata: { name: body.name, parent_id: body.parent_id ?? null },
      ip: req.ip,
    });

    res.status(201).json({ folder: data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/folders/:id ──────────────────────────────────────────
foldersRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateFolderSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    const { data: existing } = await client
      .from("folders")
      .select("id, name, parent_id, path")
      .eq("id", req.params.id)
      .maybeSingle<FolderRow>();
    if (!existing) throw errors.notFound("Folder not found");

    // Self-Reference + Cycle-Check (kein Move zu eigenem Descendant)
    if (body.parent_id) {
      if (body.parent_id === existing.id) {
        throw errors.badRequest("Folder kann nicht in sich selbst");
      }
      const { data: target } = await client
        .from("folders")
        .select("path")
        .eq("id", body.parent_id)
        .maybeSingle();
      if (target && target.path.startsWith(existing.path + "/")) {
        throw errors.badRequest("Folder kann nicht in einen seiner Unterordner verschoben werden");
      }
    }

    const newName = body.name ?? existing.name;
    const newParent =
      body.parent_id === undefined ? existing.parent_id : body.parent_id;
    const newPath = await buildPath(client, newParent, newName);

    const { data, error } = await client
      .from("folders")
      .update({ name: newName, parent_id: newParent, path: newPath })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error || !data) {
      throw error?.code === "23505"
        ? errors.conflict(`Ordner "${newName}" existiert hier bereits`)
        : errors.internal(`Update failed: ${error?.message ?? "unknown"}`);
    }

    // Descendants neu berechnen wenn path geändert hat
    if (newPath !== existing.path) {
      const { data: children } = await client
        .from("folders")
        .select("id, name")
        .eq("parent_id", req.params.id);
      for (const child of (children ?? []) as Array<{ id: string; name: string }>) {
        await recomputeDescendantPaths(client, child.id, `${newPath}/${child.name}`);
      }
    }

    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "folder",
      resource_id: data.id,
      metadata: {
        renamed: body.name !== undefined,
        moved: body.parent_id !== undefined,
      },
      ip: req.ip,
    });

    res.json({ folder: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/folders/:id ─────────────────────────────────────────
// Files im Sub-Tree gehen in den Papierkorb (Soft-Delete). Sub-Folders
// selbst werden via DB-Cascade hart gelöscht — kein Folder-Trash.
foldersRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: existing } = await client
      .from("folders")
      .select("id, name, path")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existing) throw errors.notFound("Folder not found");

    // Reihenfolge ist sicherheitsrelevant: softDeleteFolderTreeFiles macht ein
    // atomares UPDATE (alle nicht-gelöschten Files im Subtree → deleted_at +
    // folder_id=null) und WIRFT bei Fehler. Erst danach folgt der destruktive
    // Folder-Delete. Dadurch referenziert beim CASCADE keine aktive File-Zeile
    // mehr den Subtree → keine versehentlichen Hard-Deletes / Orphans.
    const { softDeletedFileCount } = await softDeleteFolderTreeFiles(client, existing);

    const { error } = await client.from("folders").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Delete failed");

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "folder",
      resource_id: existing.id,
      metadata: { name: existing.name, soft_deleted_file_count: softDeletedFileCount },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
