import type { FieldDef, FieldType } from "./field-types";
import { isCurrencyValue } from "./field-types";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const datetimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});
const numberFormatter = new Intl.NumberFormat("de-DE");

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency });
}

export function formatValue(field: FieldDef, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";

  switch (field.type) {
    case "boolean":
      return value ? "Ja" : "Nein";

    case "date":
      try {
        return dateFormatter.format(new Date(String(value)));
      } catch {
        return String(value);
      }

    case "datetime":
      try {
        return datetimeFormatter.format(new Date(String(value)));
      } catch {
        return String(value);
      }

    case "number":
      return typeof value === "number" ? numberFormatter.format(value) : String(value);

    case "currency": {
      if (!isCurrencyValue(value)) return String(value);
      try {
        return currencyFormatter(value.currency || "EUR").format(value.amount);
      } catch {
        return `${value.amount} ${value.currency}`;
      }
    }

    case "rating":
      return "★".repeat(Number(value) || 0) + "☆".repeat(Math.max(0, 5 - (Number(value) || 0)));

    case "select": {
      const opt = field.options?.find((o) => o.value === value);
      return opt?.label ?? String(value);
    }

    case "multiselect": {
      if (!Array.isArray(value)) return String(value);
      return value
        .map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v))
        .join(", ");
    }

    default:
      return String(value);
  }
}

// Liest den rohen Form-Wert (string, boolean, array, …) und konvertiert ihn
// für die Speicherung im jsonb (Type-passend).
export function parseRawValue(type: FieldType, raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) return null;

  switch (type) {
    case "number":
      return typeof raw === "number" ? raw : Number(raw);
    case "boolean":
      return Boolean(raw);
    case "rating":
      return Number(raw) || 0;
    case "multiselect":
      return Array.isArray(raw) ? raw : [];
    case "currency":
      return isCurrencyValue(raw) ? raw : null;
    default:
      return raw;
  }
}
