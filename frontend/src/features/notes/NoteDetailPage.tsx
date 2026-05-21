import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pin,
  PinOff,
  Eye,
  Pencil,
  X,
  GripVertical,
} from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { ApiRequestError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Markdown } from "./Markdown";
import { NOTE_TYPE_META } from "./note-meta";
import { useNote, useUpdateNote, useDeleteNote, type NoteItem } from "./useNotes";
import "./notes.css";

export function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const query = useNote(noteId);
  const update = useUpdateNote(noteId ?? "");
  const remove = useDeleteNote();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [items, setItems] = useState<NoteItem[]>([]);
  const [pinned, setPinned] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Lokalen State aus der geladenen Notiz initialisieren (nur bei id-Wechsel).
  const loadedId = useRef<string | null>(null);
  const note = query.data;
  useEffect(() => {
    if (!note || loadedId.current === note.id) return;
    loadedId.current = note.id;
    setTitle(note.title);
    setBody(note.body);
    setItems(note.items ?? []);
    setPinned(note.pinned);
  }, [note]);

  function updateItem(index: number, patch: Partial<NoteItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { text: "", ...(note?.type === "checklist" ? { done: false } : {}) }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!noteId) return;
    setError(null);
    try {
      await update.mutateAsync({
        title: title.trim(),
        body,
        items: items.filter((it) => it.text.trim() !== ""),
        pinned,
      });
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Speichern fehlgeschlagen");
    }
  }

  async function del() {
    if (!noteId) return;
    const ok = await confirm({
      title: "Notiz löschen?",
      description: "Diese Aktion kann nicht rückgängig gemacht werden.",
      destructive: true,
    });
    if (!ok) return;
    await remove.mutateAsync(noteId);
    navigate("/notizen");
  }

  if (query.isLoading) return <div className="notes-muted" style={{ padding: 24 }}>Lade…</div>;
  if (query.isError || !note)
    return (
      <div className="notes-detail">
        <Link to="/notizen" className="notes-back">
          <ArrowLeft size={16} /> Zurück
        </Link>
        <div className="notes-error">Notiz nicht gefunden.</div>
      </div>
    );

  return (
    <div className="notes-detail">
      <div className="notes-detail__head">
        <Link to="/notizen" className="notes-back" aria-label="Zurück">
          <ArrowLeft size={18} />
        </Link>
        <span className="notes-detail__type" style={{ color: NOTE_TYPE_META[note.type].color }}>
          {NOTE_TYPE_META[note.type].label}
        </span>
        <div className="notes-detail__actions">
          <GlassButton
            variant="ghost"
            onClick={() => setPinned((p) => !p)}
            title={pinned ? "Pin entfernen" : "Anpinnen"}
          >
            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
            {pinned ? "Angepinnt" : "Anpinnen"}
          </GlassButton>
          <GlassButton variant="ghost" onClick={del} disabled={remove.isPending}>
            <Trash2 size={14} /> Löschen
          </GlassButton>
          <GlassButton variant="primary" onClick={save} disabled={update.isPending}>
            {update.isPending ? "Speichere…" : "Speichern"}
          </GlassButton>
        </div>
      </div>

      <GlassInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titel"
        className="notes-detail__title"
      />

      {/* ── Typ-spezifischer Editor ──────────────────────────────── */}
      {note.type === "text" && (
        <div className="notes-text-editor">
          <div className="notes-text-editor__bar">
            <button
              type="button"
              className={cn("notes-tab", !preview && "notes-tab--active")}
              onClick={() => setPreview(false)}
            >
              <Pencil size={13} /> Bearbeiten
            </button>
            <button
              type="button"
              className={cn("notes-tab", preview && "notes-tab--active")}
              onClick={() => setPreview(true)}
            >
              <Eye size={13} /> Vorschau
            </button>
            <span className="notes-hint">Markdown: # Überschrift · - Liste · **fett** · *kursiv*</span>
          </div>
          {preview ? (
            <div className="notes-md-wrap">
              <Markdown text={body} />
            </div>
          ) : (
            <textarea
              className="glass-input notes-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Schreibe etwas…"
              rows={14}
            />
          )}
        </div>
      )}

      {(note.type === "checklist" || note.type === "list") && (
        <div className="notes-items">
          {note.type === "checklist" && items.length > 0 && (
            <div className="notes-progress">
              {items.filter((i) => i.done).length}/{items.length} erledigt
            </div>
          )}
          {items.map((it, i) => (
            <div key={i} className="notes-item">
              {note.type === "checklist" ? (
                <input
                  type="checkbox"
                  className="notes-item__check"
                  checked={!!it.done}
                  onChange={(e) => updateItem(i, { done: e.target.checked })}
                />
              ) : (
                <GripVertical size={14} className="notes-item__bullet" />
              )}
              <input
                className={cn("notes-item__input", it.done && "notes-item__input--done")}
                value={it.text}
                onChange={(e) => updateItem(i, { text: e.target.value })}
                placeholder="Eintrag…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (i === items.length - 1) addItem();
                  }
                }}
              />
              <button
                type="button"
                className="notes-item__remove"
                onClick={() => removeItem(i)}
                aria-label="Eintrag entfernen"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="notes-additem" onClick={addItem}>
            <Plus size={14} /> Eintrag hinzufügen
          </button>
        </div>
      )}

      {error && <div className="notes-error">{error}</div>}
      {savedAt && !update.isPending && !error && (
        <div className="notes-saved">Gespeichert ✓</div>
      )}
    </div>
  );
}
