create table if not exists public.daily_digest_notifications (
  id uuid primary key default gen_random_uuid(),
  digest_date date not null,
  recipient_email text not null,
  status text not null check (status in ('sending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (digest_date, recipient_email)
);

alter table public.daily_digest_notifications enable row level security;
revoke all on public.daily_digest_notifications from anon, authenticated;
grant select, insert, update on public.daily_digest_notifications to service_role;

create index if not exists daily_digest_notifications_created_at_idx
  on public.daily_digest_notifications(created_at desc);
