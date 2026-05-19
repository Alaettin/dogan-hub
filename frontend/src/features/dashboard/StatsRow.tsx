import { Clock, Boxes, HardDrive, History } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { formatRelativeTime } from "../../lib/relative-time";
import type { DashboardStats } from "./useDashboard";
import "./dashboard.css";

interface StatsRowProps {
  stats: DashboardStats | undefined;
  loading: boolean;
}

const BYTES_PER_GB = 1024 ** 3;

function formatBytes(bytes: number): string {
  if (bytes >= BYTES_PER_GB) return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function StatsRow({ stats, loading }: StatsRowProps) {
  if (loading || !stats) {
    return (
      <div className="stats-row">
        {[0, 1, 2, 3].map((i) => (
          <GlassCard key={i} className="stat-card">
            <div className="skeleton" style={{ height: 12, width: 80 }} />
            <div className="skeleton" style={{ height: 24, width: 120 }} />
            <div className="skeleton" style={{ height: 10, width: 100 }} />
          </GlassCard>
        ))}
      </div>
    );
  }

  const activeModules = Object.values(stats.modules).filter(
    (m) => m.status === "active",
  ).length;
  const totalModules = Object.keys(stats.modules).length;
  const storagePct = Math.round((stats.storage.used_bytes / stats.storage.limit_bytes) * 100);

  return (
    <div className="stats-row">
      <GlassCard className="stat-card">
        <div className="stat-card__header">
          <Clock size={14} />
          Letzte Anmeldung
        </div>
        <div className="stat-card__value">{formatRelativeTime(stats.last_login)}</div>
        <div className="stat-card__hint">
          {stats.last_login ? new Date(stats.last_login).toLocaleString("de-DE") : "Noch nie"}
        </div>
      </GlassCard>

      <GlassCard className="stat-card">
        <div className="stat-card__header">
          <Boxes size={14} />
          Module
        </div>
        <div className="stat-card__value">
          {activeModules}
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}> / {totalModules} aktiv</span>
        </div>
        <div className="stat-card__hint">Auth läuft. Rest folgt laut Roadmap.</div>
      </GlassCard>

      <GlassCard className="stat-card">
        <div className="stat-card__header">
          <HardDrive size={14} />
          Speicherplatz
        </div>
        <div className="stat-card__value">
          {formatBytes(stats.storage.used_bytes)}
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {" "}/ {formatBytes(stats.storage.limit_bytes)}
          </span>
        </div>
        <div className="stat-progress" aria-hidden>
          <div className="stat-progress__bar" style={{ width: `${storagePct}%` }} />
        </div>
      </GlassCard>

      <GlassCard className="stat-card">
        <div className="stat-card__header">
          <History size={14} />
          Audit-Einträge
        </div>
        <div className="stat-card__value">{stats.counts.audit_entries}</div>
        <div className="stat-card__hint">Aktivitäten in deinem Account.</div>
      </GlassCard>
    </div>
  );
}
