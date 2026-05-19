import { HardDrive, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import type { Folder } from "./useFolders";
import { getFolderPath } from "./folder-tree";
import "./files.css";

interface BreadcrumbsProps {
  folders: Folder[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

export function Breadcrumbs({ folders, currentFolderId, onNavigate }: BreadcrumbsProps) {
  const trail = getFolderPath(currentFolderId, folders);

  return (
    <nav className="breadcrumbs" aria-label="Pfad">
      <button
        type="button"
        className={cn("breadcrumbs__crumb", !currentFolderId && "breadcrumbs__crumb--current")}
        onClick={() => onNavigate(null)}
        disabled={!currentFolderId}
      >
        <HardDrive size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
        Root
      </button>
      {trail.map((folder, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={folder.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ChevronRight size={12} className="breadcrumbs__separator" />
            <button
              type="button"
              className={cn("breadcrumbs__crumb", isLast && "breadcrumbs__crumb--current")}
              onClick={() => !isLast && onNavigate(folder.id)}
              disabled={isLast}
            >
              {folder.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
