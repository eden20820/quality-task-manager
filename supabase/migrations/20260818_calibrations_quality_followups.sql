create table if not exists public.calibration_items (
  id uuid primary key default gen_random_uuid(),
  equipment_name text not null check (char_length(trim(equipment_name)) between 1 and 200),
  equipment_code text,
  serial_number text,
  location text,
  next_calibration_date date not null,
  notes text,
  source_file_name text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calibration_items_next_date_idx
  on public.calibration_items(next_calibration_date asc);

alter table public.calibration_items enable row level security;
grant select, insert, update, delete on public.calibration_items to authenticated;

create policy "Active users can read calibration items" on public.calibration_items
for select to authenticated using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
create policy "Active users can add calibration items" on public.calibration_items
for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
create policy "Active users can update calibration items" on public.calibration_items
for update to authenticated using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
create policy "Active users can delete calibration items" on public.calibration_items
for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create table if not exists public.quality_followups (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('pka', 'nonconformity', 'eco')),
  reference_number text not null check (char_length(trim(reference_number)) between 1 and 100),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at date not null default current_date,
  closed_at date,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, reference_number)
);

create index if not exists quality_followups_status_opened_idx
  on public.quality_followups(status, opened_at asc);

alter table public.quality_followups enable row level security;
grant select, insert, update, delete on public.quality_followups to authenticated;

create policy "Active users can read quality followups" on public.quality_followups
for select to authenticated using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
create policy "Active users can add quality followups" on public.quality_followups
for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
create policy "Active users can update quality followups" on public.quality_followups
for update to authenticated using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
create policy "Active users can delete quality followups" on public.quality_followups
for delete to authenticated using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
