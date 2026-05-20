// Leichte Datums-Helfer auf Basis der nativen Intl-API (keine externe Lib).
// Wochenstart Montag (DE-Konvention).

const WEEKDAY_SHORT = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const MONTH_YEAR = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
const MONTH_LONG = new Intl.DateTimeFormat("de-DE", { month: "long" });
const DAY_MONTH = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" });
const TIME_FMT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const FULL_FMT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const DATE_SHORT_FMT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Lokaler Datums-Key YYYY-MM-DD (nicht UTC — Anzeige folgt lokaler Zeit). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/** Montag der Woche, in der `d` liegt. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mo=0 … So=6
  return addDays(x, -dow);
}

/** 7 Tage Mo–So der Woche von `d`. */
export function getWeekDays(d: Date): Date[] {
  const mon = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** Wochen-Raster eines Monats (Mo-Start), inkl. Tage der Nachbarmonate. */
export function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const gridStart = startOfWeek(first);
  const weeks: Date[][] = [];
  let cursor = gridStart;
  // 6 Wochen decken jeden Monat ab
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function formatMonthYear(d: Date): string {
  return MONTH_YEAR.format(d);
}
export function formatMonthLong(d: Date): string {
  return MONTH_LONG.format(d);
}
export function formatDayMonth(d: Date): string {
  return DAY_MONTH.format(d);
}
export function formatTime(d: Date): string {
  return TIME_FMT.format(d);
}
export function formatFull(d: Date): string {
  return FULL_FMT.format(d);
}
export function formatDateShort(d: Date): string {
  return DATE_SHORT_FMT.format(d);
}
export function weekdayShort(d: Date): string {
  return WEEKDAY_SHORT.format(d);
}
export function weekdayLong(d: Date): string {
  return WEEKDAY_LONG.format(d);
}

/** ISO-Kalenderwoche (für Wochenansicht-Label). */
export function isoWeek(d: Date): number {
  const date = startOfDay(d);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  );
}
