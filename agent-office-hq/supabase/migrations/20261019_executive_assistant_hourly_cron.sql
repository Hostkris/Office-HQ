-- Hourly weekday scheduling is opt-in per owner/company and always read-only.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create table if not exists public.hq_exec_email_cron_secret (
 id boolean primary key default true check(id=true),
 secret text not null check(length(secret)=64)
);
alter table public.hq_exec_email_cron_secret enable row level security;
revoke all on public.hq_exec_email_cron_secret from public,anon,authenticated;
grant all on public.hq_exec_email_cron_secret to service_role;
insert into public.hq_exec_email_cron_secret(id,secret)
 values(true,encode(gen_random_bytes(32),'hex')) on conflict(id) do nothing;
select cron.schedule(
 'office-hq-executive-assistant-hourly',
 '0 * * * *',
 $job$
 select net.http_post(
  url:='https://wvadoqncgrmfsftefuoy.supabase.co/functions/v1/office-executive-inbox',
  headers:=jsonb_build_object('Content-Type','application/json','x-office-cron-key',
    (select secret from public.hq_exec_email_cron_secret where id=true)),
  body:='{"action":"cron"}'::jsonb,
  timeout_milliseconds:=30000
 );
 $job$
);
