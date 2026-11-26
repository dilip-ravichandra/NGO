-- Green India Gokul Foundation - database and access rules for Supabase.
-- Run once in a NEW project: Dashboard -> SQL Editor -> paste -> Run.
-- Every table has Row Level Security: the browser is never trusted for roles, ownership, status or money.

-- ---------- people ----------
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null default '' check (char_length(name) <= 80),
  email      text not null,
  phone      text check (phone ~ '^[0-9]{10}$'),
  role       text not null default 'REGISTERED_USER' check (role in ('REGISTERED_USER','DONOR','VOLUNTEER','ADMIN','SUPER_ADMIN')),
  locale     text not null default 'en' check (locale in ('en','kn','hi','ta','te','ml')),
  created_at timestamptz not null default now()
);
create unique index profiles_phone_unique on public.profiles (phone) where phone is not null;   -- one account per mobile

-- A profile is created for every new login (e-mail or Google). The visitor can never choose an admin role.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare ph text := nullif(right(regexp_replace(coalesce(new.raw_user_meta_data->>'phone',''), '\D', '', 'g'), 10), '');
        wanted text := upper(coalesce(new.raw_user_meta_data->>'role',''));
begin
  insert into public.profiles (id, name, email, phone, role)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), 80),
          new.email,
          case when char_length(ph) = 10 then ph end,
          case when wanted in ('DONOR','VOLUNTEER') then wanted else 'REGISTERED_USER' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Admin rights need the admin role AND a two-factor (aal2) session.
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
     and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('ADMIN','SUPER_ADMIN'));
$$;

-- ---------- website content (same shapes the site uses, kept in "data") ----------
create table public.programs     (id text primary key default gen_random_uuid()::text, status text not null default 'PUBLISHED', data jsonb not null, created_at timestamptz not null default now());
create table public.events       (like public.programs including all);
create table public.news         (like public.programs including all);
create table public.articles     (like public.programs including all);
create table public.gallery      (like public.programs including all);
create table public.testimonials (like public.programs including all);

create table public.site_settings (id int primary key default 1 check (id = 1), public_data jsonb not null default '{}', private_data jsonb not null default '{}');
insert into public.site_settings (id) values (1);

-- ---------- records from visitors ----------
create sequence public.ticket_seq;
create sequence public.badge_seq;

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete set null,
  donor_name text not null, donor_email text not null, donor_phone text, donor_pan text,
  program text not null, amount numeric(12,2) not null check (amount > 0),
  frequency text not null default 'ONE_TIME' check (frequency in ('ONE_TIME','MONTHLY')),
  method text, status text not null default 'PENDING' check (status in ('PENDING','CAPTURED','FAILED','REFUNDED')),
  order_id text unique, payment_id text unique, receipt_no text unique,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.volunteers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references public.profiles on delete cascade,
  badge text not null unique default 'GIGF-VOL-' || lpad(nextval('public.badge_seq')::text, 4, '0'),
  city text check (char_length(city) <= 80), domain text check (char_length(domain) <= 80),
  id_type text check (char_length(id_type) <= 40),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  hours numeric not null default 0, attendance jsonb not null default '[]', tasks jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  guests int not null default 1 check (guests between 1 and 10),
  as_volunteer boolean not null default false, attended boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  no text not null unique default 'TKT-' || lpad(nextval('public.ticket_seq')::text, 4, '0'),
  user_id uuid default auth.uid() references public.profiles on delete set null,
  category text not null check (category in ('CONTACT','CHAT_ESCALATION','PAYMENT_ISSUE')),
  name text not null check (char_length(name) <= 80), email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 20), subject text check (char_length(subject) <= 200),
  message text not null check (char_length(message) <= 4000),
  donation_id uuid references public.donations on delete set null,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED')),
  replies jsonb not null default '[]',
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.ticket_notes (ticket_id uuid primary key references public.tickets on delete cascade, notes jsonb not null default '[]', ai jsonb);   -- staff only

create table public.subscribers (email text primary key check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' and char_length(email) <= 254), created_at timestamptz not null default now());

create table public.audit_log (id bigint generated always as identity primary key, at timestamptz not null default now(), actor uuid, action text not null, entity text not null, entity_id text);

-- ---------- tamper-proof audit trail ----------
create function public.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  insert into public.audit_log (actor, action, entity, entity_id) values (auth.uid(), tg_op, tg_table_name, r->>'id');
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','donations','volunteers','tickets','events','news','articles','programs','gallery','testimonials','site_settings'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_change()', t);
  end loop;
