import { fileTypeFromBuffer } from "file-type";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Whitelist MUSS mit der Liste in 0007_storage_bucket.sql übereinstimmen,
// sonst lehnt Supabase Storage den Upload silently ab.
export const MIME_WHITELIST = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
]);

// Magic-Bytes-Erkennung via file-type erkennt manche Text-Formate nicht (TXT, CSV, MD, JSON).
// Für diese akzeptieren wir den declared MIME, weil keine sichere Magic-Bytes-Signatur existiert.
const TEXT_MIMES_WITHOUT_MAGIC = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export interface ValidationResult {
  ok: boolean;
  error?: string;
  detectedMime?: string;
}

export function validateMimeAndSize(declaredMime: string, sizeBytes: number): ValidationResult {
  if (sizeBytes <= 0) return { ok: false, error: "Empty file" };
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File too large (max ${MAX_FILE_SIZE_BYTES} bytes)` };
  }
  if (!MIME_WHITELIST.has(declaredMime)) {
    return { ok: false, error: `MIME type "${declaredMime}" not allowed` };
  }
  return { ok: true };
}

export async function validateMagicBytes(
  buffer: Buffer | Uint8Array,
  declaredMime: string,
): Promise<ValidationResult> {
  if (TEXT_MIMES_WITHOUT_MAGIC.has(declaredMime)) {
    return { ok: true, detectedMime: declaredMime };
  }
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    return { ok: false, error: "Could not detect file type from contents" };
  }
  if (detected.mime !== declaredMime) {
    return {
      ok: false,
      error: `MIME mismatch: declared "${declaredMime}", detected "${detected.mime}"`,
      detectedMime: detected.mime,
    };
  }
  return { ok: true, detectedMime: detected.mime };
}

// Strippt path-traversal, Steuerzeichen, max 200 Zeichen. Erlaubt deutsche Umlaute.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/]/g, "_")          // Slashes → Underscore (path-traversal)
    .replace(CONTROL_CHARS, "")      // Control chars raus
    .replace(/^\.+/, "")             // Führende Punkte (Unix-versteckte Files)
    .trim();
  if (cleaned.length === 0) return "unnamed";
  if (cleaned.length > 200) {
    const lastDot = cleaned.lastIndexOf(".");
    const ext = lastDot > 0 ? cleaned.slice(lastDot) : "";
    return cleaned.slice(0, 200 - ext.length) + ext;
  }
  return cleaned;
}
