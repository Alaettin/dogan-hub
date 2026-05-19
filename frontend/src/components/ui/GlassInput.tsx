import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import "./glass.css";

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  { label, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div>
      {label && (
        <label className="glass-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? "true" : undefined}
        className={cn("glass-input", className)}
        {...rest}
      />
      {error && <p className="glass-field-error">{error}</p>}
    </div>
  );
});
