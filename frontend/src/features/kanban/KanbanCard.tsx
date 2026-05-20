import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock } from "lucide-react";
import { getColorOption } from "../databases/color-picker";
import type { Card } from "./useKanban";

interface KanbanCardProps {
  card: Card;
  onOpen: (card: Card) => void;
  overlay?: boolean;
}

function formatDue(iso: string): string {
  const d = new Date(`${iso}T00:00`);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function KanbanCard({ card, onOpen, overlay }: KanbanCardProps) {
  const sortable = useSortable({ id: card.id, data: { type: "card", columnId: card.column_id } });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.4 : 1,
    borderLeftColor: getColorOption(card.color).swatch,
  };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`kanban-card ${overlay ? "kanban-card--overlay" : ""}`}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => !overlay && onOpen(card)}
    >
      {card.labels.length > 0 && (
        <div className="kanban-card__labels">
          {card.labels.map((l, i) => (
            <span
              key={i}
              className="kanban-card__label"
              style={{ background: getColorOption(l.color).swatch }}
              title={l.name}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className="kanban-card__title">{card.title}</div>
      {card.due_date && (
        <div className="kanban-card__due">
          <CalendarClock size={12} />
          {formatDue(card.due_date)}
        </div>
      )}
    </div>
  );
}
