import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import {
  useEmptyTrash,
  usePurgeFile,
  useRestoreFile,
  useTrashedFiles,
  type TrashedFile,
} from "./useTrash";
import { formatFileSize, getFileIcon } from "./file-icons";
import "./files.css";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function TrashPage() {
  const trash = useTrashedFiles();
  const emptyTrash = useEmptyTrash();
  const confirm = useConfirm();

  const items = trash.data ?? [];

  async function handleEmpty() {
    const ok = await confirm({
      title: "Papierkorb leeren?",
      description: `${items.length} ${items.length === 1 ? "Datei wird" : "Dateien werden"} unwiderruflich entfernt.`,
      confirmLabel: "Leeren",
      destructive: true,
    });
    if (ok) await emptyTrash.mutateAsync();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1180 }}>
      <header
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div>
          <h1
            style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.3px" }}
          >
            Papierkorb
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            Gelöschte Dateien können wiederhergestellt oder endgültig entfernt werden.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {items.length > 0 && (
            <GlassButton
              variant="secondary"
              onClick={handleEmpty}
              disabled={emptyTrash.isPending}
              style={{ color: "var(--text-danger)" }}
            >
              <Trash2 size={14} />
              {emptyTrash.isPending ? "Leere…" : "Papierkorb leeren"}
            </GlassButton>
          )}
        </div>
      </header>

      <GlassPanel style={{ overflow: "hidden", padding: 0 }}>
        {trash.isLoading ? (
          <div className="file-list__empty">Lade…</div>
        ) : items.length === 0 ? (
          <div className="file-list__empty">Der Papierkorb ist leer.</div>
        ) : (
          <table className="file-list">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 100 }}>Größe</th>
                <th style={{ width: 180 }}>Gelöscht</th>
                <th className="file-list__actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((file) => (
                <TrashRow key={file.id} file={file} />
              ))}
            </tbody>
          </table>
        )}
      </GlassPanel>
    </div>
  );
}

interface TrashRowProps {
  file: TrashedFile;
}

function TrashRow({ file }: TrashRowProps) {
  const restore = useRestoreFile();
  const purge = usePurgeFile();
  const confirm = useConfirm();
  const Icon = getFileIcon(file.mime_type);

  return (
    <tr>
      <td>
        <div className="file-list__name">
          <Icon size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span className="file-list__name-text">{file.name}</span>
        </div>
      </td>
      <td>{formatFileSize(file.size_bytes)}</td>
      <td>{dateFormatter.format(new Date(file.deleted_at))}</td>
      <td className="file-list__actions">
        <Dropdown
          align="end"
          trigger={
            <button
              type="button"
              className="glass-button glass-button--ghost"
              aria-label="Optionen"
              style={{ padding: "4px 6px" }}
            >
              <MoreHorizontal size={14} />
            </button>
          }
        >
          <DropdownItem
            icon={<RotateCcw size={12} />}
            label="Wiederherstellen"
            onClick={async () => {
              await restore.mutateAsync(file.id);
            }}
          />
          <DropdownItem
            icon={<Trash2 size={12} />}
            label="Endgültig löschen"
            danger
            onClick={async () => {
              const ok = await confirm({
                title: "Endgültig löschen?",
                description: `"${file.name}" wird unwiderruflich gelöscht.`,
                confirmLabel: "Endgültig löschen",
                destructive: true,
              });
              if (ok) await purge.mutateAsync(file.id);
            }}
          />
        </Dropdown>
      </td>
    </tr>
  );
}
