import { Link } from "react-router-dom";
import { HardDrive } from "lucide-react";
import { useDashboardStats } from "../dashboard/useDashboard";
import { formatFileSize } from "./file-icons";
import { cn } from "../../lib/cn";
import "./files.css";

export function StorageIndicator() {
  const stats = useDashboardStats();
  const storage = stats.data?.storage;

  if (!storage) {
    return (
      <div className="storage-indicator">
        <div className="storage-indicator__row">
          <span className="storage-indicator__label">Speicher</span>
          <span className="storage-indicator__value">…</span>
        </div>
        <div className="storage-indicator__bar">
          <div className="storage-indicator__bar-fill" style={{ width: "0%" }} />
        </div>
      </div>
    );
  }

  const pct = Math.min(
    100,
    Math.round((storage.used_bytes / storage.limit_bytes) * 100),
  );
  const variant = pct >= 90 ? "danger" : pct >= 70 ? "warning" : null;

  return (
    <Link to="/dateien" className="storage-indicator" aria-label="Speicher-Übersicht">
      <div className="storage-indicator__row">
        <span className="storage-indicator__label">
          <HardDrive size={10} style={{ verticalAlign: "-1px", marginRight: 4 }} />
          Speicher
        </span>
        <span className="storage-indicator__value">{pct}%</span>
      </div>
      <div className="storage-indicator__bar">
        <div
          className={cn(
            "storage-indicator__bar-fill",
            variant && `storage-indicator__bar-fill--${variant}`,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="storage-indicator__hint">
        {formatFileSize(storage.used_bytes)} / {formatFileSize(storage.limit_bytes)} ·{" "}
        {storage.items} {storage.items === 1 ? "Datei" : "Dateien"}
      </div>
    </Link>
  );
}
