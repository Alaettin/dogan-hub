import { FileRowMenu } from "./FileRowMenu";
import { formatFileSize, getFileIcon } from "./file-icons";
import { useDownloadFile, type FileRow } from "./useFiles";
import "./files.css";

interface FileListProps {
  files: FileRow[];
}

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export function FileList({ files }: FileListProps) {
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
    <table className="file-list">
      <thead>
        <tr>
          <th>Name</th>
          <th style={{ width: 100 }}>Größe</th>
          <th style={{ width: 130 }}>Geändert</th>
          <th className="file-list__actions" />
        </tr>
      </thead>
      <tbody>
        {files.map((file) => {
          const Icon = getFileIcon(file.mime_type);
          return (
            <tr key={file.id} onClick={() => openFile(file)}>
              <td>
                <div className="file-list__name">
                  <Icon size={16} style={{ color: "var(--text-accent)", flexShrink: 0 }} />
                  <span className="file-list__name-text">{file.name}</span>
                </div>
              </td>
              <td>{formatFileSize(file.size_bytes)}</td>
              <td>{dateFormatter.format(new Date(file.updated_at))}</td>
              <td className="file-list__actions" onClick={(e) => e.stopPropagation()}>
                <FileRowMenu file={file} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
