import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Archive, ArchiveRestore, Trash2, MoreHorizontal, Pencil } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassInput } from "../../components/ui/GlassInput";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import {
  useArchiveDatabase,
  useDeleteDatabase,
  useDuplicateDatabase,
  useUpdateDatabase,
  type Database,
} from "./useDatabases";

interface Props {
  database: Database;
}

export function DatabaseMenu({ database }: Props) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();

  const archive = useArchiveDatabase(database.id);
  const duplicate = useDuplicateDatabase(database.id);
  const remove = useDeleteDatabase(database.id);
  const update = useUpdateDatabase(database.id);

  const [renameValue, setRenameValue] = useState(database.name);
  const [confirmName, setConfirmName] = useState("");

  return (
    <>
      <Dropdown
        align="end"
        trigger={
          <GlassButton variant="ghost" aria-label="Datenbank-Optionen">
            <MoreHorizontal size={16} />
          </GlassButton>
        }
      >
        <DropdownItem
          icon={<Pencil size={14} />}
          label="Umbenennen"
          onClick={() => {
            setRenameValue(database.name);
            setRenameOpen(true);
          }}
        />
        <DropdownItem
          icon={<Copy size={14} />}
          label="Duplizieren"
          onClick={async () => {
            const copy = await duplicate.mutateAsync(undefined);
            navigate(`/databases/${copy.id}`);
          }}
        />
        <DropdownItem
          icon={database.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          label={database.archived ? "Aus Archiv holen" : "Archivieren"}
          onClick={async () => {
            await archive.mutateAsync(!database.archived);
            if (!database.archived) navigate("/databases");
          }}
        />
        <DropdownItem
          icon={<Trash2 size={14} />}
          label="Löschen"
          danger
          onClick={() => {
            setConfirmName("");
            setDeleteOpen(true);
          }}
        />
      </Dropdown>

      <GlassDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Datenbank umbenennen"
        description="Der Schema-Inhalt bleibt unverändert."
      >
        <div className="db-form">
          <GlassInput
            label="Neuer Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
          <div className="db-form__actions">
            <GlassButton variant="ghost" onClick={() => setRenameOpen(false)}>
              Abbrechen
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={async () => {
                if (!renameValue.trim()) return;
                await update.mutateAsync({ name: renameValue.trim() });
                setRenameOpen(false);
              }}
              disabled={update.isPending || !renameValue.trim()}
            >
              Speichern
            </GlassButton>
          </div>
        </div>
      </GlassDialog>

      <GlassDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Datenbank löschen"
        description={`Tippe "${database.name}" ein, um zu bestätigen. Alle Einträge gehen unwiderruflich verloren.`}
      >
        <div className="db-form">
          <GlassInput
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={database.name}
            autoFocus
          />
          <div className="db-form__actions">
            <GlassButton variant="ghost" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </GlassButton>
            <GlassButton
              variant="primary"
              disabled={confirmName !== database.name || remove.isPending}
              onClick={async () => {
                await remove.mutateAsync();
                setDeleteOpen(false);
                navigate("/databases");
              }}
              style={
                confirmName === database.name
                  ? {
                      background: "rgba(252,165,165,0.15)",
                      borderColor: "rgba(252,165,165,0.4)",
                      color: "var(--text-danger)",
                    }
                  : undefined
              }
            >
              {remove.isPending ? "Lösche…" : "Endgültig löschen"}
            </GlassButton>
          </div>
        </div>
      </GlassDialog>
    </>
  );
}
