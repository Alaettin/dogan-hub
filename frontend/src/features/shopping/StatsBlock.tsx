import type { ReactNode } from "react";
import { Wallet, TrendingUp, PackageCheck, Boxes, Percent } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { formatEur } from "../../lib/money";
import { RevenueChart, StatusDonut, RevenueByPlatform } from "./ShopCharts";
import type { Stats, GlobalStats, ListingStatus } from "./useShopping";

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <GlassCard className="shop-stat">
      <span className="shop-stat__icon" style={accent ? { color: accent } : undefined}>
        {icon}
      </span>
      <span className="shop-stat__body">
        <span className="shop-stat__value">{value}</span>
        <span className="shop-stat__label">{label}</span>
      </span>
    </GlassCard>
  );
}

interface StatsBlockProps {
  stats: Stats;
  byPlatform?: GlobalStats["by_platform"];
}

export function StatsBlock({ stats, byPlatform }: StatsBlockProps) {
  return (
    <div className="shop-stats">
      <div className="shop-stat-grid">
        <StatCard icon={<Wallet size={18} />} label="Umsatz" value={formatEur(stats.revenue)} accent="#10b981" />
        <StatCard icon={<TrendingUp size={18} />} label="Gewinn" value={formatEur(stats.profit)} accent="#818cf8" />
        <StatCard icon={<PackageCheck size={18} />} label="Verkauft" value={String(stats.sold)} accent="#38bdf8" />
        <StatCard icon={<Boxes size={18} />} label="Aktiver Wert" value={formatEur(stats.active_value)} accent="#f59e0b" />
        <StatCard icon={<Percent size={18} />} label="Verkaufsquote" value={`${stats.sell_through} %`} accent="#ec4899" />
      </div>

      <div className="shop-charts">
        <GlassCard className="shop-chart">
          <h3 className="shop-chart__title">Umsatz & Gewinn (12 Monate)</h3>
          <RevenueChart data={stats.revenue_by_month} />
        </GlassCard>

        {byPlatform && byPlatform.length > 0 && (
          <GlassCard className="shop-chart">
            <h3 className="shop-chart__title">Umsatz nach Plattform</h3>
            <RevenueByPlatform data={byPlatform} />
          </GlassCard>
        )}

        <GlassCard className="shop-chart">
          <h3 className="shop-chart__title">Status-Verteilung</h3>
          <StatusDonut active={stats.active} sold={stats.sold} cancelled={stats.cancelled} />
          <div className="shop-legend">
            <span><i style={{ background: "#38bdf8" }} /> Aktiv {stats.active}</span>
            <span><i style={{ background: "#10b981" }} /> Verkauft {stats.sold}</span>
            <span><i style={{ background: "#94a3b8" }} /> Entfernt {stats.cancelled}</span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

const STATUS_META: Record<ListingStatus, { label: string; cls: string }> = {
  active: { label: "Aktiv", cls: "shop-badge--active" },
  sold: { label: "Verkauft", cls: "shop-badge--sold" },
  cancelled: { label: "Entfernt", cls: "shop-badge--cancelled" },
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  const m = STATUS_META[status];
  return <span className={`shop-badge ${m.cls}`}>{m.label}</span>;
}
