import { Bell, X } from "lucide-react";
import { useReminders } from "./useReminders";
import "./calendar.css";

// In-App-Erinnerungs-Stack oben mittig. Wird in AppShell gerendert.
export function ReminderBanner() {
  const { due, dismiss } = useReminders();
  if (due.length === 0) return null;

  return (
    <div className="reminder-stack">
      {due.map((r) => (
        <div key={r.key} className="reminder-toast" role="alert">
          <Bell size={16} className="reminder-toast__icon" />
          <div className="reminder-toast__body">
            <div className="reminder-toast__title">{r.title}</div>
            <div className="reminder-toast__when">{r.when}</div>
          </div>
          <button
            type="button"
            className="reminder-toast__close"
            onClick={() => dismiss(r.key)}
            aria-label="Erinnerung schließen"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
