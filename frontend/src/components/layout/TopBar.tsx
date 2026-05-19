import { LogOut } from "lucide-react";
import { GlassButton } from "../ui/GlassButton";
import { useAuth } from "../../features/auth/useAuth";
import "./layout.css";

export function TopBar() {
  const { profile, signOut } = useAuth();

  return (
    <header className="app-shell__topbar">
      <div />
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
