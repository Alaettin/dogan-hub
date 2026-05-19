import { z } from "zod";

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  parent_id: z.string().uuid().nullable().optional(),
});

export const updateFolderSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    parent_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.parent_id !== undefined, {
    message: "Mindestens name oder parent_id setzen",
  });

export const listFoldersQuerySchema = z.object({});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
