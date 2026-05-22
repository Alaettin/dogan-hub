import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, List, Plus, Share2, UploadCloud, FileArchive, X } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useFolders } from "./useFolders";
import { useFiles, useDownloadZip, type FileRow } from "./useFiles";
import { FolderTree } from "./FolderTree";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileList } from "./FileList";
import { FileGrid } from "./FileGrid";
import { UploadDropZone } from "./UploadDropZone";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { ShareFolderDialog } from "./ShareFolderDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { cn } from "../../lib/cn";
import "./files.css";

type ViewMode = "list" | "grid";

export function FilesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get("folder");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const folders = useFolders();
  const files = useFiles(currentFolderId);
  const currentFolder = folders.data?.find((f) => f.id === currentFolderId);
  const downloadZip = useDownloadZip();

  const fileItems = files.data?.items ?? [];

  function navigate(folderId: string | null) {
    const next = new URLSearchParams(searchParams);
    if (folderId) next.set("folder", folderId);
    else next.delete("folder");
    setSearchParams(next, { replace: true });
    setSelectedIds(new Set()); // Auswahl beim Ordnerwechsel zurücksetzen
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === fileItems.length ? new Set() : new Set(fileItems.map((f) => f.id)),
    );
  }

  function triggerUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.addEventListener("change", () => {
      const list = input.files;
      if (!list) return;
      const evt = new CustomEvent("myhub:upload-files", {
        detail: { files: Array.from(list), folderId: currentFolderId },
      });
      window.dispatchEvent(evt);
    });
    input.click();
  }

  return (
    <div className="files-page">
      <GlassPanel>
        <FolderTree
          folders={folders.data ?? []}
          currentFolderId={currentFolderId}
          onNavigate={navigate}
        />
      </GlassPanel>

      <div className="files-main">
        <div className="files-toolbar">
          <Breadcrumbs
            folders={folders.data ?? []}
            currentFolderId={currentFolderId}
            onNavigate={navigate}
          />
          <div className="files-toolbar__spacer" />
          <GlassButton
            variant="secondary"
            className={cn(
              "glass-button--icon",
              viewMode === "list" && "glass-button--toggle-active",
            )}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            aria-label="Listenansicht"
          >
            <List size={16} />
          </GlassButton>
          <GlassButton
            variant="secondary"
            className={cn(
              "glass-button--icon",
              viewMode === "grid" && "glass-button--toggle-active",
            )}
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            aria-label="Kachelansicht"
          >
            <LayoutGrid size={16} />
          </GlassButton>
          <GlassButton variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Neuer Ordner
          </GlassButton>
          <GlassButton
            variant="secondary"
            onClick={() => setShareOpen(true)}
            disabled={!currentFolderId}
            title={currentFolderId ? "Aktuellen Ordner freigeben" : "Öffne einen Ordner, um ihn freizugeben"}
          >
            <Share2 size={14} />
            Freigeben
          </GlassButton>
          <GlassButton
            variant="secondary"
            onClick={() =>
              currentFolder &&
              downloadZip.mutate({ folderIds: [currentFolder.id], name: currentFolder.name })
            }
            disabled={!currentFolderId || downloadZip.isPending}
            title={
              currentFolderId
                ? "Aktuellen Ordner als ZIP herunterladen"
                : "Öffne einen Ordner, um ihn als ZIP zu laden"
            }
          >
            <FileArchive size={14} />
            Als ZIP
          </GlassButton>
          <GlassButton variant="primary" onClick={triggerUpload}>
            <UploadCloud size={14} />
            Upload
          </GlassButton>
        </div>

        {selectedIds.size > 0 && (
          <div className="files-selbar">
            <span className="files-selbar__count">{selectedIds.size} ausgewählt</span>
            <GlassButton
              variant="primary"
              onClick={() =>
                downloadZip.mutate({ fileIds: [...selectedIds], name: "dateien" })
              }
              disabled={downloadZip.isPending}
            >
              <FileArchive size={14} />
              Als ZIP herunterladen
            </GlassButton>
            <button
              type="button"
              className="files-selbar__clear"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Auswahl aufheben"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <UploadDropZone folderId={currentFolderId}>
          <GlassPanel style={{ padding: 0, minHeight: 320, overflow: "hidden" }}>
            {files.isLoading ? (
              <div className="file-list__empty">Lade…</div>
            ) : viewMode === "list" ? (
              <FileList
                files={fileItems}
                onOpen={setPreviewFile}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
              />
            ) : (
              <div style={{ padding: 14 }}>
                <FileGrid
                  files={fileItems}
                  onOpen={setPreviewFile}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              </div>
            )}
          </GlassPanel>
        </UploadDropZone>
      </div>

      <CreateFolderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        parentId={currentFolderId}
      />

      <ShareFolderDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        folderId={currentFolderId}
        folderName={currentFolder?.name ?? null}
      />

      <FilePreviewDialog
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
      />
    </div>
  );
}
