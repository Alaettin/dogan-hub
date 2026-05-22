import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, PartyPopper } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { getColorOption } from "../databases/color-picker";
import {
  WEEKDAY_LABELS,
  addDays,
  formatDateShort,
  formatFull,
  formatMonthYear,
  getMonthGrid,
  isToday,
  startOfDay,
  toDateKey,
} from "../../lib/calendar-utils";
import { getHolidayMap, getHolidays } from "../../lib/holidays";
import { expandAll } from "../../lib/recurrence";
import { useEvents } from "./useCalendar";
import "./calendar.css";

type AgendaItem =
  | { kind: "event"; key: string; title: string; when: Date; label: string; color: string }
  | { kind: "holiday"; key: string; title: string; when: Date; label: string };

export function CalendarWidget({ count = 6 }: { count?: number }) {
  // Stabiler Tagesbezug — einmal pro Mount. Verhindert, dass sich das
  // Query-Fenster (und damit der React-Query-Key) bei jedem Render ändert.
  const today = useMemo(() => new Date(), []);
  const weeks = useMemo(
    () => getMonthGrid(today.getFullYear(), today.getMonth()),
    [today],
  );

  // Fenster: aktueller Monat (für Punkte) + nächste 60 Tage (für Liste).
  const windowStart = weeks[0][0];
  const windowEnd = useMemo(() => addDays(today, 60), [today]);
  const events = useEvents(windowStart.toISOString(), windowEnd.toISOString());

  const occs = useMemo(
    () => expandAll(events.data ?? [], windowStart, windowEnd),
    [events.data, windowStart, windowEnd],
  );

  const daysWithEvents = useMemo(() => {
    const s = new Set<string>();
    for (const o of occs) s.add(toDateKey(o.occurrenceStart));
    return s;
  }, [occs]);

  const holidayMap = useMemo(() => getHolidayMap([today.getFullYear()]), [today]);

  // „Nächste Termine": eigene Events + kommende Feiertage gemischt, chronologisch.
  const upcoming = useMemo<AgendaItem[]>(() => {
    const dayStart = startOfDay(today);
    const items: AgendaItem[] = [];

    for (const o of occs) {
      if (o.occurrenceStart.getTime() < dayStart.getTime()) continue;
      items.push({
        kind: "event",
        key: `e-${o.id}-${o.occurrenceStart.getTime()}`,
        title: o.title,
        when: o.occurrenceStart,
        label: o.all_day ? formatDateShort(o.occurrenceStart) : formatFull(o.occurrenceStart),
        color: getColorOption(o.color).swatch,
      });
    }

    const years = [...new Set([today.getFullYear(), windowEnd.getFullYear()])];
    for (const y of years) {
      for (const h of getHolidays(y)) {
        if (h.date.getTime() < dayStart.getTime() || h.date.getTime() > windowEnd.getTime()) {
          continue;
        }
        items.push({
          kind: "holiday",
          key: `h-${toDateKey(h.date)}`,
          title: h.name,
          when: h.date,
          label: formatDateShort(h.date),
        });
      }
    }

    items.sort((a, b) => a.when.getTime() - b.when.getTime());
    return items.slice(0, count);
  }, [occs, today, windowEnd, count]);

  return (
    <GlassCard className="cal-widget">
      <div className="cal-widget__head">
        <span className="cal-widget__title">
          <CalendarDays size={15} /> {formatMonthYear(today)}
        </span>
        <Link to="/kalender" className="cal-widget__link">
          Kalender öffnen
        </Link>
      </div>

      <div className="cal-widget__main">
        <div className="cal-widget__cal">
          <div className="cal-widget__grid">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="cal-widget__dow">
                {w}
              </div>
            ))}
            {weeks.flat().map((day) => {
              const key = toDateKey(day);
              const outside = day.getMonth() !== today.getMonth();
              return (
                <div
                  key={key}
                  className={[
                    "cal-widget__day",
                    outside ? "cal-widget__day--outside" : "",
                    isToday(day) ? "cal-widget__day--today" : "",
                    holidayMap.has(key) ? "cal-widget__day--holiday" : "",
                  ].join(" ")}
                >
                  {day.getDate()}
                  {!outside && daysWithEvents.has(key) && <span className="cal-widget__dot" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="cal-widget__list">
          <div className="cal-widget__list-title">Nächste Termine</div>
          {upcoming.length === 0 && (
            <div className="cal-widget__empty">Keine anstehenden Termine.</div>
          )}
          {upcoming.map((item) => (
            <Link key={item.key} to="/kalender" className="cal-widget__item">
              {item.kind === "holiday" ? (
                <PartyPopper size={13} className="cal-widget__item-holiday" />
              ) : (
                <span className="cal-widget__item-dot" style={{ background: item.color }} />
              )}
              <span className="cal-widget__item-title">{item.title}</span>
              <span className="cal-widget__item-when">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
