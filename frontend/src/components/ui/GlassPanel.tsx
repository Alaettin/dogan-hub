import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import "./glass.css";

export const GlassPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function GlassPanel({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("glass-panel", className)} {...rest} />;
  },
);
