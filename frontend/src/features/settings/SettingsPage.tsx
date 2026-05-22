import { NavLink, Outlet } from "react-router-dom";
import { Users, Rss, LayoutDashboard } from "lucide-react";
import { cn } from "../../lib/cn";
import "./settings.css";

interface SubNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const items: SubNavItem[] = [
  { to: "/einstellungen/dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} /> },
  { to: "/einstellungen/benutzer", label: "Benutzerverwaltung", icon: <Users size={14} /> },
  { to: "/einstellungen/rss", label: "RSS-Feeds", icon: <Rss size={14} /> },
];

export function SettingsPage() {
  return (
    <div className="settings-page">
      <aside className="settings-subnav" aria-label="Einstellungs-Navigation">
        <div className="settings-subnav__heading">Einstellungen</div>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn("settings-subnav__link", isActive && "settings-subnav__link--active")
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </aside>
      <section className="settings-content">
        <Outlet />
      </section>
    </div>
  );
}
