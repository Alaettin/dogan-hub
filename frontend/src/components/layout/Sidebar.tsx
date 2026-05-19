import { NavLink } from "react-router-dom";
import { LayoutDashboard, Database, ShoppingCart, Settings, Bird } from "lucide-react";
import { cn } from "../../lib/cn";
import "./layout.css";

interface SidebarItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const PRIMARY: SidebarItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { to: "/daten", label: "Daten", icon: <Database size={16} />, disabled: true },
  { to: "/einkauf", label: "Einkaufsliste", icon: <ShoppingCart size={16} />, disabled: true },
];

const SECONDARY: SidebarItem[] = [
  { to: "/einstellungen", label: "Einstellungen", icon: <Settings size={16} />, disabled: true },
];

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
        {PRIMARY.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
      </nav>

      <div className="sidebar__section-label">Mehr</div>
      <nav className="sidebar__nav">
        {SECONDARY.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
      </nav>

      <div className="sidebar__footer">Etappe 1</div>
    </aside>
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
      end
      className={({ isActive }) =>
        cn("sidebar__item", isActive && "sidebar__item--active")
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
