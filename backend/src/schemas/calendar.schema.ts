import { z } from "zod";

const recurrenceFreq = z.enum(["daily", "weekly", "monthly", "yearly"]);
const category = z.enum(["general", "birthday", "work", "private"]);

export const createEventSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).nullish(),
  location: z.string().max(200).nullish(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }).nullish(),
  all_day: z.boolean().optional().default(false),
  color: z.string().max(40).nullish(),
  category: category.nullish(),
  recurrence_freq: recurrenceFreq.nullish(),
  recurrence_interval: z.number().int().min(1).max(365).optional().default(1),
  recurrence_until: z.string().datetime({ offset: true }).nullish(),
  remind_minutes_before: z.number().int().min(0).max(40320).nullish(), // ≤ 4 Wochen
});

export const updateEventSchema = createEventSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Nothing to update" },
);

export const eventsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
