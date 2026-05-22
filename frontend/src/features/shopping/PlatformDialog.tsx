import { useEffect, useState } from "react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { ColorPicker } from "../databases/color-picker";
import { useCreatePlatform, useUpdatePlatform, type Platform } from "./useShopping";

interface PlatformDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform?: Platform | null;
}

export function PlatformDialog({ open, onOpenChange, platform }: PlatformDialogProps) {
  const isEdit = !!platform;
  const create = useCreatePlatform();
  const update = useUpdatePlatform(platform?.id ?? "");

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState("indigo");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(platform?.name ?? "");
      setUrl(platform?.url ?? "");
      setColor(platform?.color ?? "indigo");
      setNotes(platform?.notes ?? "");
    }
  }, [open, platform]);

  const pending = create.isPending || update.isPending;

  async function submit() {
    const payload = {
      name: name.trim(),
      url: url.trim() || null,
      color,
      notes: notes.trim() || null,
    };
    if (!payload.name) return;
    if (isEdit) await update.mutateAsync(payload);
    else await create.mutateAsync(payload);
    onOpenChange(false);
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Plattform bearbeiten" : "Neue Plattform"}
    >
      <div className="db-form">
        <GlassInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Cardmarket"
          autoFocus
        />
        <GlassInput
          label="URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.cardmarket.com"
        />
        <div className="db-form__row">
          <label className="db-form__label">Farbe</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <GlassInput
          label="Notizen (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={() => void submit()} disabled={pending || !name.trim()}>
            {isEdit ? "Speichern" : "Anlegen"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
