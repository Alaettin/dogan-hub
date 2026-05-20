import { getMonthGrid, isToday, toDateKey, formatMonthLong } from "../../lib/calendar-utils";
import type { EventOccurrence } from "./useCalendar";

interface YearViewProps {
  year: number;
  occByDay: Map<string, EventOccurrence[]>;
  holidayMap: Map<string, string>;
  onMonthClick: (month: number) => void;
  onDayClick: (d: Date) => void;
}

export function YearView({ year, occByDay, holidayMap, onMonthClick, onDayClick }: YearViewProps) {
  return (
    <div className="cal-year">
      {Array.from({ length: 12 }, (_, m) => {
        const weeks = getMonthGrid(year, m);
        return (
          <div key={m} className="cal-year__month">
            <button
              type="button"
              className="cal-year__title"
              onClick={() => onMonthClick(m)}
            >
              {formatMonthLong(new Date(year, m, 1))}
            </button>
            <div className="cal-year__grid">
              {weeks.flat().map((day) => {
                const key = toDateKey(day);
                const outside = day.getMonth() !== m;
                const hasEvent = !outside && (occByDay.get(key)?.length ?? 0) > 0;
                const isHoliday = !outside && holidayMap.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={outside}
                    onClick={() => onDayClick(day)}
                    className={[
                      "cal-year__day",
                      outside ? "cal-year__day--outside" : "",
                      isToday(day) ? "cal-year__day--today" : "",
                      isHoliday ? "cal-year__day--holiday" : "",
                    ].join(" ")}
                    title={holidayMap.get(key) ?? undefined}
                  >
                    {outside ? "" : day.getDate()}
                    {hasEvent && <span className="cal-year__dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
