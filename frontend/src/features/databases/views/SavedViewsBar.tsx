import { BookmarkPlus, MoreHorizontal, Star, Trash2 } from "lucide-react";
import { GlassButton } from "../../../components/ui/GlassButton";
import { Dropdown, DropdownItem } from "../../../components/ui/Dropdown";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useDeleteView, useUpdateView, type SavedView } from "../useViews";
import { viewConfigsEqual, type ViewConfig } from "../view-types";
import { cn } from "../../../lib/cn";
import "./views.css";

interface SavedViewsBarProps {
  views: SavedView[];
  current: ViewConfig;
  databaseId: string;
  onSelect: (view: SavedView) => void;
  onSave: () => void;
}

export function SavedViewsBar({ views, current, databaseId, onSelect, onSave }: SavedViewsBarProps) {
  return (
    <div className="saved-views-bar">
      {views.map((v) => {
        const cfg: ViewConfig = { view_type: v.view_type, ...v.config };
        const active = viewConfigsEqual(cfg, current);
        return (
          <SavedViewTab
            key={v.id}
            view={v}
            active={active}
            databaseId={databaseId}
            onSelect={() => onSelect(v)}
          />
        );
      })}
      <GlassButton variant="ghost" onClick={onSave}>
        <BookmarkPlus size={14} />
        Ansicht speichern
      </GlassButton>
    </div>
  );
}

interface SavedViewTabProps {
  view: SavedView;
  active: boolean;
  databaseId: string;
  onSelect: () => void;
}

function SavedViewTab({ view, active, databaseId, onSelect }: SavedViewTabProps) {
  const update = useUpdateView(view.id, databaseId);
  const remove = useDeleteView(view.id, databaseId);
  const confirm = useConfirm();

  return (
    <div className={cn("saved-view-tab", active && "saved-view-tab--active")}>
      <span
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
      >
        {view.is_default && <Star size={10} fill="currentColor" />}
        {view.name}
      </span>
      <Dropdown
        align="end"
        trigger={
          <button
            type="button"
            className="saved-view-tab__menu-trigger"
            aria-label="Optionen"
          >
            <MoreHorizontal size={12} />
          </button>
        }
      >
        <DropdownItem
          icon={<Star size={12} />}
          label={view.is_default ? "Standard entfernen" : "Als Standard"}
          onClick={async () => {
            await update.mutateAsync({ is_default: !view.is_default });
          }}
        />
        <DropdownItem
          icon={<Trash2 size={12} />}
          label="Löschen"
          danger
          onClick={async () => {
            const ok = await confirm({
              title: "Ansicht löschen?",
              description: `Die gespeicherte Ansicht "${view.name}" wird entfernt.`,
              confirmLabel: "Löschen",
              destructive: true,
            });
            if (ok) await remove.mutateAsync();
          }}
        />
      </Dropdown>
    </div>
  );
}
