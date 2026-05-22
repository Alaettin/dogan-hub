import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { cn } from "../../lib/cn";
import { Toggle } from "./controls";
import {
  useDashboardSettings,
  useUpdateDashboardSettings,
  type DashboardSettings,
} from "../dashboard/useDashboard";
import "./settings.css";

type WidgetKey = "calendar" | "kanban" | "notes" | "rss";

const WIDGETS: {
  key: WidgetKey;
  label: string;
  showField: keyof DashboardSettings;
  countField: keyof DashboardSettings;
}[] = [
  { key: "calendar", label: "Kalender", showField: "show_calendar", countField: "calendar_count" },
  { key: "kanban", label: "Kanban", showField: "show_kanban", countField: "kanban_count" },
  { key: "notes", label: "Notizen", showField: "show_notes", countField: "notes_count" },
  { key: "rss", label: "RSS-Feeds", showField: "show_rss", countField: "rss_count" },
];

export function DashboardSettingsPage() {
  const settings = useDashboardSettings();
  const update = useUpdateDashboardSettings();
  const [draft, setDraft] = useState<DashboardSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  if (settings.isLoading || !draft) {
    return (
      <>
        <header className="settings-content__header">
          <h1 className="settings-content__title">Dashboard</h1>
        </header>
        <div className="settings-empty">Lade Einstellungen…</div>
      </>
    );
  }

  const dirty = !!settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data);

  function setField(field: keyof DashboardSettings, value: boolean | number) {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
    setSaved(false);
  }

  function onSave() {
    if (!draft) return;
    // Anzahlen auf gültigen Bereich (1–20) begrenzen.
    const clamp = (n: number) => Math.max(1, Math.min(20, Math.round(n) || 1));
    const payload = {
      show_calendar: draft.show_calendar,
      show_kanban: draft.show_kanban,
      show_notes: draft.show_notes,
      show_rss: draft.show_rss,
      calendar_count: clamp(draft.calendar_count),
      kanban_count: clamp(draft.kanban_count),
      notes_count: clamp(draft.notes_count),
      rss_count: clamp(draft.rss_count),
    };
    update.mutate(payload, { onSuccess: () => setSaved(true) });
  }

  return (
    <>
      <header className="settings-content__header">
        <div>
          <h1 className="settings-content__title">Dashboard</h1>
          <p className="settings-content__subtitle">
            Welche Kacheln erscheinen und wie viele Elemente sie zeigen.
          </p>
        </div>
      </header>

      <GlassCard className="user-detail-section">
        <h2 className="user-detail-section__title">Kacheln</h2>
        <div className="user-detail-section__body">
          {WIDGETS.map((w) => {
            const visible = draft[w.showField] as boolean;
            return (
              <div className="rss-set-row" key={w.key}>
                <span className={cn("rss-set-row__label", !visible && "rss-set-row__label--off")}>
                  {w.label}
                </span>
                <div className="dash-set-controls">
                  <GlassInput
                    className="rss-days-input"
                    type="number"
                    min={1}
                    max={20}
                    value={draft[w.countField] as number}
                    disabled={!visible}
                    onChange={(e) => setField(w.countField, Number(e.target.value))}
                  />
                  <Toggle
                    checked={visible}
                    onChange={(v) => setField(w.showField, v)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <div className="user-detail-form-row__actions">
        {saved && !dirty && (
          <span className="rss-set-saved">
            <Check size={13} /> Gespeichert
          </span>
        )}
        <GlassButton
          variant="primary"
          onClick={onSave}
          disabled={!dirty || update.isPending}
        >
          {update.isPending ? "Speichere…" : "Speichern"}
        </GlassButton>
      </div>
    </>
  );
}
