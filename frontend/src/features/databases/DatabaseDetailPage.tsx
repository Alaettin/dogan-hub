import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Archive, Plus, Settings2 } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useDatabase } from "./useDatabases";
import { useEntries, type Entry } from "./useEntries";
import { useViews, type SavedView } from "./useViews";
import { getIconComponent } from "./icon-picker";
import { getColorOption } from "./color-picker";
import { DatabaseMenu } from "./DatabaseMenu";
import { SchemaEditor } from "./SchemaEditor";
import { EntryFormDialog } from "./EntryFormDialog";
import type { FieldDef } from "./fields/field-types";
import {
  decodeViewFromParams,
  encodeViewToParams,
  type ViewConfig,
} from "./view-types";
import { ViewSwitcher } from "./views/ViewSwitcher";
import { SortMenu } from "./views/SortMenu";
import { FilterBuilder } from "./views/FilterBuilder";
import { SavedViewsBar } from "./views/SavedViewsBar";
import { SaveViewDialog } from "./views/SaveViewDialog";
import { EntryTable } from "./views/EntryTable";
import { EntryCards } from "./views/EntryCards";
import { EntryList } from "./views/EntryList";
import "./databases.css";

export function DatabaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const db = useDatabase(id);
  const views = useViews(id);

  // View-Config aus URL
  const viewConfig = useMemo<ViewConfig>(
    () => decodeViewFromParams(searchParams),
    [searchParams],
  );

  // Default-View beim ersten Mount laden, wenn URL ohne View-Params
  const [appliedDefault, setAppliedDefault] = useState(false);
  useEffect(() => {
    if (appliedDefault) return;
    if (!views.data) return;
    if (searchParams.get("view") || searchParams.get("sort") || searchParams.get("filter")) {
      setAppliedDefault(true);
      return;
    }
    const def = views.data.find((v) => v.is_default);
    if (def) {
      const next: ViewConfig = { view_type: def.view_type, ...def.config };
      setSearchParams(encodeViewToParams(next), { replace: true });
    }
    setAppliedDefault(true);
  }, [views.data, searchParams, setSearchParams, appliedDefault]);

  function updateView(patch: Partial<ViewConfig>) {
    const next: ViewConfig = { ...viewConfig, ...patch };
    setSearchParams(encodeViewToParams(next), { replace: true });
  }

  function applySavedView(view: SavedView) {
    const next: ViewConfig = { view_type: view.view_type, ...view.config };
    setSearchParams(encodeViewToParams(next), { replace: true });
  }

  const entries = useEntries(id, {
    sort: viewConfig.sort,
    order: viewConfig.order,
    filters: viewConfig.filters,
  });

  const [schemaOpen, setSchemaOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | undefined>(undefined);
  const [saveViewOpen, setSaveViewOpen] = useState(false);

  if (db.isLoading) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Lade…</div>;
  }
  if (db.isError || !db.data) {
    return (
      <GlassCard style={{ padding: 24, maxWidth: 600 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Datenbank nicht gefunden</h2>
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
  const schema = (db.data.schema ?? []) as FieldDef[];
  const fieldCount = schema.length;
  const visibleFields = schema.filter((f) => f.visible_in_table !== false).slice(0, 5);
  const visibleSchema = visibleFields.length > 0 ? visibleFields : schema.slice(0, 5);
  const entryList = entries.data?.items ?? [];

  function openEdit(entry: Entry) {
    setEditingEntry(entry);
    setEntryOpen(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1180 }}>
      <div className="db-detail-header">
        <div className="db-detail-title">
          <div className="db-detail-icon" style={{ color: color.swatch }}>
            <Icon size={22} />
          </div>
          <div>
            <h1 className="db-detail-name">{db.data.name}</h1>
            {db.data.description && (
              <p className="db-detail-description">{db.data.description}</p>
            )}
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {fieldCount} {fieldCount === 1 ? "Feld" : "Felder"} ·{" "}
              {entries.data?.total ?? 0}{" "}
              {(entries.data?.total ?? 0) === 1 ? "Eintrag" : "Einträge"}
              {db.data.archived && " · Archiviert"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <GlassButton variant="secondary" onClick={() => setSchemaOpen(true)}>
            <Settings2 size={14} />
            Schema
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={() => {
              setEditingEntry(undefined);
              setEntryOpen(true);
            }}
            disabled={schema.length === 0}
          >
            <Plus size={14} />
            Neuer Eintrag
          </GlassButton>
          <DatabaseMenu database={db.data} />
        </div>
      </div>

      {db.data.archived && (
        <GlassCard
          style={{
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-warning)",
            background: "rgba(252, 211, 77, 0.06)",
            borderColor: "rgba(252, 211, 77, 0.25)",
          }}
        >
          <Archive size={16} />
          Diese Datenbank ist archiviert.
        </GlassCard>
      )}

      {schema.length === 0 ? (
        <GlassCard variant="accent" style={{ padding: 24 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Definiere erst das Schema</h3>
          <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            Klicke oben auf "Schema" um Felder hinzuzufügen. Erst dann kannst du Einträge anlegen.
          </p>
        </GlassCard>
      ) : (
        <>
          {(views.data?.length ?? 0) > 0 && (
            <SavedViewsBar
              views={views.data ?? []}
              current={viewConfig}
              databaseId={db.data.id}
              onSelect={applySavedView}
              onSave={() => setSaveViewOpen(true)}
            />
          )}

          <div className="view-toolbar">
            <SortMenu
              schema={schema}
              sort={viewConfig.sort}
              order={viewConfig.order}
              onChange={(sort, order) => updateView({ sort, order })}
            />
            <div className="view-toolbar__spacer" />
            {(views.data?.length ?? 0) === 0 && (
              <GlassButton variant="ghost" onClick={() => setSaveViewOpen(true)}>
                Ansicht speichern
              </GlassButton>
            )}
            <ViewSwitcher
              value={viewConfig.view_type}
              onChange={(v) => updateView({ view_type: v })}
            />
          </div>

          <FilterBuilder
            schema={schema}
            filters={viewConfig.filters ?? []}
            onChange={(filters) => updateView({ filters })}
          />

          {viewConfig.view_type === "table" && (
            <GlassPanel style={{ overflow: "hidden" }}>
              <EntryTable
                entries={entryList}
                visibleFields={visibleSchema}
                databaseId={db.data.id}
                sort={viewConfig.sort}
                order={viewConfig.order}
                onSortChange={(sort, order) => updateView({ sort, order })}
                onEdit={openEdit}
              />
            </GlassPanel>
          )}
          {viewConfig.view_type === "cards" && (
            <EntryCards
              entries={entryList}
              visibleFields={visibleSchema}
              onEdit={openEdit}
            />
          )}
          {viewConfig.view_type === "list" && (
            <EntryList
              entries={entryList}
              visibleFields={visibleSchema}
              onEdit={openEdit}
            />
          )}
        </>
      )}

      <SchemaEditor open={schemaOpen} onOpenChange={setSchemaOpen} database={db.data} />
      <EntryFormDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        databaseId={db.data.id}
        schema={schema}
        mode={editingEntry ? "edit" : "create"}
        entry={editingEntry}
      />
      <SaveViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        databaseId={db.data.id}
        config={viewConfig}
      />
    </div>
  );
}
