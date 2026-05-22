import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { Toggle } from "./controls";
import { cn } from "../../lib/cn";
import {
  useRssSettings,
  useUpdateRssSettings,
  type CleanupMode,
  type DefaultView,
  type RssSettings,
} from "../rss/useRss";
import "./settings.css";

const INTERVAL_OPTIONS = [
  { v: 5, label: "Alle 5 Minuten" },
  { v: 15, label: "Alle 15 Minuten" },
  { v: 30, label: "Alle 30 Minuten" },
  { v: 60, label: "Stündlich" },
  { v: 180, label: "Alle 3 Stunden" },
  { v: 360, label: "Alle 6 Stunden" },
];

const CLEANUP_OPTIONS: { v: CleanupMode; label: string }[] = [
  { v: "off", label: "Aus" },
  { v: "read", label: "Gelesene" },
  { v: "all", label: "Alle" },
];

const VIEW_OPTIONS: { v: DefaultView; label: string }[] = [
  { v: "all", label: "Alle" },
  { v: "unread", label: "Ungelesen" },
];

export function RssSettingsPage() {
  const settings = useRssSettings();
  const update = useUpdateRssSettings();
  const [draft, setDraft] = useState<RssSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  if (settings.isLoading || !draft) {
    return (
      <>
        <header className="settings-content__header">
          <h1 className="settings-content__title">RSS-Feeds</h1>
        </header>
        <div className="settings-empty">Lade Einstellungen…</div>
      </>
    );
  }

  const cleanupOff = draft.cleanup_mode === "off";
  const dirty = !!settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data);

  function setField<K extends keyof RssSettings>(field: K, value: RssSettings[K]) {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
    setSaved(false);
  }

  function onSave() {
    if (!draft) return;
    update.mutate(
      {
        refresh_interval_minutes: draft.refresh_interval_minutes,
        cleanup_mode: draft.cleanup_mode,
        cleanup_after_days: Math.max(1, Math.min(3650, Math.round(draft.cleanup_after_days) || 30)),
        cleanup_keep_favorites: draft.cleanup_keep_favorites,
        default_view: draft.default_view,
        mark_read_on_open: draft.mark_read_on_open,
      },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <>
      <header className="settings-content__header">
        <h1 className="settings-content__title">RSS-Feeds</h1>
      </header>

      <GlassCard className="user-detail-section">
        <h2 className="user-detail-section__title">Aktualisierung</h2>
        <div className="rss-set-row">
          <span className="rss-set-row__label">Intervall</span>
          <select
            className="glass-input rss-set-select"
            value={draft.refresh_interval_minutes}
            onChange={(e) => setField("refresh_interval_minutes", Number(e.target.value))}
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
            {!INTERVAL_OPTIONS.some((o) => o.v === draft.refresh_interval_minutes) && (
              <option value={draft.refresh_interval_minutes}>
                {draft.refresh_interval_minutes} Minuten
              </option>
            )}
          </select>
        </div>
      </GlassCard>

      <GlassCard className="user-detail-section">
        <h2 className="user-detail-section__title">Aufräumen</h2>
        <div className="rss-set-row">
          <span className="rss-set-row__label">Alte Artikel löschen</span>
          <Seg
            options={CLEANUP_OPTIONS}
            value={draft.cleanup_mode}
            onChange={(v) => setField("cleanup_mode", v)}
          />
        </div>
        <div className="rss-set-row">
          <span className={cn("rss-set-row__label", cleanupOff && "rss-set-row__label--off")}>
            Löschen nach (Tage)
          </span>
          <GlassInput
            className="rss-days-input"
            type="number"
            min={1}
            max={3650}
            value={draft.cleanup_after_days}
            disabled={cleanupOff}
            onChange={(e) => setField("cleanup_after_days", Number(e.target.value))}
          />
        </div>
        <div className="rss-set-row">
          <span className={cn("rss-set-row__label", cleanupOff && "rss-set-row__label--off")}>
            Favoriten behalten
          </span>
          <Toggle
            checked={draft.cleanup_keep_favorites}
            disabled={cleanupOff}
            onChange={(v) => setField("cleanup_keep_favorites", v)}
          />
        </div>
      </GlassCard>

      <GlassCard className="user-detail-section">
        <h2 className="user-detail-section__title">Ansicht</h2>
        <div className="rss-set-row">
          <span className="rss-set-row__label">Standard-Ansicht</span>
          <Seg
            options={VIEW_OPTIONS}
            value={draft.default_view}
            onChange={(v) => setField("default_view", v)}
          />
        </div>
        <div className="rss-set-row">
          <span className="rss-set-row__label">Beim Öffnen als gelesen markieren</span>
          <Toggle
            checked={draft.mark_read_on_open}
            onChange={(v) => setField("mark_read_on_open", v)}
          />
        </div>
      </GlassCard>

      <div className="user-detail-form-row__actions">
        {saved && !dirty && (
          <span className="rss-set-saved">
            <Check size={13} /> Gespeichert
          </span>
        )}
        <GlassButton variant="primary" onClick={onSave} disabled={!dirty || update.isPending}>
          {update.isPending ? "Speichere…" : "Speichern"}
        </GlassButton>
      </div>
    </>
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="rss-seg" role="group">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          className={cn("rss-seg__btn", value === o.v && "rss-seg__btn--active")}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
