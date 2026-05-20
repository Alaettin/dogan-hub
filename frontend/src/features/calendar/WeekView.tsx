import { getColorOption } from "../databases/color-picker";
import { formatTime, isToday, toDateKey, weekdayShort } from "../../lib/calendar-utils";
import type { EventOccurrence } from "./useCalendar";

interface WeekViewProps {
  days: Date[]; // 7 Tage Mo–So
  occByDay: Map<string, EventOccurrence[]>;
  holidayMap: Map<string, string>;
  onDayClick: (d: Date) => void;
  onEventClick: (occ: EventOccurrence) => void;
}

export function WeekView({ days, occByDay, holidayMap, onDayClick, onEventClick }: WeekViewProps) {
  return (
    <div className="cal-week">
      {days.map((day) => {
        const key = toDateKey(day);
        const occs = occByDay.get(key) ?? [];
        const holiday = holidayMap.get(key);
        return (
          <div key={key} className={`cal-week__col ${isToday(day) ? "cal-week__col--today" : ""}`}>
            <div
              className="cal-week__head"
              onClick={() => onDayClick(day)}
              role="button"
              tabIndex={0}
            >
              <span className="cal-week__dow">{weekdayShort(day)}</span>
              <span className="cal-week__num">{day.getDate()}</span>
            </div>
            <div className="cal-week__body" onClick={() => onDayClick(day)}>
              {holiday && <div className="cal-holiday" title={holiday}>{holiday}</div>}
              {occs.map((occ, i) => (
                <button
                  key={`${occ.id}-${i}`}
                  type="button"
                  className="cal-week__event"
                  style={{ borderLeftColor: getColorOption(occ.color).swatch }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(occ);
                  }}
                >
                  <span className="cal-week__event-time">
                    {occ.all_day ? "ganztägig" : formatTime(occ.occurrenceStart)}
                  </span>
                  <span className="cal-week__event-title">{occ.title}</span>
                </button>
              ))}
              {occs.length === 0 && !holiday && <div className="cal-week__empty" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
