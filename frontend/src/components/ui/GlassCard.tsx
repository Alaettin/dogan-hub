import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import "./glass.css";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "accent";
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { variant = "default", className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(variant === "accent" ? "glass-accent-card" : "glass-card", className)}
      {...rest}
    />
  );
});
