import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import "./glass.css";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton({ variant = "secondary", className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn("glass-button", `glass-button--${variant}`, className)}
        {...rest}
      />
    );
  },
);
