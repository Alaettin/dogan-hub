import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Archive, Plus, Settings2, Trash2 } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useDatabase } from "./useDatabases";
import { useDeleteEntry, useEntries, type Entry } from "./useEntries";
import { getIconComponent } from "./icon-picker";
import { getColorOption } from "./color-picker";
import { DatabaseMenu } from "./DatabaseMenu";
import { SchemaEditor } from "./SchemaEditor";
import { EntryFormDialog } from "./EntryFormDialog";
import { FieldDisplay } from "./fields/FieldDisplay";
import type { FieldDef } from "./fields/field-types";
import "./databases.css";

export function DatabaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDatabase(id);
  const entries = useEntries(id);

  const [schemaOpen, setSchemaOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | undefined>(undefined);

  if (db.isLoading) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Lade…</div>;
  }

  if (db.isError || !db.data) {
    return (
      <GlassCard style={{ padding: 24, maxWidth: 600 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Datenbank nicht gefunden</h2>
        <p style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 14 }}>
          Möglicherweise wurde sie gelöscht.
        </p>
        <Link to="/databases" style={{ textDecoration: "none" }}>
          <GlassButton variant="primary" style={{ marginTop: 14 }}>
            <ArrowLeft size={14} />
            Zur Übersicht
          </GlassButton>
        </Link>
      </GlassCard>
    );
  }

  const Icon = getIconComponent(db.data.icon);
  const color = getColorOption(db.data.color);
  const schema = (db.data.schema ?? []) as FieldDef[];
  const fieldCount = schema.length;
  const visibleFields = schema.filter((f) => f.visible_in_table !== false).slice(0, 5);
  const visibleSchema = visibleFields.length > 0 ? visibleFields : schema.slice(0, 5);
  const entryList = entries.data?.items ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1180 }}>
      <div className="db-detail-header">
        <div className="db-detail-title">
          <div className="db-detail-icon" style={{ color: color.swatch }}>
            <Icon size={22} />
          </div>
          <div>
            <h1 className="db-detail-name">{db.data.name}</h1>
            {db.data.description && (
              <p className="db-detail-description">{db.data.description}</p>
            )}
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {fieldCount} {fieldCount === 1 ? "Feld" : "Felder"} ·{" "}
              {entries.data?.total ?? 0}{" "}
              {(entries.data?.total ?? 0) === 1 ? "Eintrag" : "Einträge"}
              {db.data.archived && " · Archiviert"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <GlassButton variant="secondary" onClick={() => setSchemaOpen(true)}>
            <Settings2 size={14} />
            Schema
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={() => {
              setEditingEntry(undefined);
              setEntryOpen(true);
            }}
            disabled={schema.length === 0}
          >
            <Plus size={14} />
            Neuer Eintrag
          </GlassButton>
          <DatabaseMenu database={db.data} />
        </div>
      </div>

      {db.data.archived && (
        <GlassCard
          style={{
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-warning)",
            background: "rgba(252, 211, 77, 0.06)",
            borderColor: "rgba(252, 211, 77, 0.25)",
          }}
        >
          <Archive size={16} />
          Diese Datenbank ist archiviert. Hol sie über das Menü zurück, wenn du sie nutzen willst.
        </GlassCard>
      )}

      {schema.length === 0 && (
        <GlassCard variant="accent" style={{ padding: 24 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Definiere erst das Schema</h3>
          <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            Klicke oben auf "Schema" um Felder hinzuzufügen. Erst dann kannst du Einträge anlegen.
          </p>
        </GlassCard>
      )}

      {schema.length > 0 && (
        <GlassPanel style={{ overflow: "hidden" }}>
          <EntryQuickTable
            entries={entryList}
            visibleFields={visibleSchema}
            databaseId={db.data.id}
            onEdit={(entry) => {
              setEditingEntry(entry);
              setEntryOpen(true);
            }}
          />
        </GlassPanel>
      )}

      <SchemaEditor open={schemaOpen} onOpenChange={setSchemaOpen} database={db.data} />
      <EntryFormDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        databaseId={db.data.id}
        schema={schema}
        mode={editingEntry ? "edit" : "create"}
        entry={editingEntry}
      />
    </div>
  );
}

interface EntryQuickTableProps {
  entries: Entry[];
  visibleFields: FieldDef[];
  databaseId: string;
  onEdit: (entry: Entry) => void;
}

function EntryQuickTable({ entries, visibleFields, databaseId, onEdit }: EntryQuickTableProps) {
  if (entries.length === 0) {
    return (
      <div className="entry-table__empty">
        Noch keine Einträge. Klick oben auf "Neuer Eintrag".
      </div>
    );
  }

  return (
    <table className="entry-table">
      <thead>
        <tr>
          {visibleFields.map((f) => (
            <th key={f.id}>{f.label}</th>
          ))}
          <th className="entry-table__actions" />
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            visibleFields={visibleFields}
            databaseId={databaseId}
            onEdit={() => onEdit(e)}
          />
        ))}
      </tbody>
    </table>
  );
}

interface EntryRowProps {
  entry: Entry;
  visibleFields: FieldDef[];
  databaseId: string;
  onEdit: () => void;
}
function EntryRow({ entry, visibleFields, databaseId, onEdit }: EntryRowProps) {
  const remove = useDeleteEntry(entry.id, databaseId);

  return (
    <tr onClick={onEdit}>
      {visibleFields.map((f) => (
        <td key={f.id}>
          <FieldDisplay field={f} value={entry.data[f.key]} />
        </td>
      ))}
      <td className="entry-table__actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="glass-button glass-button--ghost"
          aria-label="Eintrag löschen"
          onClick={async () => {
            if (confirm("Eintrag wirklich löschen?")) {
              await remove.mutateAsync();
            }
          }}
          style={{ color: "var(--text-danger)", padding: "6px 8px" }}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
