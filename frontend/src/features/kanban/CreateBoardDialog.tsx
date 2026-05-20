import { useEffect, useState } from "react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { ColorPicker } from "../databases/color-picker";
import { ApiRequestError } from "../../lib/api";
import { useCreateBoard } from "./useKanban";

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CreateBoardDialog({ open, onOpenChange, onCreated }: CreateBoardDialogProps) {
  const create = useCreateBoard();
  const [name, setName] = useState("");
  const [color, setColor] = useState("indigo");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setColor("indigo");
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
      const board = await create.mutateAsync({ name: name.trim(), color });
      onOpenChange(false);
      onCreated?.(board.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Anlegen fehlgeschlagen");
    }
  }

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title="Neues Board">
      <div className="db-form">
        <GlassInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Projekt Relaunch"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
        />
        <div>
          <label className="glass-label">Farbe</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {error && <div className="kanban-error">{error}</div>}
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
