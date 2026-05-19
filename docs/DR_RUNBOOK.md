# DR-Runbook (Disaster Recovery)

**Wenn etwas kaputtgeht — hier nachschlagen, nicht raten.**

Dieser Runbook deckt die wahrscheinlichsten Crash-Szenarien für Dogan-Hub
ab und beschreibt Schritt-für-Schritt, was zu tun ist. Die Reihenfolge der
Szenarien geht von „wahrscheinlich" zu „schlimmster Fall".

---

## 0. Wo finde ich was?

| Was                  | Wo                                                            |
| -------------------- | ------------------------------------------------------------- |
| Supabase Dashboard   | https://supabase.com/dashboard → Projekt `ftcgffkxjtxwwmsbmcjz` |
| VPS-Konsole          | Hetzner Cloud Console (oder Provider deiner Wahl)             |
| Domain-Registrar     | wo `dogan-hub.de` registriert ist (Namecheap / IONOS / …)      |
| Code-Repository      | dieses Verzeichnis + ggf. GitHub-Remote                       |
| `.env`-Werte         | **lokal** + Password-Manager (Bitwarden o.ä.) — niemals in Git |
| Backup-Snapshots     | Hetzner → „Backups"-Tab am Server                              |
| Supabase-Backups     | Dashboard → Database → Backups                                |

**Wichtig:** Die Werte aus `.env` (Service-Role-Key, JWT-Secret etc.)
sollten zwingend in einem Password-Manager liegen. Ohne sie kannst du das
Backend nicht starten.

---

## Szenario 1 — Datenbank-Daten verloren / korrupt

**Symptome:** Eine Tabelle ist leer, falsche Daten drin, oder du hast aus
Versehen eine wichtige Row gelöscht.

### Variante A: Du weißt welcher Datensatz weg ist (kleiner Schaden)

1. Supabase Dashboard → Database → SQL Editor
2. Such-Query: `SELECT * FROM <table> WHERE id = '<known-id>'`
3. Wenn weg → siehe Variante B (PITR)

### Variante B: Point-in-Time Restore (PITR, nur Supabase Pro)

PITR erlaubt Restore zu einem **beliebigen Zeitpunkt** der letzten 7-30
Tage (je nach Plan).

1. Supabase Dashboard → Database → **Backups**
2. Tab „Point in Time"
3. Zielzeit wählen (vor dem Crash)
4. „Restore" klicken
5. ⚠️ **Achtung:** Restore überschreibt **die gesamte Datenbank**. Wenn nur
   eine einzelne Tabelle betroffen ist, lieber Variante C.

### Variante C: Selektiver Restore über Daily Backup

1. Supabase Dashboard → Database → Backups → Daily-Snapshot vor dem
   Crash herunterladen (SQL-Dump)
2. Dump auf lokale Postgres-Instanz spielen
3. Betroffene Rows aus lokaler Kopie selektieren + per `pg_dump --data-only
   --table <table>` exportieren
4. Manuell in Production einspielen via SQL Editor

### Verifikation nach Restore

```sql
-- Anzahl Rows pro kritischer Tabelle prüfen
select 'profiles' as t, count(*) from profiles
union all select 'databases', count(*) from databases
union all select 'entries', count(*) from entries
union all select 'files', count(*) from files where deleted_at is null
union all select 'folders', count(*) from folders;
```

---

## Szenario 2 — Storage-Files verloren

**Symptome:** Dateien werden in der UI angezeigt aber Download liefert 404.

**Realität:** Supabase Storage hat **kein automatisches Backup** im
Free/Pro-Plan. Du musst Storage-Backups selbst bauen wenn dir die Files
wichtig sind.

### Sofort-Reaktion

1. Supabase Dashboard → Storage → Bucket `doganhub-files` → prüfen ob die
   Datei dort existiert.
2. Wenn nicht: SQL-Editor → `SELECT * FROM files WHERE id = '<id>'` →
   `storage_path` notieren.
3. Wenn `storage_path` in DB aber File im Bucket fehlt → **das File ist
   weg**. Die DB-Row ist „dangling".

### Empfehlung für die Zukunft

Storage-Backup-Job einrichten:
- Wöchentlich `supabase storage download` Skript via Cron
- Sync zu externem S3-kompatiblem Storage (z.B. Backblaze B2, Hetzner
  Storage Box)
- Backup-Aufbewahrung: 30 Tage rolling

Solange kein Backup-Job läuft: **Storage-Verlust ist endgültig.**

---

## Szenario 3 — VPS down / Caddy-SSL-Problem

**Symptome:** App nicht erreichbar, `dogan-hub.de` lädt nicht oder liefert
„Connection refused".

### Schritt 1: Diagnose

```bash
# Vom lokalen Rechner
ping dogan-hub.de              # DNS + Erreichbarkeit
curl -I https://dogan-hub.de   # HTTP-Response

# Auf dem VPS (per SSH)
docker ps                       # laufen Container?
docker logs caddy --tail 50    # Caddy-Fehler?
docker logs backend --tail 50  # Backend-Fehler?
```

