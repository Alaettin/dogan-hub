import { cn } from "../../../lib/cn";
import type { FieldDef } from "./field-types";
import { formatValue } from "./value-utils";
import "./fields.css";

interface FieldDisplayProps {
  field: FieldDef;
  value: unknown;
  className?: string;
}

export function FieldDisplay({ field, value, className }: FieldDisplayProps) {
  const formatted = formatValue(field, value);
  const muted = formatted === "—";

  return (
    <span className={cn("field-display", muted && "field-display--muted", className)}>
      {formatted}
    </span>
  );
}
