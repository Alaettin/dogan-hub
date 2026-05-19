import { useEffect, useState } from "react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { useCreateFolder } from "./useFolders";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
}

export function CreateFolderDialog({ open, onOpenChange, parentId }: CreateFolderDialogProps) {
  const create = useCreateFolder();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Bitte einen Namen eingeben.");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), parent_id: parentId });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
    }
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Neuer Ordner"
      description={parentId ? "Wird im aktuellen Ordner angelegt." : "Wird im Root angelegt."}
    >
      <div className="db-form">
        <GlassInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Steuer 2026"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
        />
        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(252,165,165,0.08)",
              border: "1px solid rgba(252,165,165,0.25)",
              color: "var(--text-danger)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={save} disabled={create.isPending}>
            {create.isPending ? "Erstelle…" : "Anlegen"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
