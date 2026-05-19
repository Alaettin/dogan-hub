import { useEffect, useMemo, useState } from "react";
import { Search, UploadCloud } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { useFiles, type FileRow } from "../files/useFiles";
import { UploadDropZone } from "../files/UploadDropZone";
import { formatFileSize, getFileIcon } from "../files/file-icons";
import { cn } from "../../lib/cn";
import "./entry-files.css";

interface FilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeFileIds?: Set<string>;
  onPick: (file: FileRow) => Promise<void> | void;
}

type Mode = "existing" | "upload";

export function FilePicker({ open, onOpenChange, excludeFileIds, onPick }: FilePickerProps) {
  const [mode, setMode] = useState<Mode>("existing");
  const [search, setSearch] = useState("");
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  // Wir laden ALLE files des Users (limit 200) und filtern client-seitig.
  // Server-seitige Suche kommt mit 3d.3.
  const files = useFiles(undefined);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("existing");
      setSearch("");
      setPickedIds(new Set());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const all = files.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((f) => {
      if (excludeFileIds?.has(f.id)) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q);
    });
  }, [files.data, search, excludeFileIds]);

  async function pick(file: FileRow) {
    if (pickedIds.has(file.id) || picking) return;
    setPicking(true);
    try {
      await onPick(file);
      setPickedIds((prev) => new Set(prev).add(file.id));
      onOpenChange(false);
    } finally {
      setPicking(false);
    }
  }

  // Custom-Event-Listener: wenn ein File via UploadDropZone hochgeladen wurde,
  // erscheint es in der useFiles-Liste. Wir können hier kein "neu hochgeladenes File"
  // automatisch picken, weil UploadDropZone das File-Objekt nicht raus emittiert.
  // → User muss nach dem Upload auf "Bestehende" wechseln und es dort wählen.
  // Pragmatisch für MVP: wir zeigen einen Hinweis im Upload-Tab nach Upload.

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Datei anhängen"
      className="file-picker-dialog"
    >
      <div className="file-picker__tabs">
        <button
          type="button"
          className={cn("file-picker__tab", mode === "existing" && "file-picker__tab--active")}
          onClick={() => setMode("existing")}
        >
          Bestehende Datei
        </button>
        <button
          type="button"
          className={cn("file-picker__tab", mode === "upload" && "file-picker__tab--active")}
          onClick={() => setMode("upload")}
        >
          Neu hochladen
        </button>
      </div>

      {mode === "existing" ? (
        <>
          <div className="file-picker__search" style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                pointerEvents: "none",
              }}
            />
            <GlassInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Datei suchen…"
              style={{ paddingLeft: 32 }}
            />
          </div>

          <div className="file-picker__list">
            {files.isLoading ? (
              <div className="file-picker__empty">Lade…</div>
            ) : filtered.length === 0 ? (
              <div className="file-picker__empty">
                {search ? "Keine Treffer." : "Noch keine Dateien — lade welche hoch."}
              </div>
            ) : (
              filtered.map((file) => {
                const Icon = getFileIcon(file.mime_type);
                return (
                  <button
                    key={file.id}
                    type="button"
                    className="file-picker__item"
                    onClick={() => pick(file)}
                    disabled={picking}
                  >
                    <Icon size={16} className="file-picker__item-icon" />
                    <span className="file-picker__item-name">{file.name}</span>
                    <span className="file-picker__item-meta">{formatFileSize(file.size_bytes)}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <UploadDropZone folderId={null}>
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
                border: "1px dashed var(--glass-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <UploadCloud size={28} style={{ color: "var(--text-accent)", marginBottom: 8 }} />
              <div>Datei hier ablegen oder Dialog schließen und über &ldquo;Bestehende&rdquo; wählen.</div>
            </div>
          </UploadDropZone>
          <p className="file-picker__upload-hint">
            Datei wird im Root abgelegt und kann später verschoben werden.
            Nach dem Upload kannst du sie über &ldquo;Bestehende Datei&rdquo; anhängen.
          </p>
        </>
      )}

      <div className="db-form__actions" style={{ marginTop: 14 }}>
        <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
          Schließen
        </GlassButton>
      </div>
    </GlassDialog>
  );
}
