import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Database, ShoppingCart, Settings, Bird, Plus, FolderOpen } from "lucide-react";
import { cn } from "../../lib/cn";
import { useDatabases } from "../../features/databases/useDatabases";
import { getIconComponent } from "../../features/databases/icon-picker";
import { getColorOption } from "../../features/databases/color-picker";
import { CreateDatabaseDialog } from "../../features/databases/CreateDatabaseDialog";
import "./layout.css";
import "../../features/databases/databases.css";

interface SidebarItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const SECONDARY: SidebarItem[] = [
  { to: "/einkauf", label: "Einkaufsliste", icon: <ShoppingCart size={16} />, disabled: true },
  { to: "/einstellungen", label: "Einstellungen", icon: <Settings size={16} />, disabled: true },
];

export function Sidebar() {
  const databases = useDatabases(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <aside className="app-shell__sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark">
            <Bird size={16} />
          </div>
          <span className="sidebar__brand-text">Dogan-Hub</span>
        </div>

        <nav className="sidebar__nav">
          <SidebarLink to="/" label="Dashboard" icon={<LayoutDashboard size={16} />} />
        </nav>

        <div className="sidebar__section-label">Daten</div>
        <nav className="sidebar__nav sidebar__db-section">
          <SidebarLink to="/databases" label="Datenbanken" icon={<Database size={16} />} />
          <SidebarLink to="/dateien" label="Dateien" icon={<FolderOpen size={16} />} />
          {databases.data?.map((db) => {
            const Icon = getIconComponent(db.icon);
            const color = getColorOption(db.color);
            return (
              <NavLink
                key={db.id}
                to={`/databases/${db.id}`}
                className={({ isActive }) =>
                  cn("sidebar__item", "sidebar__db-item", isActive && "sidebar__item--active")
                }
              >
                <span style={{ color: color.swatch, display: "inline-flex" }}>
                  <Icon size={14} />
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {db.name}
                </span>
              </NavLink>
            );
          })}
          <button
            type="button"
            className="sidebar__db-new"
            onClick={() => setCreateOpen(true)}
            aria-label="Neue Datenbank anlegen"
          >
            <Plus size={12} />
            Neue Datenbank
          </button>
        </nav>

        <div className="sidebar__section-label">Mehr</div>
        <nav className="sidebar__nav">
          {SECONDARY.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        <div className="sidebar__footer">Etappe 3c.1</div>
      </aside>

      <CreateDatabaseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function SidebarLink({ to, label, icon, disabled }: SidebarItem) {
  if (disabled) {
    return (
      <span className={cn("sidebar__item", "sidebar__item--disabled")} aria-disabled="true">
        {icon}
        {label}
        <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>bald</span>
      </span>
    );
  }
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn("sidebar__item", isActive && "sidebar__item--active")
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
