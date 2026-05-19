# Dogan-Hub — PLAN.md

> Persönliches Operationssystem als modulare Web-App.
> Stand: 2026-05-19 (rev. 4 — Name: Dogan-Hub) · Owner: Alaettin · Implementation: Claude Code

## Inhalt

1. Vision & Scope
2. Tech Stack
3. Architektur
4. Sicherheits-Konzept
4b. Backup, Recovery & Daten-Lifecycle
4c. E-Mail-Versand
4d. DSGVO & Rechtliche Compliance
4e. Health-Checks & Monitoring
4f. Testing-Strategie
4g. Performance-Budgets
4h. Error-States & Empty-States
4i. Deployment & Updates
5. Datenmodell (inkl. Daten-Modul-Funktionen)
6. Folder-Struktur
7. Design-System: "Glass"
8. Implementation Roadmap (Etappen 0-6 + Phase 2 Backlog)
9. Environment Variables
10. Docker Compose & Caddyfile
11. Akzeptanz-Kriterien MVP
12. Open Questions
13. Hinweise für Claude Code
14. Branding

---

## 1. Vision & Scope

Ein selbstgehosteter, modularer Hub auf einem VPS, der über die Zeit verschiedene persönliche Werkzeuge bündelt. Erstes Modul: **Daten-Modul** mit zwei eng verzahnten Subsystemen:
- **Datenbanken** (Notion-artig): strukturierte Datensätze mit user-definierten Schemas
- **Dateien** (Dropbox-artig): freier Ordner-/Datei-Browser für unstrukturierte Ablage

Beide teilen sich denselben Storage-Layer, dieselbe globale Suche und dieselbe Rechte-Logik. Dateien können optional an Datenbank-Einträge verknüpft werden (keine Kopie, sondern Reference).

Zweites Modul: **Einkaufsliste**. Architektur muss so generisch sein, dass weitere Module später ohne Refactoring andocken können.

**Nicht-Ziele MVP:** Mobile-Native-App, Offline-Sync, Sync-Clients, Versionierung, kommerzielle Mehrmandantenfähigkeit, öffentliche Anmeldung, WebDAV.

---

## 2. Tech Stack

| Layer | Wahl | Begründung |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Vertraut, schnell, ökosystemstark |
| Styling | TailwindCSS 3 + CSS-Variablen | Glass-System lebt von CSS-Variablen für Backdrop-Blur etc. |
| State | TanStack Query (Server) + Zustand (Client) | Klare Trennung Server- vs. UI-State |
| Routing | React Router 6 | Standard |
| Forms | React Hook Form + Zod | Type-Safe Validation |
| UI Primitives | Radix UI (headless) | Accessible, unstyled, Glass-anpassbar |
| Icons | Lucide React | Konsistent, modern |
| Animation | Framer Motion | Für Page-Transitions & Glass-Glow-Effekte |
| Backend | Node.js 20 + Express + TypeScript | Solide, deine Expertise |
| API-Stil | REST + Zod-validierte Schemas | Pragmatisch; GraphQL overkill für Single-User-Tier |
| Auth | Supabase Auth (JWT) | Multi-User-fähig, RLS-Integration |
| Database | Supabase Cloud (PostgreSQL 15) | Cloud erstmal, später migrierbar |
| File Storage | Supabase Storage | Im selben Ökosystem, RLS auf Buckets |
| Realtime | Supabase Realtime (optional, Phase 2+) | Live-Updates bei Multi-User |
| Container | Docker + Docker Compose | Frontend + Backend in separaten Containern |
| Reverse Proxy | Caddy 2 | Automatisches HTTPS via Let's Encrypt |
| Observability | Pino (structured logs) + Sentry (errors) | Production-tauglich, kein Overengineering |

---

## 3. Architektur

```
                   Browser
                      │
                      ▼
              ┌──────────────┐
              │   Caddy 2    │  ← TLS, HTTP/2, Compression, HSTS
              │  dogan-hub   │
              │     .de      │
              └──────┬───────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────┐         ┌──────────────────┐
│   Frontend    │         │    Backend       │
│  (Nginx +     │         │  (Node/Express)  │
│   static      │         │  Port 4000       │
│   build)      │         │                  │
│   Port 80     │         │                  │
└───────────────┘         └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Supabase Cloud  │
                          │  • Postgres      │
                          │  • Auth (JWT)    │
                          │  • Storage       │
                          │  • Realtime      │
                          └──────────────────┘
```

**Request-Flow:**
1. Browser → Caddy (HTTPS)
2. Caddy reverse-proxyt `/` → Frontend-Container, `/api/*` → Backend-Container
3. Frontend bekommt Supabase JWT durch Login (Supabase JS SDK direkt zum Auth-Server)
4. Frontend ruft Backend-API mit `Authorization: Bearer <jwt>`
5. Backend verifiziert JWT gegen Supabase Public Key, extrahiert `user_id`, `role`
6. Backend nutzt entweder Service Role Key (privilegierte Ops) oder den User-JWT (RLS-aware) für Supabase-Calls
7. RLS-Policies auf jeder Tabelle erzwingen `auth.uid() = owner_id`

**Warum Backend trotz Supabase?**
- Privilegierte Operationen (Admin-Endpoints, User-Invites)
- Aggregationen, die RLS nicht sauber abbilden kann (Dashboard-Stats über alle eigenen Daten)
- Externe Integrationen, Cronjobs (später)
- Sicherheits-Layer: kein Service Role Key im Browser
- File-Upload-Validation (Mime, Magic Bytes, Size) bevor's an Supabase Storage geht

---

## 4. Sicherheits-Konzept

> Sicherheit ist nicht optional. Jede Entscheidung wird gegen "Was passiert wenn das Internet das findet?" geprüft.

**Auth & Sessions:**
- Supabase Auth mit Email/Password
- JWT Short-Lived (1h) + Refresh-Token (30 Tage, rotating)
- Refresh-Token in `httpOnly` + `Secure` + `SameSite=Strict` Cookie (Supabase JS SDK kann das konfigurieren)
- Logout = Token-Revoke serverseitig
- Erster registrierter User wird automatisch `role: 'admin'` in `profiles`-Tabelle
- Weitere User nur per Admin-Invite (E-Mail mit signed Magic Link)
- Passwort-Policy: min. 12 Zeichen, zxcvbn-Score ≥ 3
- Brute-Force-Schutz: Rate-Limiting auf `/auth/*` Endpoints (5 Versuche / 15 Min / IP)

**Row Level Security (RLS):**
- RLS auf **jeder** Tabelle aktiviert — keine Ausnahmen
- Default-Policy: `auth.uid() = owner_id`
- Shared-Resources (z.B. geteilte Einkaufslisten später) über explizite `shares`-Tabelle

**Backend-Härtung:**
- Helmet (Security-Headers: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin)
- CORS: nur die eigene Domain whitelisten
- Rate-Limiting global (100 req/min/IP) + endpoint-spezifisch
- Request-Body-Limit: 10 MB (Datei-Uploads gehen direkt zu Supabase Storage via signed URL, nicht durchs Backend)
- Alle Inputs werden mit Zod validiert
- Prepared Statements / Parametrized Queries (Supabase Client macht das automatisch)
- Keine Stack-Traces in Responses (nur generische Error-Codes nach außen)
- Secrets: nur in `.env`, niemals im Code, niemals im Git
- `.env.example` ist im Repo, `.env` ist in `.gitignore`

**File-Upload-Sicherheit:**
- Whitelist erlaubter MIME-Types
- Magic-Bytes-Validation (file-type npm package), nicht nur Extension trust
- Max-Size pro Datei: 50 MB (konfigurierbar)
- Storage-Bucket-Policies: nur owner darf lesen/schreiben
- Signed URLs mit 1h TTL für Downloads
- ClamAV-Scan optional (Phase 3+ wenn Familie eigene Dateien hochlädt)

**Frontend-Härtung:**
- Strict CSP via Caddy-Header
- Keine `dangerouslySetInnerHTML` ohne sanitize (DOMPurify)
- Alle externen Links: `rel="noopener noreferrer"`
- Kein localStorage für sensitive Daten (JWT macht Supabase SDK ohnehin selbst sicher)

**TLS / Domain:**
- Caddy automatisches HTTPS via Let's Encrypt
- HSTS mit `includeSubDomains; preload`
- TLS 1.3, schwache Ciphers explizit deaktiviert
- A+ auf SSL Labs als Akzeptanzkriterium

**Logging & Audit:**
- Strukturierte JSON-Logs via Pino mit `pino-roll` für Rotation
- Rotation: täglich + bei >50 MB, Retention 30 Tage, danach hard-delete
- Audit-Log-Tabelle: jeder Schreibzugriff (CREATE/UPDATE/DELETE) auf User-Daten wird mit `user_id`, `action`, `resource`, `timestamp`, `ip_hash` geloggt
- Audit-Log Retention: 1 Jahr, dann monatlich aggregierter Roll-Up (counts pro action_type)
- Sentry für unbehandelte Errors (mit PII-Scrubbing über `beforeSend`-Hook)
- Logs werden in Docker-Volume persistiert
- Disk-Space-Alert: cronjob prüft Volume-Auslastung, Sentry-Event bei >80%

