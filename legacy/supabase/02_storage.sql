-- =====================================================================
-- TOWNAIJA — file storage (photos & documents)
-- Run after 01_schema.sql in the Supabase SQL Editor.
--   job-photos     public read  — vehicle photos, condition & delivery photos
--   operator-docs  private      — licence, ID, truck photo, selfie (owner + admins)
--   topup-proofs   private      — bank transfer receipts (owner + admins)
-- Every upload goes into a folder named after the uploader's user id.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('job-photos',    'job-photos',    true,  5242880, array['image/jpeg','image/png','image/webp']),
  ('operator-docs', 'operator-docs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('topup-proofs',  'topup-proofs',  false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "townaija upload own folder" on storage.objects;
create policy "townaija upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('job-photos','operator-docs','topup-proofs')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "townaija read job photos" on storage.objects;
create policy "townaija read job photos" on storage.objects for select
  using (bucket_id = 'job-photos');

drop policy if exists "townaija read own private files" on storage.objects;
create policy "townaija read own private files" on storage.objects for select to authenticated
  using (bucket_id in ('operator-docs','topup-proofs')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
