# Deployment auf VM mit bestehendem Caddy → myhub.adogan.de

Diese Anleitung deployt MyHub auf einer VM, auf der **bereits ein Caddy** plus
andere Docker-Services laufen (z.B. unter `/opt/kanban`). MyHub wird unter
`https://myhub.adogan.de` erreichbar.

**Prinzip:** MyHub startet nur `frontend` + `backend` (kein eigener Caddy) und
tritt dem **bestehenden Caddy-Netzwerk** bei. Dein vorhandener Caddy bekommt
einen Site-Block, der `myhub.adogan.de` an die MyHub-Container weiterleitet.

> Standalone-Setup (VM ohne eigenen Caddy)? Dann stattdessen `docker-compose.yml`
> verwenden — die bringt einen eigenen Caddy mit. Diese Anleitung ist für den
> Fall „Caddy läuft schon".

---

## Voraussetzungen

- Docker + Docker Compose v2 auf der VM
- Bestehender Caddy-Container in einem Docker-Netzwerk, routet andere Services
  per Container-Name (einzelne Caddyfile)
- DNS: `myhub.adogan.de` zeigt auf die VM (A/AAAA-Record) — ✅ schon vorbereitet
- Zugriff aufs Supabase-Dashboard (gleiches Projekt wie bisher)

---

## Schritt 1 — Repo holen

```bash
sudo git clone https://github.com/Alaettin/dogan-hub.git /opt/myhub
cd /opt/myhub
```

## Schritt 2 — Caddy-Netzwerk ermitteln

Der bestehende Caddy hängt in einem Docker-Netzwerk. Dessen Namen brauchen wir:

```bash
docker ps                       # Caddy-Container-Namen finden
docker inspect <caddy-container> -f '{{json .NetworkSettings.Networks}}' | tr ',' '\n'
```

Notiere den Netzwerk-Namen (z.B. `caddy_default`, `web`, `proxy`, …).

## Schritt 3 — `.env` anlegen

```bash
cp .env.example .env
nano .env
```

Diese Datei dient **doppelt**: als Backend-Runtime-Env (`env_file`) **und** zur
Interpolation der Frontend-Build-Args. Mindestens setzen:

```dotenv
NODE_ENV=production
LOG_FILE_PATH=/app/logs/app.log

# Supabase (Dashboard → Settings → API)
SUPABASE_URL=https://<projekt>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=...

# Frontend-Build (werden ins Bundle gebacken; anon-Key ist öffentlich = ok)
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Security
CORS_ALLOWED_ORIGINS=https://myhub.adogan.de

# Name des bestehenden Caddy-Netzwerks aus Schritt 2
CADDY_NETWORK=caddy_default
```

> `VITE_API_BASE_URL` wird **nicht** gebraucht: Das Frontend ruft die API
> relativ unter `/api` auf — Caddy routet `myhub.adogan.de/api/*` ans Backend
> (gleiche Domain, kein CORS-Problem).

## Schritt 4 — Bauen + starten

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Ergebnis: zwei Container `myhub-frontend` (Port 80 intern) und `myhub-backend`
(Port 4000 intern), beide im Caddy-Netzwerk. Prüfen:

```bash
docker compose -f docker-compose.prod.yml ps
docker logs myhub-backend --tail 30      # sollte "[myhub-backend] listening" zeigen
```

## Schritt 5 — Site-Block in die bestehende Caddyfile einfügen

Öffne deine vorhandene Caddyfile und hänge diesen Block an:

```caddyfile
myhub.adogan.de {
    encode zstd gzip

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=(), usb=()"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob: https:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
        -Server
    }

    # WICHTIG: handle (nicht handle_path) — /api-Präfix darf NICHT gestrippt
    # werden, das Backend mountet alle Routen unter /api/...
    handle /api/* {
        reverse_proxy myhub-backend:4000
    }

    handle {
        reverse_proxy myhub-frontend:80
    }
}
```

Caddy neu laden (Zero-Downtime):

```bash
docker exec <caddy-container> caddy reload --config /etc/caddy/Caddyfile
# Falls das fehlschlägt: docker restart <caddy-container>
```

Caddy holt das Let's-Encrypt-Zertifikat für `myhub.adogan.de` automatisch
(DNS zeigt ja schon auf die VM).

## Schritt 6 — Supabase Auth-URLs setzen

Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://myhub.adogan.de`
- **Redirect URLs:** `https://myhub.adogan.de/**`

Damit funktionieren Magic-Link-Einladungen + Email-Bestätigungen (sie leiten
sonst auf localhost zurück).

## Schritt 7 — Migrations

Das Supabase-Projekt ist dasselbe wie in der Entwicklung — die Migrations
(`0001`–`0009`) sind **bereits angewandt**. Nichts zu tun.

> Frisches Supabase-Projekt? Dann einmalig:
> `cd /opt/myhub/backend && npx supabase db push --linked`

## Schritt 8 — Verifikation

```bash
# Health-Check übers echte HTTPS
curl -s https://myhub.adogan.de/api/health/deep
# → {"status":"ok","components":{"db":{"ok":true,...},"auth":{...},"storage":{...}}}
```

Im Browser: `https://myhub.adogan.de` → Login-Seite → einloggen → Dashboard.
**Der erste registrierte Account wird automatisch Admin** (DB-Trigger
`handle_new_user`). Weitere Personen lädst du über
`Einstellungen → Benutzerverwaltung → User einladen` ein.

---

## Updates einspielen

```bash
cd /opt/myhub
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

(Caddy bleibt unberührt — nur bei Caddyfile-Änderungen neu laden.)

---

## Troubleshooting

| Symptom | Ursache / Fix |
| --- | --- |
| **502 Bad Gateway** | Backend gecrasht oder nicht im Netz → `docker logs myhub-backend`; prüfen ob `.env` vollständig |
| **Caddy: „dial tcp: no such host myhub-backend"** | Container nicht im selben Netz → `docker network inspect <CADDY_NETWORK>` muss `myhub-frontend` + `myhub-backend` listen; `CADDY_NETWORK` in `.env` korrekt? |
| **Weiße Seite / Konsole: „VITE_SUPABASE_URL fehlt"** | Build-Args fehlten → `.env` füllen und **neu bauen**: `docker compose -f docker-compose.prod.yml build --no-cache frontend && docker compose -f docker-compose.prod.yml up -d` |
| **Login klappt, aber Invite-Mail-Link führt auf localhost** | Supabase Auth-URLs (Schritt 6) nicht gesetzt |
| **Zertifikat-Fehler** | DNS noch nicht propagiert oder Port 80/443 nicht beim Caddy → `dig myhub.adogan.de`, Caddy-Logs prüfen |
| **`CADDY_NETWORK` leer** | `docker compose -f docker-compose.prod.yml config` zeigt Interpolation; Wert in `.env` setzen |