**Rate-Limiting im Detail:**
- Anonyme Requests (vor Auth): 30 req/min/IP
- Authentifizierte Requests: 200 req/min/user
- Auth-Endpoints (`/api/auth/*`): 5 req/15min/IP (Brute-Force-Schutz)
- File-Upload `/api/files/sign-upload`: 30 req/min/user + 1 GB/Stunde/user Bandwidth-Limit
- Echte Client-IP via `X-Forwarded-For` (Caddy setzt Header korrekt, Express vertraut Proxy via `app.set('trust proxy', 1)`)
- Rate-Limit-Hits werden als Sentry-Warning geloggt, im Audit-Log gespeichert
- Store: Redis optional ab Phase 2, MVP nutzt In-Memory mit `express-rate-limit`

**Content Security Policy (konkret):**
```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';                   -- pdf.js braucht WASM
style-src 'self' 'unsafe-inline';                       -- Glass-System nutzt inline styles
img-src 'self' data: blob: https://*.supabase.co;       -- Bilder aus Supabase Storage
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;  -- Supabase API + Realtime
worker-src 'self' blob:;                                -- pdf.js Worker
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```
Wird per Caddy als Header gesetzt, nicht via Meta-Tag. Test-Tool: csp-evaluator.withgoogle.com

---

## 4b. Backup, Recovery & Daten-Lifecycle

### 4b.1 Backup-Strategie

**MVP (Supabase Pro):**
- Supabase Daily Backups: 30 Tage automatisch
- Point-in-Time Recovery (PITR): 7 Tage Granularität
- Storage-Bucket-Snapshots: automatisch über Supabase, nicht in DB-Backups enthalten — separat zu sichern

**Restore-Test (Pflicht):**
- Quartalsweise: einen Test-Restore in eine Staging-DB durchführen
- Dokumentiert in `docs/DR_RUNBOOK.md` mit konkreten Befehlen
- Ergebnis als "✓ tested YYYY-MM-DD" in Repo committen

**Phase-2: Off-Site-Backups (Backlog):**
- Cronjob im Backend (täglich 03:00): `pg_dump` der Application-Tabellen + Storage-Inhalt
- Verschlüsselung mit `age` (asymmetrisch, Public-Key liegt im Container, Private-Key offline)
- Upload via rclone zu Hetzner Storage Box, Backblaze B2 oder S3
- Retention extern: 90 Tage, monatliche bleiben 1 Jahr
- Restore-Skript: `scripts/restore-from-offsite.sh`

### 4b.2 Disaster Recovery

**Ausfall-Szenarien & Reaktion:**

| Szenario | Recovery |
|---|---|
| Code-Bug zerstört User-Daten | PITR auf Zeitpunkt vor Bug, max. 5 Min Datenverlust |
| Versehentliches DROP/DELETE | PITR oder Daily Backup |
| VPS down | DNS auf Reserve-VPS umschwenken (Phase 2), oder ~30 Min Downtime fürs Re-Provisioning |
| Supabase-Region-Outage | Warten (Supabase Pro hat 99.9% SLA) |
| Supabase-Account kompromittiert | Phase-2 Off-Site-Backup einspielen auf neuem Account |
| Datei in Storage gelöscht | Soft-Delete-Trash (30 Tage), danach nur via Off-Site-Backup |

**Akzeptanz:** `docs/DR_RUNBOOK.md` existiert mit Step-by-Step für jedes Szenario.

### 4b.3 Daten-Lifecycle-Regeln

**User wird gelöscht:**
- Soft-Delete-Approach: `profiles.deleted_at` gesetzt, Login deaktiviert
- 30-Tage-Grace-Period (Recovery möglich, im Audit-Log dokumentiert)
- Danach: alle eigenen Daten kaskadiert hard-deleted (Datenbanken, Einträge, Files, Folders, Tags)
- Storage-Files via Cronjob purgen
- Audit-Log-Einträge des Users werden anonymisiert (`user_id` → NULL, Rest bleibt für Compliance)

**Datenbank wird archiviert:**
- `archived = true` → nicht in Hauptansicht, nicht in globaler Suche
- Bleibt zugänglich über "Archiv"-Sektion
- Einträge bleiben unverändert verfügbar

**Datenbank wird gelöscht:**
- Confirm-Dialog mit Name-Eingabe + Anzahl Einträge
- Cascade: alle Einträge weg, `entry_files`-References weg
- Files bleiben erhalten (sind ggf. in Ordnern oder an anderen Einträgen)

**Schema-Feld wird gelöscht:**
- Confirm-Dialog mit Anzahl Einträge die Werte für das Feld haben
- Werte werden in `data`-jsonb-Spalte hard-gelöscht (jsonb `-` Operator)
- Keine Schattenkopie — User wurde gewarnt

**Datei wird gelöscht (Trash):**
- Soft-Delete: `files.deleted_at = now()`, `folder_id` NULL
- Im Trash 30 Tage verfügbar via Restore
- Cronjob `trash-cleanup` (täglich 02:00): hard-delete WHERE deleted_at < now() - 30d
- Bei Hard-Delete: Storage-File via Supabase Storage API entfernen
- Wenn Datei noch `entry_files`-Reference hat → kein Soft-Delete möglich, User wird gewarnt ("Wird noch von X Eintrag verwendet")

**Eintrag wird gelöscht:**
- Hard-Delete (keine Trash-Funktion für Einträge im MVP — Phase 2)
- `entry_files`-References weg, Files bleiben

---

## 4c. E-Mail-Versand

**MVP-Strategie (Supabase Pro):**
- Supabase eingebauter Mailer für: Email-Verification, Password-Reset, Magic-Link-Invites
- Limit: 30 Mails/Stunde — reicht für Familie + Freunde
- Standard-Templates auf Deutsch anpassen über Supabase Dashboard

**Sender-Domain Setup (Pflicht, sonst landet alles im Spam):**
- Subdomain `mail.dogan-hub.de` einrichten
- SPF-Record: `v=spf1 include:_spf.supabase.co ~all`
- DKIM-Keys von Supabase Dashboard kopieren, TXT-Records setzen
- DMARC-Record: `v=DMARC1; p=quarantine; rua=mailto:postmaster@dogan-hub.de`
- Test: mail-tester.com (Ziel: 10/10)

**E-Mail-Templates (in Supabase Dashboard zu konfigurieren):**
- Welcome (nach erstem Login)
- Invite (von Admin verschickt, mit Magic-Link)
- Password-Reset
- Email-Change-Confirmation
- Alle auf Deutsch, im Glass-Design (HTML-Template mit Dark-Mode-fallback)

**Phase 2 Trigger zum Upgrade auf externen Provider:**
- Mehr als 30 Mails/Stunde nötig
- App-eigene Mails außerhalb Auth (Reminder-Modul, Reports)
- Empfehlung dann: Resend (EU-Region möglich, gute DX, ab 20€/Mo)
- Konfiguration: in Supabase Auth-Settings auf "Custom SMTP" umstellen

---

## 4d. DSGVO & Rechtliche Compliance

**Da Multi-User mit personenbezogenen Daten und über Internet erreichbar — auch nur für Familie — gelten DSGVO und TMG.**

**Pflicht zum Launch:**
- [ ] **Impressum** unter `/impressum` — gemäß TMG §5 (Name, Adresse, Kontakt, USt-ID falls vorhanden)
- [ ] **Datenschutzerklärung** unter `/datenschutz` — gemäß DSGVO Art. 13 (welche Daten, Zweck, Rechtsgrundlage, Speicherdauer, Rechte)
- [ ] **Auftragsverarbeitungsvertrag (AVV)** mit Supabase abschließen — Supabase bietet Standard-AVV im Dashboard zum Download/Signieren
- [ ] **Sub-Auftragsverarbeiter dokumentieren**: Supabase Cloud (Hosting in EU-Region wählen!), Sentry, ggf. künftige Provider
- [ ] EU-Region für Supabase-Projekt wählen (Frankfurt empfohlen)
- [ ] Sentry: EU-Region nutzen, PII-Scrubbing aktiv

**Cookie-Consent:**
- Auth-Cookies sind functional/strictly necessary → kein Consent-Banner pflicht
- Keine Tracking-Cookies, kein Analytics → bleibt so
- Falls Phase-2 Analytics dazukommt: dann Consent-Banner pflicht (Empfehlung: Plausible, das ist consent-frei DSGVO-konform)

**User-Rechte aus DSGVO umsetzen (Art. 15-22):**
- Auskunft (Art. 15): "Meine Daten exportieren"-Button → JSON+ZIP mit allem
- Berichtigung (Art. 16): durch normale Edit-Funktionen abgedeckt
- Löschung (Art. 17): "Mein Konto löschen"-Button in Settings → 30-Tage-Grace-Period + Hard-Delete
- Datenübertragbarkeit (Art. 20): Export in Standard-Format (JSON) deckt das ab
- Widerspruch: Nutzungsbedingungen-Akzeptanz beim ersten Login

**Akzeptanz:** Impressum + Datenschutzerklärung sind vor Go-Live live. Beide Dokumente von einer juristischen Vorlage abgeleitet (z.B. eRecht24, datenschutz-generator.de).

---

## 4e. Health-Checks & Monitoring

**Health-Endpoints:**
```
GET /api/health/live       → 200 wenn Prozess läuft
GET /api/health/ready      → 200 wenn DB-Connection + Storage erreichbar + JWT-Verify-Working
GET /api/health/deep       → 200 + Stats (DB-Latency, Storage-Latency, letzte Job-Run-Times)
```
`/live` und `/ready` müssen unter 100ms antworten. `/deep` ist Admin-only (Bearer Token im Header).

