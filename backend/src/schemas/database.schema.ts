import { z } from "zod";

// Field-Types laut PLAN.md §5.0.1 MVP-Set
export const FIELD_TYPES = [
  "text",
  "longtext",
  "number",
  "currency",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
  "url",
  "email",
  "phone",
  "rating",
] as const;

export const fieldDefinitionSchema = z.object({
  id: z.string().min(1),
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "key muss snake_case (lowercase, _ erlaubt)"),
  label: z.string().min(1).max(100),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  description: z.string().max(300).optional(),
  default_value: z.unknown().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  visible_in_table: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});

export const schemaArraySchema = z.array(fieldDefinitionSchema);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const TAILWIND_COLOR = /^[a-z]+(-\d{3})?$/;

const colorSchema = z
  .string()
  .max(30)
  .refine((v) => HEX_COLOR.test(v) || TAILWIND_COLOR.test(v), {
    message: "Color muss HEX (#RRGGBB) oder Tailwind-Color-Key sein",
  });

export const createDatabaseSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  icon: z.string().max(40).optional(),
  color: colorSchema.optional(),
  description: z.string().max(500).optional(),
  schema: schemaArraySchema.optional(),
  template_key: z.string().max(40).optional(),
});

export const updateDatabaseSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    icon: z.string().max(40).optional(),
    color: colorSchema.optional(),
    description: z.string().max(500).optional(),
    schema: schemaArraySchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Mindestens ein Feld muss gesetzt sein",
  });

export const archiveSchema = z.object({ archived: z.boolean() });

export const duplicateSchema = z.object({ name: z.string().min(1).max(100).trim().optional() });

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>;
export type UpdateDatabaseInput = z.infer<typeof updateDatabaseSchema>;
