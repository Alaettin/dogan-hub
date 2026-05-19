import { GlassCard } from "../../components/ui/GlassCard";
import { formatFileSize, getFileIcon } from "./file-icons";
import { FileRowMenu } from "./FileRowMenu";
import type { FileRow } from "./useFiles";
import "./files.css";

interface FileGridProps {
  files: FileRow[];
  onOpen: (file: FileRow) => void;
}

export function FileGrid({ files, onOpen }: FileGridProps) {
  if (files.length === 0) {
    return (
      <div className="file-list__empty">
        Noch keine Dateien hier — leg sie per Drag-Drop ab oder klick auf "Upload".
      </div>
    );
  }

  return (
    <div className="file-grid">
      {files.map((file) => {
        const Icon = getFileIcon(file.mime_type);
        return (
          <GlassCard
            key={file.id}
            className="file-tile"
            onClick={() => onOpen(file)}
          >
            <div className="file-tile__icon">
              <Icon size={22} />
            </div>
            <div className="file-tile__name" title={file.name}>
              {file.name}
            </div>
            <div className="file-tile__meta">{formatFileSize(file.size_bytes)}</div>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ position: "absolute", top: 6, right: 6 }}
            >
              <FileRowMenu file={file} />
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
