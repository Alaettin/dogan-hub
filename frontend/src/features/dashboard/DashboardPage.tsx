import { lazy, Suspense } from "react";
import { useAuth } from "../auth/useAuth";
import { StatsRow } from "./StatsRow";
import { useDashboardStats } from "./useDashboard";
import "./dashboard.css";

// Widgets lazy — halten Kalender-/Kanban-Code aus dem Main-Bundle.
const CalendarWidget = lazy(() =>
  import("../calendar/CalendarWidget").then((m) => ({ default: m.CalendarWidget })),
);
const KanbanWidget = lazy(() =>
  import("../kanban/KanbanWidget").then((m) => ({ default: m.KanbanWidget })),
);
const NotesWidget = lazy(() =>
  import("../notes/NotesWidget").then((m) => ({ default: m.NotesWidget })),
);

export function DashboardPage() {
  const { profile } = useAuth();
  const stats = useDashboardStats();

  const displayName = profile?.display_name ?? stats.data?.user.display_name ?? "Hub-Nutzer";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1180 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-0.5px" }}>
          Hallo, {displayName}
        </h1>
      </header>

      <StatsRow stats={stats.data} loading={stats.isLoading} />

      <Suspense fallback={null}>
        <CalendarWidget />
      </Suspense>

      <Suspense fallback={null}>
        <KanbanWidget />
      </Suspense>

      <Suspense fallback={null}>
        <NotesWidget />
      </Suspense>
    </div>
  );
}
