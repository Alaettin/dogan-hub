import { useState } from "react";
import { BookmarkPlus, MoreHorizontal, Star, Trash2 } from "lucide-react";
import { GlassButton } from "../../../components/ui/GlassButton";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const update = useUpdateView(view.id, databaseId);
  const remove = useDeleteView(view.id, databaseId);

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
      <button
        type="button"
        className="saved-view-tab__menu-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        aria-label="Optionen"
      >
        <MoreHorizontal size={12} />
      </button>
      {menuOpen && (
        <div
          role="menu"
          onMouseLeave={() => setMenuOpen(false)}
          style={{
            position: "absolute",
            zIndex: 30,
            marginTop: 4,
            transform: "translateY(28px)",
            minWidth: 200,
            background: "var(--glass-bg-2)",
            backdropFilter: "blur(var(--glass-blur))",
            WebkitBackdropFilter: "blur(var(--glass-blur))",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-md)",
            padding: 4,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
          }}
        >
          <MenuRow
            icon={<Star size={12} />}
            label={view.is_default ? "Standard entfernen" : "Als Standard"}
            onClick={async () => {
              await update.mutateAsync({ is_default: !view.is_default });
              setMenuOpen(false);
            }}
          />
          <MenuRow
            icon={<Trash2 size={12} />}
            label="Löschen"
            danger
            onClick={async () => {
              if (confirm(`Ansicht "${view.name}" löschen?`)) {
                await remove.mutateAsync();
                setMenuOpen(false);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

interface MenuRowProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}
function MenuRow({ icon, label, onClick, danger }: MenuRowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: "transparent",
        border: "none",
        color: danger ? "var(--text-danger)" : "var(--text-primary)",
        fontSize: 12,
        cursor: "pointer",
        borderRadius: "var(--radius-sm)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glass-bg-1)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {label}
    </button>
  );
}
