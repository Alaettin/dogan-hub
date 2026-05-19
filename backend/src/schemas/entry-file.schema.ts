import { z } from "zod";

export const attachFileSchema = z.object({
  file_id: z.string().uuid(),
});

export type AttachFileInput = z.infer<typeof attachFileSchema>;
