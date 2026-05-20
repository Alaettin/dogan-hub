import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KanbanSquare, Plus } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { getColorOption } from "../databases/color-picker";
import { CreateBoardDialog } from "./CreateBoardDialog";
import { useBoards } from "./useKanban";
import "./kanban.css";

export function KanbanListPage() {
  const boards = useBoards();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1180 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.3px" }}>
          Kanban
        </h1>
        <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} />
          Neues Board
        </GlassButton>
      </header>

      {boards.isLoading && <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Lade…</div>}

      {boards.data?.length === 0 && (
        <GlassCard variant="accent" style={{ padding: 32, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 500 }}>Noch kein Board</h2>
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Board anlegen
          </GlassButton>
        </GlassCard>
      )}

      {boards.data && boards.data.length > 0 && (
        <div className="kanban-list">
          {boards.data.map((b) => (
            <Link key={b.id} to={`/kanban/${b.id}`} className="kanban-list-row">
              <span
                className="kanban-list-row__bar"
                style={{ background: getColorOption(b.color).swatch }}
              />
              <KanbanSquare size={18} style={{ color: getColorOption(b.color).swatch, flexShrink: 0 }} />
              <span className="kanban-list-row__name">{b.name}</span>
              <span className="kanban-list-row__stats">
                <span className="kanban-stat">{b.card_count} Aufgaben</span>
                <span className="kanban-stat">{b.column_count} Spalten</span>
                {b.overdue_count > 0 && (
                  <span className="kanban-stat kanban-stat--overdue">{b.overdue_count} fällig</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}

      <CreateBoardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate(`/kanban/${id}`)}
      />
    </div>
  );
}
