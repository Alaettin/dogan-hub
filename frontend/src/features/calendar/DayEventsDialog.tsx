import { Plus } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { getColorOption } from "../databases/color-picker";
import { formatTime, weekdayLong, formatDayMonth } from "../../lib/calendar-utils";
import type { EventOccurrence } from "./useCalendar";

interface DayEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  occurrences: EventOccurrence[];
  onPick: (occ: EventOccurrence) => void;
  onCreate: (date: Date) => void;
}

export function DayEventsDialog({
  open,
  onOpenChange,
  date,
  occurrences,
  onPick,
  onCreate,
}: DayEventsDialogProps) {
  const title = date ? `${weekdayLong(date)}, ${formatDayMonth(date)}` : "Termine";

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="db-form">
        <div className="cal-day-list">
          {occurrences.length === 0 && (
            <div className="cal-widget__empty">Keine Termine an diesem Tag.</div>
          )}
          {occurrences.map((occ, i) => (
            <button
              key={`${occ.id}-${i}`}
              type="button"
              className="cal-day-item"
              onClick={() => onPick(occ)}
            >
              <span
                className="cal-day-item__dot"
                style={{ background: getColorOption(occ.color).swatch }}
              />
              <span className="cal-day-item__time">
                {occ.all_day ? "ganztägig" : formatTime(occ.occurrenceStart)}
              </span>
              <span className="cal-day-item__title">{occ.title}</span>
            </button>
          ))}
        </div>

        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
            Schließen
          </GlassButton>
          <GlassButton variant="primary" onClick={() => date && onCreate(date)}>
            <Plus size={14} />
            Termin
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}
