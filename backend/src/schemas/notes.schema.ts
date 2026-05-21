import { z } from "zod";

const noteType = z.enum(["text", "checklist", "list"]);

const noteItemSchema = z.object({
  text: z.string().max(500).default(""),
  done: z.boolean().optional(),
});

// ─── Create ──────────────────────────────────────────────────────────
export const createNoteSchema = z.object({
  type: noteType.default("text"),
  title: z.string().max(200).trim().default(""),
  body: z.string().max(20000).default(""),
  items: z.array(noteItemSchema).max(500).optional(),
  color: z.string().max(40).nullish(),
  tags: z.array(z.string().max(40).trim()).max(20).optional(),
  pinned: z.boolean().optional(),
});

// ─── Update ──────────────────────────────────────────────────────────
// Bewusst OHNE Defaults (kein `.partial()` auf createNoteSchema), sonst
// würden bei einem Teil-Update fehlende Felder mit Defaults überschrieben.
export const updateNoteSchema = z
  .object({
    type: noteType.optional(),
    title: z.string().max(200).trim().optional(),
    body: z.string().max(20000).optional(),
    items: z.array(noteItemSchema).max(500).optional(),
    color: z.string().max(40).nullish(),
    tags: z.array(z.string().max(40).trim()).max(20).optional(),
    pinned: z.boolean().optional(),
    position: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
