import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ChevronRight,
  Download,
  Eye,
  Folder as FolderIcon,
  FolderPlus,
  Home,
  Pencil,
  Plus,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassInput } from "../../components/ui/GlassInput";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { ApiRequestError } from "../../lib/api";
import { getFileIcon } from "../files/file-icons";
import {
  usePublicCreateFolder,
  usePublicDeleteFile,
  usePublicDeleteFolder,
  usePublicDownload,
  usePublicFiles,
  usePublicFolders,
  usePublicShare,
  usePublicUpload,
  type PublicFile,
  type PublicFolder,
} from "./usePublicShare";
import "./share.css";

export function SharePage() {
  const { token } = useParams<{ token: string }>();
  const share = usePublicShare(token);

  // Sub-Folder-Navigation: aktueller Pfad als Stack der Folder-Knoten (incl. Root).
  const [stack, setStack] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (share.data && stack.length === 0) {
      setStack([{ id: share.data.folder.id, name: share.data.folder.name }]);
    }
  }, [share.data, stack.length]);

  const currentFolderId = stack[stack.length - 1]?.id ?? share.data?.folder.id ?? null;

  if (share.isLoading) {
    return <CenterCard title="Lade Freigabe…" />;
  }

  if (share.isError || !share.data || !token) {
    const message =
      share.error instanceof ApiRequestError
        ? share.error.message
        : "Diese Freigabe ist abgelaufen oder ungültig.";
    return <CenterCard title="Link ungültig" description={message} />;
  }

  const canEdit = share.data.permission === "edit";

  return (
    <div className="share-page">
      <header className="share-page__header">
        <div className="share-page__brand">
          <span className="share-page__brand-mark">MyHub</span>
          <span className="share-page__brand-sub">Geteilte Freigabe</span>
        </div>
        <div className="share-page__title-row">
          <FolderIcon size={20} style={{ color: "var(--text-accent)" }} />
          <h1 className="share-page__title">{share.data.folder.name}</h1>
          <span className={`share-badge share-badge--${share.data.permission}`}>
            {canEdit ? (
              <>
                <Pencil size={11} /> Bearbeiten
              </>
            ) : (
              <>
                <Eye size={11} /> Lesen
              </>
            )}
          </span>
          <span className="share-page__expires">{formatRemaining(share.data.expires_at)}</span>
        </div>
        <Breadcrumb stack={stack} onJump={(idx) => setStack((s) => s.slice(0, idx + 1))} />
      </header>

      <FolderView
        token={token}
        currentFolderId={currentFolderId}
        canEdit={canEdit}
        onEnterFolder={(f) => setStack((s) => [...s, { id: f.id, name: f.name }])}
      />
    </div>
  );
}

interface BreadcrumbProps {
  stack: Array<{ id: string; name: string }>;
  onJump: (index: number) => void;
}

function Breadcrumb({ stack, onJump }: BreadcrumbProps) {
  return (
    <nav className="share-breadcrumb" aria-label="Pfad">
      {stack.map((node, idx) => {
        const isLast = idx === stack.length - 1;
        return (
          <span key={node.id} className="share-breadcrumb__segment">
            <button
              type="button"
              className="share-breadcrumb__btn"
              disabled={isLast}
              onClick={() => onJump(idx)}
            >
              {idx === 0 ? <Home size={12} /> : null}
              <span>{node.name}</span>
            </button>
            {!isLast && <ChevronRight size={12} className="share-breadcrumb__sep" />}
          </span>
        );
      })}
    </nav>
  );
}

interface FolderViewProps {
  token: string;
  currentFolderId: string | null;
  canEdit: boolean;
  onEnterFolder: (folder: PublicFolder) => void;
}

