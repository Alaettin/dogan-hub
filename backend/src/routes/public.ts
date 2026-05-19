import { randomUUID } from "node:crypto";
import { Router } from "express";
import { supabaseService } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { recordEvent } from "../services/audit.service.js";
import {
  MAX_FILE_SIZE_BYTES,
  sanitizeFilename,
  validateMagicBytes,
} from "../services/file.service.js";
import {
  buildStoragePath,
  deleteObjects,
  downloadHeadBytes,
  getSignedDownloadUrl,
  getSignedUploadUrl,
} from "../services/storage.service.js";
import {
  assertCanModifyFolder,
  assertEditPermission,
  assertFileInShareSubtree,
  assertFolderInShareSubtree,
  resolveShareByToken,
  type ResolvedShare,
} from "../services/share.service.js";
import { softDeleteFolderTreeFiles } from "../services/folder.service.js";
import {
  createFolderSchema,
  updateFolderSchema,
} from "../schemas/folder.schema.js";
import { signUploadSchema, updateFileSchema } from "../schemas/file.schema.js";

export const publicRouter = Router();

// Hilfsmethode: Token resolven, sonst 404. Wird in jedem Handler aufgerufen.
async function resolveOr404(token: string): Promise<ResolvedShare> {
  const resolved = await resolveShareByToken(token);
  if (!resolved) throw errors.notFound("Freigabe abgelaufen oder ungültig");
  return resolved;
}

// Audit-Helper: schreibt share_access Events. user_id ist immer der Owner.
async function logShareAccess(
  resolved: ResolvedShare,
  action: "create" | "update" | "delete",
  metadata: Record<string, unknown>,
  ip: string | undefined,
): Promise<void> {
  await recordEvent({
    user_id: resolved.share.owner_id,
    action,
    resource_type: "share_access",
    metadata: { share_id: resolved.share.id, ...metadata },
    ip,
  });
}

