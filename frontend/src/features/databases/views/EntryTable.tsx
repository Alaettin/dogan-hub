import { Trash2 } from "lucide-react";
import { FieldDisplay } from "../fields/FieldDisplay";
import type { FieldDef } from "../fields/field-types";
import { useDeleteEntry, type Entry } from "../useEntries";
import "./views.css";
import "../databases.css";

interface EntryTableProps {
  entries: Entry[];
  visibleFields: FieldDef[];
  databaseId: string;
  sort: string | undefined;
  order: "asc" | "desc" | undefined;
  onSortChange: (sort: string | undefined, order: "asc" | "desc" | undefined) => void;
  onEdit: (entry: Entry) => void;
}

export function EntryTable({
  entries,
  visibleFields,
  databaseId,
  sort,
  order,
  onSortChange,
  onEdit,
}: EntryTableProps) {
  if (entries.length === 0) {
    return (
      <div className="entry-table__empty">
        Keine Einträge — Filter aufheben oder neu anlegen.
      </div>
    );
  }

  function handleHeaderClick(fieldKey: string) {
    if (sort === fieldKey) {
      onSortChange(fieldKey, order === "asc" ? "desc" : "asc");
    } else {
      onSortChange(fieldKey, "asc");
    }
  }

  return (
    <table className="entry-table">
      <thead>
        <tr>
          {visibleFields.map((f) => (
            <th
              key={f.id}
              className="sortable"
              data-sort={sort === f.key ? order : undefined}
              onClick={() => handleHeaderClick(f.key)}
            >
              {f.label}
            </th>
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
