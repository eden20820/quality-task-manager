alter table public.quality_followups
  add column if not exists alerts_enabled boolean not null default true;
