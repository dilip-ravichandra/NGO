-- Donations: direct-UPI claims, offline gifts, verification and receipt numbers.
-- Run once, after schema.sql and admin-email-2step.sql: Supabase -> SQL Editor -> paste -> Run.
-- Rule kept from schema.sql: the browser can never create or edit a donation directly. Everything goes through the functions below.

alter table public.donations
  add column if not exists utr    text,                              -- 12-digit UPI reference typed by the donor
  add column if not exists source text not null default 'GATEWAY' check (source in ('GATEWAY','UPI_DIRECT','OFFLINE')),
  add column if not exists note   text check (char_length(note) <= 300);
create unique index if not exists donations_utr_unique on public.donations (utr) where utr is not null;   -- one reference, one claim
create sequence if not exists public.receipt_seq;

create or replace function public.next_receipt_no() returns text language sql security definer set search_path = '' as $$
  select 'GIGF/' || case when extract(month from now()) >= 4 then extract(year from now())::int else extract(year from now())::int - 1 end
         || '-' || lpad(((case when extract(month from now()) >= 4 then extract(year from now())::int + 1 else extract(year from now())::int end) % 100)::text, 2, '0')
         || '/' || lpad(nextval('public.receipt_seq')::text, 5, '0');
$$;
revoke execute on function public.next_receipt_no() from public, anon, authenticated;

-- A signed-in donor says "I paid by UPI". It stays PENDING until staff check the bank statement.
create or replace function public.submit_upi_donation(p_program text, p_amount numeric, p_utr text, p_name text, p_phone text, p_pan text)
returns public.donations language plpgsql security definer set search_path = '' as $$
declare r public.donations; mail text;
begin
  select email into mail from public.profiles where id = auth.uid();
  if mail is null then raise exception 'please log in'; end if;
  if p_amount is null or p_amount < 10 or p_amount > 500000 then raise exception 'amount out of range'; end if;
  if p_utr !~ '^[0-9]{12}$' then raise exception 'the UPI reference has 12 digits'; end if;
  if (select count(*) from public.donations where user_id = auth.uid() and status = 'PENDING') >= 5 then raise exception 'too many payments are still waiting to be checked'; end if;
  insert into public.donations (user_id, donor_name, donor_email, donor_phone, donor_pan, program, amount, method, status, utr, source)
  values (auth.uid(), left(coalesce(p_name,''), 80), mail, left(p_phone, 20), left(p_pan, 10), left(p_program, 80), p_amount, 'UPI direct', 'PENDING', p_utr, 'UPI_DIRECT')
  returning * into r;
  return r;
end $$;
revoke execute on function public.submit_upi_donation(text, numeric, text, text, text, text) from public, anon;
grant execute on function public.submit_upi_donation(text, numeric, text, text, text, text) to authenticated;

-- Staff: record a cash / cheque / bank gift and issue its receipt.
create or replace function public.add_offline_donation(p_name text, p_email text, p_phone text, p_program text, p_amount numeric, p_method text, p_note text)
returns public.donations language plpgsql security definer set search_path = '' as $$
declare r public.donations;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount missing'; end if;
  insert into public.donations (donor_name, donor_email, donor_phone, program, amount, method, status, source, note, receipt_no)
  values (left(p_name, 80), left(coalesce(p_email,''), 254), left(p_phone, 20), left(p_program, 80), p_amount, left(p_method, 40), 'CAPTURED', 'OFFLINE', left(p_note, 300), public.next_receipt_no())
  returning * into r;
  return r;
end $$;
revoke execute on function public.add_offline_donation(text, text, text, text, numeric, text, text) from public, anon;
grant execute on function public.add_offline_donation(text, text, text, text, numeric, text, text) to authenticated;

-- Staff: after checking the bank statement, confirm or reject a pending payment.
create or replace function public.verify_donation(target uuid, ok boolean)
returns public.donations language plpgsql security definer set search_path = '' as $$
declare r public.donations;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.donations set status = case when ok then 'CAPTURED' else 'FAILED' end,
         receipt_no = case when ok then coalesce(receipt_no, public.next_receipt_no()) else receipt_no end
  where id = target and status = 'PENDING' returning * into r;
  if r.id is null then raise exception 'this payment is no longer pending'; end if;
  return r;
end $$;
revoke execute on function public.verify_donation(uuid, boolean) from public, anon;
grant execute on function public.verify_donation(uuid, boolean) to authenticated;
