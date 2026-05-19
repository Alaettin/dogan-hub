import { useEffect, useState } from "react";
import { Check, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassButton } from "../../components/ui/GlassButton";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { ApiRequestError } from "../../lib/api";
import {
  TTL_PRESETS,
  useCreateShare,
  useFolderShares,
  useRevokeShare,
  type FolderShare,
} from "./useShares";

interface ShareFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string | null;
  folderName: string | null;
}

export function ShareFolderDialog({
  open,
  onOpenChange,
  folderId,
  folderName,
}: ShareFolderDialogProps) {
  const shares = useFolderShares(open ? folderId ?? undefined : undefined);
  const create = useCreateShare(folderId ?? "");
  const revoke = useRevokeShare();
  const confirm = useConfirm();

  const [permission, setPermission] = useState<"read" | "edit">("read");
  const [ttlSec, setTtlSec] = useState<number>(TTL_PRESETS[1].sec); // default 24h
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPermission("read");
      setTtlSec(TTL_PRESETS[1].sec);
      setError(null);
      setCopiedId(null);
    }
  }, [open]);

  async function copy(share: FolderShare) {
    const url = buildShareUrl(share.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId((c) => (c === share.id ? null : c)), 1500);
    } catch {
      setError("Kopieren in die Zwischenablage fehlgeschlagen");
    }
  }

  async function submit() {
    if (!folderId) return;
    setError(null);
    try {
      const share = await create.mutateAsync({ permission, ttl_sec: ttlSec });
      // Auto-Copy direkt nach Create — typisches Share-Verhalten
      await copy(share);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Anlegen fehlgeschlagen");
    }
  }

  async function handleRevoke(share: FolderShare) {
    const ok = await confirm({
      title: "Freigabe widerrufen?",
      description: "Der Link wird sofort ungültig. Bereits geöffnete Tabs verlieren den Zugriff beim nächsten Request.",
      destructive: true,
      confirmLabel: "Widerrufen",
    });
    if (!ok) return;
    try {
      await revoke.mutateAsync(share.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Widerruf fehlgeschlagen");
    }
  }

  const activeShares = shares.data ?? [];

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ordner freigeben"
      description={folderName ? `„${folderName}" per Link teilen.` : undefined}
      className="share-dialog-wide"
    >
      <div className="share-dialog">
        {/* ─── Bestehende Freigaben ───────────────────────────── */}
        <section className="share-dialog__section">
          <h3 className="share-dialog__heading">Aktive Freigaben</h3>
          {shares.isLoading && (
            <div className="share-dialog__empty">Lade…</div>
          )}
          {!shares.isLoading && activeShares.length === 0 && (
            <div className="share-dialog__empty">Noch keine Freigaben.</div>
          )}
          {activeShares.map((s) => (
            <div key={s.id} className="share-item">
              <div className="share-item__head">
                <span className={`share-badge share-badge--${s.permission}`}>
                  {s.permission === "edit" ? (
                    <>
                      <Pencil size={11} /> Bearbeiten
                    </>
                  ) : (
                    <>
                      <Eye size={11} /> Lesen
                    </>
                  )}
                </span>
                <span className="share-item__expires">{formatRemaining(s.expires_at)}</span>
                <button
                  type="button"
                  className="share-item__revoke"
                  onClick={() => handleRevoke(s)}
                  disabled={revoke.isPending}
                  aria-label="Freigabe widerrufen"
                  title="Widerrufen"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="share-item__url-row">
                <code className="share-item__url">{buildShareUrl(s.token)}</code>
                <button
                  type="button"
                  className="share-item__copy"
                  onClick={() => copy(s)}
                  title="Link kopieren"
                >
                  {copiedId === s.id ? (
                    <>
                      <Check size={12} /> Kopiert
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Kopieren
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* ─── Neue Freigabe ──────────────────────────────────── */}
        <section className="share-dialog__section">
          <h3 className="share-dialog__heading">Neue Freigabe erstellen</h3>

          <div className="share-radio-row">
            <PermissionOption
              label="Lesen"
              description="Anschauen + Herunterladen"
              icon={<Eye size={14} />}
              checked={permission === "read"}
              onChange={() => setPermission("read")}
            />
            <PermissionOption
              label="Bearbeiten"
              description="Hochladen + Sub-Ordner anlegen"
              icon={<Pencil size={14} />}
              checked={permission === "edit"}
              onChange={() => setPermission("edit")}
            />
          </div>

          <div className="share-ttl-row">
            {TTL_PRESETS.map((p) => (
              <button
                key={p.sec}
                type="button"
                className={`share-ttl-btn ${ttlSec === p.sec ? "share-ttl-btn--active" : ""}`}
                onClick={() => setTtlSec(p.sec)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "rgba(252,165,165,0.08)",
                border: "1px solid rgba(252,165,165,0.25)",
                color: "var(--text-danger)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div className="db-form__actions">
            <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
              Schließen
            </GlassButton>
            <GlassButton variant="primary" onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Erstelle…" : "Link erstellen + kopieren"}
            </GlassButton>
          </div>
        </section>
      </div>
    </GlassDialog>
  );
}

interface PermissionOptionProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}

function PermissionOption({ label, description, icon, checked, onChange }: PermissionOptionProps) {
  return (
    <label className={`share-radio ${checked ? "share-radio--checked" : ""}`}>
      <input type="radio" name="share-permission" checked={checked} onChange={onChange} />
      <div className="share-radio__body">
        <div className="share-radio__label">
          {icon} {label}
        </div>
        <div className="share-radio__desc">{description}</div>
      </div>
    </label>
  );
}

function buildShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "abgelaufen";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `läuft in ${Math.floor(h / 24)} Tagen ab`;
  if (h >= 1) return `läuft in ${h} h ab`;
  const m = Math.floor(ms / 60_000);
  return `läuft in ${m} min ab`;
}
