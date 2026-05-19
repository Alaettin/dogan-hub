import { useAuth } from "../auth/useAuth";
import { StatsRow } from "./StatsRow";
import { ActivityFeed } from "./ActivityFeed";
import { useDashboardActivity, useDashboardStats } from "./useDashboard";
import "./dashboard.css";

export function DashboardPage() {
  const { profile } = useAuth();
  const stats = useDashboardStats();
  const activity = useDashboardActivity(10);

  const displayName = profile?.display_name ?? stats.data?.user.display_name ?? "Hub-Nutzer";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1180 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-0.5px" }}>
          Hallo, {displayName}
        </h1>
      </header>

      <StatsRow stats={stats.data} loading={stats.isLoading} />

      <ActivityFeed items={activity.data?.items} loading={activity.isLoading} />
    </div>
  );
}