**Caddy Health-Checks:**
- Auf `frontend`: `/health.txt` static
- Auf `backend`: `/api/health/ready`
- Bei 3 Fehlversuchen: Caddy markiert Backend als down, returnt 503

**Uptime-Monitoring:**
- MVP: Uptime Kuma im selben Compose, eigene Subdomain `status.dogan-hub.de`
- Checks: Frontend (200), Backend `/api/health/ready` (200), Supabase REST (200)
- Notification via Telegram-Bot oder E-Mail bei Down >2 Min

**Sentry-Alerts:**
- Error-Rate >10/Stunde → Telegram
- Neue (noch nie gesehene) Exception → Telegram
- Performance: Backend-Response-P95 >2s → Telegram

**System-Monitoring:**
- VPS-Disk-Space-Alert bei >80% (cronjob → Telegram)
- VPS-Memory-Alert bei >90%
- Cronjob-Failures werden in `jobs_log`-Tabelle protokolliert und bei Fehler Sentry-Event

---

## 4f. Testing-Strategie

**Pflicht im MVP (kritische Pfade):**

**RLS-Policy-Tests (Pflicht — Sicherheits-kritisch):**
- Setup: zwei Test-User in Test-DB
- Pro Tabelle: User A erstellt Eintrag, User B versucht zu lesen/updaten/löschen → muss 0 Rows / 403 geben
- Tool: Supabase JS Client mit jeweiligen JWTs in `vitest`-Tests
- Run vor jedem Deploy als Pre-Push-Hook

**Auth-Flow-Tests (Pflicht):**
- Login mit korrekten Credentials → JWT
- Login mit falschen Credentials → 401
- Rate-Limit hits nach 5 Versuchen
- Token-Refresh funktioniert
- Logout invalidiert Token
- Tool: Playwright E2E

**File-Upload-Security-Tests (Pflicht):**
- Upload `.exe` mit Fake-PDF-MIME → muss scheitern (Magic Bytes)
- Upload Datei >50MB → muss scheitern
- Upload mit Path-Traversal (`../../etc/passwd`) → muss scheitern
- Download eines anderen Users' Datei → muss 403
- Tool: vitest mit supertest

**Phase 2 — Vollausbau:**
- Unit-Tests für Business-Logic (Schema-Migration-Rules, Search-Service)
- E2E-Tests für Happy-Paths jeder Etappe
- Visual Regression (Percy oder Chromatic) für Glass-Komponenten
- Load-Tests (k6) für File-Upload-Endpoints

---

## 4g. Performance-Budgets

**Frontend:**
- Initial JS-Bundle: <250 KB gzipped (Hard-Limit, Vite-Plugin `vite-plugin-bundle-analyzer` als Check)
- Largest Contentful Paint (LCP): <2.5s auf 3G-Throttling
- First Input Delay (FID): <100ms
- Cumulative Layout Shift (CLS): <0.1
- Tooling: Lighthouse CI in Phase 2

**Backend:**
- API-Response-P95: <300ms für CRUD-Endpoints
- File-Upload-Signing: <100ms
- Search-Endpoint-P95: <500ms

**Datenmengen-Annahmen:**
- Datenbank-Detail-View: bis 100 Einträge ohne Virtual Scrolling
- 100-1.000 Einträge: Pagination (50 pro Seite)
- >1.000 Einträge: Virtual Scrolling via `@tanstack/react-virtual`
- File-Browser: ab 200 Einträgen pro Ordner Virtual Scrolling

**Storage:**
- Pro User Soft-Limit MVP: 5 GB
- Hard-Limit: 10 GB (Upload returnt 413)
- Warning ab 80% mit Banner im Dashboard

---

## 4h. Error-States & Empty-States (Design-System-Anforderung)

**Pflicht-Zustände pro datenführender Komponente:**

| Zustand | Anforderung |
|---|---|
| Loading | Glass-Skeleton mit subtle Shimmer (kein Spinner-only) |
| Empty (initial) | Illustration/Icon + Call-to-Action ("Lege deine erste Datenbank an") |
| Empty (gefiltert) | Andere Meldung ("Keine Treffer — Filter zurücksetzen") mit Reset-Button |
| Error (Netzwerk) | "Verbindung verloren — Erneut versuchen"-Button |
| Error (403/401) | "Du hast keinen Zugriff" + Logout-Option |
| Error (500) | "Etwas ist schiefgelaufen" + Error-ID für Support + Sentry-Event |
| Offline (Phase 3) | Banner "Du bist offline — letzte gespeicherte Daten" |

**Akzeptanz:** Jede Liste/Detail-Komponente implementiert alle relevanten Zustände. Storybook-artiger Playground in `/dev/states` zeigt alle States nebeneinander.

---

## 4i. Deployment & Updates

**Initiales Deployment:**
- Manuell via SSH + `docker compose up -d` auf VPS
- Konfig in `.env` auf Server (nie im Repo)
- Caddy übernimmt TLS automatisch nach DNS-Setup

**Updates (MVP-Workflow):**
1. Lokal entwickeln, mergen in `main`
2. Auf VPS: `git pull && docker compose build && docker compose up -d`
3. Migrations: vor `up -d` separat per Supabase CLI ausführen
4. Downtime: ~10-30 Sekunden während Container-Restart (akzeptabel für Single-User-Familie)

**Zero-Downtime-Updates (Phase 2):**
- Blue-Green über Caddy mit zwei Backend-Containern
- Migration-Strategy: nur additive Changes ohne Restart-Notwendigkeit, breaking Changes als 2-Step (1. Code akzeptiert beides, 2. Daten migriert, 3. Code nur noch neue Variante)

**Rollback-Strategie:**
- Git-Tag pro Release (`v1.0.0`, `v1.0.1`)
- Rollback: `git checkout v1.0.0 && docker compose build && up -d`
- DB-Migrations: forward-only, kritische Rollbacks via PITR

---

## 5. Datenmodell

### 5.0 Daten-Modul: Funktionen & Workflows

Das Daten-Modul besteht aus zwei eng integrierten Subsystemen mit gemeinsamer Storage- und Suche-Basis.

#### 5.0.1 Subsystem A: Datenbanken (strukturiert)

**Drei Grundbausteine:**
- **Datenbank** = Container für einen Lebensbereich (z.B. "Autos", "Verträge", "Bücher")
- **Schema** = die Felder einer Datenbank, vom User selbst definiert
- **Eintrag** = ein konkreter Datensatz in einer Datenbank, optional mit verknüpften Dateien

**Datenbanken verwalten:**
- Anlegen mit Name, Icon (Lucide), Farbe (für Glass-Accent), Beschreibung
- Aus Template starten (vordefinierte Schemas: Autos, Verträge, Bücher, Belege, Abos, Passwörter, Geräte/Garantien)
- Duplizieren (Schema kopieren, ohne Einträge)
- Archivieren (verschwindet aus Hauptansicht, Daten bleiben)
- Löschen mit Confirm-Dialog ("Tippe Namen ein")
- Reihenfolge in Sidebar per Drag & Drop

**Schema-Editor (Field-Types MVP):**

| Typ | Beispiel | Speicherung |
|---|---|---|
| `text` | "Toyota Corolla" | string |
| `longtext` | Notizen mit Markdown | string |
| `number` | 87.420 | number |
| `currency` | 18.500 € | { amount, currency } |
| `date` | 15.09.2026 | ISO-Datum |
| `datetime` | 31.12.2026 23:59 | ISO-Datetime |
| `boolean` | aktiv/inaktiv | bool |
| `select` | Status: Aktiv/Gekündigt | string + options |
| `multiselect` | Kategorien | array + options |
| `url` | Versicherungs-Login | validated string |
| `email` | Ansprechpartner | validated string |
| `phone` | Werkstatt-Nummer | string |
| `rating` | 0–5 Sterne | int |

**Phase 2 Field-Types:** `relation` (FK zu anderer DB), `formula` (computed wie "Tage bis TÜV").

**Feld-Eigenschaften:** Required, Default-Wert, Beschreibung/Tooltip, In Tabellen-View sichtbar, Sortier-Position im Form.

**Schema-Migration-Regeln:**
- Feld hinzufügen → vorhandene Einträge bekommen `null` → OK
- Feld umbenennen → nur Label ändert sich, `key` bleibt stabil
- Feld-Typ ändern → nur kompatible Konvertierungen (text↔longtext, number→text), sonst mit Warnung
- Feld löschen → Confirm-Dialog mit Anzahl betroffener Einträge

**Einträge bearbeiten:**
- Form wird dynamisch aus Schema generiert (keine Custom-Form pro DB nötig)
- Inline-Edit in Tabellen-View (Klick auf Zelle → editierbar wie Airtable)
- Detail-View mit allen Feldern + verknüpften Dateien + Aktivitäts-Historie
- Quick-Add (nur required Fields)
- Duplizieren (alle Werte kopieren)
- Bulk-Operationen: Selektieren → löschen, taggen, exportieren

**Ansichten pro Datenbank (speicherbar):**
- **Tabelle** (Default): sortier-/filterbar, inline editierbar
- **Karten**: Galerie-Style, Card pro Eintrag
- **Liste**: kompakt, mobile-tauglich
- **Kalender** *(Phase 2)*: für DBs mit Date-Feld
- **Kanban** *(Phase 2)*: für DBs mit Select-Feld

