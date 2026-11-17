-- Songa 2.5.0: private storage for actual traveller document uploads.
-- Apply this migration before enabling the Trip Workspace file-upload controls.

alter table public.trip_documents
  add column if not exists storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'songa-trip-documents',
  'songa-trip-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists songa_trip_documents_select_own on storage.objects;
create policy songa_trip_documents_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'songa-trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists songa_trip_documents_insert_own on storage.objects;
create policy songa_trip_documents_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'songa-trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists songa_trip_documents_delete_own on storage.objects;
create policy songa_trip_documents_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'songa-trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
