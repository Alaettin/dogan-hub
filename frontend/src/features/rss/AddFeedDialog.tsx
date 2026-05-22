import { useState } from "react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { ApiRequestError } from "../../lib/api";
import { useAddFeed, useFolders } from "./useRss";

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vorausgewählter Ordner (z.B. wenn aus einem Ordner heraus geöffnet). */
  defaultFolderId?: string | null;
}

export function AddFeedDialog({ open, onOpenChange, defaultFolderId }: AddFeedDialogProps) {
  const folders = useFolders();
  const addFeed = useAddFeed();
  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? "");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUrl("");
    setFolderId(defaultFolderId ?? "");
    setError(null);
  }

  async function submit() {
    setError(null);
    const feedUrl = url.trim();
    if (!feedUrl) {
      setError("Bitte eine Feed-URL eingeben.");
      return;
    }
    try {
      await addFeed.mutateAsync({
        feed_url: feedUrl,
        folder_id: folderId || null,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiRequestError) setError(e.message);
      else setError("Feed konnte nicht hinzugefügt werden.");
    }
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title="Feed hinzufügen"
      description="URL eines RSS- oder Atom-Feeds. Die Adresse wird geprüft und Artikel werden geladen."
    >
      <div className="db-form">
        <GlassInput
          label="Feed-URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/feed.xml"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !addFeed.isPending) void submit();
          }}
        />

        <div>
          <label className="glass-label" htmlFor="rss-folder">
            Ordner (optional)
          </label>
          <select
            id="rss-folder"
            className="glass-input rss-select"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          >
            <option value="">— Kein Ordner —</option>
            {(folders.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="glass-field-error">{error}</p>}

        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)} disabled={addFeed.isPending}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={() => void submit()} disabled={addFeed.isPending}>
            {addFeed.isPending ? "Prüfe…" : "Hinzufügen"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
