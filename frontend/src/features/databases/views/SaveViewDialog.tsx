import { useEffect, useState } from "react";
import { GlassDialog } from "../../../components/ui/GlassDialog";
import { GlassButton } from "../../../components/ui/GlassButton";
import { GlassInput } from "../../../components/ui/GlassInput";
import { useCreateView } from "../useViews";
import type { ViewConfig } from "../view-types";

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  databaseId: string;
  config: ViewConfig;
}

export function SaveViewDialog({ open, onOpenChange, databaseId, config }: SaveViewDialogProps) {
  const create = useCreateView(databaseId);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setIsDefault(false);
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
      await create.mutateAsync({
        name: name.trim(),
        view_type: config.view_type,
        config: {
          sort: config.sort,
          order: config.order,
          filters: config.filters,
          columns: config.columns,
        },
        is_default: isDefault,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ansicht speichern"
      description="Aktuelle Sortierung, Filter und Ansichts-Modus werden gemeinsam abgelegt."
    >
      <div className="db-form">
        <GlassInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Fällige TÜV"
          autoFocus
        />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Als Standard-Ansicht setzen
        </label>

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
            {create.isPending ? "Speichere…" : "Speichern"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
