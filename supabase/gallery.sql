-- Gallery photo and video files. The gallery TABLE already exists (schema.sql); this adds the file storage.
-- Run once, after schema.sql and admin-email-2step.sql: Supabase -> SQL Editor -> paste -> Run.
-- The bucket is PUBLIC to read (these are website pictures). Only the admin can add, change or delete files.
-- 50 MB is the largest single file; check your plan's storage and bandwidth limits.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gallery staff add" on storage.objects;
create policy "gallery staff add" on storage.objects for insert to authenticated with check (bucket_id = 'gallery' and public.is_admin());
drop policy if exists "gallery staff see" on storage.objects;
create policy "gallery staff see" on storage.objects for select to authenticated using (bucket_id = 'gallery' and public.is_admin());
drop policy if exists "gallery staff delete" on storage.objects;
create policy "gallery staff delete" on storage.objects for delete to authenticated using (bucket_id = 'gallery' and public.is_admin());
