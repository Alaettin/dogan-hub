# myhub — Audit: Sicherheit, Stabilität & Performance

**Datum:** 2026-05-21
**Scope:** Backend (Express + TypeScript), Supabase (Postgres + RLS), Frontend (React 18 + Vite + TanStack Query).
**Out of scope:** DSGVO/Datenschutz — bewusst ausgeklammert, da **Single-User, self-hosted**.

> **Kontext-Hinweis zur Bewertung:** Weil nur ein Nutzer existiert und das System selbst gehostet wird, sind klassische Multi-Tenant-Risiken (Cross-User-Datenleck, Login-Brute-Force, Admin-DoS) **nachrangig**. Im Vordergrund stehen **Stabilität, Korrektheit und Performance**. RLS bleibt als Defense-in-Depth wertvoll. Mehrere ursprünglich als „Critical" markierte Funde wurden nach Code-Verifikation herabgestuft (siehe §7).

---

## 1. Priorisierte Zusammenfassung (Aufwand → Nutzen)

| # | Fund | Kategorie | Severity | Aufwand |
|---|------|-----------|----------|---------|
| 1 | Kein `unhandledRejection`/`uncaughtException`-Handler → stiller Server-Crash | Stabilität | High | XS |
| 2 | Vite ohne Code-Splitting → 849 kB Main-Chunk | Performance | High | S |
| 3 | Kanban Board-Create nicht atomar (Spalten-Insert ohne Fehlerprüfung) | Stabilität | High | S |
| 4 | Kanban Boards-Liste: 3 DB-Round-Trips + JS-Aggregation | Performance | High | M |
| 5 | Fehlende DB-Indizes (notes/kanban_cards/calendar/entry_files) | Performance | Medium | S |
| 6 | Notes-Suche: PostgREST-Filter zerbricht bei `.` im Suchtext | Security/Korrektheit | Medium | S |
| 7 | Kein Frontend Error-Boundary → White-Screen bei Render-Fehler | Stabilität | Medium | XS |
| 8 | Notes/Trash ohne Pagination | Performance | Medium | S |
| 9 | Notes-Suche ohne Debounce (Fetch pro Tastenanschlag) | Performance | Medium | XS |
| 10 | TanStack `staleTime` global 30 s (für stabile Daten zu kurz) | Performance | Medium | XS |
| 11 | Storage-Cleanup verschluckt Fehler → Orphan-Objekte | Stabilität | Medium | XS |
| 12 | `position`-Double-Precision-Kollaps nach vielen Reorders | Stabilität | Medium | M |
| 13 | Dashboard lädt alle `size_bytes` in den Speicher | Performance | Medium | S |
| 14 | 500-Fehler echo'n interne DB-Messages an den Client | Security | Low | XS |

Aufwand: XS < 30 min · S ≈ 0,5–1 h · M ≈ 1–3 h.

---

## 2. Security

### 2.1 [Medium] PostgREST-Filter aus Freitext — Korrektheits-/Robustheits-Bug
**Datei:** `backend/src/routes/notes.ts:34-35`
```ts
const safe = search.replace(/[%,()]/g, " ").trim();
if (safe) query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
```
Die Bereinigung entfernt `%,()`, aber **nicht** PostgREST-Operatorzeichen wie `.` oder `:`. Ein Suchbegriff wie `v1.0` oder `foo.and(...)` verändert/zerbricht den Filterstring. **Kein Cross-User-Datenleck** (Single-User + RLS auf `owner_id`), aber falsche Suchergebnisse bzw. Fehler.
**Fix:** PostgREST-Sonderzeichen escapen **oder** typisierte Filter statt String-`.or()` verwenden (zwei `.ilike()`-Abfragen vereinen, oder Postgres-Volltextsuche `textSearch`).

