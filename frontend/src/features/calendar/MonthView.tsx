import { getColorOption } from "../databases/color-picker";
import { WEEKDAY_LABELS, isToday, toDateKey } from "../../lib/calendar-utils";
import type { EventOccurrence } from "./useCalendar";

interface MonthViewProps {
  weeks: Date[][];
  month: number; // 0-11, für „außerhalb des Monats"-Dimmung
  occByDay: Map<string, EventOccurrence[]>;
  holidayMap: Map<string, string>;
  onDayClick: (d: Date) => void;
  onEventClick: (occ: EventOccurrence) => void;
  onMoreClick: (d: Date) => void;
}

export function MonthView({
  weeks,
  month,
  occByDay,
  holidayMap,
  onDayClick,
  onEventClick,
  onMoreClick,
}: MonthViewProps) {
  return (
    <div className="cal-month">
      <div className="cal-month__head">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="cal-month__weekday">
            {w}
          </div>
        ))}
      </div>
      <div className="cal-month__grid">
        {weeks.flat().map((day) => {
          const key = toDateKey(day);
          const occs = occByDay.get(key) ?? [];
          const holiday = holidayMap.get(key);
          const outside = day.getMonth() !== month;
          return (
            <div
              key={key}
              className={`cal-cell ${outside ? "cal-cell--outside" : ""} ${isToday(day) ? "cal-cell--today" : ""}`}
              onClick={() => onDayClick(day)}
              role="button"
              tabIndex={0}
            >
              <div className="cal-cell__num">{day.getDate()}</div>
              {holiday && <div className="cal-holiday" title={holiday}>{holiday}</div>}
              {occs.slice(0, 3).map((occ, i) => (
                <button
                  key={`${occ.id}-${i}`}
                  type="button"
                  className="cal-chip"
                  style={{ background: getColorOption(occ.color).swatch }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(occ);
                  }}
                  title={occ.title}
                >
                  {occ.title}
                </button>
              ))}
              {occs.length > 3 && (
                <button
                  type="button"
                  className="cal-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoreClick(day);
                  }}
                >
                  +{occs.length - 3} weitere
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
