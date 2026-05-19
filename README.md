# Dogan-Hub

> Persönliches Operationssystem als modulare Web-App.

Siehe **[PLAN.md](./PLAN.md)** für die vollständige Architektur, Roadmap und Design-Entscheidungen.

## Status

**Etappe 1 — Auth & Shell.** Login, Supabase-Anbindung, Glass-Design und AppShell stehen. Daten-Modul folgt in Etappe 3.

## Tech-Stack (Kurzfassung)

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS 3 + Glass-Design-System
- **State:** TanStack Query + Zustand + React Router 6 + React Hook Form + Zod
- **Backend:** Node 20 + Express + TypeScript + Pino + Helmet + Zod
- **Datenbank/Auth/Storage:** Supabase Cloud (EU/Frankfurt)
- **Container:** Docker + Docker Compose
- **Reverse Proxy:** Caddy 2 (auto-HTTPS via Let's Encrypt in Production)

## Quickstart

### 1. Supabase einrichten (einmalig)

Folge **[docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)** — dauert ca. 10 Minuten:
- Account anlegen, Projekt in EU/Frankfurt erstellen
- API-Keys in `.env` eintragen
- Migrations per `supabase db push` einspielen
- Ersten Admin-User manuell im Supabase-Dashboard anlegen

### 2. Dev-Server starten

```bash
# Alles auf einmal (Windows)
start.bat

# oder manuell:
cd frontend && npm install && npm run dev    # http://localhost:5173
cd backend  && npm install && npm run dev    # http://localhost:4000
```

### 3. Einloggen

Browser auf http://localhost:5173 → wird zu `/login` umgeleitet → mit den im Supabase-Dashboard angelegten Credentials einloggen.

## Verifikation

```bash
# Type-Checks
cd frontend && npm run typecheck
cd backend  && npm run typecheck

# RLS-Test (braucht echtes Supabase-Projekt — siehe SUPABASE_SETUP.md)
cd backend && npm test

# Production-Build
cd frontend && npm run build    # Ziel: <250 KB gzipped (PLAN §4g)
cd backend  && npm run build
```

## Repo-Struktur

```
dogan-hub/
├── frontend/                          # Vite + React + TS + Glass-Design
│   ├── src/design/                    # Tokens + MeshBackground
│   ├── src/components/ui/             # GlassCard, GlassButton, …
│   ├── src/components/layout/         # AppShell, Sidebar, TopBar
│   ├── src/features/auth/             # useAuth, LoginPage, ProtectedRoute
│   ├── src/features/dashboard/        # DashboardPage
│   ├── src/lib/                       # supabase, api, query-client, cn
│   └── src/router.tsx
├── backend/                           # Node + Express + TS
│   ├── src/config/                    # env (Zod), supabase clients
│   ├── src/lib/                       # logger (Pino), errors
│   ├── src/middleware/                # auth, error-handler, rate-limit
│   ├── src/routes/                    # health, auth/me
│   └── tests/rls/                     # RLS-Smoke-Test
├── supabase/
│   ├── config.toml
│   └── migrations/                    # 0001_profiles, 0002_audit
├── docs/
│   ├── SUPABASE_SETUP.md              # Einmal-Setup-Anleitung
│   └── AUTH_FLOW.md                   # Wie JWT + RLS zusammenspielen
├── docker-compose.yml
├── Caddyfile
├── PLAN.md
└── README.md
```

## API-Endpoints (Etappe 1)

| Methode | Pfad | Beschreibung | Auth |
|---|---|---|---|
| GET | `/api/health/live` | Liveness-Probe | nein |
| GET | `/api/health/ready` | Readiness inkl. Supabase-Latenz | nein |
| GET | `/api/me` | Aktueller User + Profile | Bearer JWT |

## Roadmap

Vollständig in [PLAN.md §8](./PLAN.md). Kurz:

- ✅ **Etappe 0** — Setup (Boilerplate)
- ✅ **Etappe 1** — Auth & Shell (Supabase, Login, Glass-Design)
- ⬜ **Etappe 2** — Dashboard mit Live-Stats
- ⬜ **Etappe 3** — Daten-Modul (Datenbanken + Dateien + Tags + globale Suche)
- ⬜ **Etappe 4** — Admin (User-Invites, Audit-Log-Viewer)
- ⬜ **Etappe 5** — Production-Hardening & Deployment
- ⬜ **Etappe 6** — Einkaufsliste

## Owner

Alaettin · `alaettin87@gmail.com`
