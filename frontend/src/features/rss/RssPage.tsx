import { useEffect, useMemo, useRef, useState } from "react";
import {
  Rss,
  Plus,
  FolderPlus,
  Inbox,
  CircleDot,
  Star,
  Search,
  RefreshCw,
  CheckCheck,
  Upload,
  Download,
  Trash2,
  Folder,
  AlertCircle,
  PauseCircle,
} from "lucide-react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassInput } from "../../components/ui/GlassInput";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { AddFeedDialog } from "./AddFeedDialog";
import { ArticleReader } from "./ArticleReader";
import {
  useFolders,
  useFeeds,
  useUnreadCounts,
  useItems,
  useRefreshFeed,
  useDeleteFeed,
  useCreateFolder,
  useDeleteFolder,
  useUpdateItem,
  useMarkAllRead,
  useImportOpml,
  useRssSettings,
  downloadOpml,
  type ItemsFilter,
  type RssItem,
  type RssFeed,
} from "./useRss";
import "./rss.css";

type Selection =
  | { kind: "all" }
  | { kind: "unread" }
  | { kind: "favorites" }
  | { kind: "feed"; id: string }
  | { kind: "folder"; id: string };

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.round(h / 24);
  if (d < 7) return `vor ${d} Tg`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

export function RssPage() {
  const confirm = useConfirm();
  const folders = useFolders();
  const feeds = useFeeds();
  const unread = useUnreadCounts();
  const settings = useRssSettings();

  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  // Standard-Ansicht aus den Einstellungen einmalig anwenden (vor der ersten
  // Nutzer-Interaktion), damit eigene Klicks danach nicht überschrieben werden.
  const appliedDefaultView = useRef(false);
  useEffect(() => {
    if (appliedDefaultView.current || !settings.data) return;
    appliedDefaultView.current = true;
    if (settings.data.default_view === "unread") setSelection({ kind: "unread" });
  }, [settings.data]);
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<RssItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshFeed = useRefreshFeed();
  const deleteFeed = useDeleteFeed();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const updateItem = useUpdateItem();
  const markAllRead = useMarkAllRead();
  const importOpml = useImportOpml();

  const filter: ItemsFilter = useMemo(() => {
    const f: ItemsFilter = {};
    if (selection.kind === "unread") f.unread = true;
    else if (selection.kind === "favorites") f.favorite = true;
    else if (selection.kind === "feed") f.feedId = selection.id;
    else if (selection.kind === "folder") f.folderId = selection.id;
    if (search.trim()) f.search = search.trim();
    return f;
  }, [selection, search]);

  const items = useItems(filter);

  const feedsByFolder = useMemo(() => {
    const map = new Map<string | null, RssFeed[]>();
    for (const feed of feeds.data ?? []) {
      const key = feed.folder_id;
      const arr = map.get(key) ?? [];
      arr.push(feed);
      map.set(key, arr);
    }
    return map;
  }, [feeds.data]);

  const totalUnread = useMemo(
    () => Object.values(unread.data ?? {}).reduce((a, b) => a + b, 0),
    [unread.data],
  );

  const feedById = useMemo(() => {
    const m = new Map<string, RssFeed>();
    for (const f of feeds.data ?? []) m.set(f.id, f);
    return m;
  }, [feeds.data]);

  function openArticle(item: RssItem) {
    setOpenItem(item);
    const markOnOpen = settings.data?.mark_read_on_open !== false;
    if (markOnOpen && !item.is_read) updateItem.mutate({ id: item.id, is_read: true });
  }

  function headingLabel(): string {
    switch (selection.kind) {
      case "all":
        return "Alle Artikel";
      case "unread":
        return "Ungelesen";
      case "favorites":
        return "Favoriten";
      case "feed":
        return feedById.get(selection.id)?.title ?? "Feed";
      case "folder":
        return folders.data?.find((f) => f.id === selection.id)?.name ?? "Ordner";
    }
  }

  async function handleDeleteFeed(feed: RssFeed) {
    const ok = await confirm({
      title: "Feed entfernen?",
      description: `„${feed.title}" und alle gespeicherten Artikel werden gelöscht.`,
      destructive: true,
    });
    if (!ok) return;
    if (selection.kind === "feed" && selection.id === feed.id) setSelection({ kind: "all" });
    await deleteFeed.mutateAsync(feed.id);
  }

  async function handleDeleteFolder(id: string, name: string) {
    const ok = await confirm({
      title: "Ordner löschen?",
      description: `„${name}" wird gelöscht. Die enthaltenen Feeds bleiben erhalten (ohne Ordner).`,
      destructive: true,
    });
    if (!ok) return;
    if (selection.kind === "folder" && selection.id === id) setSelection({ kind: "all" });
    await deleteFolder.mutateAsync(id);
  }

  async function submitFolder() {
    const name = folderName.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    await createFolder.mutateAsync(name);
    setFolderName("");
    setCreatingFolder(false);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const res = await importOpml.mutateAsync(text);
    await confirm({
      title: "OPML importiert",
      description: `${res.feedsCreated} Feeds, ${res.foldersCreated} Ordner hinzugefügt${
        res.feedsSkipped ? `, ${res.feedsSkipped} bereits vorhanden` : ""
      }.`,
      confirmLabel: "OK",
      cancelLabel: "Schließen",
    });
  }

  const showRefresh = selection.kind === "feed";

  return (
    <div className={`rss-page ${openItem ? "rss-page--reading" : ""}`}>
      {/* ─── Sidebar ─────────────────────────────────────────── */}
      <GlassPanel className="rss-sidebar">
        <div className="rss-sidebar__head">
          <span className="rss-sidebar__brand">
            <Rss size={16} /> RSS Feeds
          </span>
          <div className="rss-sidebar__head-actions">
            <button
              className="rss-iconlink"
              title="Ordner anlegen"
              onClick={() => setCreatingFolder(true)}
            >
              <FolderPlus size={15} />
            </button>
            <button className="rss-iconlink" title="Feed hinzufügen" onClick={() => setAddOpen(true)}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <nav className="rss-nav">
          <SmartLink
            active={selection.kind === "all"}
            icon={<Inbox size={15} />}
            label="Alle Artikel"
            onClick={() => setSelection({ kind: "all" })}
          />
          <SmartLink
            active={selection.kind === "unread"}
            icon={<CircleDot size={15} />}
            label="Ungelesen"
            badge={totalUnread || undefined}
            onClick={() => setSelection({ kind: "unread" })}
          />
          <SmartLink
            active={selection.kind === "favorites"}
            icon={<Star size={15} />}
            label="Favoriten"
            onClick={() => setSelection({ kind: "favorites" })}
          />
        </nav>

        {creatingFolder && (
          <div className="rss-newfolder">
            <GlassInput
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Ordnername"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitFolder();
                if (e.key === "Escape") setCreatingFolder(false);
              }}
              onBlur={() => void submitFolder()}
            />
          </div>
        )}

        <div className="rss-feedlist">
          {/* Ordner mit Feeds */}
          {(folders.data ?? []).map((folder) => {
            const folderFeeds = feedsByFolder.get(folder.id) ?? [];
            return (
              <div key={folder.id} className="rss-folder">
                <div
                  className={`rss-folder__head ${
                    selection.kind === "folder" && selection.id === folder.id
                      ? "rss-folder__head--active"
                      : ""
                  }`}
                >
                  <button
                    className="rss-folder__title"
                    onClick={() => setSelection({ kind: "folder", id: folder.id })}
                  >
                    <Folder size={14} />
                    {folder.name}
                  </button>
                  <button
                    className="rss-iconlink rss-iconlink--sm"
                    title="Ordner löschen"
                    onClick={() => void handleDeleteFolder(folder.id, folder.name)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {folderFeeds.map((feed) => (
                  <FeedRow
                    key={feed.id}
                    feed={feed}
                    nested
                    unread={unread.data?.[feed.id]}
                    active={selection.kind === "feed" && selection.id === feed.id}
                    onSelect={() => setSelection({ kind: "feed", id: feed.id })}
                    onDelete={() => void handleDeleteFeed(feed)}
                  />
                ))}
              </div>
            );
          })}

          {/* Feeds ohne Ordner */}
          {(feedsByFolder.get(null) ?? []).map((feed) => (
            <FeedRow
              key={feed.id}
              feed={feed}
              unread={unread.data?.[feed.id]}
              active={selection.kind === "feed" && selection.id === feed.id}
              onSelect={() => setSelection({ kind: "feed", id: feed.id })}
              onDelete={() => void handleDeleteFeed(feed)}
            />
          ))}

          {feeds.data && feeds.data.length === 0 && (
            <p className="rss-sidebar__empty">
              Noch keine Feeds. Mit „+" einen Feed hinzufügen.
            </p>
          )}
        </div>

        <div className="rss-sidebar__footer">
          <input
            ref={fileInput}
            type="file"
            accept=".opml,.xml,text/xml"
            style={{ display: "none" }}
            onChange={(e) => void onImportFile(e)}
          />
          <button className="rss-footlink" onClick={() => fileInput.current?.click()}>
            <Upload size={13} /> OPML-Import
          </button>
          <button className="rss-footlink" onClick={() => void downloadOpml()}>
            <Download size={13} /> Export
          </button>
        </div>
      </GlassPanel>

      {/* ─── Artikelliste ────────────────────────────────────── */}
      <section className="rss-list">
        <div className="rss-list__toolbar">
          <h1 className="rss-list__title">{headingLabel()}</h1>
          <div className="rss-list__tools">
            <div className="rss-search">
              <Search size={14} className="rss-search__icon" />
              <input
                className="glass-input rss-search__input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Artikel durchsuchen…"
              />
            </div>
            {showRefresh && (
              <GlassButton
                variant="ghost"
                className="rss-icon-btn"
                title="Feed aktualisieren"
                disabled={refreshFeed.isPending}
                onClick={() => refreshFeed.mutate((selection as { id: string }).id)}
              >
                <RefreshCw size={15} className={refreshFeed.isPending ? "rss-spin" : ""} />
              </GlassButton>
            )}
            <GlassButton
              variant="ghost"
              className="rss-icon-btn"
              title="Alle als gelesen markieren"
              onClick={() =>
                markAllRead.mutate(
                  selection.kind === "feed"
                    ? { feed_id: selection.id }
                    : selection.kind === "folder"
                      ? { folder_id: selection.id }
                      : {},
                )
              }
            >
              <CheckCheck size={15} />
            </GlassButton>
          </div>
        </div>

        <div className="rss-articles">
          {items.isLoading && <p className="rss-muted">Lade Artikel…</p>}
          {items.data && items.data.length === 0 && !items.isLoading && (
            <p className="rss-muted">Keine Artikel.</p>
          )}
          {(items.data ?? []).map((item) => (
            <button
              key={item.id}
              className={`rss-article ${item.is_read ? "rss-article--read" : ""} ${
                openItem?.id === item.id ? "rss-article--active" : ""
              }`}
              onClick={() => openArticle(item)}
            >
              <span className="rss-article__dot" aria-hidden="true" />
              <span className="rss-article__main">
                <span className="rss-article__meta">
                  {feedById.get(item.feed_id)?.title ?? ""}
                  <span className="rss-article__sep">·</span>
                  {relativeTime(item.published_at)}
                </span>
                <span className="rss-article__title">{item.title}</span>
                {item.summary && <span className="rss-article__preview">{item.summary}</span>}
              </span>
              {item.image_url && (
                <img className="rss-article__thumb" src={item.image_url} alt="" loading="lazy" />
              )}
              <span
                role="button"
                tabIndex={0}
                className={`rss-article__star ${item.is_favorite ? "rss-article__star--on" : ""}`}
                title={item.is_favorite ? "Favorit entfernen" : "Favorit"}
                onClick={(e) => {
                  e.stopPropagation();
                  updateItem.mutate({ id: item.id, is_favorite: !item.is_favorite });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    updateItem.mutate({ id: item.id, is_favorite: !item.is_favorite });
                  }
                }}
              >
                <Star size={15} fill={item.is_favorite ? "currentColor" : "none"} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Reader ──────────────────────────────────────────── */}
      {openItem && (
        <ArticleReader
          item={openItem}
          feed={feedById.get(openItem.feed_id)}
          onClose={() => setOpenItem(null)}
          onToggleFavorite={() => {
            const next = !openItem.is_favorite;
            updateItem.mutate({ id: openItem.id, is_favorite: next });
            setOpenItem({ ...openItem, is_favorite: next });
          }}
          onToggleRead={() => {
            const next = !openItem.is_read;
            updateItem.mutate({ id: openItem.id, is_read: next });
            setOpenItem({ ...openItem, is_read: next });
          }}
        />
      )}

      <AddFeedDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultFolderId={selection.kind === "folder" ? selection.id : undefined}
      />
    </div>
  );
}

