import { randomUUID } from "node:crypto";
import { Router } from "express";
import archiver from "archiver";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient, supabaseService } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import {
  commitFileSchema,
  downloadZipSchema,
  listFilesQuerySchema,
  signUploadSchema,
  updateFileSchema,
} from "../schemas/file.schema.js";
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
import { logger } from "../lib/logger.js";

export const filesRouter = Router();

// ─── GET /api/files ──────────────────────────────────────────────────
filesRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const { folder_id, limit, offset } = listFilesQuerySchema.parse(req.query);
    const client = getUserScopedClient(req.user.accessToken);

    let query = client
      .from("files")
      .select(
        "id, owner_id, folder_id, name, storage_path, mime_type, size_bytes, created_at, updated_at",
        { count: "exact" },
      )
      .is("deleted_at", null);

    query = folder_id
      ? query.eq("folder_id", folder_id)
      : query.is("folder_id", null);

    const { data, error, count } = await query
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw errors.internal("Failed to load files");

    res.json({ items: data ?? [], total: count ?? 0, limit, offset });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/files/sign-upload ─────────────────────────────────────
filesRouter.post("/sign-upload", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = signUploadSchema.parse(req.body);

    // Kein MIME-Whitelist-Check mehr — User soll alles hochladen können.
    // Size-Limit + RLS-Path-Trennung bleiben als Schutz.
    if (body.size_bytes <= 0) throw errors.badRequest("Empty file");
    if (body.size_bytes > MAX_FILE_SIZE_BYTES) {
      throw errors.badRequest(`Datei zu groß (max ${MAX_FILE_SIZE_BYTES} bytes)`);
    }

    const safeName = sanitizeFilename(body.filename);
    const fileId = randomUUID();
    const storagePath = buildStoragePath(req.user.id, fileId, safeName);

    const client = getUserScopedClient(req.user.accessToken);

    // folder_id validieren — Zielordner muss existieren UND dem User gehören.
    // Sonst FK-Violation, die nur kryptisch ist.
    let resolvedFolderId: string | null = body.folder_id ?? null;
    if (resolvedFolderId) {
      const { data: folder } = await client
        .from("folders")
        .select("id")
        .eq("id", resolvedFolderId)
        .maybeSingle();
      if (!folder) {
        throw errors.badRequest(
          "Zielordner existiert nicht mehr — bitte zur Übersicht zurück und neu laden.",
        );
      }
    }

    // Signed Upload URL holen
    const { signedUrl, token } = await getSignedUploadUrl(storagePath);

    // DB-Row anlegen (status implicit: nicht-committed = noch kein audit-event)
    const { data, error } = await client
      .from("files")
      .insert({
        id: fileId,
        owner_id: req.user.id,
        folder_id: resolvedFolderId,
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
      token,
      path: storagePath,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/files/:id/commit ──────────────────────────────────────
filesRouter.post("/:id/commit", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    commitFileSchema.parse(req.body ?? {});
    const client = getUserScopedClient(req.user.accessToken);

    const { data: file } = await client
      .from("files")
      .select("id, folder_id, name, size_bytes, mime_type, storage_path")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!file) throw errors.notFound("File not found");

    // Magic-Bytes-Verifikation: declared MIME muss zum Datei-Inhalt passen.
    // Schützt davor, dass eine .exe als image/png hochgeladen wird.
    // Bei unerkanntem Format (Text, unbekannt) wird durchgewinkt — Validation
    // ist nur Reject-by-Mismatch, nicht Accept-by-Detection.
    const head = await downloadHeadBytes(file.storage_path);
    if (head) {
      const verdict = await validateMagicBytes(head, file.mime_type);
      if (!verdict.ok && verdict.detectedMime) {
        // Definite Mismatch — Datei aus Storage + DB entfernen.
        try {
          await deleteObjects([file.storage_path]);
        } catch (cleanupErr) {
          // Nicht verschlucken: bleibt das Objekt liegen, ist es ein Orphan
          // im Bucket. Als error loggen, damit es im Monitoring auffällt.
          logger.error(
            { err: cleanupErr, path: file.storage_path },
            "magic-bytes cleanup failed — orphan storage object left behind",
          );
        }
        await supabaseService.from("files").delete().eq("id", file.id);
        throw errors.badRequest(
          `Datei-Inhalt passt nicht zum angegebenen Typ (deklariert: ${file.mime_type}, erkannt: ${verdict.detectedMime}). Upload abgelehnt.`,
        );
      }
      // Optional: erkannte MIME ist akkurater als Browser-Declaration
      // → DB-Row aktualisieren, damit später korrekt gerendert wird.
      if (verdict.ok && verdict.detectedMime && verdict.detectedMime !== file.mime_type) {
        await client
          .from("files")
          .update({ mime_type: verdict.detectedMime })
          .eq("id", file.id);
      }
    }

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "file",
      resource_id: file.id,
      metadata: { folder_id: file.folder_id, name: file.name, size_bytes: file.size_bytes },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/files/download-zip ────────────────────────────────────
// Lädt mehrere Dateien und/oder ganze Ordner (rekursiv) als ein ZIP.
// RLS (user-scoped client) stellt sicher, dass nur eigene Dateien landen.
filesRouter.post("/download-zip", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = downloadZipSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    type Entry = { storagePath: string; zipPath: string };
    const entries: Entry[] = [];
    const used = new Set<string>();

    // Eindeutigen ZIP-Pfad sicherstellen (Namenskollision → " (2)").
    const uniquePath = (p: string): string => {
      if (!used.has(p)) {
        used.add(p);
        return p;
      }
      const dot = p.lastIndexOf(".");
      const base = dot > 0 ? p.slice(0, dot) : p;
      const ext = dot > 0 ? p.slice(dot) : "";
      let i = 2;
      let cand = `${base} (${i})${ext}`;
      while (used.has(cand)) cand = `${base} (${(i += 1)})${ext}`;
      used.add(cand);
      return cand;
    };

    let singleFolderName: string | null = null;

    // ── Ordner (rekursiv) ──
    if (body.folderIds && body.folderIds.length > 0) {
      const { data: allFolders, error: fErr } = await client
        .from("folders")
        .select("id, name, path");
      if (fErr) throw errors.internal(`Ordner laden fehlgeschlagen: ${fErr.message}`);
      const folders = (allFolders ?? []) as { id: string; name: string; path: string }[];
      const byId = new Map(folders.map((f) => [f.id, f]));

      const onlyOneFolder = body.folderIds.length === 1 && !(body.fileIds && body.fileIds.length);

      for (const rootId of body.folderIds) {
        const root = byId.get(rootId);
        if (!root) continue; // fremder/ungültiger Ordner → RLS
        if (onlyOneFolder) singleFolderName = root.name;

        const rootPath = root.path;
        const subtree = folders.filter(
          (f) => f.path === rootPath || f.path.startsWith(`${rootPath}/`),
        );
        const subtreeIds = subtree.map((f) => f.id);
        const pathById = new Map(subtree.map((f) => [f.id, f.path]));
        const baseSeg = rootPath.split("/").filter(Boolean).slice(-1)[0] ?? root.name;

        const { data: files, error: filErr } = await client
          .from("files")
          .select("name, storage_path, folder_id")
          .in("folder_id", subtreeIds)
          .is("deleted_at", null);
        if (filErr) throw errors.internal(`Dateien laden fehlgeschlagen: ${filErr.message}`);

        for (const file of files ?? []) {
          const fPath = pathById.get(file.folder_id as string) ?? rootPath;
          const relDir = baseSeg + fPath.slice(rootPath.length); // z.B. "Docs" + "/Sub"
          entries.push({
            storagePath: file.storage_path as string,
            zipPath: uniquePath(`${relDir}/${file.name as string}`),
          });
        }
      }
    }

    // ── Einzeldateien (im ZIP-Root) ──
    if (body.fileIds && body.fileIds.length > 0) {
      const { data: files, error: filErr } = await client
        .from("files")
        .select("name, storage_path")
        .in("id", body.fileIds)
        .is("deleted_at", null);
      if (filErr) throw errors.internal(`Dateien laden fehlgeschlagen: ${filErr.message}`);
      for (const file of files ?? []) {
        entries.push({
          storagePath: file.storage_path as string,
          zipPath: uniquePath(file.name as string),
        });
      }
    }

    if (entries.length === 0) throw errors.notFound("Keine Dateien zum Herunterladen");

    // ── ZIP streamen ──
    const rawName = (body.name?.trim() || singleFolderName || "dateien").replace(/\.zip$/i, "");
    const asciiName = rawName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}.zip"; filename*=UTF-8''${encodeURIComponent(rawName)}.zip`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("warning", (err) => logger.warn({ err }, "zip: warning"));
    archive.on("error", (err) => {
      logger.error({ err }, "zip: archive error");
      res.destroy();
    });
    archive.pipe(res);

    for (const entry of entries) {
      try {
        const url = await getSignedDownloadUrl(entry.storagePath, 300);
        const r = await fetch(url);
        if (!r.ok) {
          logger.warn({ path: entry.storagePath, status: r.status }, "zip: file fetch failed");
          continue;
        }
        const buf = Buffer.from(await r.arrayBuffer());
        archive.append(buf, { name: entry.zipPath });
      } catch (e) {
        logger.warn({ err: e, path: entry.storagePath }, "zip: append failed");
      }
    }

    await archive.finalize();
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/files/:id/download ────────────────────────────────────
filesRouter.post("/:id/download", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: file } = await client
      .from("files")
      .select("id, storage_path")
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!file) throw errors.notFound("File not found");

    const url = await getSignedDownloadUrl(file.storage_path);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/files/:id ────────────────────────────────────────────
filesRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = updateFileSchema.parse(req.body);
    const client = getUserScopedClient(req.user.accessToken);

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = sanitizeFilename(body.name);
    if (body.folder_id !== undefined) update.folder_id = body.folder_id;

    const { data, error } = await client
      .from("files")
      .update(update)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();
    if (error) throw errors.internal("Update failed");
    if (!data) throw errors.notFound("File not found");

    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "file",
      resource_id: data.id,
      metadata: { renamed: body.name !== undefined, moved: body.folder_id !== undefined },
      ip: req.ip,
    });

    res.json({ file: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/files/:id ───────────────────────────────────────────
// Soft-Delete: deleted_at = now(), folder_id = null. Storage-Object bleibt,
// wird in 3c.2 / Phase 2 vom Trash-Cleanup-Cron hard-gelöscht.
filesRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: file } = await client
      .from("files")
      .select("id, name, folder_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!file) throw errors.notFound("File not found");

    const { error } = await client
      .from("files")
      .update({ deleted_at: new Date().toISOString(), folder_id: null })
      .eq("id", req.params.id);
    if (error) throw errors.internal("Soft-delete failed");

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "file",
      resource_id: file.id,
      metadata: { name: file.name, folder_id: file.folder_id, soft: true },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/files/trash ────────────────────────────────────────────
filesRouter.get("/trash", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data, error, count } = await client
      .from("files")
      .select(
        "id, owner_id, folder_id, name, storage_path, mime_type, size_bytes, deleted_at, created_at, updated_at",
        { count: "exact" },
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw errors.internal("Failed to load trash");

    res.json({ items: data ?? [], total: count ?? 0 });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/files/:id/restore ─────────────────────────────────────
filesRouter.post("/:id/restore", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: file } = await client
      .from("files")
      .select("id, name")
      .eq("id", req.params.id)
      .not("deleted_at", "is", null)
      .maybeSingle();
    if (!file) throw errors.notFound("File not found in trash");

    const { data, error } = await client
      .from("files")
      .update({ deleted_at: null })
      .eq("id", req.params.id)
      .select()
      .maybeSingle();
    if (error || !data) throw errors.internal("Restore failed");

    await recordEvent({
      user_id: req.user.id,
      action: "update",
      resource_type: "file",
      resource_id: data.id,
      metadata: { name: file.name, restored: true },
      ip: req.ip,
    });

    res.json({ file: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/files/:id/purge ─────────────────────────────────────
// Hard-Delete: Storage-Object + DB-Row weg. Nur möglich wenn File in Trash.
filesRouter.delete("/:id/purge", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: file } = await client
      .from("files")
      .select("id, name, storage_path, deleted_at")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!file) throw errors.notFound("File not found");
    if (!file.deleted_at) {
      throw errors.badRequest("File ist nicht im Papierkorb — erst löschen, dann purgen");
    }

    // Storage-Object zuerst löschen (wenn das fehlschlägt, lieber orphan als DB-Inkonsistenz)
    if (file.storage_path) {
      try {
        await deleteObjects([file.storage_path]);
      } catch {
        // bewusst weiter: Storage-Cleanup-Cron räumt sonst auf
      }
    }

    const { error } = await client.from("files").delete().eq("id", req.params.id);
    if (error) throw errors.internal("Purge failed");

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "file",
      resource_id: file.id,
      metadata: { name: file.name, purged: true },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/files/trash/empty ─────────────────────────────────────
filesRouter.post("/trash/empty", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data: trashed } = await client
      .from("files")
      .select("id, storage_path")
      .not("deleted_at", "is", null);

    const paths = (trashed ?? []).map((f) => f.storage_path).filter(Boolean);
    if (paths.length > 0) {
      try {
        await deleteObjects(paths);
      } catch {
        // weitermachen
      }
    }

    const ids = (trashed ?? []).map((f) => f.id);
    if (ids.length === 0) {
      res.json({ purged: 0 });
      return;
    }

    const { error } = await client.from("files").delete().in("id", ids);
    if (error) throw errors.internal("Empty trash failed");

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "file",
      metadata: { purged_count: ids.length, empty_trash: true },
      ip: req.ip,
    });

    res.json({ purged: ids.length });
  } catch (err) {
    next(err);
  }
});

// Hilfs-Endpoint nur intern genutzt — z.B. von Storage-Cleanup-Cron in Phase 2.
export async function purgeFileHard(fileId: string, ownerId: string): Promise<void> {
  const { data: file } = await supabaseService
    .from("files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (file?.storage_path) {
    await deleteObjects([file.storage_path]);
  }
  await supabaseService.from("files").delete().eq("id", fileId);
}
