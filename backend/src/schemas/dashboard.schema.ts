import { z } from "zod";

const count = z.number().int().min(1).max(20);

export const updateDashboardSettingsSchema = z
  .object({
    show_calendar: z.boolean().optional(),
    show_kanban: z.boolean().optional(),
    show_notes: z.boolean().optional(),
    show_rss: z.boolean().optional(),
    calendar_count: count.optional(),
    kanban_count: count.optional(),
    notes_count: count.optional(),
    rss_count: count.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type UpdateDashboardSettingsInput = z.infer<typeof updateDashboardSettingsSchema>;
