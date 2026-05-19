# Supabase Setup — Etappe 1

Diese Anleitung führt einmalig durch das Supabase-Projekt-Setup für MyHub. Dauert ca. 10 Minuten.

## 1. Account & Projekt anlegen

1. Auf https://supabase.com mit `alaettin87@gmail.com` registrieren (oder einloggen)
2. **New Project** klicken
3. Einstellungen:
   - **Name:** `myhub`
   - **Database Password:** starkes Passwort — **unbedingt im Passwort-Manager speichern**
   - **Region:** `Europe (Frankfurt) — eu-central-1` (Pflicht wegen DSGVO laut [PLAN.md §4d](../PLAN.md))
   - **Pricing Plan:** Free reicht für Etappe 1. Vor Go-Live auf Pro upgraden (PITR + 30-Tage-Backups)
4. **Create new project** klicken — Provisioning dauert 1-2 Minuten

## 2. API-Keys kopieren

Im Projekt: **Project Settings → API**

| Wert im Dashboard | Ziel in `.env` |
|---|---|
| `Project URL` | `SUPABASE_URL` **und** `VITE_SUPABASE_URL` |
| `anon` / `public` key | `SUPABASE_ANON_KEY` **und** `VITE_SUPABASE_ANON_KEY` |
| `service_role` / `secret` key | `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **nur Backend!** Niemals als `VITE_*` exposen! |

Zusätzlich unter **Project Settings → API → JWT Settings:**

| Wert | Ziel |
|---|---|
| `JWT Secret` | `SUPABASE_JWT_SECRET` |

## 3. `.env` befüllen

Im Projekt-Root:

```bash
cp .env.example .env
```

Dann `.env` öffnen und alle `xxxxxxxx`-Platzhalter mit den Werten aus Schritt 2 ersetzen.

`.env` ist in `.gitignore` und wird **niemals** committed.

## 4. Email-Auth & Signups konfigurieren

Im Dashboard:

1. **Authentication → Providers → Email:** aktiv lassen (Default)
2. **Authentication → Settings:**
   - **Enable email confirmations:** **AUS** (für MVP/Familie — Mails kommen erst in Etappe 5)
   - **Disable signups:** **AN** ⚠️ — nur Admin-Invites laut PLAN §4 Auth-Konzept
   - **Site URL:** `http://localhost:5173` (in Etappe 5 auf Production-Domain umstellen)
3. **Authentication → URL Configuration → Redirect URLs:** `http://localhost:5173/**` eintragen

## 5. Supabase CLI installieren

Empfohlen: als devDependency im Projekt — dann brauchst du keine globale Installation.

```bash
cd backend
npm install
```

Die CLI ist via Wrapper `sb.bat` im Projekt-Root erreichbar:

```powershell
.\sb --version
```

Alternativ Scoop (Windows) oder direktes Binary von github.com/supabase/cli/releases.

## 6. Projekt verlinken & Migrations pushen

⚠️ **Pflicht-Reihenfolge:** Migrations **vor** dem ersten User-Anlegen. Andernfalls fehlt der `handle_new_user`-Trigger und es wird kein `profiles`-Row erzeugt (manueller Backfill nötig).

Personal Access Token in PowerShell setzen (einmalig pro Session):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."   # aus supabase.com/dashboard/account/tokens
```

Dann im Projekt-Root:

```powershell
# Mit Cloud-Projekt verbinden — <ref> ist die Projekt-ID aus der URL
# (z.B. https://supabase.com/dashboard/project/abcdefghij → ref = abcdefghij)
.\sb link --project-ref <ref>

# Migrations einspielen
.\sb db push
```

Beim Link wirst du nach dem Database-Passwort aus Schritt 1 gefragt.

## 7. Ersten Admin-User anlegen

> Erst nach Schritt 6 ausführen — der Auto-Admin-Trigger muss in der DB sein.

Da Signups deaktiviert sind, muss der erste User manuell angelegt werden:

1. **Authentication → Users → Add user → Create new user**
2. **Email:** `alaettin87@gmail.com` (oder dein gewünschter Admin-Account)
3. **Password:** mind. 12 Zeichen
4. **Auto Confirm User:** **AN** (sonst kannst du dich nicht einloggen, solange Email-Confirmations konfiguriert sind)
5. **Create user** klicken

Der Trigger `handle_new_user()` aus `0001_init_profiles.sql` legt automatisch eine `profiles`-Row mit `role = 'admin'` an (weil erster User in leerer Tabelle).

> **Fallback bei "Profile not found":** Wenn der User vor den Migrations angelegt wurde, im Supabase SQL Editor diese Backfill-Query laufen lassen:
> ```sql
> insert into public.profiles (id, display_name, role)
> select u.id,
>        coalesce(nullif(u.raw_user_meta_data->>'display_name',''), split_part(u.email,'@',1)),
>        'admin'
> from auth.users u
> where not exists (select 1 from public.profiles p where p.id = u.id);
> ```

## 8. Verifikation

Im Supabase Dashboard:

- **Table Editor:** Tabellen `profiles` und `audit_log` existieren
- **Authentication → Policies:** RLS ist auf beiden Tabellen aktiv (grünes Schild-Icon)
- **Database → Triggers:** `on_auth_user_created` ist sichtbar (löst `handle_new_user()` aus)
- **profiles:** Dein in Schritt 7 angelegter User hat einen Eintrag mit `role = 'admin'`

Wenn alles passt: Etappe 1 kann lokal getestet werden — siehe [Hauptdokumentation README.md](../README.md).

## Häufige Probleme

- **`supabase db push` schlägt fehl mit "Auth required":** `supabase login` ausführen
- **Trigger feuert nicht beim manuellen User-Anlegen:** Reihenfolge prüfen — Migration **vor** User-Erstellung pushen. Workaround: User löschen, neu anlegen
- **`role` ist `user` statt `admin` beim ersten User:** Bedeutet `profiles` war beim Trigger nicht leer. Tabelle leeren (`DELETE FROM profiles;`), User in Auth löschen, neu anlegen
- **Frontend bekommt CORS-Error:** Site URL in Supabase Dashboard prüfen (Schritt 4)
