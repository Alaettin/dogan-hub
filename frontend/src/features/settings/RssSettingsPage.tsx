import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassInput } from "../../components/ui/GlassInput";
import { cn } from "../../lib/cn";
import {
  useRssSettings,
  useUpdateRssSettings,
  type CleanupMode,
  type DefaultView,
  type UpdateRssSettingsInput,
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
  const [savedAt, setSavedAt] = useState(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();

  const [days, setDays] = useState<string>("");
  useEffect(() => {
    if (settings.data) setDays(String(settings.data.cleanup_after_days));
  }, [settings.data?.cleanup_after_days]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  function save(patch: UpdateRssSettingsInput) {
    update.mutate(patch, {
      onSuccess: () => {
        setSavedAt(Date.now());
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSavedAt(0), 2000);
      },
    });
  }

  if (settings.isLoading || !settings.data) {
    return (
      <>
        <header className="settings-content__header">
          <h1 className="settings-content__title">RSS-Feeds</h1>
        </header>
        <div className="settings-empty">Lade Einstellungen…</div>
      </>
    );
  }

  const s = settings.data;
  const cleanupOff = s.cleanup_mode === "off";

  function commitDays() {
    const n = Math.max(1, Math.min(3650, Number(days) || s.cleanup_after_days));
    setDays(String(n));
    if (n !== s.cleanup_after_days) save({ cleanup_after_days: n });
  }

  return (
    <>
      <header className="settings-content__header">
        <h1 className="settings-content__title">RSS-Feeds</h1>
        <span className="rss-set-saved">{savedAt > 0 && (<><Check size={13} /> Gespeichert</>)}</span>
      </header>

      <GlassCard className="user-detail-section">
        <h2 className="user-detail-section__title">Aktualisierung</h2>
        <div className="rss-set-row">
          <span className="rss-set-row__label">Intervall</span>
          <select
            className="glass-input rss-set-select"
            value={s.refresh_interval_minutes}
            onChange={(e) => save({ refresh_interval_minutes: Number(e.target.value) })}
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
            {!INTERVAL_OPTIONS.some((o) => o.v === s.refresh_interval_minutes) && (
              <option value={s.refresh_interval_minutes}>{s.refresh_interval_minutes} Minuten</option>
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
            value={s.cleanup_mode}
            onChange={(v) => save({ cleanup_mode: v })}
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
            value={days}
            disabled={cleanupOff}
            onChange={(e) => setDays(e.target.value)}
            onBlur={commitDays}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <div className="rss-set-row">
          <span className={cn("rss-set-row__label", cleanupOff && "rss-set-row__label--off")}>
            Favoriten behalten
          </span>
          <Toggle
            checked={s.cleanup_keep_favorites}
            disabled={cleanupOff}
            onChange={(v) => save({ cleanup_keep_favorites: v })}
          />
        </div>
      </GlassCard>

      <GlassCard className="user-detail-section">
        <h2 className="user-detail-section__title">Ansicht</h2>
        <div className="rss-set-row">
          <span className="rss-set-row__label">Standard-Ansicht</span>
          <Seg
            options={VIEW_OPTIONS}
            value={s.default_view}
            onChange={(v) => save({ default_view: v })}
          />
        </div>
        <div className="rss-set-row">
          <span className="rss-set-row__label">Beim Öffnen als gelesen markieren</span>
          <Toggle checked={s.mark_read_on_open} onChange={(v) => save({ mark_read_on_open: v })} />
        </div>
      </GlassCard>
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

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="rss-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="rss-toggle__track" />
    </label>
  );
}
