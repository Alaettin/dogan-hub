import { GlassPanel } from "../../../components/ui/GlassPanel";
import { FieldDisplay } from "../fields/FieldDisplay";
import type { FieldDef } from "../fields/field-types";
import type { Entry } from "../useEntries";
import "./views.css";

interface EntryListProps {
  entries: Entry[];
  visibleFields: FieldDef[];
  onEdit: (entry: Entry) => void;
}

export function EntryList({ entries, visibleFields, onEdit }: EntryListProps) {
  if (entries.length === 0) {
    return <div className="entry-table__empty">Keine Einträge.</div>;
  }

  const [titleField, ...metaFields] = visibleFields;

  return (
    <GlassPanel style={{ padding: 8 }}>
      <div className="entry-list">
        {entries.map((e) => (
          <div key={e.id} className="entry-list__row" onClick={() => onEdit(e)}>
            {titleField && (
              <div className="entry-list__title">
                <FieldDisplay field={titleField} value={e.data[titleField.key]} />
              </div>
            )}
            <div className="entry-list__meta">
              {metaFields.map((f) => (
                <span key={f.id} style={{ whiteSpace: "nowrap" }}>
                  <FieldDisplay field={f} value={e.data[f.key]} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
