# Deployment auf VM mit bestehendem Host-Caddy → myhub.adogan.de

Diese Anleitung deployt MyHub auf einer VM, auf der bereits ein **Caddy als
Host-Dienst** (systemd) plus andere Docker-Apps laufen. Die anderen Apps liegen
auf `127.0.0.1:<port>` und Caddy proxyt per Domain dorthin. MyHub macht es
genauso und wird unter `https://myhub.adogan.de` erreichbar.

**Prinzip:** MyHub startet nur `frontend` + `backend` (kein eigener Caddy) und
published seine Ports auf `127.0.0.1`. Der vorhandene Host-Caddy bekommt einen
Site-Block, der `myhub.adogan.de` an diese Ports weiterleitet.

> Standalone-Setup (VM ganz ohne Reverse-Proxy)? Dann stattdessen
> `docker-compose.yml` verwenden — die bringt einen eigenen Caddy mit.

---

## Voraussetzungen

- Docker + Docker Compose v2
- Caddy als Host-Dienst (`systemctl status caddy`), Config in `/etc/caddy/Caddyfile`
- DNS: `myhub.adogan.de` zeigt auf die VM — ✅
- Supabase-Dashboard-Zugriff (gleiches Projekt wie Entwicklung)

---

## Schritt 1 — Repo holen

```bash
sudo git clone https://github.com/Alaettin/dogan-hub.git /opt/myhub
cd /opt/myhub
```

## Schritt 2 — `.env` anlegen

```bash
sudo cp .env.example .env
sudo nano .env
```

Diese Datei dient doppelt: Backend-Runtime-Env **und** Interpolation der
Frontend-Build-Args. Mindestens setzen (Supabase: Dashboard → Settings → API):

```dotenv
NODE_ENV=production
LOG_FILE_PATH=/app/logs/app.log

SUPABASE_URL=https://<projekt>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=...

VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

CORS_ALLOWED_ORIGINS=https://myhub.adogan.de
```

> `VITE_API_BASE_URL` wird nicht gebraucht — das Frontend ruft `/api` relativ
> auf, Caddy routet `myhub.adogan.de/api/*` ans Backend (gleiche Domain).

## Schritt 3 — Freie Host-Ports prüfen

`docker-compose.prod.yml` nutzt standardmäßig `127.0.0.1:8090` (Frontend) und
`127.0.0.1:4000` (Backend). Prüfen, dass die frei sind:

```bash
sudo ss -tlnp | grep -E ':(8090|4000)\s' || echo "frei"
```

Belegt? Dann die Host-Ports in `docker-compose.prod.yml` ändern (linke Seite vor
dem `:`) und in der Caddyfile (Schritt 5) entsprechend anpassen.

## Schritt 4 — Bauen + starten

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker logs myhub-backend --tail 30      # erwartet: "[myhub-backend] listening"
```

## Schritt 5 — Host-Caddyfile erweitern

`/etc/caddy/Caddyfile` editieren (`sudo nano /etc/caddy/Caddyfile`) und diesen
Block ans Ende anhängen:

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

    # handle (nicht handle_path): /api-Präfix NICHT strippen — das Backend
    # mountet alle Routen unter /api/...
    handle /api/* {
        reverse_proxy 127.0.0.1:4000
    }

    handle {
        reverse_proxy 127.0.0.1:8090
    }
}
```

Config testen + neu laden:

```bash
caddy validate --config /etc/caddy/Caddyfile      # optional
sudo systemctl reload caddy
```

Caddy holt das Let's-Encrypt-Zertifikat für `myhub.adogan.de` automatisch.

## Schritt 6 — Supabase Auth-URLs setzen

Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://myhub.adogan.de`
- **Redirect URLs:** `https://myhub.adogan.de/**`

(Sonst zeigen Magic-Link-Invites + Email-Bestätigungen auf localhost.)

## Schritt 7 — Migrations

Gleiches Supabase-Projekt wie in der Entwicklung → Migrations (`0001`–`0009`)
sind bereits angewandt. Nichts zu tun.

> Frisches Projekt? Einmalig: `cd /opt/myhub/backend && npx supabase db push --linked`

## Schritt 8 — Verifikation

```bash
curl -s https://myhub.adogan.de/api/health/deep
# → {"status":"ok","components":{"db":{"ok":true,...},"auth":{...},"storage":{...}}}
```

Browser: `https://myhub.adogan.de` → Login → Dashboard. **Der erste Account
wird automatisch Admin** (DB-Trigger `handle_new_user`). Weitere Personen über
`Einstellungen → Benutzerverwaltung → User einladen`.

---

## Updates einspielen

```bash
cd /opt/myhub
sudo git pull
docker compose -f docker-compose.prod.yml up -d --build
```

(Caddy bleibt unberührt — nur bei Caddyfile-Änderungen `sudo systemctl reload caddy`.)

---

## Troubleshooting

| Symptom | Ursache / Fix |
| --- | --- |
| **502 Bad Gateway** | Backend down → `docker logs myhub-backend`; `.env` vollständig? |
| **Caddy 502 / connection refused** | Port-Mismatch zwischen `docker-compose.prod.yml` (linke Port-Seite) und Caddyfile `reverse_proxy 127.0.0.1:<port>` |
| **Weiße Seite / „VITE_SUPABASE_URL fehlt"** | Build-Args fehlten → `.env` füllen, neu bauen: `docker compose -f docker-compose.prod.yml build --no-cache frontend && docker compose -f docker-compose.prod.yml up -d` |
| **Invite-Mail-Link → localhost** | Supabase Auth-URLs (Schritt 6) nicht gesetzt |
| **Zertifikat-Fehler** | DNS nicht propagiert → `dig myhub.adogan.de`; Caddy-Logs: `journalctl -u caddy -n 50` |
| **Port belegt beim `up`** | Anderen Host-Port in `docker-compose.prod.yml` wählen + Caddyfile anpassen |
