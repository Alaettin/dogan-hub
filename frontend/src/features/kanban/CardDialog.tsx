import { useEffect, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { COLOR_OPTIONS, ColorPicker, getColorOption } from "../databases/color-picker";
import { ApiRequestError } from "../../lib/api";
import {
  useDeleteCard,
  useUpdateCard,
  type Card,
  type KanbanLabel,
} from "./useKanban";

interface CardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  card: Card | null;
}

export function CardDialog({ open, onOpenChange, boardId, card }: CardDialogProps) {
  const update = useUpdateCard(boardId);
  const del = useDeleteCard(boardId);
  const confirm = useConfirm();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("indigo");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState<KanbanLabel[]>([]);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("emerald");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !card) return;
    setTitle(card.title);
    setDescription(card.description ?? "");
    setColor(card.color ?? "indigo");
    setDueDate(card.due_date ?? "");
    setLabels(card.labels ?? []);
    setLabelName("");
    setLabelColor("emerald");
    setError(null);
  }, [open, card]);

  function addLabel() {
    const name = labelName.trim();
    setLabels((prev) => [...prev, { name, color: labelColor }]);
    setLabelName("");
  }

  function removeLabel(idx: number) {
    setLabels((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!card) return;
    setError(null);
    if (!title.trim()) {
      setError("Titel ist erforderlich");
      return;
    }
    try {
      await update.mutateAsync({
        id: card.id,
        title: title.trim(),
        description: description.trim() || null,
        color,
        due_date: dueDate || null,
        labels,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Speichern fehlgeschlagen");
    }
  }

  async function remove() {
    if (!card) return;
    const ok = await confirm({
      title: `„${card.title}" löschen?`,
      description: "Die Karte wird unwiderruflich entfernt.",
      destructive: true,
      confirmLabel: "Löschen",
    });
    if (!ok) return;
    try {
      await del.mutateAsync(card.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Löschen fehlgeschlagen");
    }
  }

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title="Karte bearbeiten">
      <div className="db-form">
        <GlassInput
          label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={200}
        />

        <div>
          <label className="glass-label">Beschreibung</label>
          <textarea
            className="glass-input kanban-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="kanban-form-grid">
          <div>
            <label className="glass-label">Fälligkeit</label>
            <GlassInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="glass-label">Karten-Farbe</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        <div>
          <label className="glass-label">Labels</label>
          <div className="kanban-label-chips">
            {labels.length === 0 && <span className="kanban-label-empty">Keine Labels</span>}
            {labels.map((l, i) => (
              <span
                key={i}
                className="kanban-label-chip"
                style={{ background: getColorOption(l.color).swatch }}
              >
                {l.name || getColorOption(l.color).label}
                <button type="button" onClick={() => removeLabel(i)} aria-label="Label entfernen">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="kanban-label-add">
            <div className="kanban-label-swatches">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`kanban-swatch ${labelColor === c.key ? "kanban-swatch--active" : ""}`}
                  style={{ background: c.swatch }}
                  onClick={() => setLabelColor(c.key)}
                  aria-label={c.label}
                />
              ))}
            </div>
            <input
              className="glass-input kanban-label-input"
              placeholder="Label-Text (optional)"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLabel();
                }
              }}
            />
            <GlassButton variant="ghost" onClick={addLabel}>
              <Plus size={14} />
            </GlassButton>
          </div>
        </div>

        {error && <div className="kanban-error">{error}</div>}

        <div className="db-form__actions">
          <GlassButton
            variant="ghost"
            onClick={remove}
            disabled={del.isPending}
            style={{ marginRight: "auto", color: "var(--text-danger, #fca5a5)" }}
          >
            <Trash2 size={14} />
            Löschen
          </GlassButton>
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={save} disabled={update.isPending}>
            <Save size={14} />
            {update.isPending ? "Speichere…" : "Speichern"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
