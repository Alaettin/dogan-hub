# Dogan-Hub

> Persönliches Operationssystem als modulare Web-App.

Siehe **[PLAN.md](./PLAN.md)** für die vollständige Architektur, Roadmap und Design-Entscheidungen.

## Status

**Etappe 0 — Setup.** Boilerplate für Frontend, Backend, Docker Compose und Caddy steht. Auth, Supabase-Anbindung, Glass-Design und Daten-Modul folgen in Etappe 1+.

## Tech-Stack (Kurzfassung)

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS 3
- **Backend:** Node 20 + Express + TypeScript
- **Datenbank/Auth/Storage:** Supabase Cloud (EU/Frankfurt, ab Etappe 1)
- **Container:** Docker + Docker Compose
- **Reverse Proxy:** Caddy 2 (auto-HTTPS via Let's Encrypt in Production)

## Quickstart (lokale Entwicklung, ohne Docker)

Voraussetzungen: Node.js 20+, npm.

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# Backend (in neuem Terminal)
cd backend
npm install
npm run dev          # http://localhost:4000, /api/health
```

`.env` ist noch nicht erforderlich — die Etappe-0-Stubs benötigen keine Secrets.

## Quickstart (Docker Compose)

```bash
cp .env.example .env
# .env editieren (für lokal genügen die Defaults)
docker compose build
docker compose up
```

**Hinweis lokal:** Caddy versucht in der mitgelieferten Konfiguration HTTPS via Let's Encrypt — das funktioniert nur auf einem öffentlich erreichbaren VPS mit DNS-Eintrag. Für lokales Testen entweder:
- Frontend/Backend direkt aufrufen (`http://localhost:5173` / `http://localhost:4000`)
- oder Caddy temporär auf `localhost` umstellen (kommt mit Etappe 1)

## Repo-Struktur

```
dogan-hub/
├── frontend/         # Vite + React + TS + Tailwind
├── backend/          # Node + Express + TS
├── supabase/         # Migrations (ab Etappe 1)
├── docs/             # Runbooks, Design-System-Doku
├── docker-compose.yml
├── Caddyfile
├── PLAN.md           # Architektur, Datenmodell, Roadmap
└── README.md
```

## Roadmap

Vollständig in [PLAN.md §8](./PLAN.md). Kurz:

- ✅ **Etappe 0** — Setup (Boilerplate)
- ⬜ **Etappe 1** — Auth & Shell (Supabase, Login, Sidebar)
- ⬜ **Etappe 2** — Dashboard
- ⬜ **Etappe 3** — Daten-Modul (Datenbanken + Dateien + Tags + Suche)
- ⬜ **Etappe 4** — Admin (User-Invites, Audit-Log)
- ⬜ **Etappe 5** — Production-Hardening & Deployment
- ⬜ **Etappe 6** — Einkaufsliste

## Owner

Alaettin · `alaettin87@gmail.com`
