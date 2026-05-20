import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { cn } from "../../lib/cn";
import {
  addDays,
  addMonths,
  formatMonthYear,
  getMonthGrid,
  getWeekDays,
  isoWeek,
  startOfWeek,
  toDateKey,
} from "../../lib/calendar-utils";
import { getHolidayMap } from "../../lib/holidays";
import { expandAll } from "../../lib/recurrence";
import { DayEventsDialog } from "./DayEventsDialog";
import { EventDialog } from "./EventDialog";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { YearView } from "./YearView";
import { useEvents, type CalendarEvent, type EventOccurrence } from "./useCalendar";
import "./calendar.css";

type View = "year" | "month" | "week";

function parseDate(s: string | null): Date {
  if (s) {
    const d = new Date(`${s}T00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as View) || "month";
  const cursor = parseDate(params.get("date"));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [dialogDate, setDialogDate] = useState<Date | undefined>(undefined);
  const [dayOpen, setDayOpen] = useState(false);
  const [dayDate, setDayDate] = useState<Date | null>(null);

  // Sichtfenster je nach Ansicht
  const { windowStart, windowEnd, monthForGrid } = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      return { windowStart: start, windowEnd: addDays(start, 7), monthForGrid: cursor.getMonth() };
    }
    if (view === "year") {
      return {
        windowStart: new Date(cursor.getFullYear(), 0, 1),
        windowEnd: new Date(cursor.getFullYear() + 1, 0, 1),
        monthForGrid: cursor.getMonth(),
      };
    }
    // month: 6-Wochen-Grid
    const weeks = getMonthGrid(cursor.getFullYear(), cursor.getMonth());
    return {
      windowStart: weeks[0][0],
      windowEnd: addDays(weeks[5][6], 1),
      monthForGrid: cursor.getMonth(),
    };
  }, [view, cursor]);

  const events = useEvents(windowStart.toISOString(), windowEnd.toISOString());

  // Occurrences expandieren + nach Tag gruppieren
  const occByDay = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    const occs = expandAll(events.data ?? [], windowStart, windowEnd);
    for (const occ of occs) {
      const key = toDateKey(occ.occurrenceStart);
      const arr = map.get(key);
      if (arr) arr.push(occ);
      else map.set(key, [occ]);
    }
    return map;
  }, [events.data, windowStart, windowEnd]);

  const holidayMap = useMemo(() => {
    const years = [windowStart.getFullYear(), windowEnd.getFullYear()];
    return getHolidayMap([...new Set(years)]);
  }, [windowStart, windowEnd]);

  function setView(v: View) {
    const next = new URLSearchParams(params);
    next.set("view", v);
    setParams(next, { replace: true });
  }

  function navigate(dir: -1 | 0 | 1) {
    let target: Date;
    if (dir === 0) target = new Date();
    else if (view === "week") target = addDays(cursor, dir * 7);
    else if (view === "year") target = new Date(cursor.getFullYear() + dir, cursor.getMonth(), 1);
    else target = addMonths(cursor, dir);
    const next = new URLSearchParams(params);
    next.set("date", toDateKey(target));
    setParams(next, { replace: true });
  }

  function jumpTo(d: Date, v?: View) {
    const next = new URLSearchParams(params);
    next.set("date", toDateKey(d));
    if (v) next.set("view", v);
    setParams(next, { replace: true });
  }

  function openCreate(d?: Date) {
    setEditing(null);
    setDialogDate(d);
    setDialogOpen(true);
  }

  function openEdit(occ: EventOccurrence) {
    // occ ist eine angereicherte Kopie des Events — Basis-Event reicht zum Editieren.
    const { occurrenceStart: _s, occurrenceEnd: _e, ...base } = occ;
    void _s;
    void _e;
    setEditing(base as CalendarEvent);
    setDialogOpen(true);
  }

  const title =
    view === "year"
      ? String(cursor.getFullYear())
      : view === "week"
        ? `KW ${isoWeek(cursor)} · ${formatMonthYear(cursor)}`
        : formatMonthYear(cursor);

  return (
    <div className="cal-page">
      <header className="cal-header">
        <div className="cal-header__left">
          <h1 className="cal-title">{title}</h1>
          <div className="cal-nav">
            <GlassButton variant="ghost" onClick={() => navigate(-1)} aria-label="Zurück">
              <ChevronLeft size={16} />
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => navigate(0)}>
              Heute
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => navigate(1)} aria-label="Vor">
              <ChevronRight size={16} />
            </GlassButton>
          </div>
        </div>
        <div className="cal-header__right">
          <div className="cal-viewswitch">
            {(["year", "month", "week"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                className={cn("cal-viewswitch__btn", view === v && "cal-viewswitch__btn--active")}
                onClick={() => setView(v)}
              >
                {v === "year" ? "Jahr" : v === "month" ? "Monat" : "Woche"}
              </button>
            ))}
          </div>
          <GlassButton variant="primary" onClick={() => openCreate()}>
            <CalendarPlus size={14} />
            Termin
          </GlassButton>
        </div>
      </header>

      {events.isLoading && <div className="cal-loading">Lade Termine…</div>}

      {view === "month" && (
        <MonthView
          weeks={getMonthGrid(cursor.getFullYear(), cursor.getMonth())}
          month={monthForGrid}
          occByDay={occByDay}
          holidayMap={holidayMap}
          onDayClick={openCreate}
          onEventClick={openEdit}
          onMoreClick={(d) => {
            setDayDate(d);
            setDayOpen(true);
          }}
        />
      )}
      {view === "week" && (
        <WeekView
          days={getWeekDays(cursor)}
          occByDay={occByDay}
          holidayMap={holidayMap}
          onDayClick={openCreate}
          onEventClick={openEdit}
        />
      )}
      {view === "year" && (
        <YearView
          year={cursor.getFullYear()}
          occByDay={occByDay}
          holidayMap={holidayMap}
          onMonthClick={(m) => jumpTo(new Date(cursor.getFullYear(), m, 1), "month")}
          onDayClick={(d) => jumpTo(d, "month")}
        />
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        defaultDate={dialogDate}
      />

      <DayEventsDialog
        open={dayOpen}
        onOpenChange={setDayOpen}
        date={dayDate}
        occurrences={dayDate ? (occByDay.get(toDateKey(dayDate)) ?? []) : []}
        onPick={(occ) => {
          setDayOpen(false);
          openEdit(occ);
        }}
        onCreate={(d) => {
          setDayOpen(false);
          openCreate(d);
        }}
      />
    </div>
  );
}
