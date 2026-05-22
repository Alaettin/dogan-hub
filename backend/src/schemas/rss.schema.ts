import { z } from "zod";

// ─── Ordner ──────────────────────────────────────────────────────────
export const createFolderSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  position: z.number().optional(),
});

export const updateFolderSchema = z
  .object({
    name: z.string().min(1).max(120).trim().optional(),
    position: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ─── Feeds ───────────────────────────────────────────────────────────
export const createFeedSchema = z.object({
  feed_url: z.string().url().max(2000),
  folder_id: z.string().uuid().nullish(),
  title: z.string().max(200).trim().optional(),
});

export const updateFeedSchema = z
  .object({
    title: z.string().max(200).trim().optional(),
    folder_id: z.string().uuid().nullish(),
    status: z.enum(["active", "paused"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ─── Artikel ─────────────────────────────────────────────────────────
export const updateItemSchema = z
  .object({
    is_read: z.boolean().optional(),
    is_favorite: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const markAllReadSchema = z.object({
  feed_id: z.string().uuid().optional(),
  folder_id: z.string().uuid().optional(),
});

// ─── Einstellungen ───────────────────────────────────────────────────
export const updateRssSettingsSchema = z
  .object({
    refresh_interval_minutes: z.number().int().min(5).max(1440).optional(),
    cleanup_mode: z.enum(["off", "read", "all"]).optional(),
    cleanup_after_days: z.number().int().min(1).max(3650).optional(),
    cleanup_keep_favorites: z.boolean().optional(),
    default_view: z.enum(["all", "unread"]).optional(),
    mark_read_on_open: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type UpdateRssSettingsInput = z.infer<typeof updateRssSettingsSchema>;

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type CreateFeedInput = z.infer<typeof createFeedSchema>;
export type UpdateFeedInput = z.infer<typeof updateFeedSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
