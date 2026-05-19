import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Plus, Trash2, UserPlus } from "lucide-react";
import { GlassButton } from "../../components/ui/GlassButton";
import { GlassDialog } from "../../components/ui/GlassDialog";
import { GlassInput } from "../../components/ui/GlassInput";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useAuth } from "../auth/useAuth";
import {
  useAdminUsers,
  useDeleteUser,
  useInviteUser,
  type AdminUser,
} from "./useAdminUsers";
import { computeInitials, formatError } from "./utils";
import "./settings.css";

export function UserManagementPage() {
  const { profile } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const users = useAdminUsers();

  if (profile && profile.role !== "admin") {
    return <div className="settings-noaccess">Kein Zugriff. Nur Admins können Benutzer verwalten.</div>;
  }

  return (
    <>
      <header className="settings-content__header">
        <div>
          <h1 className="settings-content__title">Benutzerverwaltung</h1>
          <p className="settings-content__subtitle">
            Klicke einen Eintrag um Details zu bearbeiten oder lade neue Personen ein.
          </p>
        </div>
        <GlassButton variant="primary" onClick={() => setInviteOpen(true)}>
          <Plus size={14} />
          User einladen
        </GlassButton>
      </header>

      {users.isLoading && <div className="settings-empty">Lade Benutzer…</div>}

      {users.data && users.data.length === 0 && (
        <div className="settings-empty">Keine Benutzer vorhanden.</div>
      )}

      {users.data && users.data.length > 0 && (
        <div className="user-table">
          <div className="user-table__head">
            <div>Name</div>
            <div>Email</div>
            <div>Rolle</div>
            <div />
          </div>
          {users.data.map((u) => (
            <UserRow key={u.id} user={u} isSelf={profile?.id === u.id} />
          ))}
        </div>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

interface UserRowProps {
  user: AdminUser;
  isSelf: boolean;
}

function UserRow({ user, isSelf }: UserRowProps) {
  const navigate = useNavigate();
  const deleteUser = useDeleteUser();
  const confirm = useConfirm();

  const initials = computeInitials(user.display_name || user.email || "?");

  async function remove() {
    const ok = await confirm({
      title: `${user.display_name} löschen?`,
      description:
        "Das Konto wird endgültig entfernt. Diese Aktion kann nicht rückgängig gemacht werden.",
      destructive: true,
      confirmLabel: "Endgültig löschen",
    });
    if (!ok) return;
    try {
      await deleteUser.mutateAsync(user.id);
    } catch (err) {
      alert(formatError(err));
    }
  }

  return (
    <div
      className="user-table__row user-table__row--clickable"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/einstellungen/benutzer/${user.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/einstellungen/benutzer/${user.id}`);
        }
      }}
    >
      <div className="user-cell-user">
        <div className="user-avatar" aria-hidden>
          {user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials}
        </div>
        <div className="user-cell-name">
          <span className="user-cell-name__display">
            {user.display_name}
            {isSelf && <span className="user-cell-name__hint"> · Du</span>}
          </span>
        </div>
      </div>
      <div className="user-cell-email">{user.email ?? "—"}</div>
      <div>
        <span className={`role-badge role-badge--${user.role}`}>
          {user.role === "admin" ? "Admin" : "User"}
        </span>
      </div>
      <div
        className="user-row-menu"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Dropdown
          trigger={
            <GlassButton variant="ghost" aria-label="Benutzer-Aktionen">
              <MoreHorizontal size={14} />
            </GlassButton>
          }
        >
          <DropdownItem
            icon={<Trash2 size={14} />}
            label="Löschen"
            onClick={remove}
            danger
            disabled={isSelf || deleteUser.isPending}
          />
        </Dropdown>
      </div>
    </div>
  );
}

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invite = useInviteUser();

  function close() {
    setEmail("");
    setError(null);
    onOpenChange(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email ist erforderlich");
      return;
    }
    try {
      await invite.mutateAsync(trimmed);
      close();
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="User einladen"
      description="Wir schicken eine Magic-Link-Einladung an die Email-Adresse."
    >
      <form className="invite-form" onSubmit={submit}>
        <GlassInput
          label="Email"
          type="email"
          name="email"
          placeholder="name@beispiel.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        {error && <div className="invite-form__error">{error}</div>}
        <div className="invite-form__actions">
          <GlassButton type="button" variant="ghost" onClick={close} disabled={invite.isPending}>
            Abbrechen
          </GlassButton>
          <GlassButton type="submit" variant="primary" disabled={invite.isPending}>
            <UserPlus size={14} />
            {invite.isPending ? "Sende…" : "Einladen"}
          </GlassButton>
        </div>
      </form>
    </GlassDialog>
  );
}
