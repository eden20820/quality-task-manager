create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  notes text,
  reminder_date date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminders_reminder_date_idx on public.reminders(reminder_date);
alter table public.reminders enable row level security;

create policy "Active users can read reminders" on public.reminders for select to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_active));
create policy "Active users can create reminders" on public.reminders for insert to authenticated
with check (created_by = auth.uid() and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_active));
create policy "Active users can delete reminders" on public.reminders for delete to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_active));

alter publication supabase_realtime add table public.reminders;
