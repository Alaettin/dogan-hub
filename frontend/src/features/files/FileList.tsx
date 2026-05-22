import { memo } from "react";
import { FileRowMenu } from "./FileRowMenu";
import { formatFileSize, getFileIcon } from "./file-icons";
import type { FileRow } from "./useFiles";
import "./files.css";

interface FileListProps {
  files: FileRow[];
  onOpen: (file: FileRow) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

// Memoisierte Zeile: rendert nur neu, wenn sich diese Datei, onOpen oder der
// Auswahl-Status ändert (statt alle Zeilen bei jedem Eltern-Render).
const FileListRow = memo(function FileListRow({
  file,
  onOpen,
  selected,
  onToggleSelect,
}: {
  file: FileRow;
  onOpen: (file: FileRow) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const Icon = getFileIcon(file.mime_type);
  return (
    <tr onClick={() => onOpen(file)} className={selected ? "file-list__row--selected" : undefined}>
      <td className="file-list__check" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(file.id)}
          aria-label={`${file.name} auswählen`}
        />
      </td>
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

export function FileList({
  files,
  onOpen,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="file-list__empty">
        Noch keine Dateien hier — leg sie per Drag-Drop ab oder klick auf "Upload".
      </div>
    );
  }

  const allSelected = files.length > 0 && selectedIds.size === files.length;

  return (
    <table className="file-list">
      <thead>
        <tr>
          <th className="file-list__check">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              aria-label="Alle auswählen"
            />
          </th>
          <th>Name</th>
          <th style={{ width: 100 }}>Größe</th>
          <th style={{ width: 130 }}>Geändert</th>
          <th className="file-list__actions" />
        </tr>
      </thead>
      <tbody>
        {files.map((file) => (
          <FileListRow
            key={file.id}
            file={file}
            onOpen={onOpen}
            selected={selectedIds.has(file.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </tbody>
    </table>
  );
}
