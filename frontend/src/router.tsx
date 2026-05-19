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
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage /> },
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
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
