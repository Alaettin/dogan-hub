import { useMemo } from "react";
import DOMPurify from "dompurify";
import { X, ExternalLink, Star, Circle } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import type { RssFeed, RssItem } from "./useRss";

interface ArticleReaderProps {
  item: RssItem;
  feed?: RssFeed;
  onClose: () => void;
  onToggleFavorite: () => void;
  onToggleRead: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArticleReader({
  item,
  feed,
  onClose,
  onToggleFavorite,
  onToggleRead,
}: ArticleReaderProps) {
  // Externes Feed-HTML wird vor dem Rendern sanitisiert (XSS-Schutz).
  const safeHtml = useMemo(() => {
    const raw = item.content ?? item.summary ?? "";
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        "p", "br", "a", "b", "strong", "i", "em", "u", "ul", "ol", "li",
        "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "img", "figure",
        "figcaption", "pre", "code", "span", "hr", "table", "thead", "tbody",
        "tr", "th", "td",
      ],
      ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel"],
      ADD_ATTR: ["target"],
    });
  }, [item.content, item.summary]);

  // Hero nur zeigen, wenn der Fließtext nicht ohnehin schon ein Bild enthält
  // (das Hero wird oft aus dem ersten <img> des Contents extrahiert → Duplikat).
  const showHero = !!item.image_url && !/<img/i.test(safeHtml);

  return (
    <article className="rss-reader">
      <div className="rss-reader__bar">
        <GlassButton variant="ghost" className="rss-icon-btn" onClick={onClose} title="Schließen">
          <X size={16} />
        </GlassButton>
        <div className="rss-reader__bar-actions">
          <GlassButton
            variant="ghost"
            className={`rss-icon-btn ${item.is_favorite ? "rss-icon-btn--fav" : ""}`}
            onClick={onToggleFavorite}
            title={item.is_favorite ? "Favorit entfernen" : "Als Favorit markieren"}
          >
            <Star size={16} fill={item.is_favorite ? "currentColor" : "none"} />
          </GlassButton>
          <GlassButton
            variant="ghost"
            className="rss-icon-btn"
            onClick={onToggleRead}
            title={item.is_read ? "Als ungelesen markieren" : "Als gelesen markieren"}
          >
            <Circle size={16} fill={item.is_read ? "none" : "currentColor"} />
          </GlassButton>
          {item.link && (
            <a className="rss-reader__open" href={item.link} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Original
            </a>
          )}
        </div>
      </div>

      <div className="rss-reader__scroll">
        <header className="rss-reader__head">
          <span className="rss-reader__source">
            {feed?.title ?? "Feed"}
            {item.published_at && <> · {formatDate(item.published_at)}</>}
            {item.author && <> · {item.author}</>}
          </span>
          <h1 className="rss-reader__title">{item.title}</h1>
        </header>

        {showHero && (
          <img className="rss-reader__hero" src={item.image_url!} alt="" loading="lazy" />
        )}

        {safeHtml.trim() ? (
          <div className="rss-reader__body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          <p className="rss-muted">Kein Inhalt verfügbar — bitte das Original öffnen.</p>
        )}
      </div>
    </article>
  );
}
