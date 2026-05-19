import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserScopedClient, supabaseService } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { recordEvent } from "../services/audit.service.js";
import { createShareSchema } from "../schemas/share.schema.js";
import { createShare } from "../services/share.service.js";

export const sharesRouter = Router();

// ─── POST /api/folders/:folderId/shares ──────────────────────────────
// Erstellt neuen Share-Link für einen Folder.
sharesRouter.post("/:folderId/shares", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const body = createShareSchema.parse(req.body);

    const share = await createShare({
      folderId: req.params.folderId,
      ownerId: req.user.id,
      permission: body.permission,
      ttlSec: body.ttl_sec,
    });

    await recordEvent({
      user_id: req.user.id,
      action: "create",
      resource_type: "folder_share",
      resource_id: share.id,
      metadata: {
        folder_id: share.folder_id,
        permission: share.permission,
        expires_at: share.expires_at,
      },
      ip: req.ip,
    });

    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/folders/:folderId/shares ───────────────────────────────
// Listet aktive (nicht-widerrufene, nicht-abgelaufene) Shares für einen Folder.
sharesRouter.get("/:folderId/shares", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data, error } = await client
      .from("folder_shares")
      .select("id, folder_id, owner_id, token, permission, expires_at, revoked_at, created_at")
      .eq("folder_id", req.params.folderId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw errors.internal(`Failed to load shares: ${error.message}`);

    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/folders/shares ─────────────────────────────────────────
// Alle eigenen aktiven Shares (für künftige Übersichts-Page).
sharesRouter.get("/shares", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();
    const client = getUserScopedClient(req.user.accessToken);

    const { data, error } = await client
      .from("folder_shares")
      .select("id, folder_id, owner_id, token, permission, expires_at, revoked_at, created_at")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw errors.internal(`Failed to load shares: ${error.message}`);

    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/folders/shares/:shareId ─────────────────────────────
// Widerruf via revoked_at = now(). Soft-Delete, damit Audit-Trail bleibt.
sharesRouter.delete("/shares/:shareId", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw errors.unauthorized();

    // Service-Role: Eigentum prüfen wir manuell — wir wollen sicher sein dass
    // der User nur seine eigenen Shares widerrufen kann, RLS könnte das auch,
    // aber wir wollen einen sauberen 403 statt stillen No-Op.
    const { data: existing, error: readErr } = await supabaseService
      .from("folder_shares")
      .select("id, owner_id, folder_id")
      .eq("id", req.params.shareId)
      .maybeSingle();
    if (readErr) throw errors.internal(`Failed to read share: ${readErr.message}`);
    if (!existing) throw errors.notFound("Share nicht gefunden");
    if (existing.owner_id !== req.user.id) {
      throw errors.forbidden("Diese Freigabe gehört dir nicht");
    }

    const { error } = await supabaseService
      .from("folder_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", req.params.shareId);
    if (error) throw errors.internal(`Widerruf fehlgeschlagen: ${error.message}`);

    await recordEvent({
      user_id: req.user.id,
      action: "delete",
      resource_type: "folder_share",
      resource_id: req.params.shareId,
      metadata: { folder_id: existing.folder_id },
      ip: req.ip,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
