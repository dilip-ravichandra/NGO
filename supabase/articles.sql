-- Scheduled articles and news become public only when their time arrives (checked by the database, India time).
-- Run once, after schema.sql and admin-email-2step.sql: Supabase -> SQL Editor -> paste -> Run.
do $$ declare t text; begin
  foreach t in array array['articles','news'] loop
    execute format('drop policy if exists "read published" on public.%I', t);
    execute format($p$create policy "read published" on public.%I for select using (
      status = 'PUBLISHED'
      or (status = 'SCHEDULED' and data->>'publishAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}'
          and ((data->>'publishAt')::timestamp at time zone 'Asia/Kolkata') <= now())
      or public.is_admin())$p$, t);
  end loop;
end $$;
