import { randomBytes } from "node:crypto";
import { supabaseService } from "../config/supabase.js";
import { errors } from "../lib/errors.js";
import { MAX_SHARE_TTL_SEC } from "../schemas/share.schema.js";

export interface FolderShareRow {
  id: string;
  folder_id: string;
  owner_id: string;
  token: string;
  permission: "read" | "edit";
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface FolderRow {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  path: string;
}

export interface ResolvedShare {
  share: FolderShareRow;
  folder: FolderRow;
}

export function generateShareToken(): string {
  // 32 Byte = 256 bit — praktisch unbrute-forc-bar.
  // base64url ergibt 43 URL-safe Zeichen (kein =-Padding nötig).
  return randomBytes(32).toString("base64url");
}

interface CreateShareArgs {
  folderId: string;
  ownerId: string;
  permission: "read" | "edit";
  ttlSec: number;
}

export async function createShare(args: CreateShareArgs): Promise<FolderShareRow> {
  if (args.ttlSec <= 0 || args.ttlSec > MAX_SHARE_TTL_SEC) {
    throw errors.badRequest("TTL muss zwischen 1s und 7 Tagen liegen");
  }

  // Folder muss existieren UND dem Owner gehören. RLS via Service-Role
  // greift nicht — wir prüfen den Owner-Check manuell.
  const { data: folder, error: fErr } = await supabaseService
    .from("folders")
    .select("id, owner_id")
    .eq("id", args.folderId)
    .maybeSingle();
  if (fErr) throw errors.internal("Failed to verify folder");
  if (!folder) throw errors.notFound("Folder nicht gefunden");
  if (folder.owner_id !== args.ownerId) throw errors.forbidden("Folder gehört dir nicht");

  const expiresAt = new Date(Date.now() + args.ttlSec * 1000).toISOString();
  const token = generateShareToken();

  const { data, error } = await supabaseService
    .from("folder_shares")
    .insert({
      folder_id: args.folderId,
      owner_id: args.ownerId,
      token,
      permission: args.permission,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error || !data) {
    throw errors.internal(`Share-Erstellung fehlgeschlagen: ${error?.message ?? "unknown"}`);
  }
  return data as FolderShareRow;
}

// Sucht Share per Token, validiert Expiry + Revoke, joint den Root-Folder.
// Gibt null zurück bei expired/revoked/not-found — Caller mappt auf 404.
export async function resolveShareByToken(token: string): Promise<ResolvedShare | null> {
  const { data: share, error } = await supabaseService
    .from("folder_shares")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error || !share) return null;

  const typedShare = share as FolderShareRow;
  if (typedShare.revoked_at) return null;
  if (new Date(typedShare.expires_at) <= new Date()) return null;

  const { data: folder, error: fErr } = await supabaseService
    .from("folders")
    .select("id, owner_id, parent_id, name, path")
    .eq("id", typedShare.folder_id)
    .maybeSingle();
  if (fErr || !folder) return null;

  return { share: typedShare, folder: folder as FolderRow };
}

// Subtree-Check via denormalisierter folders.path-Spalte:
// targetFolder.path muss mit share.folder.path beginnen ODER identisch sein.
export async function assertFolderInShareSubtree(
  resolved: ResolvedShare,
  targetFolderId: string,
): Promise<FolderRow> {
  if (targetFolderId === resolved.folder.id) return resolved.folder;

  const { data: target, error } = await supabaseService
    .from("folders")
    .select("id, owner_id, parent_id, name, path")
    .eq("id", targetFolderId)
    .maybeSingle();
  if (error || !target) throw errors.notFound("Folder nicht gefunden");

  const typedTarget = target as FolderRow;
  const rootPath = resolved.folder.path;
  if (!typedTarget.path.startsWith(`${rootPath}/`) && typedTarget.path !== rootPath) {
    throw errors.forbidden("Folder liegt außerhalb der Freigabe");
  }
  if (typedTarget.owner_id !== resolved.share.owner_id) {
    // Defensive: sollte nie passieren da folders cascade-locked auf owner.
    throw errors.forbidden("Folder-Owner stimmt nicht");
  }
  return typedTarget;
}

export async function assertFileInShareSubtree(
  resolved: ResolvedShare,
  fileId: string,
): Promise<{ id: string; folder_id: string | null; storage_path: string; mime_type: string; name: string; owner_id: string }> {
  const { data: file, error } = await supabaseService
    .from("files")
    .select("id, folder_id, storage_path, mime_type, name, owner_id, deleted_at")
    .eq("id", fileId)
    .maybeSingle();
  if (error || !file) throw errors.notFound("Datei nicht gefunden");
  if (file.deleted_at) throw errors.notFound("Datei ist gelöscht");
  if (file.owner_id !== resolved.share.owner_id) {
    throw errors.forbidden("Datei gehört nicht zum Share-Owner");
  }
  if (!file.folder_id) {
    throw errors.forbidden("Datei liegt nicht in einem Folder (Root nicht teilbar)");
  }
  await assertFolderInShareSubtree(resolved, file.folder_id);
  return file;
}

export function assertEditPermission(resolved: ResolvedShare): void {
  if (resolved.share.permission !== "edit") {
    throw errors.forbidden("Diese Freigabe erlaubt nur Lesen");
  }
}

// Edit-Permission erlaubt Sub-Tree-Manipulation, ABER niemals den Wurzel-Folder
// selbst (Rename/Delete). Diese Funktion prüft beides.
export async function assertCanModifyFolder(
  resolved: ResolvedShare,
  folderId: string,
): Promise<FolderRow> {
  assertEditPermission(resolved);
  if (folderId === resolved.folder.id) {
    throw errors.forbidden("Der freigegebene Wurzel-Folder kann nicht via Share-Link verändert werden");
  }
  return assertFolderInShareSubtree(resolved, folderId);
}
