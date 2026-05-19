import { Trash2 } from "lucide-react";
import { FieldDisplay } from "../fields/FieldDisplay";
import type { FieldDef } from "../fields/field-types";
import { useDeleteEntry, type Entry } from "../useEntries";
import { cn } from "../../../lib/cn";
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
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
}

export function EntryTable({
  entries,
  visibleFields,
  databaseId,
  sort,
  order,
  onSortChange,
  onEdit,
  selectedIds,
  onToggleSelected,
  onToggleAll,
}: EntryTableProps) {
  if (entries.length === 0) {
    return (
      <div className="entry-table__empty">
        Keine Einträge — Suche/Filter aufheben oder neu anlegen.
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

  const allSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
  const someSelected = entries.some((e) => selectedIds.has(e.id));

  return (
    <table className="entry-table">
      <thead>
        <tr>
          <th className="entry-table__select">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={onToggleAll}
              aria-label="Alle auswählen"
            />
          </th>
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
            selected={selectedIds.has(e.id)}
            onToggleSelected={() => onToggleSelected(e.id)}
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
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
}
function EntryRow({
  entry,
  visibleFields,
  databaseId,
  selected,
  onToggleSelected,
  onEdit,
}: EntryRowProps) {
  const remove = useDeleteEntry(entry.id, databaseId);
  return (
    <tr
      className={cn(selected && "entry-table__row--selected")}
      onClick={onEdit}
    >
      <td className="entry-table__select" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label="Eintrag auswählen"
        />
      </td>
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
