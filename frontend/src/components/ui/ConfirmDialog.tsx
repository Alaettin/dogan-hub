import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GlassDialog } from "./GlassDialog";
import { GlassButton } from "./GlassButton";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  pendingRef.current = pending;

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    [],
  );

  const close = useCallback((ok: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    current.resolve(ok);
    setPending(null);
  }, []);

  const opts = pending?.options;
  const destructive = !!opts?.destructive;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <GlassDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
        title={opts?.title ?? ""}
        description={opts?.description}
      >
        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => close(false)}>
            {opts?.cancelLabel ?? "Abbrechen"}
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={() => close(true)}
            style={
              destructive
                ? {
                    background: "rgba(252,165,165,0.15)",
                    borderColor: "rgba(252,165,165,0.4)",
                    color: "var(--text-danger)",
                  }
                : undefined
            }
          >
            {opts?.confirmLabel ?? (destructive ? "Löschen" : "Bestätigen")}
          </GlassButton>
        </div>
      </GlassDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm muss innerhalb von <ConfirmDialogProvider> verwendet werden");
  }
  return ctx;
}