Jede View speichert: sichtbare Spalten, Filter (mit AND/OR), Sortierung, Gruppierung.

#### 5.0.2 Subsystem B: Dateien (Dropbox-artig, Stufe 1)

**Funktionen:**
- Ordner anlegen, umbenennen, verschieben, löschen
- Datei-Upload via Drag & Drop (einzeln, multi, ganze Ordner via HTML5 directory upload)
- Erlaubte Typen: PDF, Bilder (JPG/PNG/WebP/HEIC), Office (docx/xlsx/pptx), Text, CSV/JSON, ZIP
- Max. Größe: 50 MB pro Datei (in `.env` konfigurierbar)
- Vorschau: PDF inline (pdf.js), Bilder inline mit Lightbox, andere als Icon + Download
- Datei-Aktionen: Download, Umbenennen, Verschieben (Move-Dialog mit Ordner-Tree), Löschen, "Mit Eintrag verknüpfen"
- Sortierung: Name, Größe, Datum, Typ — auf-/absteigend
- Ansichten: Liste, Kacheln (mit Thumbnail-Generation für Bilder)
- Storage-Quota-Anzeige im Dashboard ("2,4 GB von 10 GB")
- **Trash**: 30-Tage Soft-Delete mit Restore-Möglichkeit, danach hard-delete via Cronjob
- Tags an Dateien anbringbar (gleicher Tag-Pool wie für Einträge)

**Phase-2-Backlog (bewusst rausgehalten):** Versionierung, Public-Share-Links mit Token/Passwort/TTL, WebDAV-Endpoint, Sync-Clients, Conflict-Resolution, OCR/Text-Extraction, ClamAV-Scan.

#### 5.0.3 Integration der beiden Subsysteme

- **Eine Datei = eine `files`-Row.** Keine Duplikate, keine doppelten Storage-Pfade.
- Eine Datei kann in einem Ordner liegen UND/ODER an mehrere Einträge verknüpft sein.
- "Datei an Eintrag verknüpfen" → öffnet File-Picker, der den File-Browser zeigt; wählt eine bestehende Datei oder uploaded eine neue
- "Datei aus Eintrag entfernen" → löscht nur die `entry_files`-Reference, nicht die Datei selbst
- Beim Upload aus dem Eintrag-Kontext heraus: User entscheidet, ob die Datei zusätzlich in einem Ordner abgelegt wird (Default: nur am Eintrag)

#### 5.0.4 Suche

**Globale Suche (⌘K):**
- Postgres Full-Text-Search mit `tsvector`, deutsche Sprachkonfiguration (Stemming)
- Durchsucht: Datenbank-Namen, Eintrag-Inhalte (alle Text-Felder), Dateinamen, Ordner-Pfade, Tags
- Ergebnis-Gruppierung: "Toyota" → 3 Einträge in Autos / 1 Datei `Toyota_Werkstatt.pdf` / Tag "Toyota"
- Keyboard-Navigation, Enter springt zum Resultat

**Lokale Suche:** Suchfeld in jeder DB-View und im File-Browser, live-filtert während Eingabe.

**Filter-Builder (Datenbanken):**
- Pro Feld: `equals`, `contains`, `startsWith`, `isEmpty`, `isNotEmpty`, `lessThan`, `greaterThan`, `before`, `after`, `inLast`, `inNext` (Zeiträume)
- AND/OR Verknüpfung
- Als Teil einer View speicherbar

#### 5.0.5 Tags (cross-cutting)

- User-weit, nicht pro Datenbank
- Tag = Name + Farbe
- Anwendbar auf Einträge UND Dateien
- Tag-Cloud-Übersichtsseite: Klick auf Tag zeigt alle getaggten Einträge + Dateien zusammen
- Use-Case: Tag "Steuer 2026" auf Belege (Datei) + Rechnungs-Einträge (DB) + Einkommensnachweise (Datei) gleichzeitig

#### 5.0.6 Import / Export

**Export:**
- Pro Datenbank: CSV, JSON, oder Excel
- Mit oder ohne verknüpfte Dateien (mit = ZIP mit JSON + `files/`-Ordner)
- Kompletter Backup-Export: alle DBs + alle Dateien + Tags als ZIP

**Import:**
- CSV-Import mit Schema-Mapping (UI: "Spalte A → Feld Marke")
- JSON-Import bei matchendem Schema
- Datei-Upload via Drag & Drop ganzer Ordner-Bäume

#### 5.0.7 Audit & Aktivität

- Jeder Write (CREATE/UPDATE/DELETE) auf Datenbanken, Einträge, Dateien, Ordner, Tags → `audit_log`-Row
- Detail-View jedes Eintrags/jeder Datei hat "Aktivität"-Sektion
- Feld-Diff bei Updates: "Marke geändert von 'Toyota' auf 'VW'"
- *(Phase 2)*: Undo / Restore zu früherer Version

#### 5.0.8 UI-Struktur des Daten-Moduls

```
Sidebar
├── 📊 Dashboard
├── 📦 Daten
│   ├── Datenbanken
│   │   ├── 🚗 Autos
│   │   ├── 📄 Verträge
│   │   ├── 📚 Bücher
│   │   └── + Neue Datenbank
│   └── 📁 Dateien
│       ├── Steuer/
│       ├── Familie/
│       ├── Privat/
│       └── + Neuer Ordner
├── 🏷️  Tags
└── ⚙️  Einstellungen
```

#### 5.0.9 Repräsentative Workflows

**A. Neues Auto kaufen:**
1. ⌘K → "Autos" → Enter
2. Falls DB noch nicht existiert: "Neue Datenbank → Aus Template: Autos"
3. "+ Neuer Eintrag" → Form ausfüllen
4. Fahrzeugschein-PDF, Kaufvertrag, 2 Fotos in Anhang-Sektion droppen
5. Save → erscheint in Tabelle, Aktivität geloggt

**B. Schnelles Beleg-Foto (Mobile):**
1. Hub als PWA öffnen
2. Sidebar → Dateien → Belege/2026
3. Kamera-Button → Foto → automatischer Upload
4. Kein Schema, kein Formular. Optional später strukturieren in DB "Belege" + Verknüpfung.

**C. Steuer 2026 vorbereiten:**
1. Tag "Steuer 2026" anlegen (rot)
2. Übers Jahr: jede relevante Datei + jeden relevanten Eintrag taggen
3. April: Klick auf Tag → Gesamt-Übersicht aus allen Quellen
4. Export → ZIP → an Steuerberater

**D. Schneller Lookup:**
1. ⌘K → "TÜV"
2. Findet Eintrag "Toyota Corolla" (Feld-Match) UND Datei "TÜV_Bericht_2024.pdf"
3. Klick → PDF inline → fertig
4. Time-to-Document: < 5 Sekunden

#### 5.0.10 Bewusst NICHT im Scope

- Kein Block-Editor wie Notion (longtext mit Markdown statt Blocks)
- Keine Relationen im MVP (Phase 2)
- Keine Automation/Reminder im MVP (Reminder-Modul Phase 3)
- Keine Versionierung im MVP (Files werden überschrieben)
- Keine Sync-Clients, kein WebDAV, kein Offline-Mode
- Kein E-Mail-Client, keine Cloud-Drive-Native-Integration

---

### 5.1 Auth & User
```sql
-- Supabase legt auth.users automatisch an
-- Wir erweitern um ein profiles-Schema:

profiles (
  id              uuid PK FK auth.users.id ON DELETE CASCADE
  display_name    text NOT NULL
  avatar_url      text
  role            text NOT NULL DEFAULT 'user' -- 'admin' | 'user'
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)

audit_log (
  id              bigserial PK
  user_id         uuid FK profiles.id
  action          text NOT NULL  -- 'create' | 'update' | 'delete' | 'login' | 'logout'
  resource_type   text NOT NULL  -- 'document' | 'database' | 'entry' | ...
  resource_id    text
  metadata       jsonb
  ip_hash        text
  created_at     timestamptz DEFAULT now()
)
```

### 5.2 Daten-Modul — Datenbanken + Dateien (geteilte Storage-Basis)

**Konzept:** Zwei Subsysteme über denselben Storage:
- **Datenbanken**: strukturierte Einträge mit user-definiertem Schema
- **Dateien**: freier Ordner-Browser mit standalone-Dateien

Dateien (`files`) sind die zentrale Storage-Entität. Sie können entweder in Ordnern liegen (Dropbox-Modus) ODER an Datenbank-Einträge verknüpft sein (Anhang-Modus) ODER beides gleichzeitig. Eine Datei wird **nicht** dupliziert, wenn sie an einen Eintrag gehängt wird — es gibt nur eine Reference.

