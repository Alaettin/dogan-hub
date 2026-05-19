# Auth-Flow

## Request-Flow

```
Browser                                    Backend                   Supabase
   │                                          │                          │
   │ 1. POST /auth/sign-in (email, password)  │                          │
   │ ───────────────────────────────────────────────────────────────────► │
   │                                          │                          │
   │ ◄────────── access_token (JWT, 1h) + refresh_token (30d) ──────────  │
   │                                          │                          │
   │ 2. GET /api/me                           │                          │
   │ Authorization: Bearer <JWT>              │                          │
   │ ────────────────────────────────────────►│                          │
   │                                          │ 3. JWT-Verify (HS256)    │
   │                                          │    mit SUPABASE_JWT_SECRET│
   │                                          │                          │
   │                                          │ 4. SELECT profile        │
   │                                          │    (User-JWT → RLS)      │
   │                                          │ ────────────────────────► │
   │                                          │ ◄──────── row ──────────  │
   │ ◄──────── { user, profile } ─────────────│                          │
```

## Schlüssel-Konzepte

### 1. JWT direkt vom Browser zu Supabase Auth
- Frontend ruft `supabase.auth.signInWithPassword()` — Supabase JS SDK kommuniziert direkt mit Supabase Auth, **nicht** über unser Backend
- Backend ist nicht im Sign-in-Pfad → kein Custom-Endpoint, keine Session-Speicherung serverseitig
- `access_token` (JWT, 1h TTL) und `refresh_token` (30d) liegen im Browser im `localStorage` (gemanagt vom SDK)

### 2. Backend verifiziert JWT lokal
- Jeder API-Call: `Authorization: Bearer <jwt>`
- `requireAuth`-Middleware verifiziert JWT-Signatur lokal mit `SUPABASE_JWT_SECRET` (HS256 Symmetric)
- Kein zusätzlicher Roundtrip zu Supabase pro Request → schnell
- Aus dem JWT-Payload extrahiert: `sub` (user id), `email`, `role` (Postgres-Role, immer `authenticated`)

### 3. Row Level Security (RLS) macht die eigentliche Arbeit
- Backend nutzt **zwei** Supabase-Clients:
  - `supabaseService` — mit `SERVICE_ROLE_KEY`, **umgeht RLS**. Nur für Admin-Operationen.
  - `getUserScopedClient(jwt)` — mit User-JWT, RLS-Policies greifen. Default für alle User-Daten-Zugriffe.
- Eine Policy wie `auth.uid() = owner_id` macht Frontend-Bugs harmlos: selbst wenn die UI versehentlich auf fremde Daten zeigt, kommt nichts zurück

### 4. Auto-Refresh-Token
- Supabase JS SDK macht das automatisch: kurz bevor `access_token` abläuft, holt es per `refresh_token` einen neuen
- Multi-Tab: SDK synced über `BroadcastChannel`
- Bei explizitem Logout (`supabase.auth.signOut()`) wird Token serverseitig revoked

## Profile-Erstellung

- Beim Anlegen eines neuen Users in `auth.users` feuert der Trigger `on_auth_user_created` und legt automatisch eine Row in `public.profiles` an
- **Erster User wird automatisch `role: 'admin'`** — Logik: `(SELECT COUNT(*) = 0 FROM profiles)` direkt vor dem INSERT
- `display_name` kommt aus `raw_user_meta_data->>'display_name'`, Fallback: Email-Local-Part

## Sicherheits-Garantien

1. **Service-Role-Key niemals im Frontend** — Frontend nutzt ausschließlich `anon` key (RLS greift)
2. **JWT-Verifikation lokal mit Secret** — Backend kann offline Tokens prüfen, keine Race-Conditions
3. **RLS auf jeder Tabelle aktiv** — Default Deny, explizite Allow-Policies pro Operation
4. **Refresh-Token rotiert** bei jedem Refresh (Supabase Default) → kompromittierter alter Token wird invalid

## Was ist (noch) NICHT implementiert

- **Refresh-Token in httpOnly-Cookie** statt localStorage (Phase 2 — XSS-Härtung)
- **2FA / TOTP** (Phase 2 Backlog)
- **Magic-Link-Invites** für neue User (Etappe 4)
- **Password-Reset-Flow** (Etappe 5)
