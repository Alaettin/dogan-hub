import { LogIn, LogOut, Plus, Pencil, Trash2, Activity } from "lucide-react";
import type { ReactNode } from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { formatRelativeTime } from "../../lib/relative-time";
import type { ActivityItem } from "./useDashboard";
import "./dashboard.css";

interface ActivityFeedProps {
  items: ActivityItem[] | undefined;
  loading: boolean;
}

const ACTION_LABEL: Record<ActivityItem["action"], string> = {
  login: "Anmeldung",
  logout: "Abmeldung",
  create: "Erstellt",
  update: "Aktualisiert",
  delete: "Gelöscht",
};

const ACTION_ICON: Record<ActivityItem["action"], ReactNode> = {
  login: <LogIn size={14} />,
  logout: <LogOut size={14} />,
  create: <Plus size={14} />,
  update: <Pencil size={14} />,
  delete: <Trash2 size={14} />,
};

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  return (
    <GlassPanel className="activity-list">
      <div className="activity-list__heading">
        <span className="activity-list__title">
          <Activity size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Letzte Aktivität
        </span>
        <span className="activity-list__subtitle">{items?.length ?? 0} Einträge</span>
      </div>

      {loading && (!items || items.length === 0)
        ? renderSkeleton()
        : !items || items.length === 0
        ? renderEmpty()
        : items.map((item) => (
            <div key={item.id} className="activity-item">
              <div className="activity-item__icon">{ACTION_ICON[item.action]}</div>
              <div className="activity-item__body">
                <div className="activity-item__label">
                  {ACTION_LABEL[item.action]}
                  {item.resource_type !== "auth" && (
                    <span style={{ color: "var(--text-muted)" }}> · {item.resource_type}</span>
                  )}
                </div>
                <div className="activity-item__meta">
                  {formatRelativeTime(item.created_at)}
                </div>
              </div>
            </div>
          ))}
    </GlassPanel>
  );
}

function renderSkeleton() {
  return [0, 1, 2].map((i) => (
    <div key={i} className="activity-item">
      <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
      <div className="activity-item__body">
        <div className="skeleton" style={{ height: 12, width: "60%" }} />
        <div className="skeleton" style={{ height: 10, width: "40%", marginTop: 4 }} />
      </div>
    </div>
  ));
}

function renderEmpty() {
  return (
    <div className="activity-list__empty">
      Noch keine Aktivität. Nach dem nächsten Login erscheint hier ein Eintrag.
    </div>
  );
}
