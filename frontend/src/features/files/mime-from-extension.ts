// Fallback wenn file.type leer oder "application/octet-stream" ist.
// Muss mit der MIME-Whitelist in backend/src/services/file.service.ts +
// supabase/migrations/0007_storage_bucket.sql übereinstimmen.

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
};

export function resolveMime(file: File): string {
  const reported = file.type;
  if (reported && reported !== "application/octet-stream") return reported;

  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return reported || "application/octet-stream";
  const ext = file.name.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? reported ?? "application/octet-stream";
}
