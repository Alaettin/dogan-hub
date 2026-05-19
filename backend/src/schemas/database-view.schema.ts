import { z } from "zod";
import { FILTER_OPS } from "../lib/filter-ops.js";

export const VIEW_TYPES = ["table", "cards", "list", "calendar", "kanban"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

const filterConditionSchema = z.object({
  field: z.string().min(1).max(60),
  op: z.enum(FILTER_OPS),
  value: z.unknown().optional(),
});

export const viewConfigSchema = z.object({
  columns: z.array(z.string()).optional(),
  filters: z.array(filterConditionSchema).optional(),
  sort: z.string().max(60).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const createViewSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  view_type: z.enum(VIEW_TYPES),
  config: viewConfigSchema.default({}),
  is_default: z.boolean().optional().default(false),
});

export const updateViewSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    view_type: z.enum(VIEW_TYPES).optional(),
    config: viewConfigSchema.optional(),
    is_default: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Mindestens ein Feld muss gesetzt sein",
  });

export type CreateViewInput = z.infer<typeof createViewSchema>;
export type UpdateViewInput = z.infer<typeof updateViewSchema>;