```sql
-- ─── Datenbanken-Subsystem ─────────────────────────

databases (
  id              uuid PK DEFAULT gen_random_uuid()
  owner_id        uuid FK profiles.id NOT NULL
  name            text NOT NULL          -- "Autos", "Verträge"
  icon            text                    -- Lucide icon name
  color           text                    -- z.B. "indigo" für Glass-Accent
  description     text
  schema          jsonb NOT NULL          -- Field-Definitionen (siehe unten)
  position        integer NOT NULL DEFAULT 0
  archived        boolean DEFAULT false
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)

-- schema-jsonb Beispiel:
-- [
--   {"id": "f1", "key": "marke", "label": "Marke", "type": "text", "required": true},
--   {"id": "f2", "key": "tuev", "label": "TÜV bis", "type": "date"},
--   {"id": "f3", "key": "tags", "label": "Tags", "type": "multiselect", "options": [...]}
-- ]
-- Field-Types MVP: text | longtext | number | currency | date | datetime
--                  | boolean | select | multiselect | url | email | phone | rating
-- Field-Types Phase 2: relation | formula

entries (
  id              uuid PK DEFAULT gen_random_uuid()
  database_id     uuid FK databases.id ON DELETE CASCADE
  owner_id        uuid FK profiles.id NOT NULL
  data            jsonb NOT NULL          -- {"marke": "VW", "tuev": "2026-09-15", ...}
  search_vector   tsvector GENERATED ALWAYS AS (...) STORED  -- Volltextsuche
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)

-- Gespeicherte Views pro Datenbank (Tabelle/Karten/Liste mit Filtern/Sort)
database_views (
  id              uuid PK DEFAULT gen_random_uuid()
  database_id     uuid FK databases.id ON DELETE CASCADE
  owner_id        uuid FK profiles.id NOT NULL
  name            text NOT NULL          -- "TÜV bald fällig"
  view_type       text NOT NULL          -- 'table' | 'cards' | 'list'
  config          jsonb NOT NULL         -- { columns, filters, sort, groupBy }
  is_default      boolean DEFAULT false
  created_at      timestamptz DEFAULT now()
)

-- ─── Dateien-Subsystem ─────────────────────────────

folders (
  id              uuid PK DEFAULT gen_random_uuid()
  owner_id        uuid FK profiles.id NOT NULL
  parent_id       uuid FK folders.id ON DELETE CASCADE NULL  -- NULL = root
  name            text NOT NULL
  path            text NOT NULL                              -- denormalisiert: "/Steuer/2026"
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
  UNIQUE (owner_id, parent_id, name)                         -- keine Duplikate im selben Parent
)

files (
  id              uuid PK DEFAULT gen_random_uuid()
  owner_id        uuid FK profiles.id NOT NULL
  folder_id       uuid FK folders.id ON DELETE SET NULL NULL -- NULL = root oder reine Eintrag-Anhang-Datei
  name            text NOT NULL                              -- "Fahrzeugschein.pdf"
  storage_path    text NOT NULL UNIQUE                       -- Supabase Storage Key
  mime_type       text NOT NULL
  size_bytes      bigint NOT NULL
  checksum_sha256 text                                       -- für Dedup-Detection (Phase 2)
  deleted_at      timestamptz NULL                           -- soft delete für Trash (30 Tage)
  search_vector   tsvector GENERATED ALWAYS AS
                  (to_tsvector('german', name)) STORED
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)

-- Verknüpfung: eine Datei kann an mehrere Einträge gehängt sein
entry_files (
  entry_id        uuid FK entries.id ON DELETE CASCADE
  file_id         uuid FK files.id ON DELETE CASCADE
  attached_at     timestamptz DEFAULT now()
  PRIMARY KEY (entry_id, file_id)
)

-- ─── Tags (global, gelten für Einträge UND Dateien) ─

tags (
  id              uuid PK DEFAULT gen_random_uuid()
  owner_id        uuid FK profiles.id NOT NULL
  name            text NOT NULL
  color           text
  UNIQUE (owner_id, name)
)

entry_tags (
  entry_id        uuid FK entries.id ON DELETE CASCADE
  tag_id          uuid FK tags.id ON DELETE CASCADE
  PRIMARY KEY (entry_id, tag_id)
)

file_tags (
  file_id         uuid FK files.id ON DELETE CASCADE
  tag_id          uuid FK tags.id ON DELETE CASCADE
  PRIMARY KEY (file_id, tag_id)
)
```

**Storage-Path-Konvention im Supabase Bucket `doganhub-files`:**
```
{owner_id}/{file_id}/{original_filename}
```
Vorteile: RLS-Policy `auth.uid()::text = (storage.foldername(name))[1]` ist trivial, Dateinamen bleiben menschenlesbar, file_id macht jede Datei unique selbst bei Namenskollisionen.

**Wichtig zum Lifecycle:**
- Wird ein `entry` gelöscht: `entry_files`-Reference fliegt raus, aber `files` bleiben (sind ja vielleicht im Dropbox-Bereich)
- Wird ein `folder` gelöscht: Files darin werden auf `folder_id = NULL` gesetzt UND als deleted markiert, falls keine `entry_files`-Reference existiert
- Trash-Cleanup-Cronjob: hard-delete für `files WHERE deleted_at < now() - interval '30 days'`

### 5.3 Einkaufsliste (Modul 2)

```sql
shopping_lists (
  id              uuid PK DEFAULT gen_random_uuid()
  owner_id        uuid FK profiles.id NOT NULL
  name            text NOT NULL DEFAULT 'Einkaufsliste'
  created_at      timestamptz DEFAULT now()
)

shopping_items (
  id              uuid PK DEFAULT gen_random_uuid()
  list_id         uuid FK shopping_lists.id ON DELETE CASCADE
  owner_id        uuid FK profiles.id NOT NULL
  name            text NOT NULL
  quantity        text                    -- "2 Packungen", "500g" – freitext
  category        text                    -- "Obst", "Drogerie", ...
  checked         boolean DEFAULT false
  position        integer NOT NULL        -- für Reihenfolge
  created_at      timestamptz DEFAULT now()
  checked_at      timestamptz
)

-- Phase 2+: shopping_list_shares für Familien-Sharing
```

---

## 6. Folder-Struktur

```
dogan-hub/
├── docker-compose.yml
├── Caddyfile
├── .env.example
├── .gitignore
├── README.md
├── PLAN.md
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── router.tsx
│       ├── lib/
│       │   ├── supabase.ts          # Supabase Client
│       │   ├── api.ts               # Fetch-Wrapper mit Auth
│       │   ├── query-client.ts      # TanStack Query Config
│       │   └── utils.ts
│       ├── design/
│       │   ├── tokens.css           # CSS-Variablen (Glass-System)
│       │   ├── glass.tsx            # GlassCard, GlassPanel, GlassButton
│       │   └── motion.ts            # Framer Motion Presets
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx     # Sidebar + Main
│       │   │   ├── Sidebar.tsx
│       │   │   ├── CommandPalette.tsx (⌘K)
│       │   │   └── TopBar.tsx
│       │   ├── ui/                  # Radix + Glass-Wrappers
│       │   │   ├── Dialog.tsx
│       │   │   ├── Dropdown.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Button.tsx
│       │   │   └── ...
│       │   └── shared/
│       │       ├── EmptyState.tsx
│       │       ├── LoadingSpinner.tsx
│       │       └── ErrorBoundary.tsx
│       ├── features/
│       │   ├── auth/
│       │   │   ├── LoginPage.tsx
│       │   │   ├── useAuth.ts
│       │   │   └── ProtectedRoute.tsx
│       │   ├── dashboard/
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── StatsCards.tsx
│       │   │   └── RecentActivity.tsx
│       │   ├── data/
│       │   │   ├── databases/
│       │   │   │   ├── DatabaseListPage.tsx
│       │   │   │   ├── DatabaseDetailPage.tsx
│       │   │   │   ├── DatabaseEditor.tsx       # Schema-Editor
│       │   │   │   ├── EntryFormDialog.tsx
│       │   │   │   ├── EntryTable.tsx
│       │   │   │   ├── EntryCardGrid.tsx
│       │   │   │   └── ViewSwitcher.tsx
│       │   │   ├── files/
│       │   │   │   ├── FileBrowserPage.tsx
│       │   │   │   ├── FolderTree.tsx
│       │   │   │   ├── FileListView.tsx
│       │   │   │   ├── FileGridView.tsx
│       │   │   │   ├── FilePreview.tsx          # PDF, Image inline
│       │   │   │   ├── MoveDialog.tsx
│       │   │   │   └── TrashPage.tsx
│       │   │   ├── shared/
│       │   │   │   ├── FileUploader.tsx         # DnD, multi, dir-upload
│       │   │   │   ├── FilePicker.tsx           # für Eintrag-Verknüpfung
│       │   │   │   └── TagPicker.tsx
│       │   │   └── hooks/
│       │   ├── tags/
│       │   │   └── TagsPage.tsx
│       │   ├── shopping/
│       │   │   └── (Phase 2)
│       │   └── admin/
│       │       ├── UserManagementPage.tsx
│       │       └── AuditLogPage.tsx
│       └── types/
│           └── domain.ts             # Domain-Types
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # Entry, Express-Setup
│       ├── config/
│       │   ├── env.ts               # Zod-validierte env
│       │   └── supabase.ts
│       ├── middleware/
│       │   ├── auth.ts              # JWT-Verify
│       │   ├── error-handler.ts
│       │   ├── rate-limit.ts
│       │   └── audit.ts             # Audit-Logging
│       ├── routes/
│       │   ├── health.ts
│       │   ├── auth.ts              # /me, /invite, /logout
│       │   ├── databases.ts         # CRUD Datenbanken + Schema
│       │   ├── entries.ts           # CRUD Einträge + Suche
│       │   ├── folders.ts           # Ordner CRUD + Move
│       │   ├── files.ts             # Files: list, rename, move, delete, sign-upload, sign-download, trash, restore
│       │   ├── entry-files.ts       # Verknüpfung Eintrag ↔ Datei
│       │   ├── tags.ts              # Tag-CRUD + Filter
│       │   ├── search.ts            # Globale Suche
│       │   ├── shopping.ts          # Phase 2
│       │   └── admin.ts
│       ├── services/
│       │   ├── audit.service.ts
│       │   ├── file.service.ts      # MIME + Magic-Bytes Validation
│       │   ├── storage.service.ts   # Supabase Storage Wrapper
│       │   ├── thumbnail.service.ts # Thumbnails für Bilder
│       │   └── search.service.ts
│       ├── jobs/
│       │   └── trash-cleanup.ts     # Cronjob: hard-delete > 30 Tage
│       ├── schemas/                 # Zod-Schemas
│       │   ├── database.schema.ts
│       │   ├── entry.schema.ts
│       │   ├── folder.schema.ts
│       │   ├── file.schema.ts
│       │   └── ...
│       └── lib/
│           ├── logger.ts            # Pino
│           └── errors.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init_profiles.sql
│   │   ├── 0002_init_audit.sql
│   │   ├── 0003_init_databases.sql       # databases, entries, database_views
│   │   ├── 0004_init_files.sql           # folders, files, entry_files
│   │   ├── 0005_init_tags.sql            # tags, entry_tags, file_tags
│   │   ├── 0006_rls_policies.sql         # alle RLS-Policies
│   │   ├── 0007_storage_bucket.sql       # doganhub-files Bucket + Policies
│   │   └── 0008_init_shopping.sql
│   └── seed.sql                     # DB-Templates (Autos, Verträge, ...)
│
└── docs/
    ├── DEPLOYMENT.md
    ├── DESIGN_SYSTEM.md
    └── SECURITY.md
```

