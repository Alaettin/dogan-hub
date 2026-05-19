import { z } from "zod";
import { FILTER_OPS, type FilterCondition } from "../lib/filter-ops.js";

const entryDataSchema = z.record(z.string(), z.unknown());

export const createEntrySchema = z.object({
  data: entryDataSchema,
});

export const updateEntrySchema = z.object({
  data: entryDataSchema,
});

const filterConditionSchema = z.object({
  field: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "field key must be snake_case"),
  op: z.enum(FILTER_OPS),
  value: z.unknown().optional(),
});

const sortKeySchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^(created_at|updated_at|[a-z][a-z0-9_]*)$/, "invalid sort key");

export const listEntriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: sortKeySchema.optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().max(200).optional(),
  filter: z
    .string()
    .optional()
    .transform((raw, ctx): FilterCondition[] | undefined => {
      if (!raw) return undefined;
      try {
        const parsed = JSON.parse(raw);
        const arr = z.array(filterConditionSchema).parse(parsed);
        return arr;
      } catch {
        ctx.addIssue({ code: "custom", message: "filter must be JSON array of FilterCondition" });
        return z.NEVER;
      }
    }),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
