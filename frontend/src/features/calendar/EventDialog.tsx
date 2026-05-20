import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { ColorPicker } from "../databases/color-picker";
import { ApiRequestError } from "../../lib/api";
import { toDateKey } from "../../lib/calendar-utils";
import type { RecurrenceFreq } from "../../lib/recurrence";
import {
  useCreateEvent,
  useDeleteEvent,
  useUpdateEvent,
  type CalendarEvent,
  type EventCategory,
  type EventInput,
} from "./useCalendar";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null; // null = neu anlegen
  defaultDate?: Date; // Vorbelegung beim Anlegen (Klick auf Tag)
}

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "general", label: "Allgemein" },
  { value: "birthday", label: "Geburtstag" },
  { value: "work", label: "Arbeit" },
  { value: "private", label: "Privat" },
];

const RECURRENCE: { value: RecurrenceFreq | ""; label: string }[] = [
  { value: "", label: "Keine" },
  { value: "daily", label: "Täglich" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
  { value: "yearly", label: "Jährlich" },
];

const REMIND: { value: number | ""; label: string }[] = [
  { value: "", label: "Keine" },
  { value: 0, label: "Zum Zeitpunkt" },
  { value: 5, label: "5 Min vorher" },
  { value: 15, label: "15 Min vorher" },
  { value: 60, label: "1 Std vorher" },
  { value: 1440, label: "1 Tag vorher" },
];

function timeVal(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EventDialog({ open, onOpenChange, event, defaultDate }: EventDialogProps) {
  const create = useCreateEvent();
  const update = useUpdateEvent(event?.id ?? "");
  const del = useDeleteEvent();
  const confirm = useConfirm();

  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("general");
  const [color, setColor] = useState("indigo");
  const [recurrence, setRecurrence] = useState<RecurrenceFreq | "">("");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [remind, setRemind] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (event) {
      const s = new Date(event.start_at);
      const e = event.end_at ? new Date(event.end_at) : null;
      setTitle(event.title);
      setAllDay(event.all_day);
      setStartDate(toDateKey(s));
      setStartTime(timeVal(s));
      setEndDate(e ? toDateKey(e) : toDateKey(s));
      setEndTime(e ? timeVal(e) : timeVal(s));
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
      setCategory(event.category ?? "general");
      setColor(event.color ?? "indigo");
      setRecurrence(event.recurrence_freq ?? "");
      setRecurrenceUntil(event.recurrence_until ? toDateKey(new Date(event.recurrence_until)) : "");
      setRemind(event.remind_minutes_before ?? "");
    } else {
      const base = defaultDate ?? new Date();
      setTitle("");
      setAllDay(false);
      setStartDate(toDateKey(base));
      setStartTime("09:00");
      setEndDate(toDateKey(base));
      setEndTime("10:00");
      setLocation("");
      setDescription("");
      setCategory("general");
      setColor("indigo");
      setRecurrence("");
      setRecurrenceUntil("");
      setRemind("");
    }
  }, [open, event, defaultDate]);

  // „Geburtstag" → sinnvolle Defaults setzen (ganztägig + jährlich).
  function pickCategory(c: EventCategory) {
    setCategory(c);
    if (c === "birthday") {
      setAllDay(true);
      setRecurrence("yearly");
    }
  }

  function buildInput(): EventInput | null {
    if (!title.trim()) {
      setError("Titel ist erforderlich");
      return null;
    }
    const start = allDay ? new Date(`${startDate}T00:00`) : new Date(`${startDate}T${startTime}`);
    if (Number.isNaN(start.getTime())) {
      setError("Ungültiges Startdatum");
      return null;
    }
    let end: Date | null = null;
    if (allDay) {
      end = endDate && endDate !== startDate ? new Date(`${endDate}T23:59`) : null;
    } else if (endDate) {
      end = new Date(`${endDate}T${endTime}`);
      if (end.getTime() <= start.getTime()) end = null;
    }
    return {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_at: start.toISOString(),
      end_at: end ? end.toISOString() : null,
      all_day: allDay,
      color,
      category,
      recurrence_freq: recurrence || null,
      recurrence_interval: 1,
      recurrence_until:
        recurrence && recurrenceUntil ? new Date(`${recurrenceUntil}T23:59`).toISOString() : null,
      remind_minutes_before: remind === "" ? null : remind,
    };
  }

  async function save() {
    setError(null);
    const input = buildInput();
    if (!input) return;
    try {
      if (event) await update.mutateAsync(input);
      else await create.mutateAsync(input);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Speichern fehlgeschlagen");
    }
  }

  async function remove() {
    if (!event) return;
    const ok = await confirm({
      title: `„${event.title}" löschen?`,
      description: "Der Termin wird unwiderruflich entfernt.",
      destructive: true,
      confirmLabel: "Löschen",
    });
    if (!ok) return;
    try {
      await del.mutateAsync(event.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Löschen fehlgeschlagen");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title={event ? "Termin bearbeiten" : "Neuer Termin"}
    >
      <div className="db-form">
        <GlassInput
          label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z.B. Zahnarzt, Geburtstag Mama…"
          autoFocus
          maxLength={200}
        />

        <label className="cal-checkbox">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Ganztägig
        </label>

        <div className="cal-form-grid">
          <GlassInput
            label="Start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {!allDay && (
            <GlassInput
              label="Uhrzeit"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          )}
        </div>

        <div className="cal-form-grid">
          <GlassInput
            label="Ende (optional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {!allDay && (
            <GlassInput
              label="Uhrzeit"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          )}
        </div>

        <GlassInput
          label="Ort (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <div>
          <label className="glass-label">Notiz (optional)</label>
          <textarea
            className="glass-input cal-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="cal-form-grid">
          <div>
            <label className="glass-label">Kategorie</label>
            <select
              className="glass-input"
              value={category}
              onChange={(e) => pickCategory(e.target.value as EventCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="glass-label">Wiederholung</label>
            <select
              className="glass-input"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceFreq | "")}
            >
              {RECURRENCE.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {recurrence && (
          <GlassInput
            label="Wiederholen bis (optional)"
            type="date"
            value={recurrenceUntil}
            onChange={(e) => setRecurrenceUntil(e.target.value)}
          />
        )}

        <div>
          <label className="glass-label">Erinnerung</label>
          <select
            className="glass-input"
            value={remind}
            onChange={(e) => setRemind(e.target.value === "" ? "" : Number(e.target.value))}
          >
            {REMIND.map((r) => (
              <option key={String(r.value)} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="glass-label">Farbe</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {error && <div className="cal-form-error">{error}</div>}

        <div className="db-form__actions">
          {event && (
            <GlassButton
              variant="ghost"
              onClick={remove}
              disabled={del.isPending}
              style={{ marginRight: "auto", color: "var(--text-danger, #fca5a5)" }}
            >
              <Trash2 size={14} />
              Löschen
            </GlassButton>
          )}
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={save} disabled={pending}>
            <Save size={14} />
            {pending ? "Speichere…" : "Speichern"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
