-- =====================================================================
-- 0008_storage_bucket_open_mimes.sql
-- Entfernt die MIME-Type-Whitelist im doganhub-files Bucket, damit User
-- beliebige Datei-Typen hochladen können (.msi, .exe, .iso, …).
--
-- Size-Limit 50 MB bleibt. RLS-Policy {owner_id}/{file_id}/{filename}
-- bleibt — Trennung zwischen Usern bleibt erhalten.
--
-- Security-Hinweis (PLAN §4 Polish-Backlog): Wenn Multi-User-Family
-- aktiv wird, sollten Executables nur für Eigentümer downloadbar
-- bleiben — Magic-Bytes-Check + ClamAV bleiben Phase-3-Optionen.
-- =====================================================================

update storage.buckets
set allowed_mime_types = null
where id = 'doganhub-files';
