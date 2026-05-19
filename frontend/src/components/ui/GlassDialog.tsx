import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import "./glass.css";

interface GlassDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export function GlassDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
  showCloseButton = true,
}: GlassDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="glass-dialog-overlay" />
        <Dialog.Content className={cn("glass-dialog-content", className)}>
          <Dialog.Title className="glass-dialog-title">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="glass-dialog-description">
              {description}
            </Dialog.Description>
          )}
          {showCloseButton && (
            <Dialog.Close className="glass-dialog-close" aria-label="Schließen">
              <X size={18} />
            </Dialog.Close>
          )}
          <div style={{ marginTop: description ? 16 : 12 }}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
