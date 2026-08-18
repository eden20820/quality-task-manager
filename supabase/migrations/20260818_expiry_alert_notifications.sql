create table if not exists public.expiry_alert_notifications (
  id uuid primary key default gen_random_uuid(),
  expiry_date date not null,
  recipient_email text not null,
  status text not null check (status in ('sending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expiry_date, recipient_email)
);

alter table public.expiry_alert_notifications enable row level security;
revoke all on public.expiry_alert_notifications from anon, authenticated;
grant select, insert, update on public.expiry_alert_notifications to service_role;

create index if not exists expiry_alert_notifications_created_at_idx
  on public.expiry_alert_notifications(created_at desc);

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'quality-scheduled-emails') then
    perform cron.unschedule('quality-scheduled-emails');
  end if;
end $$;

select cron.schedule(
  'quality-scheduled-emails',
  '0 * * * *',
  $schedule$
  select net.http_get(
    url := 'https://quality-task-manager-9a7n.vercel.app/api/cron/daily-digest',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'quality_cron_secret' limit 1),
        ''
      )
    ),
    timeout_milliseconds := 30000
  );
  $schedule$
);
