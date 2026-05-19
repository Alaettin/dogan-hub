import { LogOut, Search } from "lucide-react";
import { GlassButton } from "../ui/GlassButton";
import { useAuth } from "../../features/auth/useAuth";
import "./layout.css";

interface TopBarProps {
  onOpenSearch?: () => void;
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  const { profile, signOut } = useAuth();

  return (
    <header className="app-shell__topbar">
      <button
        type="button"
        className="topbar__search-trigger"
        onClick={onOpenSearch}
        aria-label="Globale Suche öffnen"
      >
        <Search size={14} />
        <span>Suchen…</span>
        <span className="topbar__search-kbd">⌘K</span>
      </button>
      <div className="topbar__user">
        <span className="topbar__user-name">
          {profile?.display_name ?? "Lädt…"}
        </span>
        <GlassButton variant="ghost" onClick={() => void signOut()} aria-label="Abmelden">
          <LogOut size={16} />
          Abmelden
        </GlassButton>
      </div>
    </header>
  );
}
