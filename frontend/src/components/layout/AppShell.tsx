import { lazy, Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MeshBackground } from "../../design/MeshBackground";
import "./layout.css";

// CommandPalette lazy laden — erscheint nur on-demand via Cmd+K oder Top-Bar.
const CommandPalette = lazy(() =>
  import("../../features/search/CommandPalette").then((m) => ({
    default: m.CommandPalette,
  })),
);

// In-App-Erinnerungen lazy — hält den Kalender-Code aus dem Main-Bundle.
const ReminderBanner = lazy(() =>
  import("../../features/calendar/ReminderBanner").then((m) => ({
    default: m.ReminderBanner,
  })),
);

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd/Ctrl + K öffnet die Command-Palette von überall in der App.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isShortcut =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isShortcut) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <MeshBackground />
      <div className="app-shell">
        <Sidebar />
        <div className="app-shell__main">
          <TopBar onOpenSearch={() => setPaletteOpen(true)} />
          <main className="app-shell__content">
            <Outlet />
          </main>
        </div>
      </div>
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <ReminderBanner />
      </Suspense>
    </>
  );
}
