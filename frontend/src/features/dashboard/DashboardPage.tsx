import { lazy, Suspense } from "react";
import { useAuth } from "../auth/useAuth";
import { useDashboardSettings } from "./useDashboard";
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
const RssWidget = lazy(() =>
  import("../rss/RssWidget").then((m) => ({ default: m.RssWidget })),
);

export function DashboardPage() {
  const { profile } = useAuth();
  const settings = useDashboardSettings();
  const s = settings.data;

  const displayName = profile?.display_name ?? "Hub-Nutzer";
  // Vor dem Laden optimistisch alle anzeigen, damit das Dashboard nicht leer aufblitzt.
  const show = (visible: boolean | undefined) => visible !== false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1180 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-0.5px" }}>
          Hallo, {displayName}
        </h1>
      </header>

      {show(s?.show_calendar) && (
        <Suspense fallback={null}>
          <CalendarWidget count={s?.calendar_count ?? 6} />
        </Suspense>
      )}

      {show(s?.show_kanban) && (
        <Suspense fallback={null}>
          <KanbanWidget count={s?.kanban_count ?? 6} />
        </Suspense>
      )}

      {show(s?.show_notes) && (
        <Suspense fallback={null}>
          <NotesWidget count={s?.notes_count ?? 6} />
        </Suspense>
      )}

      {show(s?.show_rss) && (
        <Suspense fallback={null}>
          <RssWidget count={s?.rss_count ?? 5} />
        </Suspense>
      )}
    </div>
  );
}
