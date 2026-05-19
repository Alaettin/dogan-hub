import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, List, Plus, UploadCloud } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useFolders } from "./useFolders";
import { useFiles, type FileRow } from "./useFiles";
import { FolderTree } from "./FolderTree";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileList } from "./FileList";
import { FileGrid } from "./FileGrid";
import { UploadDropZone } from "./UploadDropZone";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { cn } from "../../lib/cn";
import "./files.css";

type ViewMode = "list" | "grid";

export function FilesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get("folder");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);

  const folders = useFolders();
  const files = useFiles(currentFolderId);

  function navigate(folderId: string | null) {
    const next = new URLSearchParams(searchParams);
    if (folderId) next.set("folder", folderId);
    else next.delete("folder");
    setSearchParams(next, { replace: true });
  }

  function triggerUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.addEventListener("change", () => {
      const list = input.files;
      if (!list) return;
      const evt = new CustomEvent("dogan-hub:upload-files", {
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
          <GlassButton variant="primary" onClick={triggerUpload}>
            <UploadCloud size={14} />
            Upload
          </GlassButton>
        </div>

        <UploadDropZone folderId={currentFolderId}>
          <GlassPanel style={{ padding: 0, minHeight: 320, overflow: "hidden" }}>
            {files.isLoading ? (
              <div className="file-list__empty">Lade…</div>
            ) : viewMode === "list" ? (
              <FileList files={files.data?.items ?? []} onOpen={setPreviewFile} />
            ) : (
              <div style={{ padding: 14 }}>
                <FileGrid files={files.data?.items ?? []} onOpen={setPreviewFile} />
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

      <FilePreviewDialog
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
      />
    </div>
  );
}
