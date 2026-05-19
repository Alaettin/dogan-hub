import {
  FileText,
  Image as ImageIcon,
  FileArchive,
  FileSpreadsheet,
  File as FileIcon,
  FileType,
  Presentation,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function getFileIcon(mimeType: string): LucideIcon {
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.includes("zip")) return FileArchive;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv")
    return FileSpreadsheet;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return Presentation;
  if (mimeType.startsWith("text/") || mimeType === "application/json") return FileType;
  return FileIcon;
}

const BYTES_PER_GB = 1024 ** 3;

export function formatFileSize(bytes: number): string {
  if (bytes >= BYTES_PER_GB) return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
