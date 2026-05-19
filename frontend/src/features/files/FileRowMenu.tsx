import { useEffect, useState } from "react";
import { Download, FolderInput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { MoveDialog } from "./MoveDialog";
import {
  useDeleteFile,
  useDownloadFile,
  useUpdateFile,
  type FileRow,
} from "./useFiles";

interface FileRowMenuProps {
  file: FileRow;
}

export function FileRowMenu({ file }: FileRowMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const confirm = useConfirm();

  const update = useUpdateFile(file.id);
  const remove = useDeleteFile();
  const download = useDownloadFile();

  const [renameValue, setRenameValue] = useState(file.name);
  useEffect(() => setRenameValue(file.name), [file.name]);

  return (
    <>
      <Dropdown
        align="end"
        trigger={
          <button
            type="button"
            className="glass-button glass-button--ghost"
            aria-label="Datei-Optionen"
            style={{ padding: "4px 6px" }}
          >
            <MoreHorizontal size={14} />
          </button>
        }
      >
        <DropdownItem
          icon={<Download size={12} />}
          label="Herunterladen"
          onClick={async () => {
            try {
              const url = await download.mutateAsync(file.id);
              window.open(url, "_blank", "noopener,noreferrer");
            } catch (err) {
              console.error("download failed", err);
            }
          }}
        />
        <DropdownItem
          icon={<Pencil size={12} />}
          label="Umbenennen"
          onClick={() => setRenameOpen(true)}
        />
        <DropdownItem
          icon={<FolderInput size={12} />}
          label="Verschieben"
          onClick={() => setMoveOpen(true)}
        />
        <DropdownItem
          icon={<Trash2 size={12} />}
          label="Löschen"
          danger
          onClick={async () => {
            const ok = await confirm({
              title: "Datei löschen?",
              description: `"${file.name}" wird in den Papierkorb verschoben.`,
              confirmLabel: "Löschen",
              destructive: true,
            });
            if (ok) await remove.mutateAsync(file.id);
          }}
        />
      </Dropdown>

      <GlassDialog open={renameOpen} onOpenChange={setRenameOpen} title="Datei umbenennen">
        <div className="db-form">
          <GlassInput
            label="Neuer Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
          <div className="db-form__actions">
            <GlassButton variant="ghost" onClick={() => setRenameOpen(false)}>
              Abbrechen
            </GlassButton>
            <GlassButton
              variant="primary"
              disabled={!renameValue.trim() || update.isPending}
              onClick={async () => {
                await update.mutateAsync({ name: renameValue.trim() });
                setRenameOpen(false);
              }}
            >
              Speichern
            </GlassButton>
          </div>
        </div>
      </GlassDialog>

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={`"${file.name}" verschieben`}
        currentParentId={file.folder_id}
        onConfirm={async (targetId) => {
          await update.mutateAsync({ folder_id: targetId });
        }}
      />
    </>
  );
}