### Schritt 2: Häufige Ursachen

| Symptom                        | Ursache                          | Fix                                  |
| ------------------------------ | -------------------------------- | ------------------------------------ |
| `connection refused`           | Docker down                      | `docker compose up -d`               |
| SSL-Error (Browser-Warnung)    | ACME/Let's-Encrypt-Renewal kaputt | `docker compose restart caddy`       |
| 502 Bad Gateway                | Backend gecrasht                 | `docker logs backend` + restart      |
| App lädt aber leer             | Frontend-Build kaputt            | re-deploy: `docker compose build`    |
| DNS löst nicht auf             | Domain-Registrar-Problem         | Registrar-Dashboard prüfen           |

### Schritt 3: Hard-Reset (wenn Container kaputt)

```bash
cd /opt/dogan-hub  # oder wo das Repo liegt
docker compose down
docker compose pull          # neueste Images (wenn relevant)
docker compose up -d --build
docker compose logs -f --tail 100
```

---

## Szenario 4 — VPS komplett weg (Totalverlust)

**Symptome:** Provider-Konto gehackt, VPS gelöscht, Backup-Snapshot weg.

### Schritt 1: Neuen VPS provisionieren

1. Hetzner Cloud (oder anderer Provider) → CX22 oder besser, EU-Region
2. SSH-Key hinterlegen, root-Login per Passwort deaktivieren
3. Domain-A-Record auf neue IP setzen (kann bis zu 24h dauern, meist <1h)

### Schritt 2: OS-Hardening

```bash
# Als root nach erstem Login
apt update && apt upgrade -y
apt install -y ufw fail2ban docker.io docker-compose-plugin
ufw default deny incoming
ufw allow 22 80 443
ufw enable
systemctl enable fail2ban
```

### Schritt 3: Repo + Env zurückspielen

```bash
mkdir -p /opt/dogan-hub
cd /opt/dogan-hub
git clone <repo-url> .
# .env aus Password-Manager wiederherstellen
nano .env
docker compose up -d --build
```

### Schritt 4: Datenbank ist sicher

Die Daten leben in Supabase (separater Anbieter) — VPS-Verlust **betrifft
sie nicht**. Sobald das Backend läuft und mit den richtigen Supabase-
Credentials gestartet ist, hast du alle Daten zurück.

### Schritt 5: Storage ist im Risiko

Storage liegt auch bei Supabase. **Aber:** wenn du parallel ein Storage-
Backup pflegst (siehe Szenario 2), brauchst du dieses jetzt um etwaige
Lücken zu füllen.

---

## Szenario 5 — Supabase-Account weg / kompromittiert

**Symptome:** Login zum Supabase-Dashboard funktioniert nicht mehr oder
fremder Zugriff vermutet.

### Sofort-Reaktion

1. **Supabase-Support kontaktieren** (Pro-Plan hat Email-Support).
2. Alle Service-Role-Keys + JWT-Secrets rotieren:
   - Dashboard → Settings → API → Keys regenerieren
   - **Neue Keys** in `.env` eintragen
   - Backend neu starten (`docker compose restart backend`)
3. Audit-Log prüfen:
   ```sql
   select * from audit_log order by created_at desc limit 100;
   ```
   → ungewöhnliche Patterns suchen (viele Deletes, fremde IPs)

### Wenn Daten kompromittiert

1. PITR-Restore zum Zeitpunkt vor dem Vorfall (Szenario 1B)
2. Alle User-Sessions invalidieren (Dashboard → Auth → Users → einzeln
   sign-out)
3. Passwort-Reset für alle User erzwingen (Settings → Auth → Email-
   Template anpassen, dann bulk-revoke)

---

## Test-Restore (Pflichtübung halbjährlich)

**Warum:** Ein Backup das nie getestet wurde ist kein Backup.

### Vorgehen

1. Supabase-Projekt → „Branching" → neuen Branch `restore-test` erstellen
2. Daily-Backup vor 24h auf den Branch restore
3. Backend lokal gegen den Branch starten:
   ```bash
   SUPABASE_URL=<branch-url> npm run dev
   ```
4. Smoke-Test: Login, Dashboard, Datenbank öffnen, Datei herunterladen
5. Branch wieder löschen

**Ergebnis im Doc festhalten:** Datum, Dauer, ob alles funktioniert hat.

---

## Notfall-Kontakte / Links

- Supabase Status: https://status.supabase.com
- Hetzner Status: https://status.hetzner.com
- Domain-Renewal-Reminder im Kalender (Domains können ablaufen → Site weg)

## Letzter Test-Restore

| Datum | Restore-Source | Dauer | Ergebnis |
| ----- | -------------- | ----- | -------- |
| —     | —              | —     | —        |