// ─── kleine UI-Bausteine ─────────────────────────────────────────────
function SmartLink({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button className={`rss-smart ${active ? "rss-smart--active" : ""}`} onClick={onClick}>
      {icon}
      <span className="rss-smart__label">{label}</span>
      {badge ? <span className="rss-badge">{badge}</span> : null}
    </button>
  );
}

function FeedRow({
  feed,
  unread,
  active,
  nested,
  onSelect,
  onDelete,
}: {
  feed: RssFeed;
  unread?: number;
  active: boolean;
  nested?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rss-feedrow ${nested ? "rss-feedrow--nested" : ""} ${active ? "rss-feedrow--active" : ""}`}>
      <button className="rss-feedrow__main" onClick={onSelect} title={feed.title}>
        {feed.status === "error" ? (
          <AlertCircle size={13} className="rss-feedrow__status rss-feedrow__status--err" />
        ) : feed.status === "paused" ? (
          <PauseCircle size={13} className="rss-feedrow__status" />
        ) : (
          <Rss size={13} className="rss-feedrow__status" />
        )}
        <span className="rss-feedrow__title">{feed.title || feed.feed_url}</span>
        {unread ? <span className="rss-feedrow__count">{unread}</span> : null}
      </button>
      <button className="rss-iconlink rss-iconlink--sm rss-feedrow__del" title="Feed entfernen" onClick={onDelete}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}
