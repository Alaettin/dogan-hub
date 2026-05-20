import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { Occurrence, RecurrenceFreq } from "../../lib/recurrence";

export type EventCategory = "general" | "birthday" | "work" | "private";

export interface CalendarEvent {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  color: string | null;
  category: EventCategory | null;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_interval: number;
  recurrence_until: string | null;
  remind_minutes_before: number | null;
  created_at: string;
  updated_at: string;
}

export type EventOccurrence = Occurrence<CalendarEvent>;

export interface EventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean;
  color?: string | null;
  category?: EventCategory | null;
  recurrence_freq?: RecurrenceFreq | null;
  recurrence_interval?: number;
  recurrence_until?: string | null;
  remind_minutes_before?: number | null;
}

const KEY = "calendar";

export function useEvents(fromISO: string, toISO: string) {
  return useQuery<CalendarEvent[]>({
    queryKey: [KEY, "events", { from: fromISO, to: toISO }],
    queryFn: async () => {
      const data = await apiFetch<{ items: CalendarEvent[] }>(
        `/calendar/events?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
      );
      return data.items;
    },
    staleTime: 15_000,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EventInput) => {
      const data = await apiFetch<{ event: CalendarEvent }>("/calendar/events", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.event;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<EventInput>) => {
      const data = await apiFetch<{ event: CalendarEvent }>(`/calendar/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      return data.event;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/calendar/events/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
