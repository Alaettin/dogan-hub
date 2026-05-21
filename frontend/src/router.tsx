import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./features/dashboard/DashboardPage";

const DatabaseListPage = lazy(() =>
  import("./features/databases/DatabaseListPage").then((m) => ({ default: m.DatabaseListPage })),
);
const DatabaseDetailPage = lazy(() =>
  import("./features/databases/DatabaseDetailPage").then((m) => ({
    default: m.DatabaseDetailPage,
  })),
);
const FilesPage = lazy(() =>
  import("./features/files/FilesPage").then((m) => ({ default: m.FilesPage })),
);
const TrashPage = lazy(() =>
  import("./features/files/TrashPage").then((m) => ({ default: m.TrashPage })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const UserManagementPage = lazy(() =>
  import("./features/settings/UserManagementPage").then((m) => ({
    default: m.UserManagementPage,
  })),
);
const UserDetailPage = lazy(() =>
  import("./features/settings/UserDetailPage").then((m) => ({
    default: m.UserDetailPage,
  })),
);
const SharePage = lazy(() =>
  import("./features/share/SharePage").then((m) => ({ default: m.SharePage })),
);
const CalendarPage = lazy(() =>
  import("./features/calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })),
);
const KanbanListPage = lazy(() =>
  import("./features/kanban/KanbanListPage").then((m) => ({ default: m.KanbanListPage })),
);
const KanbanBoardPage = lazy(() =>
  import("./features/kanban/KanbanBoardPage").then((m) => ({ default: m.KanbanBoardPage })),
);
const NotesListPage = lazy(() =>
  import("./features/notes/NotesListPage").then((m) => ({ default: m.NotesListPage })),
);
const NoteDetailPage = lazy(() =>
  import("./features/notes/NoteDetailPage").then((m) => ({ default: m.NoteDetailPage })),
);

function PageFallback() {
  return (
    <div
      style={{
        padding: 48,
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      Lade…
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/share/:token",
    element: (
      <Suspense fallback={<PageFallback />}>
        <SharePage />
      </Suspense>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage /> },
          {
            path: "/kalender",
            element: (
              <Suspense fallback={<PageFallback />}>
                <CalendarPage />
              </Suspense>
            ),
          },
          {
            path: "/kanban",
            element: (
              <Suspense fallback={<PageFallback />}>
                <KanbanListPage />
              </Suspense>
            ),
          },
          {
            path: "/kanban/:boardId",
            element: (
              <Suspense fallback={<PageFallback />}>
                <KanbanBoardPage />
              </Suspense>
            ),
          },
          {
            path: "/notizen",
            element: (
              <Suspense fallback={<PageFallback />}>
                <NotesListPage />
              </Suspense>
            ),
          },
          {
            path: "/notizen/:noteId",
            element: (
              <Suspense fallback={<PageFallback />}>
                <NoteDetailPage />
              </Suspense>
            ),
          },
          {
            path: "/databases",
            element: (
              <Suspense fallback={<PageFallback />}>
                <DatabaseListPage />
              </Suspense>
            ),
          },
          {
            path: "/databases/:id",
            element: (
              <Suspense fallback={<PageFallback />}>
                <DatabaseDetailPage />
              </Suspense>
            ),
          },
          {
            path: "/dateien",
            element: (
              <Suspense fallback={<PageFallback />}>
                <FilesPage />
              </Suspense>
            ),
          },
          {
            path: "/dateien/papierkorb",
            element: (
              <Suspense fallback={<PageFallback />}>
                <TrashPage />
              </Suspense>
            ),
          },
          {
            path: "/einstellungen",
            element: (
              <Suspense fallback={<PageFallback />}>
                <SettingsPage />
              </Suspense>
            ),
            children: [
              { index: true, element: <Navigate to="/einstellungen/benutzer" replace /> },
              {
                path: "benutzer",
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <UserManagementPage />
                  </Suspense>
                ),
              },
              {
                path: "benutzer/:id",
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <UserDetailPage />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
