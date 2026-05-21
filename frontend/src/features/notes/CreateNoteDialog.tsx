import { useEffect, useState } from "react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { ApiRequestError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { NOTE_TYPE_META } from "./note-meta";
import { useCreateNote, type NoteType } from "./useNotes";

interface CreateNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

const TYPE_ORDER: NoteType[] = ["text", "checklist", "list"];

export function CreateNoteDialog({ open, onOpenChange, onCreated }: CreateNoteDialogProps) {
  const create = useCreateNote();
  const [type, setType] = useState<NoteType>("text");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("text");
      setTitle("");
      setError(null);
    }
  }, [open]);

  async function save() {
    setError(null);
    try {
      const note = await create.mutateAsync({ type, title: title.trim() });
      onOpenChange(false);
      onCreated?.(note.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Anlegen fehlgeschlagen");
    }
  }

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title="Neue Notiz">
      <div className="db-form">
        <div>
          <label className="glass-label">Typ</label>
          <div className="notes-type-picker">
            {TYPE_ORDER.map((t) => {
              const { label, icon: Icon, color } = NOTE_TYPE_META[t];
              return (
                <button
                  key={t}
                  type="button"
                  className={cn("notes-type-option", type === t && "notes-type-option--active")}
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                >
                  <Icon size={18} style={{ color }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <GlassInput
          label="Titel (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z.B. Einkaufsliste"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
        />
        {error && <div className="notes-error">{error}</div>}
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
