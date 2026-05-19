import { GlassCard } from "../../../components/ui/GlassCard";
import { FieldDisplay } from "../fields/FieldDisplay";
import type { FieldDef } from "../fields/field-types";
import type { Entry } from "../useEntries";
import "./views.css";

interface EntryCardsProps {
  entries: Entry[];
  visibleFields: FieldDef[];
  onEdit: (entry: Entry) => void;
}

export function EntryCards({ entries, visibleFields, onEdit }: EntryCardsProps) {
  if (entries.length === 0) {
    return <div className="entry-table__empty">Keine Einträge.</div>;
  }

  // Erste Spalte = Titel-Feld
  const [titleField, ...rest] = visibleFields;

  return (
    <div className="entry-cards-grid">
      {entries.map((e) => (
        <GlassCard key={e.id} className="entry-card" onClick={() => onEdit(e)}>
          {titleField && (
            <div className="entry-card__title">
              <FieldDisplay field={titleField} value={e.data[titleField.key]} />
            </div>
          )}
          {rest.length > 0 && (
            <div className="entry-card__fields">
              {rest.map((f) => (
                <div key={f.id} className="entry-card__field">
                  <span className="entry-card__field-label">{f.label}</span>
                  <FieldDisplay field={f} value={e.data[f.key]} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
