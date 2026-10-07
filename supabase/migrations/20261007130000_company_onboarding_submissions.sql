create table if not exists public.company_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  status text not null default 'new' check (status in ('new', 'reviewing', 'qualified', 'converted', 'archived')),
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  source_fingerprint text,
  answers jsonb not null default '{}'::jsonb,
  internal_notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_onboarding_submissions_status_idx
  on public.company_onboarding_submissions (status, submitted_at desc);

create index if not exists company_onboarding_submissions_rate_limit_idx
  on public.company_onboarding_submissions (source_fingerprint, submitted_at desc);

alter table public.company_onboarding_submissions enable row level security;

revoke all on public.company_onboarding_submissions from anon, authenticated;

comment on table public.company_onboarding_submissions is
  'Public company onboarding questionnaires. Inserts are performed only by a server action using the service role.';
