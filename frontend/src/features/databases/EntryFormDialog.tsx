import { useEffect, useState } from "react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { FieldInput } from "./fields/FieldInput";
import { parseRawValue } from "./fields/value-utils";
import { getDefaultValue, type FieldDef } from "./fields/field-types";
import { useCreateEntry, useUpdateEntry, type Entry } from "./useEntries";

interface EntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  databaseId: string;
  schema: FieldDef[];
  mode: "create" | "edit";
  entry?: Entry;
}

function buildInitialValues(schema: FieldDef[], entry: Entry | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of schema) {
    if (entry && entry.data[f.key] !== undefined) {
      result[f.key] = entry.data[f.key];
    } else {
      result[f.key] = getDefaultValue(f.type);
    }
  }
  return result;
}

export function EntryFormDialog({
  open,
  onOpenChange,
  databaseId,
  schema,
  mode,
  entry,
}: EntryFormDialogProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    buildInitialValues(schema, entry),
  );
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateEntry(databaseId);
  const updateMutation = useUpdateEntry(entry?.id ?? "", databaseId);

  useEffect(() => {
    if (open) {
      setValues(buildInitialValues(schema, entry));
      setError(null);
    }
  }, [open, schema, entry]);

  async function save() {
    setError(null);

    // Pflichtfeld-Check
    for (const f of schema) {
      if (!f.required) continue;
      const v = values[f.key];
      const isEmpty =
        v === null ||
        v === undefined ||
        v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (isEmpty) {
        setError(`Feld "${f.label}" ist Pflicht.`);
        return;
      }
    }

    // Werte typ-korrekt serialisieren
    const data: Record<string, unknown> = {};
    for (const f of schema) {
      const parsed = parseRawValue(f.type, values[f.key]);
      if (parsed !== null) data[f.key] = parsed;
    }

    try {
      if (mode === "create") {
        await createMutation.mutateAsync(data);
      } else if (entry) {
        await updateMutation.mutateAsync(data);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Neuer Eintrag" : "Eintrag bearbeiten"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
        {schema.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Diese Datenbank hat noch keine Felder. Definiere zuerst das Schema.
          </p>
        ) : (
          schema.map((f, idx) => (
            <FieldInput
              key={f.id}
              field={f}
              value={values[f.key]}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
              autoFocus={idx === 0}
            />
          ))
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
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
        <GlassButton
          variant="primary"
          onClick={save}
          disabled={isPending || schema.length === 0}
        >
          {isPending ? "Speichere…" : "Speichern"}
        </GlassButton>
      </div>
    </GlassDialog>
  );
}
