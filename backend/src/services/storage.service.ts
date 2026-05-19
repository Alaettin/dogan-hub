import { supabaseService } from "../config/supabase.js";
import { logger } from "../lib/logger.js";

export const STORAGE_BUCKET = "doganhub-files";

const DEFAULT_UPLOAD_TTL_SEC = 5 * 60;
const DEFAULT_DOWNLOAD_TTL_SEC = 60 * 60;

// Path-Konvention: {owner_id}/{file_id}/{filename}
// Erster Path-Segment = owner_id, damit RLS via storage.foldername(name)[1] greift.
export function buildStoragePath(ownerId: string, fileId: string, filename: string): string {
  return `${ownerId}/${fileId}/${filename}`;
}

export async function getSignedUploadUrl(
  storagePath: string,
  ttlSec = DEFAULT_UPLOAD_TTL_SEC,
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await supabaseService.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown"}`);
  }
  // expiresIn ist nicht direkt im createSignedUploadUrl-API der aktuellen SDK-Version.
  // Token-TTL ist Supabase-default (~2h). Manuell-Override für strengere TTL kommt Phase 2.
  void ttlSec;
  return { signedUrl: data.signedUrl, token: data.token, path: storagePath };
}

export async function getSignedDownloadUrl(
  storagePath: string,
  ttlSec = DEFAULT_DOWNLOAD_TTL_SEC,
): Promise<string> {
  const { data, error } = await supabaseService.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, ttlSec);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed download URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

export async function deleteObjects(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  const { error } = await supabaseService.storage.from(STORAGE_BUCKET).remove(storagePaths);
  if (error) {
    logger.warn({ err: error, paths: storagePaths }, "storage.deleteObjects failed");
    throw error;
  }
}

export async function getObjectMetadata(storagePath: string): Promise<{ size: number } | null> {
  const dir = storagePath.split("/").slice(0, -1).join("/");
  const filename = storagePath.split("/").pop();
  if (!filename) return null;
  const { data, error } = await supabaseService.storage
    .from(STORAGE_BUCKET)
    .list(dir, { limit: 1, search: filename });
  if (error || !data?.length) return null;
  const entry = data[0];
  return { size: entry.metadata?.size ?? 0 };
}
