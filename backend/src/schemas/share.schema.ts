import { z } from "zod";

export const MAX_SHARE_TTL_SEC = 7 * 24 * 60 * 60; // 604_800

export const createShareSchema = z.object({
  permission: z.enum(["read", "edit"]),
  ttl_sec: z
    .number()
    .int()
    .positive()
    .max(MAX_SHARE_TTL_SEC, "TTL darf 7 Tage nicht überschreiten"),
});

export type CreateShareInput = z.infer<typeof createShareSchema>;