end $$;

-- ---------- row level security ----------
do $$ declare t text; begin
  foreach t in array array['profiles','programs','events','news','articles','gallery','testimonials','site_settings','donations','volunteers','registrations','tickets','ticket_notes','subscribers','audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
  foreach t in array array['programs','events','news','articles','gallery','testimonials'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "read published" on public.%I for select using (status <> ''DRAFT'' or public.is_admin())', t);
    execute format('create policy "admin writes" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- profiles: see and edit only yourself; the role column is not editable from the browser
grant select on public.profiles to authenticated;
grant update (name, phone, locale) on public.profiles to authenticated;
create policy "own or admin read" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "own update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function public.set_role(target uuid, new_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() or not exists (select 1 from public.profiles where id = auth.uid() and role = 'SUPER_ADMIN') then raise exception 'not allowed'; end if;
  update public.profiles set role = new_role where id = target;
end $$;
revoke execute on function public.set_role(uuid, text) from public, anon;
grant execute on function public.set_role(uuid, text) to authenticated;

-- public numbers are readable by all; private settings are not (column grant)
grant select (id, public_data) on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
create policy "read" on public.site_settings for select using (true);
create policy "admin update" on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create function public.private_settings() returns jsonb language sql stable security definer set search_path = '' as $$
  select private_data from public.site_settings where id = 1 and public.is_admin();
$$;

-- donations: NO insert from the browser. Only the server (service key) writes them, after verifying the payment gateway.
grant select, update on public.donations to authenticated;
create policy "own or admin read" on public.donations for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "admin update" on public.donations for update to authenticated using (public.is_admin()) with check (public.is_admin());
create function public.stop_monthly(donation uuid) returns void language sql security definer set search_path = '' as $$
  update public.donations set cancelled = true where id = donation and user_id = auth.uid() and frequency = 'MONTHLY';
$$;
revoke execute on function public.stop_monthly(uuid) from public, anon;
grant execute on function public.stop_monthly(uuid) to authenticated;

-- volunteers: apply for yourself only; status, hours and badge are decided by staff
grant select, update on public.volunteers to authenticated;
grant insert (city, domain, id_type) on public.volunteers to authenticated;
create policy "own or admin read" on public.volunteers for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "apply for self" on public.volunteers for insert to authenticated with check (user_id = (select auth.uid()));
create policy "admin update" on public.volunteers for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, update, delete on public.registrations to authenticated;
grant insert (event_id, guests, as_volunteer) on public.registrations to authenticated;
create policy "own or admin read" on public.registrations for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "register self" on public.registrations for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and e.status = 'UPCOMING'));
create policy "admin update" on public.registrations for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "cancel own" on public.registrations for delete to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- tickets: anyone may send one; only the sender and staff can read it
grant insert (category, name, email, phone, subject, message, donation_id) on public.tickets to anon, authenticated;
grant select, update on public.tickets to authenticated;
create policy "anyone sends" on public.tickets for insert to anon, authenticated with check (
  donation_id is null or exists (select 1 from public.donations d where d.id = donation_id and d.user_id = (select auth.uid())));
create policy "own or admin read" on public.tickets for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "admin update" on public.tickets for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant usage on sequence public.ticket_seq to anon, authenticated;
grant usage on sequence public.badge_seq to authenticated;

grant select, insert, update, delete on public.ticket_notes to authenticated;
create policy "staff only" on public.ticket_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant insert (email) on public.subscribers to anon, authenticated;
grant select, delete on public.subscribers to authenticated;
create policy "anyone subscribes" on public.subscribers for insert to anon, authenticated with check (true);
create policy "admin read" on public.subscribers for select to authenticated using (public.is_admin());
create policy "admin delete" on public.subscribers for delete to authenticated using (public.is_admin());

grant select on public.audit_log to authenticated;
create policy "admin read" on public.audit_log for select to authenticated using (public.is_admin());

-- ---------- after you have signed up on the website once, make yourself the first admin ----------
-- update public.profiles set role = 'SUPER_ADMIN' where email = 'YOUR-EMAIL';
