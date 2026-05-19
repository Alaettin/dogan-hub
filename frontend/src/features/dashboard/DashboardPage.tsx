import { Database, ShoppingCart, Shield } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAuth } from "../auth/useAuth";
import { StatsRow } from "./StatsRow";
import { ActivityFeed } from "./ActivityFeed";
import { useDashboardActivity, useDashboardStats } from "./useDashboard";
import "./dashboard.css";

const MODULES = [
  {
    key: "data",
    title: "Datenbanken & Dateien",
    description: "Notion-artige Datensätze plus Dropbox-Ordner-Browser mit Preview.",
    icon: <Database size={20} />,
  },
  {
    key: "shopping",
    title: "Einkaufsliste",
    description: "Mobile-first Liste mit Kategorien und (später) Realtime-Sync.",
    icon: <ShoppingCart size={20} />,
  },
  {
    key: "admin",
    title: "Admin",
    description: "User-Invites, Audit-Log, Role-Management.",
    icon: <Shield size={20} />,
  },
];

export function DashboardPage() {
  const { profile } = useAuth();
  const stats = useDashboardStats();
  const activity = useDashboardActivity(20);

  const displayName = profile?.display_name ?? stats.data?.user.display_name ?? "Hub-Nutzer";
  const isAdmin = profile?.role === "admin" || stats.data?.user.role === "admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1180 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-0.5px" }}>
          Hallo, {displayName}
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
          Etappe 2 steht. Stats + Activity laufen, echte Modul-Daten folgen in Etappe 3.
          {isAdmin && <span style={{ color: "var(--text-accent)" }}> Du bist Admin.</span>}
        </p>
      </header>

      <StatsRow stats={stats.data} loading={stats.isLoading} />

      <div className="dashboard-grid">
        <ActivityFeed items={activity.data?.items} loading={activity.isLoading} />

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--text-muted)",
              margin: "0 0 4px 8px",
            }}
          >
            Module
          </h2>
          {MODULES.map((module) => {
            const moduleData = stats.data?.modules[module.key];
            const isActive = moduleData?.status === "active";
            return (
              <GlassCard
                key={module.key}
                variant={isActive ? "accent" : "default"}
                style={{ padding: 16, opacity: isActive ? 1 : 0.85 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--glass-bg-1)",
                      border: "1px solid var(--glass-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-accent)",
                      flexShrink: 0,
                    }}
                  >
                    {module.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{module.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {module.description}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: isActive ? "var(--text-success)" : "var(--text-muted)",
                      padding: "3px 8px",
                      border: `1px solid ${isActive ? "rgba(134,239,172,0.3)" : "var(--glass-border)"}`,
                      borderRadius: "var(--radius-sm)",
                      flexShrink: 0,
                    }}
                  >
                    {isActive ? "aktiv" : moduleData?.eta ?? "geplant"}
                  </span>
                </div>
              </GlassCard>
            );
          })}
        </section>
      </div>
    </div>
  );
}