---

## 7. Design-System: "Glass" (verbindlich)

### 7.1 Designprinzipien

- **Tiefe durch Layering, nicht durch Schatten.** Glass-Surfaces stapeln sich vor einem animierten Mesh-Hintergrund.
- **Bewegung ist subtil, nie performativ.** Mesh-Animation langsam (60-90s Cycle), Hover-States < 200ms.
- **Lesbarkeit schlägt Coolness.** Kontrast WCAG AA überall.
- **Konsistenz vor Variation.** Alle Cards haben dasselbe Glass-Rezept.

### 7.2 Design-Tokens (CSS-Variablen)

```css
:root {
  /* Backgrounds */
  --bg-base-start: #0a0118;
  --bg-base-mid:   #1e1b4b;
  --bg-base-end:   #2d1b69;
  --bg-mesh-orb-1: rgba(129, 140, 248, 0.35);  /* indigo-400 */
  --bg-mesh-orb-2: rgba(34, 211, 238, 0.25);   /* cyan-400 */
  --bg-mesh-orb-3: rgba(168, 85, 247, 0.20);   /* purple-500 */

  /* Glass Surfaces */
  --glass-bg-1:    rgba(255, 255, 255, 0.04);
  --glass-bg-2:    rgba(255, 255, 255, 0.07);
  --glass-bg-accent: linear-gradient(135deg,
                       rgba(129, 140, 248, 0.18),
                       rgba(34, 211, 238, 0.10));
  --glass-border:  rgba(255, 255, 255, 0.10);
  --glass-border-hover: rgba(255, 255, 255, 0.18);
  --glass-border-accent: rgba(129, 140, 248, 0.35);
  --glass-blur:    24px;

  /* Text */
  --text-primary:   #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.65);
  --text-muted:     rgba(255, 255, 255, 0.40);
  --text-accent:    #a5b4fc;  /* indigo-300 */
  --text-cyan:      #67e8f9;
  --text-success:   #86efac;
  --text-warning:   #fcd34d;
  --text-danger:    #fca5a5;

  /* Radii */
  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-xl:  20px;

  /* Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 */

  /* Typography */
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}
```

### 7.3 Komponenten-Inventar (Pflicht-Set)

| Komponente | Verhalten |
|---|---|
| `GlassCard` | Standard-Container. `var(--glass-bg-1)` + `backdrop-filter: blur(24px)` + 1px border. Radius lg. Hover: border-hover. |
| `GlassPanel` | Größere Container (z.B. Sidebar-Sections). Etwas mehr Opacity. |
| `GlassAccentCard` | Hervorgehobene Karte. `--glass-bg-accent` Gradient + accent border. Für aktive Module. |
| `GlassButton` | Primary: bg-accent + glow on hover. Secondary: glass-bg-1 + border. |
| `GlassInput` | bg-bg-1, border, fokus = indigo glow ring. |
| `GlassDialog` | Modal über halbtransparentem Overlay + sehr starker Blur (40px). |
| `Sidebar` | Linke Sidebar, 220px, glass-bg-2, items mit Slide-Indicator bei active. |
| `CommandPalette` | ⌘K, zentriertes Glass-Dialog mit Fuzzy-Search über alle Routes + Entries. |

### 7.4 Mesh-Hintergrund (Hero-Element)

- Three orbs (Indigo, Cyan, Purple) mit `radial-gradient`
- CSS-Animation: jede Orb verschiebt sich auf eigener Bahn (verschiedene Cycles 60s/75s/90s)
- Fixed Position, hinter allem anderen, niemals klickbar
- Auf `prefers-reduced-motion: reduce` → statisch

---

## 8. Implementation Roadmap

### Etappe 0 — Setup (1-2 Tage)

- [ ] GitHub-Repo `dogan-hub` anlegen, MIT-Lizenz, `.gitignore` (Node, Vite, .env)
- [ ] Folder-Struktur gemäß §6 anlegen
- [ ] `frontend/`: Vite + React + TS + Tailwind initialisieren
- [ ] `backend/`: Node + Express + TS Setup, `tsx watch` für Dev
- [ ] Supabase-Projekt anlegen (EU-Region)
- [ ] `.env.example` mit allen benötigten Variablen committen
- [ ] `docker-compose.yml` skelett (frontend, backend, caddy)
- [ ] `Caddyfile` minimal mit auto-HTTPS
- [ ] README mit Quickstart

**Akzeptanz:** `docker compose up` startet alles, Browser zeigt "Hello Dogan-Hub" über HTTPS.

### Etappe 1 — Auth & Shell (3-4 Tage)

- [ ] Supabase-Migrationen 0001 (profiles) + 0002 (audit)
- [ ] RLS-Policies für `profiles`
- [ ] Trigger: bei `auth.users` INSERT → `profiles` row + erster User = admin
- [ ] Backend: `/api/health`, JWT-Middleware, `/api/me`
- [ ] Frontend: Login-Page mit Glass-Design
- [ ] Frontend: AppShell mit Sidebar + Mesh-Background
- [ ] Frontend: useAuth Hook + ProtectedRoute
- [ ] Frontend: CommandPalette (⌘K) Skelett
- [ ] Logout-Flow, Auto-Refresh-Token-Handling

**Akzeptanz:** Login möglich, nach Login: leeres Dashboard mit Sidebar. Logout funktioniert. Falsche Credentials → Fehler-Toast.

### Etappe 2 — Dashboard (2 Tage)

- [ ] Backend: `/api/dashboard/stats` (Counts pro Modul)
- [ ] Backend: `/api/dashboard/activity` (letzte 20 audit_log Einträge)
- [ ] Frontend: Dashboard-Page mit Glass-Stat-Cards
- [ ] Frontend: Recent-Activity-Liste
- [ ] Frontend: Modul-Cards mit Status (aktiv / coming-soon)

**Akzeptanz:** Dashboard zeigt echte Zahlen aus DB, Activity-Feed updated nach Aktionen.

### Etappe 3 — Daten-Modul MVP (8-10 Tage, parallel teilbar)

Datenbanken und Dateien werden parallel entwickelt, da sie sich Storage und Suche teilen. Empfohlene Aufteilung:

#### Etappe 3a — Foundation (2 Tage, blockt 3b und 3c)

- [ ] Migration 0003 (databases, entries, database_views)
- [ ] Migration 0004 (folders, files, entry_files)
- [ ] Migration 0005 (tags, entry_tags, file_tags)
- [ ] Migration 0006 (RLS-Policies für alle Tabellen oben)
- [ ] Migration 0007 (Supabase Storage Bucket `doganhub-files` + RLS-Policies auf Bucket)
- [ ] Backend: `storage.service.ts` (Wrapper für Supabase Storage)
- [ ] Backend: `file.service.ts` (MIME-Whitelist, Magic-Bytes-Check via `file-type` npm)
- [ ] Backend: Audit-Middleware wired für alle Write-Routes
- [ ] Frontend: `/design`-Tokens + Basis-Glass-Komponenten (GlassCard, GlassButton, GlassInput, GlassDialog)

**Akzeptanz:** Schema in Supabase ist live, RLS getestet (zweiter Test-User sieht keine Daten des ersten), Glass-Komponenten in Storybook-artigem Playground sichtbar.

#### Etappe 3b — Datenbanken-Subsystem (4-5 Tage)

