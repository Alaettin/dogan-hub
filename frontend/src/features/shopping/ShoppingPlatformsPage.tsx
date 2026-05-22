import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Store, ChevronRight } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassButton } from "../../components/ui/GlassButton";
import { formatEur } from "../../lib/money";
import { getColorOption } from "../databases/color-picker";
import { usePlatforms, useGlobalStats } from "./useShopping";
import { StatsBlock } from "./StatsBlock";
import { PlatformDialog } from "./PlatformDialog";
import "./shopping.css";

export function ShoppingPlatformsPage() {
  const platforms = usePlatforms();
  const stats = useGlobalStats();
  const [createOpen, setCreateOpen] = useState(false);

  const items = platforms.data ?? [];
  const hasData = stats.data && stats.data.listings > 0;

  return (
    <div className="shop-page">
      <header className="shop-header">
        <div>
          <h1 className="shop-header__title">Verkäufe</h1>
          <p className="shop-header__sub">Deine Inserate & Verkäufe über alle Plattformen.</p>
        </div>
        <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Neue Plattform
        </GlassButton>
      </header>

      {hasData && stats.data && <StatsBlock stats={stats.data} byPlatform={stats.data.by_platform} />}

      <section>
        <h2 className="shop-section-title">Plattformen</h2>
        {platforms.isLoading ? (
          <p className="shop-muted">Lade…</p>
        ) : items.length === 0 ? (
          <GlassCard className="shop-empty">
            <Store size={28} />
            <p>Noch keine Plattform. Lege deine erste an (z.B. Cardmarket).</p>
            <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Neue Plattform
            </GlassButton>
          </GlassCard>
        ) : (
          <div className="shop-platform-grid">
            {items.map((p) => {
              const color = getColorOption(p.color);
              return (
                <Link key={p.id} to={`/shopping/${p.id}`} className="shop-platform-card">
                  <span className="shop-platform-card__bar" style={{ background: color.swatch }} />
                  <div className="shop-platform-card__head">
                    <span className="shop-platform-card__name">{p.name}</span>
                    <ChevronRight size={16} className="shop-platform-card__chev" />
                  </div>
                  <div className="shop-platform-card__stats">
                    <span><b>{p.active}</b> aktiv</span>
                    <span><b>{p.sold}</b> verkauft</span>
                  </div>
                  <div className="shop-platform-card__rev">
                    <span className="shop-platform-card__rev-val">{formatEur(p.revenue)}</span>
                    <span className="shop-platform-card__rev-lbl">Umsatz · {formatEur(p.active_value)} aktiv</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <PlatformDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
