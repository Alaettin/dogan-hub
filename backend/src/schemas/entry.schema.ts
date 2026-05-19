import { z } from "zod";

// Server speichert data blind als jsonb. Validierung der Werte gegen das
// Datenbank-Schema passiert clientside. Wir prüfen nur die Grundstruktur,
// damit kein versehentliches null oder array reinkommt.
const entryDataSchema = z.record(z.string(), z.unknown());

export const createEntrySchema = z.object({
  data: entryDataSchema,
});

export const updateEntrySchema = z.object({
  data: entryDataSchema,
});

export const listEntriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
