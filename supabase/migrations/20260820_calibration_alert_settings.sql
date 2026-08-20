create table if not exists public.portal_settings (
  id text primary key check (id = 'global'),
  calibration_alerts_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.portal_settings (id, calibration_alerts_enabled)
values ('global', true)
on conflict (id) do nothing;

alter table public.portal_settings enable row level security;

create index if not exists portal_settings_updated_by_idx
on public.portal_settings (updated_by);

grant select, update on public.portal_settings to authenticated;

create policy "Active users can read portal settings"
on public.portal_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_active
  )
);

create policy "Active users can update portal settings"
on public.portal_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_active
  )
)
with check (
  id = 'global'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_active
  )
);
