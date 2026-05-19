import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useUpdateDatabase, type Database } from "./useDatabases";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  FIELD_TYPES_WITH_OPTIONS,
  type FieldDef,
  type FieldOption,
  type FieldType,
  slugifyKey,
} from "./fields/field-types";
import "./databases.css";
import "./fields/fields.css";

interface SchemaEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: Database;
}

function genFieldId(): string {
  return `f_${Math.random().toString(36).slice(2, 9)}`;
}

function withFreshKey(field: Omit<FieldDef, "key">, existingKeys: string[]): FieldDef {
  let base = slugifyKey(field.label);
  let key = base;
  let i = 2;
  while (existingKeys.includes(key)) {
    key = `${base}_${i++}`;
  }
  return { ...(field as FieldDef), key };
}

export function SchemaEditor({ open, onOpenChange, database }: SchemaEditorProps) {
  const update = useUpdateDatabase(database.id);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [originalKeys] = useState<Set<string>>(
    () => new Set(database.schema.map((f) => f.key)),
  );

  useEffect(() => {
    if (open) {
      setFields(
        database.schema.map((f, i) => ({
          ...f,
          id: f.id || genFieldId(),
          position: i,
          type: (FIELD_TYPES as readonly string[]).includes(f.type)
            ? (f.type as FieldType)
            : "text",
        })),
      );
      setError(null);
    }
  }, [open, database.schema]);

  function updateField(idx: number, patch: Partial<FieldDef>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function moveField(idx: number, delta: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, position: i }));
    });
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, position: i })));
  }

  function addField() {
    const existingKeys = fields.map((f) => f.key);
    const fresh = withFreshKey(
      {
        id: genFieldId(),
        label: "Neues Feld",
        type: "text",
        position: fields.length,
        visible_in_table: fields.length < 4,
      },
      existingKeys,
    );
    setFields((prev) => [...prev, fresh]);
  }

  async function save() {
    setError(null);

    // Auto-key für neue Felder
    const existing = new Set<string>();
    const cleaned = fields.map((f) => {
      let key = f.key;
      if (!originalKeys.has(key) && !key.trim()) {
        key = slugifyKey(f.label || "feld");
      }
      let final = key;
      let i = 2;
      while (existing.has(final)) {
        final = `${key}_${i++}`;
      }
      existing.add(final);
      return { ...f, key: final };
    });

    // Validation
    if (cleaned.some((f) => !f.label.trim())) {
      setError("Jedes Feld braucht einen Label.");
      return;
    }
    for (const f of cleaned) {
      if (FIELD_TYPES_WITH_OPTIONS.includes(f.type) && (!f.options || f.options.length === 0)) {
        setError(`Feld "${f.label}" braucht mindestens eine Option.`);
        return;
      }
    }

    try {
      await update.mutateAsync({ schema: cleaned });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Schema bearbeiten"
      description={`${fields.length} ${fields.length === 1 ? "Feld" : "Felder"} · Änderungen wirken auf neue und bestehende Einträge.`}
      className="schema-editor-dialog"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.map((field, idx) => (
          <FieldEditorRow
            key={field.id}
            field={field}
            isFirst={idx === 0}
            isLast={idx === fields.length - 1}
            onChange={(patch) => updateField(idx, patch)}
            onMoveUp={() => moveField(idx, -1)}
            onMoveDown={() => moveField(idx, 1)}
            onRemove={() => removeField(idx)}
          />
        ))}

        <GlassButton variant="secondary" onClick={addField}>
          <Plus size={14} />
          Feld hinzufügen
        </GlassButton>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(252,165,165,0.08)",
              border: "1px solid rgba(252,165,165,0.25)",
              color: "var(--text-danger)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div className="db-form__actions">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </GlassButton>
          <GlassButton variant="primary" onClick={save} disabled={update.isPending}>
            {update.isPending ? "Speichere…" : "Speichern"}
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  );
}

interface FieldEditorRowProps {
  field: FieldDef;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<FieldDef>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function FieldEditorRow({
  field,
  isFirst,
  isLast,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: FieldEditorRowProps) {
  const hasOptions = FIELD_TYPES_WITH_OPTIONS.includes(field.type);

  return (
    <GlassPanel style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 160px auto",
          gap: 10,
          alignItems: "end",
        }}
      >
        <GlassInput
          label="Label"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <div className="db-form__row">
          <span className="db-form__label">Typ</span>
          <select
            className="field-select"
            value={field.type}
            onChange={(e) => {
              const t = e.target.value as FieldType;
              onChange({
                type: t,
                options: FIELD_TYPES_WITH_OPTIONS.includes(t) ? field.options ?? [] : undefined,
              });
            }}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className="glass-button glass-button--ghost"
            disabled={isFirst}
            onClick={onMoveUp}
            aria-label="Nach oben"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="glass-button glass-button--ghost"
            disabled={isLast}
            onClick={onMoveDown}
            aria-label="Nach unten"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            className="glass-button glass-button--ghost"
            onClick={onRemove}
            aria-label="Löschen"
            style={{ color: "var(--text-danger)" }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!!field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Pflichtfeld
        </label>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!!field.visible_in_table}
            onChange={(e) => onChange({ visible_in_table: e.target.checked })}
          />
          In Tabelle anzeigen
        </label>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            marginLeft: "auto",
          }}
        >
          key: {field.key}
        </span>
      </div>

      {hasOptions && (
        <OptionsEditor
          options={field.options ?? []}
          onChange={(options) => onChange({ options })}
        />
      )}
    </GlassPanel>
  );
}

interface OptionsEditorProps {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
}

function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const [draftLabel, setDraftLabel] = useState("");

  function add() {
    const label = draftLabel.trim();
    if (!label) return;
    const value = slugifyKey(label);
    onChange([...options, { value, label }]);
    setDraftLabel("");
  }

  function remove(idx: number) {
    onChange(options.filter((_, i) => i !== idx));
  }

  return (
    <div
      style={{
        padding: 10,
        borderRadius: "var(--radius-md)",
        background: "var(--glass-bg-1)",
        border: "1px solid var(--glass-border)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span className="db-form__label">Auswahl-Optionen</span>
      {options.length === 0 && (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Noch keine Optionen.</span>
      )}
      {options.map((o, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, fontSize: 13 }}>{o.label}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {o.value}
          </span>
          <button
            type="button"
            className="glass-button glass-button--ghost"
            onClick={() => remove(i)}
            aria-label="Option entfernen"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          className="glass-input"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Neue Option eingeben + Enter"
        />
        <GlassButton variant="secondary" onClick={add}>
          <Plus size={12} />
        </GlassButton>
      </div>
    </div>
  );
}
