// Fallback wenn file.type leer/unbekannt ist (Firefox + Windows-Browser
// reporten viele Datei-Typen als "" oder application/octet-stream).
//
// Backend hat keine MIME-Whitelist mehr — wir akzeptieren alles, das
// nicht-leer ist. Map für gängige Typen damit der Backend-Header-Match
// stimmt; Rest fällt auf application/octet-stream zurück.

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  ico: "image/x-icon",

  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",

  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  rtf: "application/rtf",

  zip: "application/zip",
  rar: "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",

  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/m4a",
  flac: "audio/flac",

  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",

  msi: "application/x-msi",
  exe: "application/x-msdownload",
  dmg: "application/x-apple-diskimage",
  iso: "application/x-iso9660-image",
  apk: "application/vnd.android.package-archive",
};

export function resolveMime(file: File): string {
  const reported = file.type?.trim();
  if (reported && reported !== "application/octet-stream") return reported;

  const dot = file.name.lastIndexOf(".");
  if (dot >= 0) {
    const ext = file.name.slice(dot + 1).toLowerCase();
    const mapped = EXT_TO_MIME[ext];
    if (mapped) return mapped;
  }

  // Letzter Fallback — Backend akzeptiert beliebige MIME-Strings
  return "application/octet-stream";
}
