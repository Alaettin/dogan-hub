import { useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Plus, Trash2, Pencil } from "lucide-react";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { KanbanCard } from "./KanbanCard";
import type { Card, Column } from "./useKanban";

interface KanbanColumnProps {
  column: Column;
  cards: Card[];
  onOpenCard: (card: Card) => void;
  onAddCard: (columnId: string, title: string) => void;
  onRename: (column: Column, name: string) => void;
  onDelete: (columnId: string) => void;
}

export function KanbanColumn({
  column,
  cards,
  onOpenCard,
  onAddCard,
  onRename,
  onDelete,
}: KanbanColumnProps) {
  const sortable = useSortable({ id: column.id, data: { type: "column" } });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const confirm = useConfirm();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function submitCard() {
    const t = title.trim();
    if (t) onAddCard(column.id, t);
    setTitle("");
    setAdding(false);
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Spalte „${column.name}" löschen?`,
      description: "Alle Karten in dieser Spalte werden mitgelöscht.",
      destructive: true,
      confirmLabel: "Löschen",
    });
    if (ok) onDelete(column.id);
  }

  return (
    <div ref={setNodeRef} style={style} className="kanban-col">
      <div className="kanban-col__head">
        <button className="kanban-col__grip" {...attributes} {...listeners} aria-label="Spalte verschieben">
          <GripVertical size={14} />
        </button>
        {renaming ? (
          <input
            className="kanban-col__rename"
            value={nameDraft}
            autoFocus
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              if (nameDraft.trim() && nameDraft !== column.name) onRename(column, nameDraft.trim());
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setNameDraft(column.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <span className="kanban-col__name">{column.name}</span>
        )}
        <span className="kanban-col__count">{cards.length}</span>
        <Dropdown
          align="end"
          trigger={
            <button className="kanban-col__menu" aria-label="Spalten-Optionen">
              <MoreHorizontal size={14} />
            </button>
          }
        >
          <DropdownItem icon={<Pencil size={12} />} label="Umbenennen" onClick={() => setRenaming(true)} />
          <DropdownItem icon={<Trash2 size={12} />} label="Löschen" danger onClick={handleDelete} />
        </Dropdown>
      </div>

      <div className="kanban-col__cards">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} onOpen={onOpenCard} />
          ))}
        </SortableContext>
      </div>

      {adding ? (
        <div className="kanban-col__add">
          <textarea
            className="glass-input kanban-add-input"
            value={title}
            autoFocus
            rows={2}
            placeholder="Titel der Karte…"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitCard();
              }
              if (e.key === "Escape") {
                setTitle("");
                setAdding(false);
              }
            }}
            onBlur={submitCard}
          />
        </div>
      ) : (
        <button className="kanban-col__addbtn" onClick={() => setAdding(true)}>
          <Plus size={14} /> Karte hinzufügen
        </button>
      )}
    </div>
  );
}
