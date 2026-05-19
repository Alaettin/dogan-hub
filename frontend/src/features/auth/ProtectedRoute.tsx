import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export function ProtectedRoute() {
  const { initialized, session } = useAuth();
  const location = useLocation();

  if (!initialized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        Lade Session…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
