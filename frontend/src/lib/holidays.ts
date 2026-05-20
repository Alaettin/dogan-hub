// Bundesweite gesetzliche Feiertage (DE), per Algorithmus berechnet —
// kein externer Dienst. Bewegliche Feiertage über das Osterdatum (Gauß/Butcher).

import { toDateKey } from "./calendar-utils";

export interface Holiday {
  name: string;
  date: Date;
}

// Ostersonntag nach dem anonymen Gregorianischen Algorithmus (Butcher).
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=März, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Berechnet alle bundesweiten Feiertage eines Jahres.
export function getHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    { name: "Neujahr", date: new Date(year, 0, 1) },
    { name: "Karfreitag", date: addDays(easter, -2) },
    { name: "Ostermontag", date: addDays(easter, 1) },
    { name: "Tag der Arbeit", date: new Date(year, 4, 1) },
    { name: "Christi Himmelfahrt", date: addDays(easter, 39) },
    { name: "Pfingstmontag", date: addDays(easter, 50) },
    { name: "Tag der Deutschen Einheit", date: new Date(year, 9, 3) },
    { name: "1. Weihnachtstag", date: new Date(year, 11, 25) },
    { name: "2. Weihnachtstag", date: new Date(year, 11, 26) },
  ];
}

// Map dateKey → Name, für schnelle Lookups in den Views. Deckt mehrere Jahre ab.
export function getHolidayMap(years: number[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const y of years) {
    for (const h of getHolidays(y)) {
      map.set(toDateKey(h.date), h.name);
    }
  }
  return map;
}
