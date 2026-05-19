import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Archive, ArchiveRestore, Trash2, MoreHorizontal, Pencil } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassInput } from "../../components/ui/GlassInput";
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
  const [open, setOpen] = useState(false);
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
    <div className="db-menu">
      <GlassButton
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Datenbank-Optionen"
      >
        <MoreHorizontal size={16} />
      </GlassButton>

      {open && (
        <div
          role="menu"
          onMouseLeave={() => setOpen(false)}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 20,
            minWidth: 200,
            background: "var(--glass-bg-2)",
            backdropFilter: "blur(var(--glass-blur))",
            WebkitBackdropFilter: "blur(var(--glass-blur))",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-md)",
            padding: 4,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
          }}
        >
          <MenuItem
            icon={<Pencil size={14} />}
            label="Umbenennen"
            onClick={() => {
              setRenameValue(database.name);
              setRenameOpen(true);
              setOpen(false);
            }}
          />
          <MenuItem
            icon={<Copy size={14} />}
            label="Duplizieren"
            onClick={async () => {
              const copy = await duplicate.mutateAsync(undefined);
              setOpen(false);
              navigate(`/databases/${copy.id}`);
            }}
          />
          <MenuItem
            icon={database.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            label={database.archived ? "Aus Archiv holen" : "Archivieren"}
            onClick={async () => {
              await archive.mutateAsync(!database.archived);
              setOpen(false);
              if (!database.archived) navigate("/databases");
            }}
          />
          <MenuItem
            icon={<Trash2 size={14} />}
            label="Löschen"
            danger
            onClick={() => {
              setConfirmName("");
              setDeleteOpen(true);
              setOpen(false);
            }}
          />
        </div>
      )}

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
    </div>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}
function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        background: "transparent",
        border: "none",
        color: danger ? "var(--text-danger)" : "var(--text-primary)",
        fontSize: 13,
        cursor: "pointer",
        borderRadius: "var(--radius-sm)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glass-bg-1)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {label}
    </button>
  );
}