// ─── GET /api/public/shares/:token ───────────────────────────────────
// Share-Metadaten für Empfänger: Folder-Name, Permission, Restzeit.
publicRouter.get("/shares/:token", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    res.json({
      folder: {
        id: resolved.folder.id,
        name: resolved.folder.name,
        path: resolved.folder.path,
      },
      permission: resolved.share.permission,
      expires_at: resolved.share.expires_at,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/public/shares/:token/folders ───────────────────────────
// Sub-Folders im Subtree. ?parent_id=… default = share-root.
publicRouter.get("/shares/:token/folders", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    const parentIdRaw = req.query.parent_id;
    const parentId =
      typeof parentIdRaw === "string" && parentIdRaw.length > 0
        ? parentIdRaw
        : resolved.folder.id;

    // Sicherheits-Check: parent_id muss im Subtree liegen.
    await assertFolderInShareSubtree(resolved, parentId);

    const { data, error } = await supabaseService
      .from("folders")
      .select("id, owner_id, parent_id, name, path, created_at, updated_at")
      .eq("parent_id", parentId)
      .order("name", { ascending: true });
    if (error) throw errors.internal(`Failed to load folders: ${error.message}`);

    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/public/shares/:token/files ─────────────────────────────
// Files im angegebenen Folder (muss im Subtree liegen). default = share-root.
publicRouter.get("/shares/:token/files", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    const folderIdRaw = req.query.folder_id;
    const folderId =
      typeof folderIdRaw === "string" && folderIdRaw.length > 0
        ? folderIdRaw
        : resolved.folder.id;

    await assertFolderInShareSubtree(resolved, folderId);

    const { data, error } = await supabaseService
      .from("files")
      .select("id, folder_id, name, storage_path, mime_type, size_bytes, created_at, updated_at")
      .eq("folder_id", folderId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) throw errors.internal(`Failed to load files: ${error.message}`);

    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/public/shares/:token/files/:fileId/download ───────────
// Signed Download-URL (60min Gültigkeit).
publicRouter.post("/shares/:token/files/:fileId/download", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    const file = await assertFileInShareSubtree(resolved, req.params.fileId);
    const url = await getSignedDownloadUrl(file.storage_path);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/public/shares/:token/sign-upload ──────────────────────
// Edit-Permission: erstellt File-Row + signed Upload URL.
publicRouter.post("/shares/:token/sign-upload", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    assertEditPermission(resolved);

    const body = signUploadSchema.parse(req.body);
    if (body.size_bytes <= 0) throw errors.badRequest("Empty file");
    if (body.size_bytes > MAX_FILE_SIZE_BYTES) {
      throw errors.badRequest(`Datei zu groß (max ${MAX_FILE_SIZE_BYTES} bytes)`);
    }

    const targetFolderId = body.folder_id ?? resolved.folder.id;
    await assertFolderInShareSubtree(resolved, targetFolderId);

    const safeName = sanitizeFilename(body.filename);
    const fileId = randomUUID();
    const storagePath = buildStoragePath(resolved.share.owner_id, fileId, safeName);
    const { signedUrl, token: uploadToken } = await getSignedUploadUrl(storagePath);

    const { data, error } = await supabaseService
      .from("files")
      .insert({
        id: fileId,
        owner_id: resolved.share.owner_id,
        folder_id: targetFolderId,
        name: safeName,
        storage_path: storagePath,
        mime_type: body.mime_type,
        size_bytes: body.size_bytes,
        checksum_sha256: body.checksum_sha256 ?? null,
      })
      .select()
      .single();
    if (error || !data) {
      throw errors.internal(`File pre-register failed: ${error?.message ?? "unknown"}`);
    }

    res.status(201).json({
      file_id: fileId,
      signed_url: signedUrl,
      token: uploadToken,
      path: storagePath,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/public/shares/:token/files/:fileId/commit ─────────────
// Edit-Permission: Magic-Bytes-Verifikation nach erfolgreichem Upload.
publicRouter.post("/shares/:token/files/:fileId/commit", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    assertEditPermission(resolved);
    const file = await assertFileInShareSubtree(resolved, req.params.fileId);

    const head = await downloadHeadBytes(file.storage_path);
    if (head) {
      const verdict = await validateMagicBytes(head, file.mime_type);
      if (!verdict.ok && verdict.detectedMime) {
        try {
          await deleteObjects([file.storage_path]);
        } catch (cleanupErr) {
          logger.warn(
            { err: cleanupErr, path: file.storage_path },
            "magic-bytes cleanup failed (share)",
          );
        }
        await supabaseService.from("files").delete().eq("id", file.id);
        throw errors.badRequest(
          `Datei-Inhalt passt nicht zum angegebenen Typ (deklariert: ${file.mime_type}, erkannt: ${verdict.detectedMime}). Upload abgelehnt.`,
        );
      }
      if (verdict.ok && verdict.detectedMime && verdict.detectedMime !== file.mime_type) {
        await supabaseService
          .from("files")
          .update({ mime_type: verdict.detectedMime })
          .eq("id", file.id);
      }
    }

    await logShareAccess(resolved, "create", {
      action_on: "file",
      file_id: file.id,
      name: file.name,
    }, req.ip);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/public/shares/:token/files/:fileId ───────────────────
// Edit: Rename/Move. Ziel-Folder muss im Subtree.
publicRouter.patch("/shares/:token/files/:fileId", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    assertEditPermission(resolved);
    const file = await assertFileInShareSubtree(resolved, req.params.fileId);

    const body = updateFileSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = sanitizeFilename(body.name);
    if (body.folder_id !== undefined) {
      if (body.folder_id === null) {
        throw errors.badRequest("Datei muss in einem Ordner bleiben (Root nicht teilbar)");
      }
      await assertFolderInShareSubtree(resolved, body.folder_id);
      update.folder_id = body.folder_id;
    }

    const { data, error } = await supabaseService
      .from("files")
      .update(update)
      .eq("id", file.id)
      .select()
      .maybeSingle();
    if (error) throw errors.internal(`Update failed: ${error.message}`);
    if (!data) throw errors.notFound("File not found");

    await logShareAccess(resolved, "update", {
      action_on: "file",
      file_id: file.id,
      renamed: body.name !== undefined,
      moved: body.folder_id !== undefined,
    }, req.ip);

    res.json({ file: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/public/shares/:token/files/:fileId ──────────────────
// Edit: Soft-Delete (deleted_at gesetzt, Storage-Object bleibt — Owner kann
// im Trash wiederherstellen oder leeren).
publicRouter.delete("/shares/:token/files/:fileId", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    assertEditPermission(resolved);
    const file = await assertFileInShareSubtree(resolved, req.params.fileId);

    const { error } = await supabaseService
      .from("files")
      .update({ deleted_at: new Date().toISOString(), folder_id: null })
      .eq("id", file.id);
    if (error) throw errors.internal(`Soft-delete failed: ${error.message}`);

    await logShareAccess(resolved, "delete", {
      action_on: "file",
      file_id: file.id,
      name: file.name,
    }, req.ip);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/public/shares/:token/folders ──────────────────────────
// Edit: Sub-Folder anlegen. Parent muss im Subtree.
publicRouter.post("/shares/:token/folders", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    assertEditPermission(resolved);

    const body = createFolderSchema.parse(req.body);
    const parentId = body.parent_id ?? resolved.folder.id;
    const parent = await assertFolderInShareSubtree(resolved, parentId);

    const path = `${parent.path}/${body.name}`;

    const { data, error } = await supabaseService
      .from("folders")
      .insert({
        owner_id: resolved.share.owner_id,
        parent_id: parentId,
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

    await logShareAccess(resolved, "create", {
      action_on: "folder",
      folder_id: data.id,
      name: body.name,
    }, req.ip);

    res.status(201).json({ folder: data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/public/shares/:token/folders/:folderId ───────────────
// Edit: Rename eines Sub-Folders (NICHT der Root).
publicRouter.patch("/shares/:token/folders/:folderId", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    const target = await assertCanModifyFolder(resolved, req.params.folderId);

    const body = updateFolderSchema.parse(req.body);
    if (body.parent_id !== undefined) {
      throw errors.badRequest("Move via Share-Link wird nicht unterstützt — nur Rename");
    }
    if (body.name === undefined) {
      throw errors.badRequest("Name fehlt");
    }

    // Pfad neu berechnen + Descendants aktualisieren.
    const oldPath = target.path;
    const lastSlash = oldPath.lastIndexOf("/");
    const newPath = oldPath.slice(0, lastSlash + 1) + body.name;

    const { error } = await supabaseService
      .from("folders")
      .update({ name: body.name, path: newPath })
      .eq("id", target.id);
    if (error) {
      if (error.code === "23505") {
        throw errors.conflict(`Ordner "${body.name}" existiert hier bereits`);
      }
      throw errors.internal(`Update failed: ${error.message}`);
    }

    await recomputeDescendantPaths(target.id, newPath);

    await logShareAccess(resolved, "update", {
      action_on: "folder",
      folder_id: target.id,
      renamed_to: body.name,
    }, req.ip);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/public/shares/:token/folders/:folderId ──────────────
// Edit: Sub-Folder löschen (NICHT der Root). Files im Sub-Tree wandern in
// den Papierkorb des Owners, Folders selbst per DB-Cascade hart weg.
publicRouter.delete("/shares/:token/folders/:folderId", async (req, res, next) => {
  try {
    const resolved = await resolveOr404(req.params.token);
    const target = await assertCanModifyFolder(resolved, req.params.folderId);

    const { softDeletedFileCount } = await softDeleteFolderTreeFiles(
      supabaseService,
      target,
    );

    const { error } = await supabaseService
      .from("folders")
      .delete()
      .eq("id", target.id);
    if (error) throw errors.internal(`Delete failed: ${error.message}`);

    await logShareAccess(resolved, "delete", {
      action_on: "folder",
      folder_id: target.id,
      name: target.name,
      soft_deleted_file_count: softDeletedFileCount,
    }, req.ip);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── Helper: Pfad-Rekursion analog folders.ts:recomputeDescendantPaths
async function recomputeDescendantPaths(folderId: string, newPath: string): Promise<void> {
  const { data: children } = await supabaseService
    .from("folders")
    .select("id, name")
    .eq("parent_id", folderId);

  for (const child of (children ?? []) as Array<{ id: string; name: string }>) {
    const childPath = `${newPath}/${child.name}`;
    await supabaseService.from("folders").update({ path: childPath }).eq("id", child.id);
    await recomputeDescendantPaths(child.id, childPath);
  }
}

// publicShareLimiter wird in index.ts beim Mount applied — siehe app.use(...)