function FolderView({ token, currentFolderId, canEdit, onEnterFolder }: FolderViewProps) {
  const folders = usePublicFolders(token, currentFolderId);
  const files = usePublicFiles(token, currentFolderId);
  const download = usePublicDownload(token);
  const upload = usePublicUpload(token);
  const createFolder = usePublicCreateFolder(token);
  const deleteFile = usePublicDeleteFile(token);
  const deleteFolder = usePublicDeleteFolder(token);
  const confirm = useConfirm();

  const [createOpen, setCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(file: PublicFile) {
    try {
      const url = await download.mutateAsync(file.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList) return;
    setError(null);
    for (const file of Array.from(fileList)) {
      try {
        await upload.mutateAsync({ file, folderId: currentFolderId });
      } catch (err) {
        setError(formatError(err));
      }
    }
  }

  async function handleCreateFolder() {
    setError(null);
    if (!newFolderName.trim()) return;
    try {
      await createFolder.mutateAsync({
        name: newFolderName.trim(),
        parentId: currentFolderId,
      });
      setNewFolderName("");
      setCreateOpen(false);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleDeleteFile(file: PublicFile) {
    const ok = await confirm({
      title: `"${file.name}" löschen?`,
      description: "Die Datei landet im Papierkorb des Eigentümers.",
      destructive: true,
      confirmLabel: "Löschen",
    });
    if (!ok) return;
    try {
      await deleteFile.mutateAsync(file.id);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleDeleteFolder(folder: PublicFolder) {
    const ok = await confirm({
      title: `"${folder.name}" löschen?`,
      description: "Der Ordner mit allen enthaltenen Dateien wird unwiderruflich entfernt.",
      destructive: true,
      confirmLabel: "Löschen",
    });
    if (!ok) return;
    try {
      await deleteFolder.mutateAsync(folder.id);
    } catch (err) {
      setError(formatError(err));
    }
  }

  const subFolders = folders.data ?? [];
  const fileList = files.data ?? [];
  const isEmpty = !folders.isLoading && !files.isLoading && subFolders.length === 0 && fileList.length === 0;

  return (
    <>
      {canEdit && (
        <div className="share-page__actions">
          <label className="share-action-btn">
            <UploadIcon size={14} />
            <span>{upload.isPending ? "Lade hoch…" : "Datei hochladen"}</span>
            <input
              type="file"
              multiple
              hidden
              onChange={(e) => handleUpload(e.target.files)}
              disabled={upload.isPending}
            />
          </label>
          <GlassButton variant="ghost" onClick={() => setCreateOpen(true)}>
            <FolderPlus size={14} />
            Ordner anlegen
          </GlassButton>
        </div>
      )}

      {error && (
        <div className="share-error" role="alert">
          {error}
        </div>
      )}

      <GlassCard className="share-list">
        {(folders.isLoading || files.isLoading) && (
          <div className="share-list__empty">Lade…</div>
        )}

        {isEmpty && <div className="share-list__empty">Dieser Ordner ist leer.</div>}

        {subFolders.map((f) => (
          <div key={f.id} className="share-row" onClick={() => onEnterFolder(f)} role="button" tabIndex={0}>
            <FolderIcon size={16} style={{ color: "var(--text-accent)" }} />
            <span className="share-row__name">{f.name}</span>
            <span className="share-row__meta">Ordner</span>
            {canEdit && (
              <button
                type="button"
                className="share-row__action share-row__action--danger"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteFolder(f);
                }}
                aria-label="Ordner löschen"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}

        {fileList.map((f) => {
          const Icon = getFileIcon(f.mime_type);
          return (
            <div key={f.id} className="share-row">
              <Icon size={16} />
              <span className="share-row__name">{f.name}</span>
              <span className="share-row__meta">{formatBytes(f.size_bytes)}</span>
              <button
                type="button"
                className="share-row__action"
                onClick={() => handleDownload(f)}
                aria-label="Datei herunterladen"
              >
                <Download size={13} />
              </button>
              {canEdit && (
                <button
                  type="button"
                  className="share-row__action share-row__action--danger"
                  onClick={() => handleDeleteFile(f)}
                  aria-label="Datei löschen"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </GlassCard>

      <GlassDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setNewFolderName("");
        }}
        title="Neuen Ordner anlegen"
      >
        <div className="db-form">
          <GlassInput
            label="Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="z.B. Bilder"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreateFolder();
              }
            }}
          />
          <div className="db-form__actions">
            <GlassButton variant="ghost" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolder.isPending}
            >
              <Plus size={14} />
              Anlegen
            </GlassButton>
          </div>
        </div>
      </GlassDialog>
    </>
  );
}

interface CenterCardProps {
  title: string;
  description?: string;
}

function CenterCard({ title, description }: CenterCardProps) {
  return (
    <div className="share-page share-page--centered">
      <GlassCard className="share-page__center">
        <h1 className="share-page__title" style={{ fontSize: 20 }}>{title}</h1>
        {description && (
          <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            {description}
          </p>
        )}
      </GlassCard>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "abgelaufen";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `läuft in ${Math.floor(h / 24)} Tagen ab`;
  if (h >= 1) return `läuft in ${h} h ab`;
  const m = Math.floor(ms / 60_000);
  return `läuft in ${m} min ab`;
}

function formatError(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Aktion fehlgeschlagen";
}
