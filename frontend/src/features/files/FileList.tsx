import { memo } from "react";
import { FileRowMenu } from "./FileRowMenu";
import { formatFileSize, getFileIcon } from "./file-icons";
import type { FileRow } from "./useFiles";
import "./files.css";

interface FileListProps {
  files: FileRow[];
  onOpen: (file: FileRow) => void;
}

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

// Memoisierte Zeile: rendert nur neu, wenn sich diese Datei oder onOpen ändert
// (statt alle Zeilen bei jedem Eltern-Render).
const FileListRow = memo(function FileListRow({
  file,
  onOpen,
}: {
  file: FileRow;
  onOpen: (file: FileRow) => void;
}) {
  const Icon = getFileIcon(file.mime_type);
  return (
    <tr onClick={() => onOpen(file)}>
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
});

export function FileList({ files, onOpen }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="file-list__empty">
        Noch keine Dateien hier — leg sie per Drag-Drop ab oder klick auf "Upload".
      </div>
    );
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
        {files.map((file) => (
          <FileListRow key={file.id} file={file} onOpen={onOpen} />
        ))}
      </tbody>
    </table>
  );
}
