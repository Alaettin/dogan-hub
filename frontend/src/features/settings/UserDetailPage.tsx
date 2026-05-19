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

      <DisplayNameSection user={user} />
      <RoleSection user={user} isSelf={isSelf} />
      <EmailSection user={user} />
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

function DisplayNameSection({ user }: SectionProps) {
  const update = useUpdateUser();
  const [value, setValue] = useState(user.display_name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Sync wenn Liste neu geladen wird (z.B. nach Save)
  useEffect(() => {
    setValue(user.display_name);
  }, [user.display_name]);

  const dirty = value.trim() !== user.display_name && value.trim().length > 0;

  async function save() {
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({ id: user.id, display_name: value.trim() });
      setSaved(true);
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <Section title="Profil" description="Wie diese Person in der Plattform angezeigt wird.">
      <div className="user-detail-form-row">
        <GlassInput
          label="Anzeigename"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          maxLength={80}
          error={error ?? undefined}
        />
        <div className="user-detail-form-row__actions">
          {saved && !dirty && (
            <span className="user-detail-form-row__hint">Gespeichert</span>
          )}
          <GlassButton
            variant="primary"
            onClick={save}
            disabled={!dirty || update.isPending}
          >
            <Save size={14} />
            {update.isPending ? "Speichere…" : "Speichern"}
          </GlassButton>
        </div>
      </div>
    </Section>
  );
}

function RoleSection({ user, isSelf }: SectionProps) {
  const update = useUpdateUser();
  const [value, setValue] = useState<"admin" | "user">(user.role);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(user.role);
  }, [user.role]);

  const dirty = value !== user.role;
  // Self-Demote auf der Client-Seite blockieren (Server lehnt zusätzlich ab).
  const blockedSelfDemote = isSelf && value === "user";

  async function save() {
    setError(null);
    setSaved(false);
    if (blockedSelfDemote) {
      setError("Du kannst dich nicht selbst herabstufen");
      return;
    }
    try {
      await update.mutateAsync({ id: user.id, role: value });
      setSaved(true);
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <Section
      title="Rolle"
      description="Admins können alle Daten sehen, User nur ihre eigenen."
    >
      <div className="user-detail-radio-group" role="radiogroup" aria-label="Rolle">
        <RoleOption
          label="User"
          description="Standardrolle. Sieht eigene Daten."
          checked={value === "user"}
          onChange={() => setValue("user")}
          disabled={update.isPending}
        />
        <RoleOption
          label="Admin"
          description="Vollzugriff. Kann Benutzer verwalten."
          checked={value === "admin"}
          onChange={() => setValue("admin")}
          disabled={update.isPending}
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

function EmailSection({ user }: SectionProps) {
  const update = useUpdateUser();
  const initial = user.email ?? "";
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(user.email ?? "");
  }, [user.email]);

  const dirty = value.trim() !== initial && value.trim().length > 0;

  async function save() {
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({ id: user.id, email: value.trim() });
      setSaved(true);
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <Section
      title="Email"
      description="Die Email wird sofort aktualisiert. Supabase informiert die alte Adresse, sofern aktiviert."
    >
      <div className="user-detail-form-row">
        <GlassInput
          label="Email"
          type="email"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          error={error ?? undefined}
        />
        <div className="user-detail-form-row__actions">
          {saved && !dirty && (
            <span className="user-detail-form-row__hint">Gespeichert</span>
          )}
          <GlassButton
            variant="primary"
            onClick={save}
            disabled={!dirty || update.isPending}
          >
            <Save size={14} />
            {update.isPending ? "Speichere…" : "Speichern"}
          </GlassButton>
        </div>
      </div>
    </Section>
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
    <Section
      title="Gefahrenzone"
      description="Endgültige Aktionen. Bitte mit Bedacht."
      variant="danger"
    >
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
