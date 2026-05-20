import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassCard } from "../../components/ui/GlassCard";
import { GlassInput } from "../../components/ui/GlassInput";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useAuth } from "../auth/useAuth";
import {
  useAdminUsers,
  useDeleteUser,
  useUpdateUser,
  type AdminUser,
} from "./useAdminUsers";
import { computeInitials, formatError } from "./utils";
import "./settings.css";

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const users = useAdminUsers();

  if (profile && profile.role !== "admin") {
    return (
      <div className="settings-noaccess">Kein Zugriff. Nur Admins können Benutzer verwalten.</div>
    );
  }

  if (users.isLoading) {
    return <div className="settings-empty">Lade Benutzer…</div>;
  }

  const user = users.data?.find((u) => u.id === id);

  // Daten geladen, aber User nicht gefunden → zurück zur Liste.
  if (users.data && !user) {
    return <NotFoundRedirect />;
  }

  if (!user) {
    return <div className="settings-empty">Lade Benutzer…</div>;
  }

  const isSelf = profile?.id === user.id;

  return (
    <div className="user-detail">
      <button
        type="button"
        className="user-detail__back"
        onClick={() => navigate("/einstellungen/benutzer")}
      >
        <ArrowLeft size={14} />
        Zurück zur Liste
      </button>

      <DetailHeader user={user} isSelf={isSelf} />

      <ProfileSection user={user} isSelf={isSelf} />
      <DangerSection user={user} isSelf={isSelf} />
    </div>
  );
}

function NotFoundRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/einstellungen/benutzer", { replace: true });
  }, [navigate]);
  return null;
}

interface SectionProps {
  user: AdminUser;
  isSelf?: boolean;
}

function DetailHeader({ user, isSelf }: SectionProps) {
  const initials = computeInitials(user.display_name || user.email || "?");
  return (
    <div className="user-detail-header">
      <div className="user-avatar user-avatar--lg" aria-hidden>
        {user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials}
      </div>
      <div className="user-detail-header__body">
        <h1 className="user-detail-header__name">
          {user.display_name}
          {isSelf && <span className="user-detail-header__hint"> · Du</span>}
        </h1>
        <p className="user-detail-header__meta">
          {user.email ?? "—"}
          {" · "}
          <span className={`role-badge role-badge--${user.role}`}>
            {user.role === "admin" ? "Admin" : "User"}
          </span>
        </p>
      </div>
    </div>
  );
}