### 2.2 [Low] Calendar `.or()`-Interpolation — nicht ausnutzbar, aber defensiv verbessern
**Datei:** `backend/src/routes/calendar.ts:33,42`
```ts
.or(`end_at.gte.${from},and(end_at.is.null,start_at.gte.${from})`)
```
`from`/`to` werden vorher per Zod `z.string().datetime({offset:true})` validiert → keine Sonderzeichen möglich, **keine Injection**. Trotzdem empfehlenswert, dieselbe Escaping-/Builder-Strategie wie bei §2.1 anzuwenden (Konsistenz, Schutz bei künftigen Schema-Lockerungen).

### 2.3 [Low] 500-Fehler geben interne DB-Messages an den Client
**Datei:** `backend/src/middleware/error-handler.ts:13-15` (+ viele Routen)
```ts
res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
```
Bei `AppError` wird `err.message` immer ausgeliefert; viele Routen bauen `errors.internal(\`… ${error.message}\`)` (z.B. `calendar.ts:45`, `kanban.ts:94`). Kein Stacktrace, aber interne Postgres-Texte gelangen zum Client.
**Fix:** Bei `status >= 500` generische Client-Message („Internal server error"); Detailtext nur ins Log.

### 2.4 [Low] File-Upload ohne MIME-Whitelist
**Datei:** `backend/src/routes/files.ts:65-66` (bewusst entfernt), `backend/src/services/file.service.ts` (`TEXT_MIMES_WITHOUT_MAGIC`)
Magic-Bytes-Validierung greift nicht bei Textformaten (`.txt/.md/.csv/.json` werden ungeprüft akzeptiert). Für Single-User akzeptabel.
**Fix (optional):** für Text-MIMEs zumindest UTF-8-Plausibilitätscheck; Entscheidung „kein Whitelist" als bewusst dokumentieren.

### 2.5 [Info] RLS-Abdeckung — vollständig ✔
Alle Tabellen haben RLS + Owner-Policy (`auth.uid() = owner_id`):
`profiles, databases, entries, folders, files, entry_files, folder_shares, calendar_events, kanban_boards/columns/cards, notes, audit_log` sowie `storage.objects` (pfadbasiert). Der **Service-Role-Client** (RLS-Bypass) wird nur genutzt für: Audit-Insert, Public-Share-Resolve (mit manueller Ownership-Prüfung in `share.service.ts`) und Admin (`requireAdmin`, `middleware/admin.ts` — echter Rollen-Check).
**Aktion:** verifizieren, dass `requireAdmin` auf **allen** Routen in `backend/src/routes/admin.ts` sitzt.

### 2.6 [Info] Login-Brute-Force
Authentifizierung läuft über Supabase Auth (Frontend), nicht über das Backend. Rate-Limiting liegt bei Supabase; für Single-User unkritisch.

---

## 3. Stabilität

### 3.1 [High] Kein globaler Rejection-/Exception-Handler
**Datei:** `backend/src/index.ts`
Kein `process.on("unhandledRejection")` / `process.on("uncaughtException")` → ein vergessenes `await` lässt den Prozess **still** sterben.
**Fix:**
```ts
process.on("unhandledRejection", (reason) => { logger.error({ reason }, "unhandledRejection"); });
process.on("uncaughtException", (err) => { logger.fatal({ err }, "uncaughtException"); process.exit(1); });
```

### 3.2 [High] Nicht-atomare Mehrschritt-Writes
- **`backend/src/routes/kanban.ts:82-120`** — Board anlegen, dann Default-Spalten seeden; der Spalten-`insert` (Z. 98) hat **keine Fehlerprüfung** → bei Fehler verwaistes Board ohne Spalten.
  **Fix:** Insert-Ergebnis prüfen; bei Fehler Board kompensierend löschen — oder als Postgres-RPC (Transaktion) kapseln.
- **`backend/src/routes/files.ts`** (Pre-Register → Signed-Upload → Commit) — bricht der Client ab, bleiben DB-Zeile und/oder Storage-Objekt verwaist.
  **Fix:** Cleanup-Job für uncommittete Files > 24 h; bei Commit Storage-Existenz (HEAD) prüfen.
- **`backend/src/routes/folders.ts:187-217`** — erst Dateien soft-deleten, dann Ordner löschen (`ON DELETE CASCADE`). Schlägt Schritt 1 teilweise fehl, werden Rest-Dateien beim Folder-Delete **hart** gelöscht statt soft.
  **Fix:** vor dem Folder-Delete verifizieren, dass der gesamte Subtree soft-deleted ist; sonst abbrechen.

### 3.3 [Medium] Storage-Cleanup verschluckt Fehler
**Datei:** `backend/src/routes/files.ts:149-162` — bei Magic-Bytes-Reject wird `deleteObjects()` in try/catch nur `warn`-geloggt → bei Fehler bleibt ein **Orphan-Objekt** im Bucket.
**Fix:** als `error` loggen + in einer „pending cleanup"-Liste sammeln (oder Cleanup-Job), nicht still fortfahren.

### 3.4 [Medium] `position` Double-Precision-Kollaps
**Datei:** `backend/src/routes/kanban.ts:24-38` (`nextPosition`) + Midpoint-Reorder. Nach vielen Reorders zwischen benachbarten Werten droht Präzisionsverlust/Kollision.
**Fix:** Fractional-Indexing (z.B. String-Keys) oder periodisches Reindexing einer Spalte/Liste.

### 3.5 [Medium] Kein Top-Level Error-Boundary (Frontend)
**Datei:** `frontend/src/main.tsx` — ein Render-Fehler reißt die ganze App in einen White-Screen.
**Fix:** `ErrorBoundary` um `<RouterProvider>` mit Reload-Fallback.

### 3.6 [Low] NoteDetailPage State-Sync
**Datei:** `frontend/src/features/notes/NoteDetailPage.tsx` — der Init-Effekt setzt lokalen State nur bei id-Wechsel; bei `isError` kein Reset; ungespeicherte Edits gehen beim Wegnavigieren verloren (vertretbar).
**Fix (optional):** „ungespeicherte Änderungen"-Hinweis / Reset bei Fehler.

### 3.7 [Low] Keine Tests
Kein vitest-Setup im Backend trotz vorhandener Dependency.
**Fix:** Smoke-Tests für kritische Flows: Board-Create (+Spalten), Upload→Commit, Folder-Delete-Cascade, Share-Token-Resolve/Expiry.

---

## 4. Performance

### 4.1 [High] Vite ohne Code-Splitting
**Datei:** `frontend/vite.config.ts` — bare Config; Production-Build emittiert einen `index`-Chunk **~849 kB (gzip ~243 kB)**.
**Fix:** `build.rollupOptions.output.manualChunks` setzen und `build.target: "es2020"`:
```ts
manualChunks: {
  "vendor-core":  ["react", "react-dom", "react-router-dom"],
  "vendor-data":  ["@tanstack/react-query", "@supabase/supabase-js"],
  "vendor-dnd":   ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  "vendor-ui":    ["@radix-ui/react-dialog", "clsx"],
  "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
}
```
Effekt: dnd-kit lädt nur bei Kanban, kleinerer Initial-Load. (`lucide-react` wird bereits per-Icon importiert → tree-shakebar ✔)

### 4.2 [High] Kanban Boards-Liste: 3 Round-Trips
**Datei:** `backend/src/routes/kanban.ts:45-68` — lädt Boards + **alle** columns + **alle** cards und aggregiert in JS.
**Fix:** eine aggregierte Query/Postgres-RPC (Counts via `LEFT JOIN ... GROUP BY`), inkl. `overdue`-Count direkt in SQL.

### 4.3 [Medium] Fehlende Indizes → neue Migration `0013_perf_indexes.sql`
- `notes (owner_id, updated_at desc)` — Listen-Sortierung (0012 hat nur `(owner_id, pinned, updated_at)`).
- `kanban_cards (board_id, due_date) where due_date is not null` — `/kanban/tasks`-Endpoint; zusätzlich `kanban_cards (board_id)`.
- `calendar_events (owner_id, start_at, end_at)` — Range-Queries.
- `entry_files (entry_id)` — bislang nur `file_id` indiziert.

> Erfordert nach dem Anlegen ein `supabase db push`.

### 4.4 [Medium] Fehlende Pagination
- `backend/src/routes/notes.ts` — lädt **alle** Notizen.
- `backend/src/routes/files.ts` `/trash` — lädt **alle** gelöschten Dateien.
**Fix:** `limit/offset` + `count` analog zu `files`/`entries` (die bereits paginiert sind ✔).

### 4.5 [Medium] Dashboard lädt alle `size_bytes`
**Datei:** `backend/src/routes/dashboard.ts:40-43` — selektiert alle Datei-Größen und summiert in JS.
**Fix:** serverseitige Summe via Postgres-RPC/View (`sum(size_bytes)`), eine Zeile statt N.

### 4.6 [Medium] Notes-Suche ohne Debounce
**Datei:** `frontend/src/features/notes/NotesListPage.tsx` — `useNotes({search})` feuert pro Tastenanschlag.
**Fix:** 300 ms Debounce oder `useDeferredValue`.

### 4.7 [Medium] TanStack `staleTime` global 30 s
**Datei:** `frontend/src/lib/query-client.ts` — für stabile Daten (Notes, Files, Databases) zu kurz → unnötige Refetches.
**Fix:** Default `staleTime` 5 min + `gcTime` 10 min; kurze Zeiten gezielt nur für volatile Queries (kanban/calendar).

### 4.8 [Low] Kleinigkeiten
- `select("*")` in `backend/src/routes/databases.ts:59` → explizite Spalten.
- `EntryTable`/`FileList`: Zeilen via `React.memo` + `useCallback` stabilisieren (Re-Renders bei Tabellen).
- `backend/src/routes/entries.ts:220-230`: Bulk-Delete-Audit als **ein** Batch-Insert statt Schleife.

---

## 5. Remediations-Roadmap

**Phase 1 — Quick Wins (XS/S, hoher Nutzen)**
unhandledRejection-Handler (§3.1) · Error-Boundary (§3.5) · Vite `manualChunks` (§4.1) · Index-Migration `0013` (§4.3) · Notes-Suche escapen (§2.1) + Debounce (§4.6) · `staleTime` anheben (§4.7).

**Phase 2 — Stabilität**
Kanban Board-Create atomar/kompensierend (§3.2) · Storage-Cleanup-Fehler behandeln (§3.3) · Folder-Delete-Verifikation (§3.2) · 500-Messages generalisieren (§2.3).

**Phase 3 — Performance/Scale**
Kanban-Liste auf 1 Query (§4.2) · Pagination Notes/Trash (§4.4) · Dashboard-Summe serverseitig (§4.5) · Render-Memoisierung (§4.8).

**Phase 4 — Härtung/Qualität**
MIME-/UTF-8-Hinweis (§2.4) · `requireAdmin`-Abdeckung prüfen (§2.5) · Fractional-Indexing (§3.4) · vitest-Smoke-Tests (§3.7).

---

## 6. Verifiziert „kein Problem"
- **RLS** auf allen Tabellen vollständig (§2.5).
- **Error-Handler** leakt **keine** Stacktraces an den Client (nur generische 500-Message; Details im Log).
- **Calendar-`.or()`** nicht injizierbar (Zod-`datetime`-Validierung).
- **lucide-react** per-Icon importiert (tree-shakebar).
- **files/entries/search** bereits paginiert bzw. limitiert.

---

## 7. Methodik & Korrekturen
Drei parallele Audits (Security / Stabilität / Performance). Die schwerwiegendsten Funde wurden anschließend **im Code gegengeprüft**; dabei wurden mehrere Ersteinstufungen korrigiert:
- „Critical: Calendar-Injection" → **Low** (durch Zod-Validierung nicht ausnutzbar).
- „Medium: Error-Handler leakt Details" → präzisiert: **kein** Client-Leak von Stacktraces; nur 500-`AppError`-Messages echo'n DB-Texte (**Low**).
- Multi-Tenant-Themen (Brute-Force, Admin-DoS) → **Info/nachrangig** wegen Single-User.