- [ ] Backend: CRUD `/api/databases` (inkl. archive, duplicate, reorder)
- [ ] Backend: CRUD `/api/entries` (inkl. bulk-ops)
- [ ] Backend: CRUD `/api/database-views`
- [ ] Backend: Volltextsuche pro Datenbank
- [ ] Frontend: Datenbank-Liste in Sidebar (drag & drop reorder)
- [ ] Frontend: Database-Detail-Page mit View-Switcher (Tabelle / Karten / Liste)
- [ ] Frontend: Schema-Editor mit allen MVP-Field-Types
- [ ] Frontend: Entry-Form (dynamisch generiert)
- [ ] Frontend: Entry-Table mit Inline-Edit, Sort, Filter
- [ ] Frontend: Entry-Card-Grid
- [ ] Frontend: Entry-Detail-View mit Aktivitäts-Sektion
- [ ] Seed: 5-7 DB-Templates (Autos, Verträge, Bücher, Belege, Abos, Passwörter, Geräte/Garantien)

**Akzeptanz:** Datenbank "Autos" aus Template anlegen, 3 Einträge erstellen, in Tabelle/Karten-View anzeigen, filtern nach "TÜV in 6 Monaten".

#### Etappe 3c — Dateien-Subsystem (3-4 Tage)

- [ ] Backend: CRUD `/api/folders` (create, rename, move, delete kaskadiert)
- [ ] Backend: `/api/files/sign-upload` (Validation vor Sign-Vergabe: MIME, Size)
- [ ] Backend: `/api/files/sign-download` (1h TTL)
- [ ] Backend: CRUD `/api/files` (list by folder, rename, move, soft-delete, restore, hard-delete)
- [ ] Backend: Thumbnail-Service für Bilder (sharp npm, on-the-fly oder cached)
- [ ] Backend: Cronjob `trash-cleanup` (täglich, hard-delete deleted > 30d)
- [ ] Frontend: File-Browser-Page mit Folder-Tree + File-List/Grid
- [ ] Frontend: Drag & Drop Upload (Dateien + Ordner via HTML5 directory)
- [ ] Frontend: Upload-Progress-UI mit per-file Status
- [ ] Frontend: File-Preview (PDF via pdf.js, Bilder mit Lightbox)
- [ ] Frontend: Move-Dialog mit Folder-Tree
- [ ] Frontend: Breadcrumb-Navigation
- [ ] Frontend: Trash-Page mit Restore-Funktion
- [ ] Frontend: Storage-Quota-Indicator (Dashboard + Sidebar-Footer)

**Akzeptanz:** Ordnerstruktur "Steuer/2026" anlegen, 5 PDFs hochladen (auch via ganzen Ordner-Drag), Preview funktioniert, eine Datei löschen → in Trash → restore → wieder da.

#### Etappe 3d — Integration & Cross-Cutting (1-2 Tage)

- [ ] Backend: `/api/entry-files` (Verknüpfung & Entkopplung)
- [ ] Backend: `/api/tags` CRUD
- [ ] Backend: `/api/search` (globale Suche über DBs, Einträge, Dateien, Tags)
- [ ] Frontend: File-Picker-Component (im Entry-Detail nutzbar)
- [ ] Frontend: "Datei verknüpfen"-Flow im Entry-Detail
- [ ] Frontend: CommandPalette (⌘K) mit globaler Suche + Result-Gruppierung
- [ ] Frontend: Tags-Page mit Tag-Cloud
- [ ] Frontend: Tag-Picker reusable für Einträge UND Dateien
- [ ] Frontend: Tag-Detail-View (alle getaggten Einträge + Dateien)

**Akzeptanz:** ⌘K findet "Toyota" in Einträgen und in Dateinamen. Datei im File-Browser hochladen, dann an einen Eintrag verknüpfen — taucht in beiden Kontexten auf. Tag "Steuer 2026" auf 2 Einträge + 3 Dateien anwenden, Tag-Page zeigt alle 5.

### Etappe 4 — Admin (2 Tage)

- [ ] Backend: `/api/admin/users` (list, invite, deactivate)
- [ ] Backend: `/api/admin/audit-log` (paginated, filterable)
- [ ] Frontend: Admin-Bereich (nur sichtbar für role=admin)
- [ ] Frontend: User-Invite-Dialog (per E-Mail-Magic-Link)
- [ ] Frontend: Audit-Log-Viewer

**Akzeptanz:** Du kannst Familienmitglied per E-Mail einladen, sie kriegen Login, sehen nur ihre eigenen Daten.

### Etappe 5 — Production Hardening & Deployment (3-4 Tage)

**Infrastruktur:**
- [ ] VPS provisionieren (Hetzner CX22 oder besser: 4 vCPU, 8 GB RAM)
- [ ] OS-Härtung: SSH-Keys only, fail2ban, ufw (nur 22/80/443 offen), automatic security updates
- [ ] Domain auf VPS pointen (A-Record + AAAA falls IPv6)
- [ ] Production-Caddyfile mit echter Domain, alle Security-Headers + konkretes CSP
- [ ] Docker-Volumes für Logs persistieren (`./logs:/app/logs`)
- [ ] Backup-Snapshot des VPS bei Hosting-Provider aktivieren (täglich)

**Backups & DR:**
- [ ] Supabase Pro: PITR + 30-Tage-Daily-Backups aktiviert verifizieren
- [ ] Supabase EU-Region (Frankfurt) bestätigt
- [ ] `docs/DR_RUNBOOK.md` mit konkreten Restore-Step-by-Step
- [ ] Test-Restore in Staging-DB durchgeführt und dokumentiert

**Monitoring & Logging:**
- [ ] Sentry-Setup Frontend + Backend mit PII-Scrubbing
- [ ] Sentry EU-Region wählen
- [ ] Sentry-Alert-Rules konfiguriert (Error-Rate, neue Exceptions, P95-Latency)
- [ ] Uptime Kuma im Compose, eigene Subdomain `status.dogan-hub.de`
- [ ] Telegram-Bot für Alerts angebunden
- [ ] Health-Endpoints implementiert (`/api/health/live`, `/ready`, `/deep`)
- [ ] VPS-Disk + Memory Alerts (cronjob → Telegram)
- [ ] Logs-Rotation via pino-roll verifiziert (Test: Volume füllen, sehen ob rotated)

**E-Mail-Setup:**
- [ ] Sender-Subdomain `mail.dogan-hub.de` eingerichtet
- [ ] SPF, DKIM, DMARC-Records gesetzt
- [ ] mail-tester.com Score ≥ 9/10
- [ ] Auth-Mail-Templates auf Deutsch angepasst (Welcome, Invite, Reset, Email-Change)

**Rechtliches:**
- [ ] AVV mit Supabase abgeschlossen (im Dashboard)
- [ ] Impressum unter `/impressum` veröffentlicht
- [ ] Datenschutzerklärung unter `/datenschutz` veröffentlicht (Sub-Auftragsverarbeiter alle gelistet)
- [ ] "Daten exportieren"-Button funktioniert (DSGVO Art. 15+20)
- [ ] "Konto löschen"-Flow mit 30-Tage-Grace funktioniert (DSGVO Art. 17)

**Security-Tests:**
- [ ] SSL Labs Test → A+
- [ ] Mozilla Observatory → A+
- [ ] CSP-Evaluator (csp-evaluator.withgoogle.com) → keine kritischen Warnings
- [ ] RLS-Test-Suite läuft grün (alle Tabellen, beide Test-User)
- [ ] File-Upload-Security-Tests grün (Magic Bytes, Size, Path-Traversal)

**Performance-Validierung:**
- [ ] Lighthouse Performance ≥ 90 (gemessen am Dashboard mit echten Daten)
- [ ] Lighthouse A11y ≥ 95
- [ ] Bundle-Size <250 KB gzipped verifiziert
- [ ] API-P95 <300ms unter Test-Load

**Smoke-Tests vor Go-Live:**
- [ ] Login mit Test-Account erfolgreich
- [ ] Datenbank anlegen, Eintrag erstellen, Datei anhängen — funktioniert
- [ ] Datei separat hochladen in File-Browser — funktioniert
- [ ] ⌘K findet beide
- [ ] Logout funktioniert
- [ ] HTTPS, kein Mixed-Content
- [ ] Im Inkognito-Tab: alle obigen Schritte funktionieren

**Akzeptanz:** App live unter Domain. SSL Labs A+, Mozilla Observatory A+, mail-tester ≥9/10. Backup-Restore wurde mindestens einmal getestet. DSGVO-Dokumente sind veröffentlicht.

### Etappe 6 — Einkaufsliste (3-4 Tage)

- [ ] Migration 0008 (shopping_lists, shopping_items)
- [ ] RLS-Policies
- [ ] Backend: CRUD `/api/shopping/lists`, `/api/shopping/items`
- [ ] Frontend: Shopping-Page mit Glass-Design
- [ ] Drag-Drop-Reorder (dnd-kit)
- [ ] Kategorie-Gruppierung
- [ ] Quick-Add-Input (oben, ⌘N Shortcut)
- [ ] Check-Off-Animation (subtle, satisfying)
- [ ] Optional: Realtime-Subscribe für Multi-User-Sync

**Akzeptanz:** Du kannst eine Einkaufsliste pflegen, Items checken, später wiederherstellen.

### Phase 2 — Backlog (nach MVP)

**Datenbanken-Erweiterungen:**
- Relation-Field-Type (FK zu anderer DB), Formula-Field-Type
- Kalender-View (für DBs mit Date-Feld), Kanban-View (mit Select-Feld als Spalten)
- CSV/Excel-Import mit UI-basiertem Schema-Mapping
- Bulk-Edit mehrerer Einträge gleichzeitig

