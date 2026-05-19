import { useState } from "react";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import { GlassButton } from "../../../components/ui/GlassButton";
import type { FieldDef } from "../fields/field-types";
import { cn } from "../../../lib/cn";
import "./views.css";

interface SortMenuProps {
  schema: FieldDef[];
  sort: string | undefined;
  order: "asc" | "desc" | undefined;
  onChange: (sort: string | undefined, order: "asc" | "desc" | undefined) => void;
}

export function SortMenu({ schema, sort, order, onChange }: SortMenuProps) {
  const [open, setOpen] = useState(false);

  const currentField = schema.find((f) => f.key === sort);
  const label = currentField ? currentField.label : sort === "created_at" ? "Erstellt" : "—";

  function pick(key: string) {
    if (sort === key) {
      // Toggle order
      onChange(key, order === "asc" ? "desc" : "asc");
    } else {
      onChange(key, "asc");
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <GlassButton variant="secondary" onClick={() => setOpen((v) => !v)}>
        <ArrowUpDown size={14} />
        Sortieren
        {sort && (
          <span style={{ color: "var(--text-accent)", fontSize: 12 }}>
            · {label} {order === "asc" ? "↑" : "↓"}
          </span>
        )}
        <ChevronDown size={12} />
      </GlassButton>

      {open && (
        <div className="sort-popover" onMouseLeave={() => setOpen(false)}>
          <button
            type="button"
            className={cn("sort-option", sort === "created_at" && "sort-option--active")}
            onClick={() => pick("created_at")}
          >
            Erstellt
            {sort === "created_at" && (
              <span className="sort-option__direction">{order === "asc" ? "↑" : "↓"}</span>
            )}
          </button>
          {schema.map((f) => (
            <button
              key={f.id}
              type="button"
              className={cn("sort-option", sort === f.key && "sort-option--active")}
              onClick={() => pick(f.key)}
            >
              {f.label}
              {sort === f.key && (
                <span className="sort-option__direction">{order === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          ))}
          {sort && (
            <>
              <div
                style={{
                  borderTop: "1px solid var(--glass-border)",
                  margin: "4px 0",
                }}
              />
              <button
                type="button"
                className="sort-option"
                onClick={() => onChange(undefined, undefined)}
              >
                Sortierung aufheben
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
