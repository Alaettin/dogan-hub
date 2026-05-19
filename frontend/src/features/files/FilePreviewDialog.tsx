import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { useDownloadFile, type FileRow } from "./useFiles";
import { formatFileSize, getFileIcon } from "./file-icons";
import "./files.css";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: FileRow | null;
}

export function FilePreviewDialog({ open, onOpenChange, file }: FilePreviewDialogProps) {
  const download = useDownloadFile();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed URL holen wenn Dialog öffnet
  useEffect(() => {
    if (!open || !file) {
      setPreviewUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    download
      .mutateAsync(file.id)
      .then((url) => {
        if (!cancelled) {
          setPreviewUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Vorschau konnte nicht geladen werden");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.id]);

  if (!file) return null;

  const Icon = getFileIcon(file.mime_type);
  const isImage = file.mime_type.startsWith("image/");
  const isPdf = file.mime_type === "application/pdf";

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title=""
      className="preview-dialog"
      showCloseButton={false}
    >
      <div className="preview-header">
        <Icon size={16} style={{ color: "var(--text-accent)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="preview-header__name">{file.name}</div>
          <div className="preview-header__meta">{formatFileSize(file.size_bytes)}</div>
        </div>
        <GlassButton
          variant="secondary"
          onClick={() => {
            if (previewUrl) {
              window.open(previewUrl, "_blank", "noopener,noreferrer");
            }
          }}
          disabled={!previewUrl}
        >
          <Download size={14} />
          Herunterladen
        </GlassButton>
        <button
          type="button"
          className="preview-header__close"
          onClick={() => onOpenChange(false)}
          aria-label="Schließen"
        >
          <X size={18} />
        </button>
      </div>

      <div className="preview-body">
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Lade Vorschau…</div>}
        {error && <div style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</div>}
        {!loading && !error && previewUrl && isImage && (
          <img src={previewUrl} alt={file.name} className="preview-body__image" />
        )}
        {!loading && !error && previewUrl && isPdf && (
          <iframe src={previewUrl} className="preview-body__pdf" title={file.name} />
        )}
        {!loading && !error && previewUrl && !isImage && !isPdf && (
          <div className="preview-body__fallback">
            <Icon size={48} style={{ color: "var(--text-muted)" }} />
            Keine Vorschau für diesen Dateityp.
            <GlassButton
              variant="primary"
              onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
            >
              <Download size={14} />
              Datei herunterladen
            </GlassButton>
          </div>
        )}
      </div>
    </GlassDialog>
  );
}
