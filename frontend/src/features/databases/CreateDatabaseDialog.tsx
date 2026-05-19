import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { GlassCard } from "../../components/ui/GlassCard";
import { cn } from "../../lib/cn";
import { IconPicker, getIconComponent } from "./icon-picker";
import { ColorPicker } from "./color-picker";
import { useCreateDatabase } from "./useDatabases";
import { useTemplates } from "./useTemplates";
import "./databases.css";

interface CreateDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "scratch" | "template";

export function CreateDatabaseDialog({ open, onOpenChange }: CreateDatabaseDialogProps) {
  const navigate = useNavigate();
  const create = useCreateDatabase();
  const templates = useTemplates();

  const [mode, setMode] = useState<Mode>("template");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("database");
  const [color, setColor] = useState("indigo");
  const [description, setDescription] = useState("");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = templates.data?.find((t) => t.key === templateKey);

  function reset() {
    setMode("template");
    setName("");
    setIcon("database");
    setColor("indigo");
    setDescription("");
    setTemplateKey(null);
    setError(null);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    setError(null);
    try {
      const payload =
        mode === "template" && templateKey
          ? {
              name: name.trim() || selectedTemplate?.name || "Neue Datenbank",
              template_key: templateKey,
              ...(description.trim() ? { description: description.trim() } : {}),
              ...(icon !== "database" ? { icon } : {}),
              ...(color !== "indigo" ? { color } : {}),
            }
          : {
              name: name.trim(),
              icon,
              color,
              description: description.trim() || undefined,
            };

      if (mode === "scratch" && !payload.name) {
        setError("Bitte einen Namen eingeben.");
        return;
      }
      if (mode === "template" && !templateKey) {
        setError("Bitte ein Template auswählen.");
        return;
      }

      const db = await create.mutateAsync(payload);
      reset();
      onOpenChange(false);
      navigate(`/databases/${db.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
    }
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={handleClose}
      title="Neue Datenbank"
      description="Erstelle eine eigene Datenbank oder starte aus einem Template."
    >
      <div className="db-dialog-tabs">
        <button
          type="button"
          className={cn("db-dialog-tab", mode === "template" && "db-dialog-tab--active")}
          onClick={() => setMode("template")}
        >
          Aus Template
        </button>
        <button
          type="button"
          className={cn("db-dialog-tab", mode === "scratch" && "db-dialog-tab--active")}
          onClick={() => setMode("scratch")}
        >
          Von Grund auf
        </button>
      </div>

      {mode === "template" ? (
        <div className="db-form">
          {templates.isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Lade Templates…</div>
          ) : (
            <div className="template-grid">
              {templates.data?.map((t) => {
                const Icon = getIconComponent(t.icon);
                const active = templateKey === t.key;
                return (
                  <GlassCard
                    key={t.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setTemplateKey(t.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setTemplateKey(t.key);
                      }
                    }}
                    className={cn("template-card", active && "template-card--active")}
                  >
                    <div className="template-card__icon">
                      <Icon size={14} />
                    </div>
                    <div className="template-card__name">{t.name}</div>
                    <div className="template-card__meta">{t.schema.length} Felder</div>
                  </GlassCard>
                );
              })}
            </div>
          )}
          <div className="db-form__row">
            <span className="db-form__label">Name (optional, sonst Template-Name)</span>
            <GlassInput
              value={name}
              placeholder={selectedTemplate?.name ?? "Eigener Name"}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="db-form">
          <GlassInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="z.B. Notizen, Kontakte, Projekte"
          />
          <GlassInput
            label="Beschreibung (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Worum geht's in dieser Datenbank?"
          />
          <div className="db-form__row">
            <span className="db-form__label">Icon</span>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="db-form__row">
            <span className="db-form__label">Farbe</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            background: "rgba(252, 165, 165, 0.08)",
            border: "1px solid rgba(252, 165, 165, 0.25)",
            color: "var(--text-danger)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div className="db-form__actions">
        <GlassButton variant="ghost" onClick={() => handleClose(false)}>
          Abbrechen
        </GlassButton>
        <GlassButton variant="primary" onClick={handleSubmit} disabled={create.isPending}>
          {create.isPending ? "Erstelle…" : "Anlegen"}
        </GlassButton>
      </div>
    </GlassDialog>
  );
}
