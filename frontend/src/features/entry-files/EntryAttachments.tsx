import { useState } from "react";
import { Plus, X } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { getFileIcon } from "../files/file-icons";
import { FilePreviewDialog } from "../files/FilePreviewDialog";
import type { FileRow } from "../files/useFiles";
import { FilePicker } from "./FilePicker";
import { useAttachFile, useDetachFile, useEntryFiles } from "./useEntryFiles";
import "./entry-files.css";

interface EntryAttachmentsProps {
  entryId: string;
}

export function EntryAttachments({ entryId }: EntryAttachmentsProps) {
  const list = useEntryFiles(entryId);
  const attach = useAttachFile(entryId);
  const detach = useDetachFile(entryId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);

  const attached = list.data ?? [];
  const excludeIds = new Set(attached.map((f) => f.id));

  return (
    <div className="entry-attachments">
      <span className="entry-attachments__label">Anhänge</span>

      {list.isLoading ? (
        <div className="entry-attachments__empty">Lade Anhänge…</div>
      ) : attached.length === 0 ? (
        <div className="entry-attachments__empty">Noch keine Anhänge.</div>
      ) : (
        <div className="entry-attachments__chips">
          {attached.map((file) => {
            const Icon = getFileIcon(file.mime_type);
            return (
              <div
                key={file.id}
                className="attachment-chip"
                onClick={() => setPreviewFile(file)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewFile(file);
                  }
                }}
              >
                <span className="attachment-chip__icon">
                  <Icon size={14} />
                </span>
                <span className="attachment-chip__name">{file.name}</span>
                <button
                  type="button"
                  className="attachment-chip__remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    void detach.mutateAsync(file.id);
                  }}
                  aria-label={`${file.name} entfernen`}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <GlassButton
          variant="secondary"
          onClick={() => setPickerOpen(true)}
          disabled={attach.isPending}
        >
          <Plus size={14} />
          Datei anhängen
        </GlassButton>
      </div>

      <FilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeFileIds={excludeIds}
        onPick={(file) => attach.mutateAsync(file.id)}
      />

      <FilePreviewDialog
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
      />
    </div>
  );
}
