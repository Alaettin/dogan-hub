import { Link } from "react-router-dom";
import { Rss } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { useLatestItems } from "./useRss";
import "./rss.css";

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

export function RssWidget() {
  const latest = useLatestItems(5);
  const items = latest.data ?? [];

  return (
    <GlassCard className="rss-widget">
      <div className="rss-widget__head">
        <span className="rss-widget__title">
          <Rss size={15} /> Neueste Artikel
        </span>
        <Link to="/rss" className="rss-widget__link">
          Alle Feeds
        </Link>
      </div>

      {latest.isLoading && <div className="rss-widget__empty">Lade…</div>}
      {latest.data && items.length === 0 && (
        <div className="rss-widget__empty">Noch keine Artikel. Feed hinzufügen unter „RSS Feeds".</div>
      )}

      {items.map((it) => (
        <Link
          key={it.id}
          to="/rss"
          className={`rss-widget__row ${it.is_read ? "rss-widget__row--read" : ""}`}
        >
          {it.image_url ? (
            <img className="rss-widget__thumb" src={it.image_url} alt="" loading="lazy" />
          ) : (
            <span className="rss-widget__thumb rss-widget__thumb--ph">
              <Rss size={14} />
            </span>
          )}
          <span className="rss-widget__text">
            <span className="rss-widget__row-title">{it.title}</span>
            <span className="rss-widget__row-time">{relativeTime(it.published_at)}</span>
          </span>
        </Link>
      ))}
    </GlassCard>
  );
}
