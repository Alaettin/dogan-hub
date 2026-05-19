import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { cn } from "../../lib/cn";
import { useCommitFile, useSignUpload } from "./useFiles";
import { resolveMime } from "./mime-from-extension";
import "./files.css";

interface UploadDropZoneProps {
  folderId: string | null;
  children: ReactNode;
}

interface UploadEventDetail {
  files: File[];
  folderId: string | null;
}

interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

export function UploadDropZone({ folderId, children }: UploadDropZoneProps) {
  const sign = useSignUpload();
  const commit = useCommitFile();
  const [active, setActive] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const dragCounter = useRef(0);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const upload = useCallback(
    async (file: File) => {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [
        ...prev,
        { id: localId, name: file.name, size: file.size, progress: 0, status: "uploading" },
      ]);

      try {
        const mime = resolveMime(file);
        const signed = await sign.mutateAsync({
          filename: file.name,
          mime_type: mime,
          size_bytes: file.size,
          folder_id: folderId,
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const pct = Math.round((event.loaded / event.total) * 100);
              updateItem(localId, { progress: pct });
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload fehlgeschlagen (${xhr.status})`));
          });
          xhr.addEventListener("error", () => reject(new Error("Netzwerk-Fehler")));
          xhr.open("PUT", signed.signed_url, true);
          xhr.setRequestHeader("Content-Type", mime);
          xhr.send(file);
        });

        await commit.mutateAsync(signed.file_id);
        updateItem(localId, { progress: 100, status: "done" });

        // Erfolg fade-out nach 2s
        setTimeout(() => {
          setItems((prev) => prev.filter((p) => p.id !== localId));
        }, 2000);
      } catch (err) {
        updateItem(localId, {
          status: "error",
          error: err instanceof Error ? err.message : "Unbekannter Fehler",
        });
      }
    },
    [folderId, sign, commit, updateItem],
  );

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter.current += 1;
    setActive(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setActive(false);
      dragCounter.current = 0;
    }
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setActive(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => void upload(f));
  }

  // Globales Custom-Event vom Upload-Button in der Toolbar
  useEffect(() => {
    function onUploadEvent(e: Event) {
      const detail = (e as CustomEvent<UploadEventDetail>).detail;
      if (detail.folderId !== folderId) return;
      detail.files.forEach((f) => void upload(f));
    }
    window.addEventListener("myhub:upload-files", onUploadEvent);
    return () => window.removeEventListener("myhub:upload-files", onUploadEvent);
  }, [folderId, upload]);

  return (
    <>
      <div
        className={cn("upload-dropzone", active && "upload-dropzone--active")}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {active && (
          <div className="upload-dropzone__overlay">
            <UploadCloud size={20} style={{ marginRight: 8 }} />
            Dateien hier ablegen
          </div>
        )}
        {children}
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => (
            <UploadProgress key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}

interface UploadProgressProps {
  item: UploadItem;
}
function UploadProgress({ item }: UploadProgressProps) {
  const statusText =
    item.status === "done"
      ? "fertig"
      : item.status === "error"
        ? item.error ?? "Fehler"
        : `${item.progress}%`;
  return (
    <div className={cn("upload-progress", item.status === "error" && "upload-progress--error")}>
      <div className="upload-progress__row">
        {item.status === "uploading" ? (
          <Loader2 size={14} className="anim-spin" />
        ) : (
          <UploadCloud size={14} />
        )}
        <span className="upload-progress__name">{item.name}</span>
        <span
          className={cn(
            "upload-progress__status",
            item.status === "error" && "upload-progress__status--error",
          )}
        >
          {statusText}
        </span>
      </div>
      <div className="upload-progress__bar">
        <div className="upload-progress__bar-fill" style={{ width: `${item.progress}%` }} />
      </div>
    </div>
  );
}
