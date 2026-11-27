-- Volunteers: shared applications, admin management and PRIVATE ID proofs.
-- Run once, after schema.sql and admin-email-2step.sql: Supabase -> SQL Editor -> paste -> Run.

alter table public.volunteers alter column user_id drop not null;            -- the admin can add people who have no account
alter table public.volunteers
  add column if not exists name    text not null default '' check (char_length(name) <= 80),
  add column if not exists email   text check (char_length(email) <= 254),
  add column if not exists phone   text check (char_length(phone) <= 20),
  add column if not exists duty    text check (char_length(duty) <= 60),     -- role given by the admin
  add column if not exists reason  text check (char_length(reason) <= 300),  -- why an application was not approved
  add column if not exists id_path text check (char_length(id_path) <= 200);

revoke insert on public.volunteers from authenticated;
grant insert (user_id, name, email, phone, city, domain, id_type, id_path, status, duty, reason, hours, attendance, tasks) on public.volunteers to authenticated;
grant delete on public.volunteers to authenticated;

-- A person may only apply for themself, as PENDING, with nothing the staff decide filled in. Staff may add anyone.
drop policy if exists "apply for self" on public.volunteers;
create policy "apply for self or staff" on public.volunteers for insert to authenticated with check (
  public.is_admin() or (
    user_id = (select auth.uid()) and status = 'PENDING' and duty is null and reason is null and hours = 0
    and attendance = '[]'::jsonb and tasks = '[]'::jsonb
    and (id_path is null or split_part(id_path, '/', 1) = (select auth.uid())::text)));
drop policy if exists "admin delete volunteers" on public.volunteers;
create policy "admin delete volunteers" on public.volunteers for delete to authenticated using (public.is_admin());

-- A volunteer may tick off their own task, and change nothing else.
create or replace function public.mark_task_done(idx int) returns void language sql security definer set search_path = '' as $$
  update public.volunteers set tasks = jsonb_set(tasks, array[idx::text, 'done'], 'true'::jsonb)
  where user_id = auth.uid() and status = 'APPROVED' and idx >= 0 and idx < jsonb_array_length(tasks);
$$;
revoke execute on function public.mark_task_done(int) from public, anon;
grant execute on function public.mark_task_done(int) to authenticated;

-- ID proofs: private bucket. People upload into their own folder; ONLY staff can read or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('volunteer-ids', 'volunteer-ids', false, 3145728, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ids upload own folder" on storage.objects;
create policy "ids upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'volunteer-ids' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
drop policy if exists "ids staff read" on storage.objects;
create policy "ids staff read" on storage.objects for select to authenticated using (bucket_id = 'volunteer-ids' and public.is_admin());
drop policy if exists "ids staff delete" on storage.objects;
create policy "ids staff delete" on storage.objects for delete to authenticated using (bucket_id = 'volunteer-ids' and public.is_admin());
