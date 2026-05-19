import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Archive } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { useDatabases } from "./useDatabases";
import { CreateDatabaseDialog } from "./CreateDatabaseDialog";
import { getIconComponent } from "./icon-picker";
import { getColorOption } from "./color-picker";
import "./databases.css";

export function DatabaseListPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const dbs = useDatabases(showArchived);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1180 }}>
      <header
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div>
          <h1
            style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.3px" }}
          >
            Datenbanken
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
            {showArchived ? "Archivierte Datenbanken" : "Aktive Datenbanken"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <GlassButton
            variant="ghost"
            onClick={() => setShowArchived((v) => !v)}
            aria-pressed={showArchived}
          >
            <Archive size={14} />
            {showArchived ? "Aktive zeigen" : "Archiv zeigen"}
          </GlassButton>
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Neue Datenbank
          </GlassButton>
        </div>
      </header>

      {dbs.isLoading && (
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Lade…</div>
      )}

      {dbs.data?.length === 0 && (
        <GlassCard
          variant="accent"
          style={{
            padding: 32,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>
            {showArchived ? "Keine archivierten Datenbanken" : "Noch keine Datenbank"}
          </h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14, maxWidth: 480 }}>
            {showArchived
              ? "Wenn du eine Datenbank archivierst, taucht sie hier auf."
              : "Starte aus einem der vordefinierten Templates (Autos, Verträge, Bücher, …) oder bau dir eine eigene."}
          </p>
          {!showArchived && (
            <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              Erste Datenbank anlegen
            </GlassButton>
          )}
        </GlassCard>
      )}

      {dbs.data && dbs.data.length > 0 && (
        <div className="db-list-grid">
          {dbs.data.map((db) => {
            const Icon = getIconComponent(db.icon);
            const color = getColorOption(db.color);
            return (
              <Link key={db.id} to={`/databases/${db.id}`} style={{ textDecoration: "none" }}>
                <GlassCard className="db-list-card">
                  <div className="db-list-card__head">
                    <div
                      className="db-list-card__icon"
                      style={{ color: color.swatch }}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="db-list-card__name">{db.name}</div>
                  </div>
                  {db.description && (
                    <div className="db-list-card__desc">{db.description}</div>
                  )}
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}

      <CreateDatabaseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
