import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { GlassDialog } from "../../../components/ui/GlassDialog";
import { GlassButton } from "../../../components/ui/GlassButton";
import { useBulkDeleteEntries } from "../useBulkDelete";
import "./views.css";

interface BulkBarProps {
  databaseId: string;
  selectedIds: string[];
  onClear: () => void;
}

export function BulkBar({ databaseId, selectedIds, onClear }: BulkBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bulkDelete = useBulkDeleteEntries(databaseId);

  if (selectedIds.length === 0) return null;

  async function confirmDelete() {
    await bulkDelete.mutateAsync(selectedIds);
    setConfirmOpen(false);
    onClear();
  }

  return (
    <>
      <div className="bulk-bar" role="status" aria-live="polite">
        <span className="bulk-bar__count">
          {selectedIds.length} {selectedIds.length === 1 ? "Eintrag" : "Einträge"} ausgewählt
        </span>
        <span className="bulk-bar__sep" />
        <GlassButton variant="ghost" onClick={onClear}>
          <X size={14} />
          Auswahl aufheben
        </GlassButton>
        <GlassButton
          variant="secondary"
          onClick={() => setConfirmOpen(true)}
          style={{ color: "var(--text-danger)" }}
        >
          <Trash2 size={14} />
          Löschen
        </GlassButton>
      </div>

      <GlassDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Einträge löschen?"
        description={`${selectedIds.length} ${
          selectedIds.length === 1 ? "Eintrag wird" : "Einträge werden"
        } unwiderruflich gelöscht.`}
      >
        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => setConfirmOpen(false)}>
            Abbrechen
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={confirmDelete}
            disabled={bulkDelete.isPending}
            style={{
              background: "rgba(252,165,165,0.15)",
              borderColor: "rgba(252,165,165,0.4)",
              color: "var(--text-danger)",
            }}
          >
            {bulkDelete.isPending ? "Lösche…" : "Endgültig löschen"}
          </GlassButton>
        </div>
      </GlassDialog>
    </>
  );
}