// Bündelt Anzeigename, Rolle und Email in einer Profil-Karte mit
// gemeinsamem State und einem einzigen Speichern-Button unten.
function ProfileSection({ user, isSelf }: SectionProps) {
  const update = useUpdateUser();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [role, setRole] = useState<"admin" | "user">(user.role);
  const [email, setEmail] = useState(user.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Sync wenn Liste neu geladen wird (z.B. nach Save)
  useEffect(() => {
    setDisplayName(user.display_name);
    setRole(user.role);
    setEmail(user.email ?? "");
  }, [user.display_name, user.role, user.email]);

  const trimmedName = displayName.trim();
  const trimmedEmail = email.trim();
  const nameDirty = trimmedName !== user.display_name && trimmedName.length > 0;
  const roleDirty = role !== user.role;
  const emailDirty = trimmedEmail !== (user.email ?? "") && trimmedEmail.length > 0;
  const dirty = nameDirty || roleDirty || emailDirty;

  // Self-Demote client-seitig blockieren (Server lehnt zusätzlich ab).
  const blockedSelfDemote = isSelf && roleDirty && role === "user";

  function touch() {
    setSaved(false);
  }

  async function save() {
    setError(null);
    setSaved(false);
    if (blockedSelfDemote) {
      setError("Du kannst dich nicht selbst herabstufen");
      return;
    }
    const patch: Parameters<typeof update.mutateAsync>[0] = { id: user.id };
    if (nameDirty) patch.display_name = trimmedName;
    if (roleDirty) patch.role = role;
    if (emailDirty) patch.email = trimmedEmail;
    try {
      await update.mutateAsync(patch);
      setSaved(true);
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <Section title="Profil">
      <div className="user-detail-field">
        <GlassInput
          label="Anzeigename"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            touch();
          }}
          maxLength={80}
        />
      </div>

      <div className="user-detail-field">
        <span className="user-detail-field__label">Rolle</span>
        <div className="user-detail-radio-group" role="radiogroup" aria-label="Rolle">
          <RoleOption
            label="User"
            description="Standardrolle. Sieht eigene Daten."
            checked={role === "user"}
            onChange={() => {
              setRole("user");
              touch();
            }}
            disabled={update.isPending}
          />
          <RoleOption
            label="Admin"
            description="Vollzugriff. Kann Benutzer verwalten."
            checked={role === "admin"}
            onChange={() => {
              setRole("admin");
              touch();
            }}
            disabled={update.isPending}
          />
        </div>
      </div>

      <div className="user-detail-field">
        <GlassInput
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            touch();
          }}
        />
      </div>

      {error && <div className="user-detail-form-row__error">{error}</div>}
      <div className="user-detail-form-row__actions">
        {saved && !dirty && (
          <span className="user-detail-form-row__hint">Gespeichert</span>
        )}
        <GlassButton
          variant="primary"
          onClick={save}
          disabled={!dirty || update.isPending || blockedSelfDemote}
        >
          <Save size={14} />
          {update.isPending ? "Speichere…" : "Speichern"}
        </GlassButton>
      </div>
    </Section>
  );
}

interface RoleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function RoleOption({ label, description, checked, onChange, disabled }: RoleOptionProps) {
  return (
    <label className={`role-option ${checked ? "role-option--checked" : ""}`}>
      <input
        type="radio"
        name="role"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div>
        <div className="role-option__label">{label}</div>
        <div className="role-option__desc">{description}</div>
      </div>
    </label>
  );
}

function DangerSection({ user, isSelf }: SectionProps) {
  const navigate = useNavigate();
  const deleteUser = useDeleteUser();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const ok = await confirm({
      title: `${user.display_name} löschen?`,
      description:
        "Das Konto wird endgültig entfernt. Diese Aktion kann nicht rückgängig gemacht werden.",
      destructive: true,
      confirmLabel: "Endgültig löschen",
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteUser.mutateAsync(user.id);
      navigate("/einstellungen/benutzer");
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <Section title="Gefahrenzone" variant="danger">
      <div className="user-detail-form-row">
        <div className="user-detail-danger-text">
          Das Konto und alle zugehörigen Daten werden unwiderruflich gelöscht.
        </div>
        <div className="user-detail-form-row__actions">
          <GlassButton
            variant="secondary"
            onClick={remove}
            disabled={isSelf || deleteUser.isPending}
            style={{
              background: "rgba(252,165,165,0.1)",
              borderColor: "rgba(252,165,165,0.35)",
              color: "var(--text-danger, #fca5a5)",
            }}
          >
            <Trash2 size={14} />
            {deleteUser.isPending ? "Lösche…" : "Konto löschen"}
          </GlassButton>
        </div>
      </div>
      {error && <div className="user-detail-form-row__error">{error}</div>}
    </Section>
  );
}

interface SectionWrapperProps {
  title: string;
  description?: string;
  variant?: "default" | "danger";
  children: React.ReactNode;
}

function Section({ title, description, variant = "default", children }: SectionWrapperProps) {
  return (
    <GlassCard
      className={`user-detail-section ${variant === "danger" ? "user-detail-section--danger" : ""}`}
    >
      <div className="user-detail-section__head">
        <h2 className="user-detail-section__title">{title}</h2>
        {description && <p className="user-detail-section__desc">{description}</p>}
      </div>
      <div className="user-detail-section__body">{children}</div>
    </GlassCard>
  );
}
