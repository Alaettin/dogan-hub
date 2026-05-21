import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Top-Level-Fallback: verhindert White-Screen bei unerwartetem Render-Fehler.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
            color: "var(--text-primary, #e5e7eb)",
            background: "var(--bg, #0b0f17)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Etwas ist schiefgelaufen</h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.7, maxWidth: 420 }}>
            Die Ansicht konnte nicht geladen werden. Lade die Seite neu, um fortzufahren.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              color: "inherit",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
