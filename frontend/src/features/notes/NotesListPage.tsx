import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pin } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { cn } from "../../lib/cn";
import { CreateNoteDialog } from "./CreateNoteDialog";
import { NOTE_TYPE_META } from "./note-meta";
import { useNotes, useSetPinned, type Note, type NoteType } from "./useNotes";
import "./notes.css";

const TYPE_FILTERS: { value: NoteType | ""; label: string }[] = [
  { value: "", label: "Alle" },
  { value: "text", label: "Text" },
  { value: "checklist", label: "Checklisten" },
  { value: "list", label: "Listen" },
];

function notePreview(note: Note): string {
  if (note.type === "text") {
    return note.body.replace(/\s+/g, " ").trim().slice(0, 140);
  }
  const texts = note.items.map((i) => i.text).filter(Boolean);
  if (note.type === "checklist") {
    const done = note.items.filter((i) => i.done).length;
    return `${done}/${note.items.length} erledigt${texts.length ? " · " + texts.slice(0, 3).join(", ") : ""}`;
  }
  return texts.slice(0, 4).join(" · ");
}

export function NotesListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<NoteType | "">("");
  const [createOpen, setCreateOpen] = useState(false);

  const notes = useNotes({ search, type });
  const setPinned = useSetPinned();

  return (
    <div className="notes-page">
      <header className="notes-page__head">
        <h1>Notizen</h1>
        <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} />
          Neue Notiz
        </GlassButton>
      </header>

      <div className="notes-toolbar">
        <GlassInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suchen…"
          className="notes-search"
        />
        <div className="notes-type-tabs">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              className={cn("notes-tab", type === f.value && "notes-tab--active")}
              onClick={() => setType(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {notes.isLoading && <div className="notes-muted">Lade…</div>}

      {notes.data?.length === 0 && (
        <GlassCard variant="accent" style={{ padding: 32, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 500 }}>
            {search || type ? "Keine Treffer" : "Noch keine Notiz"}
          </h2>
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Notiz anlegen
          </GlassButton>
        </GlassCard>
      )}

      {notes.data && notes.data.length > 0 && (
        <div className="notes-grid">
          {notes.data.map((n) => {
            const meta = NOTE_TYPE_META[n.type];
            const Icon = meta.icon;
            return (
              <Link
                key={n.id}
                to={`/notizen/${n.id}`}
                className="notes-card"
                style={{ borderTopColor: meta.color }}
              >
                <div className="notes-card__head">
                  <Icon size={15} className="notes-card__icon" style={{ color: meta.color }} />
                  <span className="notes-card__title">{n.title || "Ohne Titel"}</span>
                  <button
                    type="button"
                    className={cn("notes-card__pin", n.pinned && "notes-card__pin--active")}
                    title={n.pinned ? "Angepinnt — Klick zum Lösen" : "Anpinnen"}
                    aria-pressed={n.pinned}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPinned.mutate({ id: n.id, pinned: !n.pinned });
                    }}
                  >
                    <Pin size={14} fill={n.pinned ? "currentColor" : "none"} />
                  </button>
                </div>
                <p className="notes-card__preview">{notePreview(n) || "—"}</p>
              </Link>
            );
          })}
        </div>
      )}

      <CreateNoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate(`/notizen/${id}`)}
      />
    </div>
  );
}
