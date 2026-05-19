import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Folder as FolderIcon,
  FileText as EntryIcon,
  Search,
} from "lucide-react";
import { useGlobalSearch } from "./useGlobalSearch";
import { getIconComponent } from "../databases/icon-picker";
import { getColorOption } from "../databases/color-picker";
import { getFileIcon } from "../files/file-icons";
import { cn } from "../../lib/cn";
import "./command-palette.css";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Target =
  | { kind: "database"; id: string; label: string; icon: string | null; color: string | null }
  | { kind: "folder"; id: string; label: string; meta: string }
  | { kind: "entry"; id: string; databaseId: string; label: string }
  | {
      kind: "file";
      id: string;
      label: string;
      mime: string;
      folderId: string | null;
      meta: string;
    };

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Debounce
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(handle);
  }, [query]);

  // Reset bei Open
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const search = useGlobalSearch(debounced, 5);

  // Flattened ordered list für Keyboard-Navigation
  const targets = useMemo<Target[]>(() => {
    if (!search.data) return [];
    const out: Target[] = [];
    for (const db of search.data.databases) {
      out.push({
        kind: "database",
        id: db.id,
        label: db.name,
        icon: db.icon,
        color: db.color,
      });
    }
    for (const e of search.data.entries) {
      const summary = describeEntry(e.data);
      out.push({
        kind: "entry",
        id: e.id,
        databaseId: e.database_id,
        label: summary,
      });
    }
    for (const f of search.data.files) {
      out.push({
        kind: "file",
        id: f.id,
        label: f.name,
        mime: f.mime_type,
        folderId: f.folder_id,
        meta: formatBytes(f.size_bytes),
      });
    }
    for (const fo of search.data.folders) {
      out.push({
        kind: "folder",
        id: fo.id,
        label: fo.name,
        meta: fo.path,
      });
    }
    return out;
  }, [search.data]);

  // Klemme activeIndex an Liste
  useEffect(() => {
    if (activeIndex >= targets.length) setActiveIndex(Math.max(0, targets.length - 1));
  }, [activeIndex, targets.length]);

  function activate(target: Target) {
    onOpenChange(false);
    switch (target.kind) {
      case "database":
        navigate(`/databases/${target.id}`);
        break;
      case "entry":
        // Eintrag wird in der DB-Detail-Page sichtbar wenn wir den Such-Begriff
        // mit übergeben (DatabaseDetailPage liest ?search=… aus URL-Params).
        navigate(`/databases/${target.databaseId}?search=${encodeURIComponent(debounced)}`);
        break;
      case "folder":
        navigate(`/dateien?folder=${target.id}`);
        break;
      case "file":
        if (target.folderId) {
          navigate(`/dateien?folder=${target.folderId}`);
        } else {
          navigate("/dateien");
        }
        break;
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(targets.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const t = targets[activeIndex];
      if (t) activate(t);
      return;
    }
  }

  if (!open) return null;

  const hasResults = targets.length > 0;
  const showEmpty = !!debounced && !search.isLoading && !hasResults;

  return createPortal(
    <>
      <div className="cmdpal-overlay" onClick={() => onOpenChange(false)} />
      <div
        className="cmdpal"
        role="dialog"
        aria-modal="true"
        aria-label="Globale Suche"
        onKeyDown={onKeyDown}
      >
        <div className="cmdpal__search">
          <Search size={16} style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            type="text"
            className="cmdpal__search-input"
            placeholder="Suchen in Datenbanken, Einträgen, Dateien…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            spellCheck={false}
          />
        </div>

        <div className="cmdpal__body" ref={bodyRef}>
          {!debounced && (
            <div className="cmdpal__empty">
              Tippe einen Begriff um Datenbanken, Einträge, Dateien und Ordner zu durchsuchen.
            </div>
          )}
          {debounced && search.isLoading && (
            <div className="cmdpal__empty">Suche…</div>
          )}
          {showEmpty && (
            <div className="cmdpal__empty">Keine Treffer für &ldquo;{debounced}&rdquo;.</div>
          )}

          {hasResults && (
            <ResultGroups
              data={search.data!}
              activeIndex={activeIndex}
              onPick={activate}
              targets={targets}
              setActiveIndex={setActiveIndex}
            />
          )}
        </div>

        <div className="cmdpal__footer">
          <span>
            <span className="cmdpal__kbd">↑↓</span> Navigieren
            {"  "}
            <span className="cmdpal__kbd">↵</span> Öffnen
          </span>
          <span>
            <span className="cmdpal__kbd">esc</span> Schließen
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}

interface ResultGroupsProps {
  data: NonNullable<ReturnType<typeof useGlobalSearch>["data"]>;
  targets: Target[];
  activeIndex: number;
  onPick: (target: Target) => void;
  setActiveIndex: (idx: number) => void;
}

function ResultGroups({
  data,
  targets,
  activeIndex,
  onPick,
  setActiveIndex,
}: ResultGroupsProps) {
  let cursor = 0;

  function renderItem(target: Target, index: number, content: React.ReactNode) {
    return (
      <button
        key={`${target.kind}-${target.id}`}
        type="button"
        className={cn("cmdpal__item", index === activeIndex && "cmdpal__item--active")}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => onPick(target)}
      >
        {content}
      </button>
    );
  }

  return (
    <>
      {data.databases.length > 0 && (
        <div className="cmdpal__group">
          <div className="cmdpal__group-label">Datenbanken</div>
          {data.databases.map((db) => {
            const Icon = getIconComponent(db.icon);
            const color = getColorOption(db.color);
            const target = targets[cursor];
            const idx = cursor++;
            return renderItem(
              target,
              idx,
              <>
                <span className="cmdpal__item-icon" style={{ color: color.swatch }}>
                  <Icon size={14} />
                </span>
                <span className="cmdpal__item-body">
                  <span className="cmdpal__item-title">{db.name}</span>
                  {db.description && (
                    <span className="cmdpal__item-meta">{db.description}</span>
                  )}
                </span>
              </>,
            );
          })}
        </div>
      )}

      {data.entries.length > 0 && (
        <div className="cmdpal__group">
          <div className="cmdpal__group-label">Einträge</div>
          {data.entries.map((e) => {
            const target = targets[cursor];
            const idx = cursor++;
            return renderItem(
              target,
              idx,
              <>
                <span className="cmdpal__item-icon">
                  <EntryIcon size={14} />
                </span>
                <span className="cmdpal__item-body">
                  <span className="cmdpal__item-title">{describeEntry(e.data)}</span>
                  <span className="cmdpal__item-meta">Eintrag · öffnet Datenbank</span>
                </span>
              </>,
            );
          })}
        </div>
      )}

      {data.files.length > 0 && (
        <div className="cmdpal__group">
          <div className="cmdpal__group-label">Dateien</div>
          {data.files.map((f) => {
            const Icon = getFileIcon(f.mime_type);
            const target = targets[cursor];
            const idx = cursor++;
            return renderItem(
              target,
              idx,
              <>
                <span className="cmdpal__item-icon">
                  <Icon size={14} />
                </span>
                <span className="cmdpal__item-body">
                  <span className="cmdpal__item-title">{f.name}</span>
                  <span className="cmdpal__item-meta">{formatBytes(f.size_bytes)}</span>
                </span>
              </>,
            );
          })}
        </div>
      )}

      {data.folders.length > 0 && (
        <div className="cmdpal__group">
          <div className="cmdpal__group-label">Ordner</div>
          {data.folders.map((fo) => {
            const target = targets[cursor];
            const idx = cursor++;
            return renderItem(
              target,
              idx,
              <>
                <span className="cmdpal__item-icon">
                  <FolderIcon size={14} />
                </span>
                <span className="cmdpal__item-body">
                  <span className="cmdpal__item-title">{fo.name}</span>
                  <span className="cmdpal__item-meta">{fo.path}</span>
                </span>
              </>,
            );
          })}
        </div>
      )}
    </>
  );
}

function describeEntry(data: Record<string, unknown>): string {
  // Nutze den ersten nicht-leeren String-Wert als Titel.
  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "(Ohne Titel)";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
