import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./dropdown.css";

const DropdownCloseContext = createContext<() => void>(() => {});

interface DropdownProps {
  trigger: ReactElement;
  children: ReactNode;
  align?: "start" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Wiederverwendbares Dropdown-Menü.
 * - Trigger-Element wird gecloned und onClick versehen.
 * - Inhalt wird via React-Portal in document.body gerendert → keine
 *   Clipping-Probleme durch overflow:hidden des Parents.
 * - Position: relativ zum Trigger-Button via getBoundingClientRect().
 * - Schließt bei Outside-Click, Escape, ODER wenn ein DropdownItem
 *   geklickt wird (via Context).
 */
export function Dropdown({
  trigger,
  children,
  align = "end",
  open: controlledOpen,
  onOpenChange,
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<CSSProperties>({ top: 0, left: 0, visibility: "hidden" });

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    function update() {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const top = r.bottom + 4;
      const left = align === "end" ? r.right : r.left;
      setPosition({
        top,
        ...(align === "end" ? { right: window.innerWidth - left } : { left }),
        visibility: "visible",
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const child = isValidElement(trigger) ? trigger : null;
  if (!child) {
    throw new Error("Dropdown trigger must be a valid React element");
  }

  const triggerEl = cloneElement(child, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingRef = (child as any).ref;
      if (typeof existingRef === "function") existingRef(node);
      else if (existingRef && typeof existingRef === "object") existingRef.current = node;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick: (e: any) => {
      e.stopPropagation();
      setOpen(!open);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = (child.props as any)?.onClick;
      if (typeof original === "function") original(e);
    },
    "aria-expanded": open,
    "aria-haspopup": "menu",
  } as Record<string, unknown>);

  return (
    <>
      {triggerEl}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="dropdown-menu"
            style={position}
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownCloseContext.Provider value={close}>
              {children}
            </DropdownCloseContext.Provider>
          </div>,
          document.body,
        )}
    </>
  );
}

interface DropdownItemProps {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Wenn true: Menü bleibt offen nach Klick. Default: schließt sofort. */
  keepOpen?: boolean;
}

export function DropdownItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
  keepOpen,
}: DropdownItemProps) {
  const close = useContext(DropdownCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      className="dropdown-item"
      data-danger={danger ? "true" : undefined}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!keepOpen) close();
        onClick();
      }}
    >
      {icon && <span className="dropdown-item__icon">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="dropdown-separator" />;
}
