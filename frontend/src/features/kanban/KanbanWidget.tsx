import { Link } from "react-router-dom";
import { KanbanSquare } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { getColorOption } from "../databases/color-picker";
import { useUpcomingTasks } from "./useKanban";
import "./kanban.css";

function formatDue(iso: string): string {
  return new Date(`${iso}T00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function KanbanWidget() {
  const tasks = useUpcomingTasks();
  const items = (tasks.data ?? []).slice(0, 6);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <GlassCard className="kanban-widget">
      <div className="kanban-widget__head">
        <span className="kanban-widget__title">
          <KanbanSquare size={15} /> Kanban-Aufgaben
        </span>
        <Link to="/kanban" className="kanban-widget__link">
          Alle Boards
        </Link>
      </div>

      {tasks.isLoading && <div className="kanban-widget__empty">Lade…</div>}
      {tasks.data && items.length === 0 && (
        <div className="kanban-widget__empty">Keine Aufgaben mit Fälligkeit.</div>
      )}

      {items.map((t) => {
        const overdue = t.due_date < today;
        return (
          <Link key={t.id} to={`/kanban/${t.board_id}`} className="kanban-widget__row">
            <span
              className="kanban-widget__bar"
              style={{ background: getColorOption(t.color).swatch }}
            />
            <span className="kanban-task">
              <span className="kanban-task__title">{t.title}</span>
              <span className="kanban-task__board">{t.board_name}</span>
            </span>
            <span className={`kanban-task__due ${overdue ? "kanban-task__due--overdue" : ""}`}>
              {formatDue(t.due_date)}
              {overdue && " · fällig"}
            </span>
          </Link>
        );
      })}
    </GlassCard>
  );
}
