import { Link } from "react-router-dom";
import { StickyNote } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { NOTE_TYPE_META } from "./note-meta";
import { useNotes, type Note } from "./useNotes";
import "./notes.css";

function preview(note: Note): string {
  if (note.type === "text") return note.body.replace(/\s+/g, " ").trim().slice(0, 80);
  const texts = note.items.map((i) => i.text).filter(Boolean);
  if (note.type === "checklist") {
    const done = note.items.filter((i) => i.done).length;
    return `${done}/${note.items.length} erledigt`;
  }
  return texts.slice(0, 3).join(" · ");
}

export function NotesWidget({ count = 6 }: { count?: number }) {
  const notes = useNotes({ pinned: true });
  const items = (notes.data ?? []).slice(0, count);

  return (
    <GlassCard className="notes-widget">
      <div className="notes-widget__head">
        <span className="notes-widget__title">
          <StickyNote size={15} /> Angepinnte Notizen
        </span>
        <Link to="/notizen" className="notes-widget__link">
          Alle Notizen
        </Link>
      </div>

      {notes.isLoading && <div className="notes-widget__empty">Lade…</div>}
      {notes.data && items.length === 0 && (
        <div className="notes-widget__empty">Keine angepinnten Notizen.</div>
      )}

      {items.map((n) => {
        const meta = NOTE_TYPE_META[n.type];
        const Icon = meta.icon;
        return (
          <Link key={n.id} to={`/notizen/${n.id}`} className="notes-widget__row">
            <Icon size={15} className="notes-widget__icon" style={{ color: meta.color }} />
            <span className="notes-widget__text">
              <span className="notes-widget__row-title">{n.title || "Ohne Titel"}</span>
              <span className="notes-widget__row-preview">{preview(n) || "—"}</span>
            </span>
          </Link>
        );
      })}
    </GlassCard>
  );
}