**Dateien-Erweiterungen (Stufe 2):**
- Versionierung (Datei-History mit Restore zu früherer Version)
- Public-Share-Links mit Token, optional Passwort, Ablaufzeit
- WebDAV-Endpoint (Mount im Finder/Explorer)
- OCR/Text-Extraction für PDFs und Bilder (durchsuchbar machen)
- Duplikat-Detection via SHA-256-Checksum
- ClamAV-Scan für Uploads
- Sync-Client für Desktop (Electron oder via Konflikt-arme Strategie)

**Cross-Cutting:**
- Sharing: einzelne DBs / Ordner / Listen mit anderen Hub-Usern teilen (read/write Permissions)
- Realtime-Sync (Multi-Device, vor allem Einkaufsliste)
- Reminder/Alerts-Modul: aggregiert `date`-Felder aller DBs, schickt E-Mail bei Fälligkeit
- Mobile-PWA-Manifest + Service Worker + Push-Notifications
- 2FA (TOTP via Supabase Auth)
- Offline-Resilience: TanStack Query Persistor + Service-Worker für letzte Daten-Cache
- AI-Assistenz: PDF-Upload → strukturiert vorgeschlagene Felder für DB-Eintrag (basiert auf deinem PDF-to-AAS-Pattern aus dem Canvas Editor)

**Infrastruktur & Operations:**
- Off-Site-Backup-Pipeline (verschlüsselt via age, rclone zu Hetzner Storage Box oder B2)
- Restore-Test als quartalsweise Aufgabe etabliert
- Externer E-Mail-Provider (Resend EU) wenn Supabase-Mailer-Limit greift
- Zero-Downtime-Deployments (Blue-Green via Caddy)
- CI/CD-Pipeline (GitHub Actions: lint + typecheck + tests + build)
- Externer Log-Sink (Better Stack oder Axiom)
- Visual Regression Tests (Percy/Chromatic) für Glass-Komponenten
- Load-Tests mit k6 für File-Upload und Search-Endpoints

**Accessibility (Tier-3):**
- Manuelle Screen-Reader-Tests (VoiceOver/NVDA) durch alle kritischen Flows
- High-Contrast-Mode (zusätzlich zum Glass-Theme)
- Keyboard-Shortcuts-Hilfe-Overlay (`?` öffnet Übersicht)

---

## 9. Environment Variables (.env.example)

```bash
# ─── Backend ─────────────────────────────────────────
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# Supabase
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=...

# Security
CORS_ALLOWED_ORIGINS=https://dogan-hub.de
COOKIE_DOMAIN=dogan-hub.de

# Optional
SENTRY_DSN=
ADMIN_INVITE_TOKEN_SECRET=

# ─── Frontend (Vite, VITE_ Prefix) ───────────────────
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=https://dogan-hub.de/api

# ─── Caddy ───────────────────────────────────────────
DOMAIN=dogan-hub.de
ACME_EMAIL=alaettin87@gmail.com
```

---

## 10. Docker Compose (Skelett)

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    environment:
      DOMAIN: ${DOMAIN}
      ACME_EMAIL: ${ACME_EMAIL}

  frontend:
    build: ./frontend
    restart: unless-stopped
    expose: ["80"]

  backend:
    build: ./backend
    restart: unless-stopped
    expose: ["4000"]
    env_file: .env

volumes:
  caddy_data:
  caddy_config:
```

```caddy
{$DOMAIN} {
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), camera=(), microphone=()"
    }

    handle_path /api/* {
        reverse_proxy backend:4000
    }

    handle {
        reverse_proxy frontend:80
    }
}
```

---

## 11. Akzeptanz-Kriterien MVP

**Auth & Multi-User:**
- [ ] Login funktioniert mit E-Mail + Passwort
- [ ] Erster User ist automatisch admin
- [ ] Admin kann weitere User einladen
- [ ] Jeder User sieht nur seine eigenen Daten (RLS verified mit zweitem Test-Account)

**Daten-Modul / Datenbanken:**
- [ ] Datenbank aus Template anlegen (z.B. "Autos")
- [ ] Schema mit allen MVP-Field-Types editieren
- [ ] Einträge erstellen, in Tabelle/Karten/Liste anzeigen
- [ ] Filter + Sort funktionieren, View speicherbar
- [ ] Inline-Edit in Tabelle funktioniert

**Daten-Modul / Dateien:**
- [ ] Ordnerstruktur anlegen, umbenennen, verschieben
- [ ] Upload via Drag & Drop (auch ganzer Ordner)
- [ ] PDF und Bild-Preview inline funktioniert
- [ ] Trash + Restore funktioniert
- [ ] Storage-Quota wird korrekt angezeigt

**Daten-Modul / Integration:**
- [ ] Datei kann an Eintrag verknüpft werden (ohne Duplikat-Storage)
- [ ] ⌘K findet quer über DBs, Einträge, Dateien, Tags
- [ ] Tag-System funktioniert für beide Subsysteme

**Plattform & Sicherheit:**
- [ ] Dashboard zeigt Live-Stats (Eintrag-Counts, Storage, Activity)
- [ ] App läuft als Docker Compose mit einem Befehl
- [ ] HTTPS via Caddy automatisch
- [ ] SSL Labs A+ erreicht, Mozilla Observatory A+
- [ ] Magic-Bytes-Validation funktioniert (Hochladen eines `.exe` als `.pdf` schlägt fehl)
- [ ] Audit-Log enthält alle Write-Ops

**Design & UX:**
- [ ] Keine Konsolen-Warnungen oder Fehler im Browser
- [ ] Lighthouse-Score Performance ≥ 90, A11y ≥ 95
- [ ] Glass-Design konsistent durchgezogen, keine "Default-Bootstrap-Reste"
- [ ] Reduced-Motion respektiert
- [ ] Mobile Viewport ist nutzbar (auch wenn nicht Touch-Primärziel)

---

## 12. Open Questions / Decisions Later

- **Backup-Frequenz vs. Storage-Kosten:** Supabase Pro nötig wenn echte Familien-Daten drin?
- **E-Mail-Versand für Invites:** Supabase eingebauter Mailer reicht oder eigener SMTP (Resend/Postmark)?
- **Recherche-Modus für DMS:** AI-gestützte Vorschläge bei Schema-Erstellung? (Phase 3, basierend auf deinen Notion-Templates)
- **Mobile-App später:** PWA mit Add-to-Homescreen ausreichend, oder echte React-Native-App?
- **Custom-Domain pro User:** wahrscheinlich Nein, ein Hub-Hostname reicht.

---

## 13. Hinweise für Claude Code

- **Niemals Code anfassen, ohne diese PLAN.md vorher zu lesen.**
- Bei Konflikt zwischen User-Request und PLAN.md: PLAN.md updaten, dann Code.
- Konsistenz im Design-System ist nicht verhandelbar — neue Komponenten erst in `/design` definieren, dann nutzen.
- Jeder Endpoint braucht: Zod-Schema, Auth-Check, Audit-Log-Eintrag, Error-Handling.
- Tests sind nice-to-have für MVP, Pflicht ab Phase 2 (Vitest + Playwright).
- Vor jedem Commit: `pnpm typecheck && pnpm lint`.
- Atomare PRs/Commits pro Etappen-Checkbox.

---

## 14. Branding

**Produktname:** Dogan-Hub
**Bedeutung:** "Doğan" (türk.) = Falke / der Aufgehende / Sonnenaufgang. Verbindet persönliche Identität mit der Funktion ("Hub" als zentraler Knotenpunkt).

**Schreibweisen:**
- Offiziell: **Dogan-Hub** (mit Bindestrich, beide Wörter kapitalisiert)
- In Code/Pfaden: `dogan-hub` (lowercase, kebab-case)
- In Package-Namen: `@dogan-hub/frontend`, `@dogan-hub/backend`
- Storage-Bucket: `doganhub-files` (ohne Bindestrich, weil Supabase Bucket-Namen keine erlauben)
- Domain: `dogan-hub.de` (primär), optional `dogan-hub.app` als zweite

**Nicht erlaubt:**
- "DoganHub", "Doganhub", "dogan_hub", "dogan.hub" — alle vermeiden, sonst Inkonsistenzen
- Auch keine deutsche Variante "Dogan-Knotenpunkt" o.ä.

**Wortmarke / Logo-Hinweis (Design-System):**
- Schriftzug in Inter Medium, Letter-Spacing -0.5px
- Bindestrich kann optisch durch einen kleinen Glass-Akzent-Strich ersetzt werden
- Akzentfarbe Indigo (#818cf8) bevorzugt
- Falke als optionales Icon-Motiv (subtil, nur in Sidebar-Header oder Loading-Screen)

**Tagline (vorläufig, kann später angepasst werden):**
- DE: "Dein persönliches Operationssystem."
- EN: "Your personal operating system."

**Sprachgebrauch in der App:**
- UI-Sprache: Deutsch (primär)
- E-Mails: Deutsch
- Fehlermeldungen: Deutsch + technischer Error-Code für Support
- Code, Variablen, API-Endpoints: Englisch (Standard)
- Commit-Messages: Englisch (Conventional Commits)

---

*Ende PLAN.md*
