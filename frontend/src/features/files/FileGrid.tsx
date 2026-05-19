import { GlassCard } from "../../components/ui/GlassCard";
import { formatFileSize, getFileIcon } from "./file-icons";
import { FileRowMenu } from "./FileRowMenu";
import { useDownloadFile, type FileRow } from "./useFiles";
import "./files.css";

interface FileGridProps {
  files: FileRow[];
}

export function FileGrid({ files }: FileGridProps) {
  const download = useDownloadFile();

  if (files.length === 0) {
    return (
      <div className="file-list__empty">
        Noch keine Dateien hier — leg sie per Drag-Drop ab oder klick auf "Upload".
      </div>
    );
  }

  async function openFile(file: FileRow) {
    try {
      const url = await download.mutateAsync(file.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("download failed", err);
    }
  }

  return (
    <div className="file-grid">
      {files.map((file) => {
        const Icon = getFileIcon(file.mime_type);
        return (
          <GlassCard
            key={file.id}
            className="file-tile"
            onClick={() => openFile(file)}
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
