import { z } from "zod";

export const signUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(120),
  size_bytes: z.number().int().nonnegative(),
  folder_id: z.string().uuid().nullable().optional(),
  checksum_sha256: z.string().length(64).optional(),
});

export const commitFileSchema = z.object({
  // Frontend signalisiert nach erfolgreichem PUT. Backend kann hier ggf. Storage-Metadata abfragen.
  storage_path: z.string().min(1).max(500).optional(),
});

export const updateFileSchema = z
  .object({
    name: z.string().min(1).max(255).trim().optional(),
    folder_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.folder_id !== undefined, {
    message: "Mindestens name oder folder_id setzen",
  });

export const listFilesQuerySchema = z.object({
  folder_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
