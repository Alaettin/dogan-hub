-- =====================================================================
-- 0007_storage_bucket.sql
-- Supabase Storage Bucket "doganhub-files" + RLS auf storage.objects.
-- Path-Konvention: {owner_id}/{file_id}/{filename}
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'doganhub-files',
  'doganhub-files',
  false,
  52428800,  -- 50 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── RLS-Policies auf storage.objects ────────────────────────────────
-- Path-Konvention: erster Pfad-Teil ist die owner_id.
-- storage.foldername(name) → text[] mit allen Pfad-Komponenten.

create policy "doganhub_files_owner_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'doganhub-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "doganhub_files_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'doganhub-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "doganhub_files_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'doganhub-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'doganhub-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "doganhub_files_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'doganhub-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
