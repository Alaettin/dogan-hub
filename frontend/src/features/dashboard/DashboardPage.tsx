import { Database, ShoppingCart, FolderKanban } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAuth } from "../auth/useAuth";

const MODULES = [
  {
    title: "Datenbanken",
    description: "Notion-artige strukturierte Datensätze mit user-definierten Schemas.",
    icon: <Database size={20} />,
    eta: "Etappe 3",
  },
  {
    title: "Dateien",
    description: "Dropbox-artiger Ordner-Browser mit PDF- und Bild-Preview.",
    icon: <FolderKanban size={20} />,
    eta: "Etappe 3",
  },
  {
    title: "Einkaufsliste",
    description: "Mobile-first Liste mit Drag-Drop, Kategorien und Realtime-Sync.",
    icon: <ShoppingCart size={20} />,
    eta: "Etappe 6",
  },
];

export function DashboardPage() {
  const { profile } = useAuth();
  const displayName = profile?.display_name ?? "Hub-Nutzer";
  const isAdmin = profile?.role === "admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 1100 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-0.5px" }}>
          Hallo, {displayName}
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
          Etappe 1 steht — Auth läuft. Module folgen in den nächsten Etappen.
          {isAdmin && (
            <span style={{ color: "var(--text-accent)" }}> Du bist Admin.</span>
          )}
        </p>
      </header>

      <section>
        <h2
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "var(--text-muted)",
            margin: "0 0 12px 0",
          }}
        >
          Module
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {MODULES.map((module) => (
            <GlassCard
              key={module.title}
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                opacity: 0.85,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <div style={{ color: "var(--text-accent)" }}>{module.icon}</div>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--text-muted)",
                    padding: "2px 8px",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {module.eta}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{module.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                {module.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}
