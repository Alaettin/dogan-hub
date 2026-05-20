import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, formatFull, toDateKey } from "../../lib/calendar-utils";
import { expandAll } from "../../lib/recurrence";
import { useEvents, type EventOccurrence } from "./useCalendar";

const FIRED_KEY = "myhub:reminders-fired";

function occKey(occ: EventOccurrence): string {
  return `${occ.id}:${toDateKey(occ.occurrenceStart)}:${occ.occurrenceStart.getHours()}:${occ.occurrenceStart.getMinutes()}`;
}

function loadFired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export interface DueReminder {
  key: string;
  title: string;
  when: string;
  occurrenceStart: Date;
}

// In-App-Erinnerungen: lädt Events der nächsten 30 Tage, prüft im Minutentakt,
// welche Erinnerung fällig ist, und liefert sie als dismissbare Liste.
// Kein Server-Cron — funktioniert solange die App offen ist.
export function useReminders() {
  const now = new Date();
  const windowStart = useMemo(() => addDays(now, -1), []); // eslint-disable-line react-hooks/exhaustive-deps
  const windowEnd = useMemo(() => addDays(now, 30), []); // eslint-disable-line react-hooks/exhaustive-deps

  const events = useEvents(windowStart.toISOString(), windowEnd.toISOString());

  const [tick, setTick] = useState(0);
  const [fired, setFired] = useState<Set<string>>(loadFired);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const due = useMemo<DueReminder[]>(() => {
    void tick; // re-evaluieren bei jedem Tick
    const nowMs = Date.now();
    const occs = expandAll(events.data ?? [], windowStart, windowEnd);
    const out: DueReminder[] = [];
    for (const occ of occs) {
      if (occ.remind_minutes_before == null) continue;
      const startMs = occ.occurrenceStart.getTime();
      const remindMs = startMs - occ.remind_minutes_before * 60_000;
      const key = occKey(occ);
      // fällig: Erinnerungszeit erreicht, Termin noch nicht vorbei, nicht erledigt
      if (nowMs >= remindMs && nowMs < startMs + 60_000 && !fired.has(key) && !dismissed.has(key)) {
        out.push({
          key,
          title: occ.title,
          when: formatFull(occ.occurrenceStart),
          occurrenceStart: occ.occurrenceStart,
        });
      }
    }
    return out;
  }, [events.data, windowStart, windowEnd, fired, dismissed, tick]);

  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => new Set(prev).add(key));
    setFired((prev) => {
      const next = new Set(prev).add(key);
      try {
        localStorage.setItem(FIRED_KEY, JSON.stringify([...next].slice(-200)));
      } catch {
        // ignore quota
      }
      return next;
    });
  }, []);

  return { due, dismiss };
}
