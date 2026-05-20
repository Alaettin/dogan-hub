// Expandiert wiederkehrende Termine in ein Sichtfenster. Die Regel wird in der
// DB einmal gespeichert; konkrete Instanzen entstehen erst hier (clientseitig).

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurringLike {
  start_at: string;
  end_at: string | null;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_interval: number;
  recurrence_until: string | null;
}

export type Occurrence<T> = T & {
  occurrenceStart: Date;
  occurrenceEnd: Date | null;
};

const SAFETY_CAP = 1500;

function addStep(d: Date, freq: RecurrenceFreq, interval: number): Date {
  const x = new Date(d);
  switch (freq) {
    case "daily":
      x.setDate(x.getDate() + interval);
      break;
    case "weekly":
      x.setDate(x.getDate() + 7 * interval);
      break;
    case "monthly":
      x.setMonth(x.getMonth() + interval);
      break;
    case "yearly":
      x.setFullYear(x.getFullYear() + interval);
      break;
  }
  return x;
}

/**
 * Liefert alle Instanzen von `event`, die das Fenster [windowStart, windowEnd]
 * überlappen. Einmal-Termine geben sich (falls überlappend) selbst zurück.
 */
export function expandOccurrences<T extends RecurringLike>(
  event: T,
  windowStart: Date,
  windowEnd: Date,
): Occurrence<T>[] {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;
  const durationMs = end ? end.getTime() - start.getTime() : 0;

  const overlaps = (occStart: Date): boolean => {
    const occEnd = new Date(occStart.getTime() + durationMs);
    return occStart.getTime() <= windowEnd.getTime() && occEnd.getTime() >= windowStart.getTime();
  };

  const make = (occStart: Date): Occurrence<T> => ({
    ...event,
    occurrenceStart: occStart,
    occurrenceEnd: durationMs ? new Date(occStart.getTime() + durationMs) : null,
  });

  // ─── Einmal-Termin ─────────────────────────────────────────────
  if (!event.recurrence_freq) {
    return overlaps(start) ? [make(start)] : [];
  }

  const freq = event.recurrence_freq;
  const interval = Math.max(1, event.recurrence_interval || 1);
  const until = event.recurrence_until ? new Date(event.recurrence_until) : null;
  const hardEnd = until && until.getTime() < windowEnd.getTime() ? until : windowEnd;

  // Fast-Forward bei daily/weekly (gleichmäßiger Abstand), um nicht von 1980 an
  // jeden Tag zu iterieren.
  let cursor = new Date(start);
  if ((freq === "daily" || freq === "weekly") && cursor.getTime() < windowStart.getTime()) {
    const stepMs = (freq === "daily" ? 1 : 7) * interval * 86400000;
    const jumps = Math.floor((windowStart.getTime() - cursor.getTime()) / stepMs);
    if (jumps > 0) cursor = new Date(cursor.getTime() + jumps * stepMs);
  }
  // Für monthly/yearly grob auf das Fensterjahr vorspringen.
  if ((freq === "monthly" || freq === "yearly") && cursor.getFullYear() < windowStart.getFullYear() - 1) {
    const yearGap = windowStart.getFullYear() - 1 - cursor.getFullYear();
    const jumps = freq === "yearly" ? Math.floor(yearGap / interval) : Math.floor((yearGap * 12) / interval);
    if (jumps > 0) cursor = addStep(cursor, freq, interval * jumps);
  }

  const out: Occurrence<T>[] = [];
  let guard = 0;
  while (cursor.getTime() <= hardEnd.getTime() && guard < SAFETY_CAP) {
    guard++;
    if (overlaps(cursor)) out.push(make(cursor));
    cursor = addStep(cursor, freq, interval);
  }
  return out;
}

/** Expandiert eine Liste und sortiert die Instanzen chronologisch. */
export function expandAll<T extends RecurringLike>(
  events: T[],
  windowStart: Date,
  windowEnd: Date,
): Occurrence<T>[] {
  const all = events.flatMap((e) => expandOccurrences(e, windowStart, windowEnd));
  all.sort((a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime());
  return all;
}
