import { Filter, Plus, X } from "lucide-react";
import { GlassButton } from "../../../components/ui/GlassButton";
import { GlassInput } from "../../../components/ui/GlassInput";
import {
  FILTER_OPS_WITHOUT_VALUE,
  FILTER_OP_LABEL,
  type FilterCondition,
  type FilterOp,
  validOpsForFieldType,
} from "../view-types";
import type { FieldDef } from "../fields/field-types";
import { cn } from "../../../lib/cn";
import "./views.css";

interface FilterBuilderProps {
  schema: FieldDef[];
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
}

export function FilterBuilder({ schema, filters, onChange }: FilterBuilderProps) {
  function update(idx: number, patch: Partial<FilterCondition>) {
    onChange(filters.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function remove(idx: number) {
    onChange(filters.filter((_, i) => i !== idx));
  }
  function add() {
    const firstField = schema[0];
    if (!firstField) return;
    const validOps = validOpsForFieldType(firstField.type);
    onChange([...filters, { field: firstField.key, op: validOps[0] ?? "eq", value: "" }]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filters.length > 0 && (
        <div className="filter-list">
          {filters.map((cond, i) => {
            const field = schema.find((f) => f.key === cond.field);
            const ops: FilterOp[] = field
              ? validOpsForFieldType(field.type)
              : ["eq", "neq"];
            const noValue = FILTER_OPS_WITHOUT_VALUE.has(cond.op);
            return (
              <div
                key={i}
                className={cn("filter-row", noValue && "filter-row--no-value")}
              >
                <select
                  className="field-select"
                  value={cond.field}
                  onChange={(e) => {
                    const next = e.target.value;
                    const f = schema.find((s) => s.key === next);
                    const validOps = f ? validOpsForFieldType(f.type) : ops;
                    const nextOp = (validOps[0] as FilterOp) ?? "eq";
                    update(i, { field: next, op: nextOp, value: "" });
                  }}
                >
                  {schema.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  className="field-select"
                  value={cond.op}
                  onChange={(e) => update(i, { op: e.target.value as FilterOp })}
                >
                  {ops.map((op) => (
                    <option key={op} value={op}>
                      {FILTER_OP_LABEL[op]}
                    </option>
                  ))}
                </select>
                {!noValue && (
                  <GlassInput
                    value={String(cond.value ?? "")}
                    onChange={(e) => update(i, { value: e.target.value })}
                    placeholder="Wert"
                  />
                )}
                <button
                  type="button"
                  className="glass-button glass-button--ghost"
                  onClick={() => remove(i)}
                  aria-label="Filter entfernen"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <GlassButton variant="ghost" onClick={add} style={{ alignSelf: "flex-start" }}>
        <Filter size={14} />
        Filter hinzufügen
        <Plus size={12} />
      </GlassButton>
    </div>
  );
}
