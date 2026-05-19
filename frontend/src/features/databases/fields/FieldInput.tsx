import { Star } from "lucide-react";
import { GlassInput } from "../../../components/ui/GlassInput";
import { cn } from "../../../lib/cn";
import {
  type FieldDef,
  type CurrencyValue,
  isCurrencyValue,
} from "./field-types";
import "./fields.css";

interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  autoFocus?: boolean;
}

export function FieldInput({ field, value, onChange, autoFocus }: FieldInputProps) {
  const requiredHint = field.required ? " *" : "";
  const label = field.label + requiredHint;

  switch (field.type) {
    case "text":
      return (
        <GlassInput
          label={label}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          required={field.required}
        />
      );

    case "url":
      return (
        <GlassInput
          label={label}
          type="url"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          required={field.required}
        />
      );

    case "email":
      return (
        <GlassInput
          label={label}
          type="email"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          required={field.required}
        />
      );

    case "phone":
      return (
        <GlassInput
          label={label}
          type="tel"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          required={field.required}
        />
      );

    case "number":
      return (
        <GlassInput
          label={label}
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
          autoFocus={autoFocus}
          required={field.required}
        />
      );

    case "date":
      return (
        <GlassInput
          label={label}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          required={field.required}
        />
      );

    case "datetime":
      return (
        <GlassInput
          label={label}
          type="datetime-local"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          required={field.required}
        />
      );

    case "longtext":
      return (
        <div className="db-form__row">
          <span className="db-form__label">{label}</span>
          <textarea
            className="field-textarea"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            autoFocus={autoFocus}
            required={field.required}
          />
        </div>
      );

    case "boolean":
      return <ToggleField field={field} value={!!value} onChange={onChange} />;

    case "select":
      return (
        <div className="db-form__row">
          <span className="db-form__label">{label}</span>
          <select
            className="field-select"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            required={field.required}
          >
            <option value="">— bitte wählen —</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="db-form__row">
          <span className="db-form__label">{label}</span>
          <select
            multiple
            className="field-select field-multiselect"
            value={arr}
            onChange={(e) =>
              onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
          >
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    case "rating":
      return <RatingField field={field} value={Number(value) || 0} onChange={onChange} />;

    case "currency":
      return <CurrencyField field={field} value={value} onChange={onChange} />;

    default:
      return (
        <GlassInput
          label={label}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

interface ToggleProps {
  field: FieldDef;
  value: boolean;
  onChange: (v: unknown) => void;
}
function ToggleField({ field, value, onChange }: ToggleProps) {
  return (
    <div className="db-form__row">
      <span className="db-form__label">{field.label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn("field-toggle", value && "field-toggle--on")}
        aria-pressed={value}
      >
        <span className="field-toggle__switch">
          <span className="field-toggle__thumb" />
        </span>
        <span className="field-toggle__label">{value ? "Ja" : "Nein"}</span>
      </button>
    </div>
  );
}

interface RatingProps {
  field: FieldDef;
  value: number;
  onChange: (v: unknown) => void;
}
function RatingField({ field, value, onChange }: RatingProps) {
  return (
    <div className="db-form__row">
      <span className="db-form__label">
        {field.label}
        {field.required ? " *" : ""}
      </span>
      <div className="field-rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={cn("field-rating__star", value >= n && "field-rating__star--filled")}
            onClick={() => onChange(value === n ? 0 : n)}
            aria-label={`${n} Sterne`}
          >
            <Star size={20} fill={value >= n ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}

interface CurrencyProps {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}
function CurrencyField({ field, value, onChange }: CurrencyProps) {
  const v: CurrencyValue = isCurrencyValue(value)
    ? value
    : { amount: 0, currency: "EUR" };

  return (
    <div className="db-form__row">
      <span className="db-form__label">
        {field.label}
        {field.required ? " *" : ""}
      </span>
      <div className="field-currency">
        <input
          type="number"
          step="0.01"
          className="glass-input"
          value={Number.isFinite(v.amount) ? String(v.amount) : ""}
          onChange={(e) =>
            onChange({ amount: Number(e.target.value) || 0, currency: v.currency })
          }
        />
        <input
          type="text"
          className="glass-input"
          value={v.currency}
          onChange={(e) => onChange({ amount: v.amount, currency: e.target.value.toUpperCase() })}
          maxLength={3}
        />
      </div>
    </div>
  );
}
