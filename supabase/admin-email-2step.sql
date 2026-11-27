-- Admin sign-in = e-mail + PASSWORD, then a code sent to that e-mail. Google or code-only sign-ins never get admin rights.
-- Run once, after schema.sql: Supabase -> SQL Editor -> paste -> Run.

create table if not exists public.admin_verified (
  session_id uuid primary key,
  user_id    uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null
);
alter table public.admin_verified enable row level security;
revoke all on public.admin_verified from anon, authenticated;   -- only the functions below touch it

-- Called with the short-lived session created by the e-mailed code, to approve the password session "target".
create or replace function public.confirm_admin_session(target uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) a
                 where a->>'method' in ('otp','magiclink') and (a->>'timestamp')::bigint > extract(epoch from now()) - 300) then
    raise exception 'an e-mail code is required';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','SUPER_ADMIN')) then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from auth.sessions s join auth.mfa_amr_claims c on c.session_id = s.id
                 where s.id = target and s.user_id = auth.uid() and c.authentication_method = 'password') then
    raise exception 'sign in with your password first';
  end if;
  insert into public.admin_verified values (target, auth.uid(), now() + interval '8 hours')
  on conflict (session_id) do update set expires_at = excluded.expires_at;
end $$;
revoke execute on function public.confirm_admin_session(uuid) from public, anon;
grant execute on function public.confirm_admin_session(uuid) to authenticated;

-- Admin = admin role, signed in with a password, and that session approved by an e-mail code within the last 8 hours.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('ADMIN','SUPER_ADMIN'))
     and exists (select 1 from jsonb_array_elements(coalesce((select auth.jwt())->'amr', '[]'::jsonb)) a where a->>'method' = 'password')
     and exists (select 1 from public.admin_verified v where v.session_id = ((select auth.jwt())->>'session_id')::uuid
                 and v.user_id = (select auth.uid()) and v.expires_at > now());
$$;
