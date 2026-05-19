import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Settings,
  Bird,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { StorageIndicator } from "../../features/files/StorageIndicator";
import "./layout.css";

interface SidebarItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  /** NavLink end-Matching. Default true (exakter Match). Auf false setzen wenn
   *  der Eintrag auch auf Sub-Routen aktiv bleiben soll (z.B. /databases/:id). */
  end?: boolean;
}

export function Sidebar() {
  return (
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
      <nav className="sidebar__nav">
        <SidebarLink
          to="/databases"
          label="Datenbanken"
          icon={<Database size={16} />}
          end={false}
        />
        <SidebarLink to="/dateien" label="Dateien" icon={<FolderOpen size={16} />} />
        <SidebarLink
          to="/dateien/papierkorb"
          label="Papierkorb"
          icon={<Trash2 size={16} />}
        />
      </nav>

      <nav className="sidebar__nav" style={{ marginTop: 16 }}>
        <SidebarLink
          to="/einstellungen"
          label="Einstellungen"
          icon={<Settings size={16} />}
          disabled
        />
      </nav>

      <StorageIndicator />
    </aside>
  );
}

function SidebarLink({ to, label, icon, disabled, end }: SidebarItem) {
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
      end={end ?? true}
      className={({ isActive }) =>
        cn("sidebar__item", isActive && "sidebar__item--active")
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
