import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Plus, Archive } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { useDatabase } from "./useDatabases";
import { getIconComponent } from "./icon-picker";
import { getColorOption } from "./color-picker";
import { DatabaseMenu } from "./DatabaseMenu";
import "./databases.css";

export function DatabaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDatabase(id);

  if (db.isLoading) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Lade…</div>;
  }

  if (db.isError || !db.data) {
    return (
      <GlassCard style={{ padding: 24, maxWidth: 600 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Datenbank nicht gefunden</h2>
        <p style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 14 }}>
          Möglicherweise wurde sie gelöscht.
        </p>
        <Link to="/databases" style={{ textDecoration: "none" }}>
          <GlassButton variant="primary" style={{ marginTop: 14 }}>
            <ArrowLeft size={14} />
            Zur Übersicht
          </GlassButton>
        </Link>
      </GlassCard>
    );
  }

  const Icon = getIconComponent(db.data.icon);
  const color = getColorOption(db.data.color);
  const fieldCount = Array.isArray(db.data.schema) ? db.data.schema.length : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1180 }}>
      <div className="db-detail-header">
        <div className="db-detail-title">
          <div className="db-detail-icon" style={{ color: color.swatch }}>
            <Icon size={22} />
          </div>
          <div>
            <h1 className="db-detail-name">{db.data.name}</h1>
            {db.data.description && <p className="db-detail-description">{db.data.description}</p>}
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {fieldCount} {fieldCount === 1 ? "Feld" : "Felder"}
              {db.data.archived && " · Archiviert"}
            </p>
          </div>
        </div>
        <DatabaseMenu database={db.data} />
      </div>

      {db.data.archived && (
        <GlassCard
          style={{
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-warning)",
            background: "rgba(252, 211, 77, 0.06)",
            borderColor: "rgba(252, 211, 77, 0.25)",
          }}
        >
          <Archive size={16} />
          Diese Datenbank ist archiviert. Hol sie über das Menü zurück, wenn du sie nutzen willst.
        </GlassCard>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <GlassCard
          variant="accent"
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={16} style={{ color: "var(--text-accent)" }} />
            <strong style={{ fontSize: 14 }}>Schema-Editor</strong>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Felder definieren, Field-Types auswählen, Required-Flags setzen — kommt in Etappe 3b.2.
          </p>
          <GlassButton variant="secondary" disabled>
            Schema bearbeiten
          </GlassButton>
        </GlassCard>

        <GlassCard
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Plus size={16} style={{ color: "var(--text-accent)" }} />
            <strong style={{ fontSize: 14 }}>Einträge</strong>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Daten anlegen, in Tabelle / Karten / Liste anzeigen, filtern — kommt in 3b.2 und 3b.3.
          </p>
          <GlassButton variant="secondary" disabled>
            Neuer Eintrag
          </GlassButton>
        </GlassCard>
      </section>
    </div>
  );
}
