import { z } from "zod";

const labelSchema = z.object({
  name: z.string().max(40).default(""),
  color: z.string().max(40),
});

// ─── Board ───────────────────────────────────────────────────────────
export const createBoardSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(2000).nullish(),
  color: z.string().max(40).nullish(),
});

export const updateBoardSchema = z
  .object({
    name: z.string().min(1).max(120).trim().optional(),
    description: z.string().max(2000).nullish(),
    color: z.string().max(40).nullish(),
    position: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ─── Column ──────────────────────────────────────────────────────────
export const createColumnSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  color: z.string().max(40).nullish(),
});

export const updateColumnSchema = z
  .object({
    name: z.string().min(1).max(80).trim().optional(),
    color: z.string().max(40).nullish(),
    position: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ─── Card ────────────────────────────────────────────────────────────
export const createCardSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).nullish(),
  color: z.string().max(40).nullish(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  labels: z.array(labelSchema).max(12).optional(),
});

export const updateCardSchema = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(5000).nullish(),
    color: z.string().max(40).nullish(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    labels: z.array(labelSchema).max(12).optional(),
    column_id: z.string().uuid().optional(),
    position: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
