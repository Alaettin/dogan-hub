import { z } from "zod";

// Geldbetrag: nicht-negativ, max. 2 Nachkommastellen.
const money = z
  .number()
  .nonnegative()
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: "Höchstens 2 Nachkommastellen",
  });

// Datum als ISO-String (YYYY-MM-DD).
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als YYYY-MM-DD");

const status = z.enum(["active", "sold", "cancelled"]);

// ─── Plattformen ─────────────────────────────────────────────────────
export const createPlatformSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  url: z.string().max(500).trim().nullish(),
  color: z.string().max(40).nullish(),
  notes: z.string().max(2000).nullish(),
});

export const updatePlatformSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    url: z.string().max(500).trim().nullish(),
    color: z.string().max(40).nullish(),
    notes: z.string().max(2000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// ─── Inserate ────────────────────────────────────────────────────────
export const createListingSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  price: money,
  quantity: z.number().int().min(1).max(100000).default(1),
  purchase_price: money.nullish(),
  fees: money.nullish(),
  condition: z.string().max(80).trim().nullish(),
  category: z.string().max(80).trim().nullish(),
  item_url: z.string().max(1000).trim().nullish(),
  image_url: z.string().max(1000).trim().nullish(),
  notes: z.string().max(2000).nullish(),
  status: status.default("active"),
  listed_at: dateStr.optional(),
  sold_at: dateStr.nullish(),
  sold_price: money.nullish(),
});

export const updateListingSchema = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    price: money.optional(),
    quantity: z.number().int().min(1).max(100000).optional(),
    purchase_price: money.nullish(),
    fees: money.nullish(),
    condition: z.string().max(80).trim().nullish(),
    category: z.string().max(80).trim().nullish(),
    item_url: z.string().max(1000).trim().nullish(),
    image_url: z.string().max(1000).trim().nullish(),
    notes: z.string().max(2000).nullish(),
    status: status.optional(),
    listed_at: dateStr.optional(),
    sold_at: dateStr.nullish(),
    sold_price: money.nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const markSoldSchema = z.object({
  sold_price: money,
  sold_at: dateStr.optional(),
});

export type CreatePlatformInput = z.infer<typeof createPlatformSchema>;
export type UpdatePlatformInput = z.infer<typeof updatePlatformSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
