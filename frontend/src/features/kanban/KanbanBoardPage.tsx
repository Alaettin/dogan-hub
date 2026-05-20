import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassCard } from "../../components/ui/GlassCard";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { CardDialog } from "./CardDialog";
import {
  useBoard,
  useCreateCard,
  useCreateColumn,
  useDeleteBoard,
  useDeleteColumn,
  useReorder,
  useUpdateBoard,
  useUpdateColumn,
  type Card,
  type Column,
} from "./useKanban";
import "./kanban.css";

function midpoint(prev: number | undefined, next: number | undefined): number {
  if (prev != null && next != null) return (prev + next) / 2;
  if (prev != null) return prev + 1;
  if (next != null) return next - 1;
  return 1;
}

export function KanbanBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const detail = useBoard(boardId);

  const createColumn = useCreateColumn(boardId!);
  const updateColumn = useUpdateColumn(boardId!);
  const deleteColumn = useDeleteColumn(boardId!);
  const createCard = useCreateCard(boardId!);
  const deleteBoard = useDeleteBoard();
  const updateBoard = useUpdateBoard(boardId!);
  const { patchCache, persistCard, persistColumn } = useReorder(boardId!);

  // Lokaler Arbeitszustand für flüssiges DnD
  const [colOrder, setColOrder] = useState<string[]>([]);
  const [lists, setLists] = useState<Record<string, Card[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"card" | "column" | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const colMap = useMemo(() => {
    const m: Record<string, Column> = {};
    for (const c of detail.data?.columns ?? []) m[c.id] = c;
    return m;
  }, [detail.data]);

  // Sync vom Server — nur wenn nicht gerade gezogen wird.
  useEffect(() => {
    if (!detail.data || activeId) return;
    const cols = [...detail.data.columns].sort((a, b) => a.position - b.position);
    setColOrder(cols.map((c) => c.id));
    const grouped: Record<string, Card[]> = {};
    for (const c of cols) grouped[c.id] = [];
    for (const card of [...detail.data.cards].sort((a, b) => a.position - b.position)) {
      (grouped[card.column_id] ??= []).push(card);
    }
    setLists(grouped);
  }, [detail.data, activeId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function findContainer(id: string): string | undefined {
    if (lists[id]) return id; // id ist eine Spalte
    return colOrder.find((colId) => lists[colId]?.some((c) => c.id === id));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setActiveType((e.active.data.current?.type as "card" | "column") ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.data.current?.type !== "card") return;
    const activeCol = findContainer(String(active.id));
    const overCol = findContainer(String(over.id));
    if (!activeCol || !overCol || activeCol === overCol) return;

    setLists((prev) => {
      const from = prev[activeCol] ?? [];
      const to = prev[overCol] ?? [];
      const moving = from.find((c) => c.id === active.id);
      if (!moving) return prev;
      const overIdx = to.findIndex((c) => c.id === over.id);
      const insertAt = overIdx >= 0 ? overIdx : to.length;
      return {
        ...prev,
        [activeCol]: from.filter((c) => c.id !== active.id),
        [overCol]: [
          ...to.slice(0, insertAt),
          { ...moving, column_id: overCol },
          ...to.slice(insertAt),
        ],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const type = active.data.current?.type;
    setActiveId(null);
    setActiveType(null);
    if (!over) return;

    if (type === "column") {
      const oldIdx = colOrder.indexOf(String(active.id));
      const newIdx = colOrder.indexOf(String(over.id));
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const next = arrayMove(colOrder, oldIdx, newIdx);
      setColOrder(next);
      const i = next.indexOf(String(active.id));
      const pos = midpoint(colMap[next[i - 1]]?.position, colMap[next[i + 1]]?.position);
      patchCache((prev) => ({
        ...prev,
        columns: prev.columns.map((c) =>
          c.id === active.id ? { ...c, position: pos } : c,
        ),
      }));
      void persistColumn(String(active.id), pos);
      return;
    }

    // Karte: finale Position innerhalb der Zielspalte bestimmen
    const col = findContainer(String(active.id));
    if (!col) return;
    let list = lists[col] ?? [];
    const fromIdx = list.findIndex((c) => c.id === active.id);
    const overIdx = list.findIndex((c) => c.id === over.id);
    if (fromIdx >= 0 && overIdx >= 0 && fromIdx !== overIdx) {
      list = arrayMove(list, fromIdx, overIdx);
      setLists((prev) => ({ ...prev, [col]: list }));
    }
    const i = list.findIndex((c) => c.id === active.id);
    const pos = midpoint(list[i - 1]?.position, list[i + 1]?.position);
    const card = list[i];
    patchCache((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === active.id ? { ...c, column_id: col, position: pos } : c,
      ),
    }));
    void persistCard(String(active.id), { column_id: card.column_id, position: pos });
  }

  if (detail.isLoading) {
    return <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Lade Board…</div>;
  }
  if (detail.isError || !detail.data) {
    return (
      <GlassCard style={{ padding: 24 }}>
        <p style={{ margin: 0 }}>Board nicht gefunden.</p>
        <Link to="/kanban" style={{ color: "var(--text-accent)" }}>
          ← Zurück zur Übersicht
        </Link>
      </GlassCard>
    );
  }

  const board = detail.data.board;
  const activeCard =
    activeType === "card"
      ? Object.values(lists).flat().find((c) => c.id === activeId) ?? null
      : null;
  const activeColumn = activeType === "column" ? colMap[activeId ?? ""] : null;

  async function handleDeleteBoard() {
    const ok = await confirm({
      title: `Board „${board.name}" löschen?`,
      description: "Alle Spalten und Karten werden mitgelöscht.",
      destructive: true,
      confirmLabel: "Löschen",
    });
    if (ok) {
      await deleteBoard.mutateAsync(board.id);
      navigate("/kanban");
    }
  }

  return (
    <div className="kanban-page">
      <header className="kanban-page__head">
        <div className="kanban-page__title">
          <Link to="/kanban" className="kanban-back" aria-label="Zurück">
            <ArrowLeft size={16} />
          </Link>
          <h1>{board.name}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <GlassButton variant="secondary" onClick={() => createColumn.mutate({ name: "Neue Spalte" })}>
            <Plus size={14} /> Spalte
          </GlassButton>
          <Dropdown
            align="end"
            trigger={
              <GlassButton variant="ghost" aria-label="Board-Optionen">
                <MoreHorizontal size={16} />
              </GlassButton>
            }
          >
            <DropdownItem
              icon={<Pencil size={12} />}
              label="Umbenennen"
              onClick={async () => {
                const name = window.prompt("Board-Name", board.name);
                if (name && name.trim()) await updateBoard.mutateAsync({ name: name.trim() });
              }}
            />
            <DropdownItem icon={<Trash2 size={12} />} label="Löschen" danger onClick={handleDeleteBoard} />
          </Dropdown>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="kanban-board">
          <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
            {colOrder.map((colId) => {
              const column = colMap[colId];
              if (!column) return null;
              return (
                <KanbanColumn
                  key={colId}
                  column={column}
                  cards={lists[colId] ?? []}
                  onOpenCard={(c) => {
                    setEditingCard(c);
                    setCardOpen(true);
                  }}
                  onAddCard={(columnId, title) => createCard.mutate({ columnId, title })}
                  onRename={(c, name) => updateColumn.mutate({ id: c.id, name })}
                  onDelete={(id) => deleteColumn.mutate(id)}
                />
              );
            })}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeCard && <KanbanCard card={activeCard} onOpen={() => {}} overlay />}
          {activeColumn && (
            <div className="kanban-col kanban-col--overlay">
              <div className="kanban-col__head">
                <span className="kanban-col__name">{activeColumn.name}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <CardDialog open={cardOpen} onOpenChange={setCardOpen} boardId={board.id} card={editingCard} />
    </div>
  );
}
