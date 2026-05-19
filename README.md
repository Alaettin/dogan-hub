# Dogan-Hub

> Persönliches Operationssystem als modulare Web-App.

Siehe **[PLAN.md](./PLAN.md)** für die vollständige Architektur, Roadmap und Design-Entscheidungen.

## Status

**MVP code-seitig live — Etappe 1 bis 5 fertig.** Auth, Dashboard mit Activity-Feed, Datenbanken-Modul (Schema-Editor + Tabellen-/Karten-/Listen-Views), Dateien-Browser mit Ordnerstruktur und Papierkorb, Eintrag-Anhänge, globale Suche (⌘K), Benutzerverwaltung (Invite/Rolle/Email/Löschen) und Production-Hardening (CSP, Magic-Bytes-Verifikation, Pino-Redact, Log-Rotation, RLS-Test-Suite, DR-Runbook) stehen.

Offen für Go-Live: VPS provisionieren, Domain pointen, Supabase Pro aktivieren (für PITR), Auth-Mail-Templates ins Deutsche übersetzen. Etappe 6 (Einkaufsliste) noch nicht begonnen.

## Tech-Stack (Kurzfassung)

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS 3 + Glass-Design-System + Radix Dialog
- **State:** TanStack Query + Zustand + React Router 6 + React Hook Form + Zod
- **Backend:** Node 20 + Express + TypeScript + Pino (mit Redact + Roll) + Helmet + Zod + file-type
- **Datenbank/Auth/Storage:** Supabase Cloud (EU/Frankfurt)
- **Container:** Docker + Docker Compose (mit persistentem Log-Volume)
- **Reverse Proxy:** Caddy 2 (auto-HTTPS via Let's Encrypt + voller CSP-Stack)

## Quickstart

### 1. Supabase einrichten (einmalig)

Folge **[docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)** — dauert ca. 10 Minuten:
- Account anlegen, Projekt in EU/Frankfurt erstellen
- API-Keys in `.env` eintragen
- Migrations per `supabase db push` einspielen
- Ersten Admin-User manuell im Supabase-Dashboard anlegen (alternativ: erster Account wird automatisch Admin)

### 2. Dev-Server starten

```bash
# Alles auf einmal (Windows)
start.bat

# oder manuell:
cd frontend && npm install && npm run dev    # http://localhost:5173
cd backend  && npm install && npm run dev    # http://localhost:4000
```

### 3. Einloggen

Browser auf http://localhost:5173 → wird zu `/login` umgeleitet → mit den im Supabase-Dashboard angelegten Credentials einloggen. Neue Personen lädst du über `Einstellungen → Benutzerverwaltung → User einladen` per Magic-Link ein.

## Verifikation

```bash
# Type-Checks
cd frontend && npm run typecheck
cd backend  && npm run typecheck

# RLS-Test-Suite (21 Tests, braucht echtes Supabase-Projekt)
cd backend && npm test

# Production-Build (Ziel: <250 KB gzipped — PLAN §4g)
cd frontend && npm run build
cd backend  && npm run build
```

## Repo-Struktur

```
dogan-hub/
├── frontend/                          # Vite + React + TS + Glass-Design
│   ├── src/design/                    # Tokens + MeshBackground
│   ├── src/components/ui/             # GlassCard, GlassButton, GlassDialog,
│   │                                  #   GlassInput, GlassPanel, Dropdown,
│   │                                  #   ConfirmDialog (Portal-basiert)
│   ├── src/components/layout/         # AppShell, Sidebar, TopBar
│   ├── src/features/auth/             # useAuth, LoginPage, ProtectedRoute
│   ├── src/features/dashboard/        # Stats + Activity-Feed
│   ├── src/features/databases/        # Liste, Detail, Schema-Editor,
│   │                                  #   Views (table/cards/list), Filter,
│   │                                  #   Sort, Bulk-Delete, Field-Typen
│   ├── src/features/files/            # Browser, Grid/List, Preview-Dialog,
│   │                                  #   Folder-Tree, Trash, Storage-Quota
│   ├── src/features/entry-files/      # Anhänge: FilePicker + Attachments-Chips
│   ├── src/features/search/           # ⌘K Command Palette (lazy)
│   ├── src/features/settings/         # Benutzerverwaltung (Liste + Detail)
│   ├── src/lib/                       # supabase, api, query-client, cn
│   └── src/router.tsx                 # Lazy-loaded Routes
├── backend/                           # Node + Express + TS
│   ├── src/config/                    # env (Zod), supabase clients
│   ├── src/lib/                       # logger (Pino + Redact + Roll), errors
│   ├── src/middleware/                # auth, requireAdmin, error-handler,
│   │                                  #   rate-limit
│   ├── src/routes/                    # health (/live, /ready, /deep), auth,
│   │                                  #   dashboard, databases, entries,
│   │                                  #   database-views, folders, files,
│   │                                  #   entry-files, search, admin
│   ├── src/services/                  # storage, file (Magic-Bytes),
│   │                                  #   audit (Append-Only-Log)
│   ├── src/schemas/                   # Zod Request-Validation pro Domain
│   └── tests/rls/                     # 21 RLS-Cross-User-Tests
├── supabase/
│   ├── config.toml
│   └── migrations/                    # 0001 profiles → 0008 storage
├── docs/
│   ├── SUPABASE_SETUP.md              # Einmal-Setup-Anleitung
│   ├── AUTH_FLOW.md                   # Wie JWT + RLS zusammenspielen
│   └── DR_RUNBOOK.md                  # Disaster-Recovery-Spickzettel
├── docker-compose.yml                 # mit backend_logs-Volume
├── Caddyfile                          # CSP + HSTS + Permissions-Policy
├── PLAN.md
└── README.md
```

## API-Endpoints

| Methode | Pfad | Beschreibung | Auth |
|---|---|---|---|
| GET | `/api/health/live` | Liveness-Probe | nein |
| GET | `/api/health/ready` | DB-Roundtrip | nein |
| GET | `/api/health/deep` | DB + Auth + Storage parallel mit Einzel-Latenz | nein |
| GET | `/api/me` | Aktueller User + Profile | Bearer JWT |
| POST | `/api/auth/log-login` | Audit-Eintrag Login | Bearer JWT |
| GET | `/api/dashboard/stats` | Stats + Storage + letzter Login | Bearer JWT |
| GET | `/api/dashboard/activity` | Letzte Audit-Events (paginierbar) | Bearer JWT |
| GET/POST/PATCH/DELETE | `/api/databases[/:id[/...]]` | Datenbank-CRUD + Archive + Duplicate | Bearer JWT |
| GET | `/api/database-templates` | Vordefinierte Schemas (Auto/Vertrag/…) | Bearer JWT |
| GET/POST/PATCH/DELETE | `/api/databases/:id/entries[/:eid]` | Entry-CRUD + Bulk-Delete | Bearer JWT |
| GET/POST/PATCH/DELETE | `/api/databases/:id/views[/:vid]` | Gespeicherte Views | Bearer JWT |
| GET/POST/PATCH/DELETE | `/api/folders[/:id]` | Ordner mit Rekursiv-Move | Bearer JWT |
| GET/POST | `/api/files/sign-upload` | Signed URL für Direct-Upload | Bearer JWT |
| POST | `/api/files/:id/commit` | Upload-Bestätigung **+ Magic-Bytes-Verify** | Bearer JWT |
| GET/POST/PATCH/DELETE | `/api/files[/:id[/...]]` | Liste, Download, Rename/Move, Soft/Hard-Delete | Bearer JWT |
| GET/POST | `/api/files/trash[/empty]` | Papierkorb + Leeren | Bearer JWT |
| POST/DELETE | `/api/entries/:id/files[/:fid]` | Eintrag↔Datei-Verknüpfung | Bearer JWT |
| GET | `/api/search?q=…` | Globale Suche (databases/entries/folders/files) | Bearer JWT |
| GET/POST/PATCH/DELETE | `/api/admin/users[/:id[/invite]]` | User-Management | Admin-JWT |

## Roadmap

Vollständig in [PLAN.md §8](./PLAN.md). Kurz:

- ✅ **Etappe 0** — Setup (Boilerplate)
- ✅ **Etappe 1** — Auth & Shell (Supabase, Login, Glass-Design)
- ✅ **Etappe 2** — Dashboard mit Live-Stats
- ✅ **Etappe 3** — Daten-Modul (Datenbanken + Dateien + globale Suche)
- ✅ **Etappe 4** — Admin (Benutzerverwaltung + User-Detail-Seite)
- 🟡 **Etappe 5** — Production-Hardening (Code: ✅ — Infra: VPS/DNS/Mail noch offen)
- ⬜ **Etappe 6** — Einkaufsliste

## Owner

Alaettin · `alaettin87@gmail.com`
