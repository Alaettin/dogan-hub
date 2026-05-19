import { Table, LayoutGrid, List } from "lucide-react";
import type { ViewType } from "../view-types";
import { cn } from "../../../lib/cn";
import "./views.css";

interface ViewSwitcherProps {
  value: ViewType;
  onChange: (v: ViewType) => void;
}

const VIEWS: Array<{ key: ViewType; label: string; icon: React.ReactNode }> = [
  { key: "table", label: "Tabelle", icon: <Table size={14} /> },
  { key: "cards", label: "Karten", icon: <LayoutGrid size={14} /> },
  { key: "list", label: "Liste", icon: <List size={14} /> },
];

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div className="view-switcher" role="tablist" aria-label="Ansicht wechseln">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={value === v.key}
          className={cn("view-switcher__btn", value === v.key && "view-switcher__btn--active")}
          onClick={() => onChange(v.key)}
        >
          {v.icon}
          {v.label}
        </button>
      ))}
    </div>
  );
}
