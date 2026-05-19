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

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  description?: string;
  options?: FieldOption[];
  visible_in_table?: boolean;
  position?: number;
}

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Text",
  longtext: "Langer Text",
  number: "Zahl",
  currency: "Währung",
  date: "Datum",
  datetime: "Datum & Zeit",
  boolean: "Ja / Nein",
  select: "Auswahl",
  multiselect: "Mehrfach-Auswahl",
  url: "URL",
  email: "Email",
  phone: "Telefon",
  rating: "Bewertung",
};

export const FIELD_TYPES_WITH_OPTIONS: FieldType[] = ["select", "multiselect"];

// Slugify: German-aware Label → snake_case key
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "field";
}

export interface CurrencyValue {
  amount: number;
  currency: string;
}

export function isCurrencyValue(value: unknown): value is CurrencyValue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CurrencyValue).amount === "number"
  );
}

export function getDefaultValue(type: FieldType): unknown {
  switch (type) {
    case "boolean":
      return false;
    case "multiselect":
      return [];
    case "rating":
      return 0;
    case "currency":
      return { amount: 0, currency: "EUR" };
    default:
      return "";
  }
}
