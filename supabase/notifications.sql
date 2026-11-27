-- Automatic e-mails. Run once, after schema.sql, admin-email-2step.sql, volunteers.sql and donations.sql.
-- 1) Run this file.  2) Deploy the function in supabase/functions/send-notifications and set its secrets.
-- 3) Run the schedule at the bottom with your own values.
-- Covers what is stored in the database: donations (UPI and offline) and volunteers. Messages and event registrations are not in the database yet.

create table if not exists public.notification_queue (
  id bigint generated always as identity primary key,
  to_email text not null, subject text not null, body text not null,
  created_at timestamptz not null default now(), sent_at timestamptz, attempts int not null default 0, last_error text
);
alter table public.notification_queue enable row level security;
revoke all on public.notification_queue from anon, authenticated;   -- only the database triggers and the server function touch it

create or replace function public.notify(to_email text, subject text, body text) returns void language sql security definer set search_path = '' as $$
  insert into public.notification_queue (to_email, subject, body)
  select $1, $2, $3 where $1 is not null and $1 <> ''
    and (select count(*) from public.notification_queue q where q.to_email = $1 and q.created_at > now() - interval '1 day') < 30;   -- no flooding
$$;
revoke execute on function public.notify(text, text, text) from public, anon, authenticated;

create or replace function public.on_donation_notify() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.source = 'UPI_DIRECT' then
    perform public.notify('ADMIN', 'UPI payment to verify', 'A donor reports a UPI payment of Rs ' || new.amount || ' (reference ' || coalesce(new.utr,'-') || '). Check the bank statement, then verify it in the admin portal.');
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'CAPTURED' then
      perform public.notify(new.donor_email, 'Donation receipt ' || coalesce(new.receipt_no,''), 'Namaste ' || new.donor_name || ', thank you for your donation of Rs ' || new.amount || '. Receipt number: ' || coalesce(new.receipt_no,'-') || '.');
    end if;
  elsif new.status = 'CAPTURED' and old.status is distinct from 'CAPTURED' then
    perform public.notify(new.donor_email, 'Donation receipt ' || coalesce(new.receipt_no,''), 'Namaste ' || new.donor_name || ', thank you for your donation of Rs ' || new.amount || '. Receipt number: ' || coalesce(new.receipt_no,'-') || '. You can download it from your dashboard.');
  elsif new.status = 'FAILED' and old.status is distinct from 'FAILED' then
    perform public.notify(new.donor_email, 'We could not confirm your payment', 'Namaste ' || new.donor_name || ', we could not find your payment of Rs ' || new.amount || ' in our account. If money left your bank, please contact us with the reference.');
  end if;
  return null;
end $$;
drop trigger if exists donation_notify on public.donations;
create trigger donation_notify after insert or update on public.donations for each row execute function public.on_donation_notify();

create or replace function public.on_volunteer_notify() returns trigger language plpgsql security definer set search_path = '' as $$
declare mail text;
begin
  -- self-applicants are written to at their verified account address, not at whatever was typed in the form
  select email into mail from public.profiles where id = new.user_id;
  mail := coalesce(mail, new.email);
  if tg_op = 'INSERT' then
    if new.status = 'PENDING' then
      perform public.notify('ADMIN', 'New volunteer application', 'A new volunteer application (' || new.badge || ') is waiting in the admin portal.');
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'APPROVED' then
      perform public.notify(mail, 'Your volunteer application is approved', 'Namaste ' || new.name || ', your application is approved. Your volunteer ID is ' || new.badge || '. Welcome to the team!');
    elsif new.status = 'REJECTED' then
      perform public.notify(mail, 'Your volunteer application', 'Namaste ' || new.name || ', thank you for applying. We are not able to approve the application at this time.' || coalesce(' Reason: ' || new.reason, ''));
    end if;
  elsif jsonb_array_length(new.tasks) > jsonb_array_length(old.tasks) then
    perform public.notify(mail, 'A volunteer task for you', 'Namaste ' || new.name || ', a new task is waiting in your dashboard.');
  end if;
  return null;
end $$;
drop trigger if exists volunteer_notify on public.volunteers;
create trigger volunteer_notify after insert or update on public.volunteers for each row execute function public.on_volunteer_notify();

-- ---------- schedule (every 5 minutes). Turn on extensions pg_cron and pg_net first, then replace the two values and run: ----------
-- select cron.schedule('send-notifications', '*/5 * * * *', $$
--   select net.http_post(
--     url := 'https://hbnwugmdivvjoebevbgv.supabase.co/functions/v1/send-notifications',
--     headers := jsonb_build_object('x-cron-secret', 'PUT-YOUR-CRON_SECRET-HERE', 'Authorization', 'Bearer PUT-YOUR-PUBLISHABLE-OR-ANON-KEY-HERE', 'Content-Type', 'application/json'),
--     body := '{}'::jsonb);
-- $$);
